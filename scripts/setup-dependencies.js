#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if we're in development or production
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     fs.existsSync(path.join(__dirname, '..', 'src'));

async function setupDependencies() {
  try {
    // Check if we're in a CI environment or npm install context that shouldn't run postinstall
    if (process.env.CI || process.env.SKIP_POSTINSTALL) {
      console.log('📦 [DantePDF] Skipping postinstall in CI/automated environment');
      return;
    }
    
    console.log('🚀 [DantePDF] Setting up system dependencies for n8n-nodes-dante-pdf...');
    console.log('🌐 [DantePDF] Using system Chrome/Chromium for optimal compatibility');
    
    // System Chrome/Chromium will be used
    
    let SystemDependencyInstaller;
    let BrowserSetup;

    try {
      if (isDevelopment) {
        // Development mode - compile TypeScript first
        console.log('📦 [DantePDF] Development mode detected, compiling TypeScript...');
        
        try {
          const { execSync } = require('child_process');
          execSync('npx tsc -p tsconfig.json', { 
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit' 
          });
          console.log('✅ [DantePDF] TypeScript compilation completed');
        } catch (compileError) {
          console.warn('⚠️  [DantePDF] TypeScript compilation failed, trying to use existing dist...');
        }
      }

      // Try to load the modules
      const distPath = path.join(__dirname, '..', 'dist', 'utils');
      
      if (fs.existsSync(path.join(distPath, 'systemDependencies.js'))) {
        const systemDeps = require(path.join(distPath, 'systemDependencies.js'));
        const browserSetup = require(path.join(distPath, 'browserSetup.js'));
        
        SystemDependencyInstaller = systemDeps.SystemDependencyInstaller;
        BrowserSetup = browserSetup.BrowserSetup;
      } else {
        throw new Error('Compiled modules not found');
      }

    } catch (requireError) {
      console.warn('⚠️  [DantePDF] Could not load dependency modules:', requireError.message);
      console.log('💡 [DantePDF] Dependencies will be installed during first use');
      return;
    }

    // Check system information
    console.log('🔍 [DantePDF] Detecting system configuration...');
    const systemInfo = await SystemDependencyInstaller.detectSystem();
    console.log(`📋 [DantePDF] System: ${systemInfo.platform}/${systemInfo.arch}, Distribution: ${systemInfo.distro}, libc: ${systemInfo.libc}`);
    
    if (systemInfo.isWSL) {
      console.log('🐧 [DantePDF] WSL (Windows Subsystem for Linux) detected');
    }
    
    // Special handling for Alpine Linux
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      console.log('');
      console.log('🏔️  [DantePDF] ========== ALPINE LINUX DETECTED ==========');
      console.log('⚠️  [DantePDF] Alpine Linux requires system Chromium');
      console.log('❌ [DantePDF] Playwright browsers do NOT work on Alpine (musl/glibc incompatibility)');
      console.log('✅ [DantePDF] You MUST install system Chromium instead');
      console.log('');
      console.log('📦 [DantePDF] Please run the following command:');
      console.log('    apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig');
      console.log('');
      console.log('🐳 [DantePDF] For Docker users, add to your Dockerfile:');
      console.log('    RUN apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig');
      console.log('');
      
      // Check if Chromium is already installed
      const chromiumPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser'];
      let chromiumFound = false;
      for (const path of chromiumPaths) {
        if (fs.existsSync(path)) {
          console.log(`✅ [DantePDF] System Chromium found at: ${path}`);
          chromiumFound = true;
          break;
        }
      }
      
      if (!chromiumFound) {
        console.log('❌ [DantePDF] System Chromium NOT found - PDF generation will fail!');
        console.log('⚠️  [DantePDF] Please install Chromium now: apk add --no-cache chromium chromium-chromedriver');
      }
      
      console.log('🏔️  [DantePDF] ==========================================');
      console.log('');
      
      // Skip Playwright installation on Alpine
      console.log('⏭️  [DantePDF] Skipping Playwright browser installation on Alpine');
      return;
    }

    // Install system dependencies
    console.log('📦 [DantePDF] Installing system dependencies...');
    const installResult = await SystemDependencyInstaller.installDependencies();

    if (installResult.success) {
      console.log('✅ [DantePDF] System dependencies installation completed successfully');
      
      if (installResult.installedPackages && installResult.installedPackages.length > 0) {
        console.log(`📋 [DantePDF] Installed packages: ${installResult.installedPackages.join(', ')}`);
      }
      
      if (installResult.failedPackages && installResult.failedPackages.length > 0) {
        console.log(`⚠️  [DantePDF] Failed packages: ${installResult.failedPackages.join(', ')}`);
      }
    } else {
      console.warn('⚠️  [DantePDF] System dependencies installation had issues:');
      console.warn(`    ${installResult.message}`);
      
      if (installResult.failedPackages && installResult.failedPackages.length > 0) {
        console.warn(`    Failed packages: ${installResult.failedPackages.join(', ')}`);
      }
    }

    // Setup browser
    console.log('🌐 [DantePDF] Setting up browser environment...');
    try {
      const browserStatus = await BrowserSetup.getBrowserStatus();
      
      if (browserStatus.available) {
        console.log('✅ [DantePDF] Browser setup completed successfully');
        console.log(`📂 [DantePDF] Browser executable: ${browserStatus.executablePath}`);
        console.log(`⚡ [DantePDF] System optimized: ${browserStatus.systemOptimized ? 'Yes' : 'No'}`);
      } else {
        console.warn('⚠️  [DantePDF] Browser setup failed:');
        console.warn(`    ${browserStatus.error}`);
        console.warn('💡 [DantePDF] Browser installation will be attempted during first use');
      }
    } catch (browserError) {
      console.warn('⚠️  [DantePDF] Browser setup encountered issues:', browserError.message);
      console.warn('💡 [DantePDF] Browser will be configured during first PDF generation');
    }

    // Enhanced browser environment check
    const browserAvailable = await checkBrowserAvailable();
    const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(require('os').homedir(), '.n8n', 'dante-pdf-browsers');
    
    // Installation summary
    console.log('\n📊 [DantePDF] Installation Summary:');
    console.log(`    Platform: ${systemInfo.platform}/${systemInfo.distro} (${systemInfo.libc || 'unknown'})`);
    console.log(`    Dependencies: ${installResult.success ? '✅ Installed' : '⚠️  Partial'}`);
    console.log(`    Chrome/Chromium Browser: ${browserAvailable ? '✅ Ready' : '⚠️  Will install on first use'}`);
    console.log(`    Browser Directory: ${browserPath}`);
    
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      console.log('    Alpine Linux: ✅ System Chromium configuration active');
    }
    
    console.log('\n🎉 [DantePDF] Setup completed! The node is ready for use.');

    // Platform-specific guidance
    if (!installResult.success || !browserAvailable) {
      console.log('\n💡 [DantePDF] Manual installation guidance:');
      
      if (systemInfo.platform === 'linux') {
        if (systemInfo.distro === 'alpine') {
          console.log('    For Alpine Linux:');
          console.log('    apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig');
        } else if (systemInfo.distro === 'debian') {
          console.log('    For Debian/Ubuntu:');
          console.log('    sudo apt-get update && sudo apt-get install -y chromium-browser');
          console.log('    sudo apt-get install -y libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2');
        }
      } else if (systemInfo.platform === 'win32') {
        console.log('    For Windows:');
        console.log('    Install Google Chrome from https://www.google.com/chrome/');
        console.log('    Install Visual C++ Redistributable if needed');
      } else if (systemInfo.platform === 'darwin') {
        console.log('    For macOS:');
        console.log('    Install Chrome from https://www.google.com/chrome/');
      }
      
      if (!browserAvailable) {
        console.log('\n🔥 [DantePDF] Browser Installation Priority:');
        console.log('    1. System Chrome/Chromium (recommended) - install via package manager');
        console.log('    2. Playwright Chrome (fallback) - automatically downloaded');
        console.log('    Note: System Chrome/Chromium is required for Alpine Linux');
      }
    }

  } catch (error) {
    console.error('❌ [DantePDF] Setup failed:', error.message);
    console.log('💡 [DantePDF] Don\'t worry! Dependencies will be installed automatically during first use.');
    
    // Don't fail the npm install process
    process.exit(0);
  }
}

