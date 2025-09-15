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
    
    // Quick Alpine detection and Chromium installation - PRIORITY
    try {
      const fs = require('fs');
      const { execSync } = require('child_process');
      
      // Check if we're on Alpine Linux
      if (fs.existsSync('/etc/alpine-release')) {
        console.log('🏔️  [DantePDF] Alpine Linux detected!');
        
        // Check if Chromium is already installed
        try {
          execSync('which chromium-browser || which chromium', { stdio: 'pipe' });
          console.log('✅ [DantePDF] Chromium already installed');
        } catch (e) {
          // Chromium not found, try to install it
          console.log('📦 [DantePDF] Installing Chromium for Alpine Linux...');
          console.log('    Running: apk add --no-cache chromium chromium-chromedriver');
          
          try {
            execSync('apk add --no-cache chromium chromium-chromedriver', { 
              stdio: 'inherit',
              timeout: 180000 
            });
            console.log('✅ [DantePDF] Chromium installed successfully!');
          } catch (installError) {
            console.error('❌ [DantePDF] Failed to auto-install Chromium');
            console.error('');
            console.error('================================================================================');
            console.error('⚠️  IMPORTANT: Manual Chromium installation required for Alpine Linux');
            console.error('================================================================================');
            console.error('');
            console.error('Please run this command in your container:');
            console.error('');
            console.error('    apk add --no-cache chromium chromium-chromedriver');
            console.error('');
            console.error('Or add to your Dockerfile:');
            console.error('    RUN apk add --no-cache chromium chromium-chromedriver');
            console.error('');
            console.error('================================================================================');
            console.error('');
            // Don't return here, continue with other setup
          }
        }
      }
    } catch (error) {
      console.log('📋 [DantePDF] Platform detection:', error.message);
    }
    
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

    // Additional system info logging (Alpine already handled above)

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

    // Installation summary
    console.log('\n📊 [DantePDF] Installation Summary:');
    console.log(`    Platform: ${systemInfo.platform}/${systemInfo.distro}`);
    console.log(`    Dependencies: ${installResult.success ? '✅ Installed' : '⚠️  Partial'}`);
    console.log(`    Browser: ${await checkBrowserAvailable() ? '✅ Ready' : '⚠️  Will setup on first use'}`);
    console.log('\n🎉 [DantePDF] Setup completed! The node is ready for use.');

    // Platform-specific guidance
    if (!installResult.success) {
      console.log('\n💡 [DantePDF] Manual installation guidance:');
      
      if (systemInfo.platform === 'linux') {
        if (systemInfo.distro === 'alpine') {
          console.log('    For Alpine Linux:');
          console.log('    apk add --no-cache gcompat libstdc++ chromium ttf-liberation fontconfig');
        } else if (systemInfo.distro === 'debian') {
          console.log('    For Debian/Ubuntu:');
          console.log('    sudo apt-get update && sudo apt-get install -y libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2');
        }
      } else if (systemInfo.platform === 'win32') {
        console.log('    For Windows:');
        console.log('    Install Visual C++ Redistributable and consider using Chocolatey for dependencies');
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
    const { chromium } = require('playwright-core');
    const executablePath = chromium.executablePath();
    return fs.existsSync(executablePath);
  } catch (error) {
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