async function checkBrowserAvailable() {
  try {
    // Check Playwright Firefox first (our primary browser)
    const { firefox } = require('playwright-core');
    const firefoxPath = firefox.executablePath();
    
    if (fs.existsSync(firefoxPath)) {
      console.log(`✅ [DantePDF] Playwright Firefox found: ${firefoxPath}`);
      return true;
    }
    
    console.log('⚠️  [DantePDF] Playwright Firefox not found, checking system Firefox...');
    
    // Check system Firefox installations
    const systemFirefoxPaths = [
      '/usr/bin/firefox',
      '/usr/bin/firefox-esr',
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe'
    ];
    
    for (const firefoxPath of systemFirefoxPaths) {
      if (fs.existsSync(firefoxPath)) {
        console.log(`✅ [DantePDF] System Firefox found: ${firefoxPath}`);
        return true;
      }
    }
    
    console.log('⚠️  [DantePDF] No Firefox installation found');
    return false;
  } catch (error) {
    console.log(`⚠️  [DantePDF] Browser check failed: ${error.message}`);
    return false;
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️  [DantePDF] Setup warning:', reason);
  console.log('💡 [DantePDF] Installation will continue - dependencies will be handled during first use');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.warn('⚠️  [DantePDF] Setup encountered an issue:', error.message);
  console.log('💡 [DantePDF] Installation will continue - dependencies will be handled during first use');
  process.exit(0);
});

// Run setup
if (require.main === module) {
  setupDependencies().catch((error) => {
    console.warn('⚠️  [DantePDF] Setup completed with warnings:', error.message);
    console.log('💡 [DantePDF] Node will function normally - dependencies handled during first use');
    process.exit(0);
  });
}

module.exports = { setupDependencies };