import { chromium, Browser, BrowserContext } from 'playwright-core';
import { SystemDependencyInstaller } from './systemDependencies';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BrowserSetupOptions {
  headless?: boolean;
  timeout?: number;
  retryAttempts?: number;
  useSystemChrome?: boolean;
}

export interface BrowserLaunchResult {
  browser: Browser;
  executablePath: string;
  systemOptimized: boolean;
}

export class BrowserSetup {
  private static browserPath: string | null = null;
  private static systemOptimized: boolean = false;
  private static readonly logger = {
    info: (msg: string) => console.log(`[DantePDF] ${msg}`),
    warn: (msg: string) => console.warn(`[DantePDF] ⚠️  ${msg}`),
    error: (msg: string) => console.error(`[DantePDF] ❌ ${msg}`),
    success: (msg: string) => console.log(`[DantePDF] ✅ ${msg}`),
  };

  static async setupBrowser(options: BrowserSetupOptions = {}): Promise<string> {
    if (this.browserPath && this.systemOptimized) {
      return this.browserPath;
    }

    const systemInfo = await SystemDependencyInstaller.detectSystem();

    // Log system info for debugging
    this.logger.info('Setting up browser environment...');
    this.logger.info(
      `System: ${systemInfo.platform}/${systemInfo.arch}, Distribution: ${systemInfo.distro}, libc: ${systemInfo.libc}`
    );

    // Always prefer system Chrome/Chromium
    this.logger.info('Looking for system Chrome/Chromium...');

    // Install system dependencies first
    const installResult = await SystemDependencyInstaller.installDependencies();
    if (installResult.success) {
      this.logger.success('System dependencies installed successfully');
      this.systemOptimized = true;
    } else {
      this.logger.warn(`System dependency installation had issues: ${installResult.message}`);
    }

    this.browserPath = await this.findOptimalBrowserPath(systemInfo, options);

    return this.browserPath;
  }

  private static async findOptimalBrowserPath(
    systemInfo: any,
    options: BrowserSetupOptions
  ): Promise<string> {
    const candidatePaths: string[] = [];

    // Platform-specific system Chrome/Chromium paths
    if (systemInfo.platform === 'win32') {
      candidatePaths.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe'
      );
    } else if (systemInfo.platform === 'darwin') {
      candidatePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      );
    } else if (systemInfo.platform === 'linux') {
      // Linux paths - prioritize system installations
      if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
        // Alpine-specific paths
        candidatePaths.push(
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/lib/chromium/chromium',
          '/usr/lib/chromium-browser/chromium-browser'
        );
      } else {
        // Standard Linux paths
        candidatePaths.push(
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome-beta',
          '/usr/bin/google-chrome-unstable',
          '/snap/bin/chromium',
          '/var/lib/flatpak/app/org.chromium.Chromium/current/active/export/bin/org.chromium.Chromium'
        );
      }
    }

    // First try system Chrome/Chromium
    for (const browserPath of candidatePaths) {
      if (fs.existsSync(browserPath)) {
        this.logger.success(`Found system Chrome/Chromium: ${browserPath}`);
        return browserPath;
      }
    }

    // If system Chrome not found and not on Alpine, try Playwright's bundled Chrome
    if (systemInfo.distro !== 'alpine' && systemInfo.libc !== 'musl') {
      try {
        const playwrightPath = chromium.executablePath();
        if (playwrightPath && fs.existsSync(playwrightPath)) {
          this.logger.warn('System Chrome not found, falling back to Playwright Chrome');
          this.logger.warn('For better performance, install system Chrome');
          return playwrightPath;
        }
      } catch (error) {
        this.logger.warn(`Playwright Chrome not available: ${(error as Error).message}`);
      }
    }

    // Provide helpful error message
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      throw new Error(
        `No Chrome/Chromium browser found on Alpine Linux.\n` +
          `\n` +
          `Please install system Chromium:\n` +
          `  apk add --no-cache chromium chromium-chromedriver\n` +
          `\n` +
          `For Docker users, add this to your Dockerfile:\n` +
          `  RUN apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig\n` +
          `\n` +
          `Note: Playwright bundled Chrome does NOT work on Alpine Linux (musl/glibc incompatibility)`
      );
    } else {
      throw new Error(
        `No Chrome/Chromium browser found.\n` +
          `\n` +
          `Please install Chrome or Chromium:\n` +
          `  - Chrome: https://www.google.com/chrome/\n` +
          `  - Chromium: Use your system package manager\n` +
          `    Ubuntu/Debian: apt install chromium-browser\n` +
          `    Fedora: dnf install chromium\n` +
          `    Arch: pacman -S chromium\n`
      );
    }
  }

  static async createOptimizedBrowser(
    options: BrowserSetupOptions = {}
  ): Promise<BrowserLaunchResult> {
    const systemInfo = await SystemDependencyInstaller.detectSystem();
    let executablePath: string;
    let attempts = 0;
    const maxAttempts = options.retryAttempts || 3;

    while (attempts < maxAttempts) {
      try {
        executablePath = await this.setupBrowser(options);
        break;
      } catch (setupError) {
        attempts++;
        this.logger.warn(
          `Browser setup attempt ${attempts}/${maxAttempts} failed: ${(setupError as Error).message}`
        );

        if (attempts >= maxAttempts) {
          throw setupError;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    const launchOptions = this.generateLaunchOptions(systemInfo, executablePath!, options);
    
    try {
      this.logger.info(`Launching Chrome from: ${executablePath!}`);
      const browser = await chromium.launch(launchOptions);
      
      this.logger.success('Browser launched successfully');
      return {
        browser,
        executablePath: executablePath!,
        systemOptimized: this.systemOptimized,
      };
    } catch (error) {
      const errorMessage = this.generateComprehensiveErrorMessage(systemInfo, executablePath!);
      throw new Error(errorMessage);
    }
  }

  private static generateLaunchOptions(
    systemInfo: any,
    executablePath: string,
    options: BrowserSetupOptions
  ): any {
    const launchOptions: any = {
      headless: options.headless !== false,
      executablePath,
      timeout: options.timeout || 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
      ],
    };

    // Alpine-specific optimizations
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      launchOptions.args.push(
        '--disable-software-rasterizer',
        '--disable-features=VizDisplayCompositor'
      );
    }

    return launchOptions;
  }

  static async createOptimizedContext(browser: Browser): Promise<BrowserContext> {
    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      acceptDownloads: false,
      ignoreHTTPSErrors: true,
    };

    const context = await browser.newContext(contextOptions);

    // Optimize context for PDF generation
    await context.addInitScript(() => {
      // Disable animations
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(style);

      // Optimize fonts
      if ('fonts' in document) {
        (document as any).fonts.ready.then(() => {
          console.log('Fonts loaded');
        });
      }
    });

    return context;
  }

  static async getBrowserStatus(): Promise<{
    available: boolean;
    executablePath?: string;
    systemOptimized: boolean;
    chromeVersion?: string;
    playwrightReady: boolean;
    systemChromeReady: boolean;
    error?: string;
    troubleshooting?: string[];
  }> {
    const systemInfo = await SystemDependencyInstaller.detectSystem();

    try {
      const executablePath = await this.setupBrowser();

      let chromeVersion: string | undefined;
      let playwrightReady = false;
      let systemChromeReady = false;

      // Check Playwright Chrome (not on Alpine)
      if (systemInfo.distro !== 'alpine' && systemInfo.libc !== 'musl') {
        try {
          const playwrightPath = chromium.executablePath();
          if (fs.existsSync(playwrightPath)) {
            playwrightReady = true;
          }
        } catch (e) {
          // Playwright Chrome not available
        }
      }

      // Check system Chrome
      const systemPaths = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
      ];
      for (const chromePath of systemPaths) {
        if (fs.existsSync(chromePath)) {
          systemChromeReady = true;
          break;
        }
      }

      return {
        available: true,
        executablePath,
        systemOptimized: this.systemOptimized,
        ...(chromeVersion && { chromeVersion }),
        playwrightReady,
        systemChromeReady,
      };
    } catch (error) {
      const troubleshooting: string[] = [];

      if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
        troubleshooting.push('Alpine Linux detected. System Chromium is required.');
        troubleshooting.push('Install Chromium: apk add --no-cache chromium chromium-chromedriver');
      } else {
        troubleshooting.push('Install Chrome or Chromium from your package manager');
      }

      return {
        available: false,
        systemOptimized: false,
        playwrightReady: false,
        systemChromeReady: false,
        error: (error as Error).message,
        troubleshooting,
      };
    }
  }

  private static generateComprehensiveErrorMessage(
    systemInfo: any,
    executablePath: string
  ): string {
    const messages: string[] = [
      `Failed to launch Chrome/Chromium browser.`,
      `System: ${systemInfo.platform}/${systemInfo.distro}`,
      `Attempted executable: ${executablePath}`,
      '',
    ];

    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      messages.push('Alpine Linux Troubleshooting:');
      messages.push('1. Install Chromium:');
      messages.push('   apk add --no-cache chromium chromium-chromedriver');
      messages.push('');
      messages.push('2. Install fonts and dependencies:');
      messages.push('   apk add --no-cache ttf-liberation fontconfig');
      messages.push('');
      messages.push('3. Check browser permissions:');
      messages.push('   ls -la /usr/bin/chromium');
    } else {
      messages.push('General Troubleshooting:');
      messages.push('1. Ensure Chrome or Chromium is installed');
      messages.push('2. Check file permissions');
      messages.push('3. Verify system dependencies');
    }

    return messages.join('\n');
  }

  static async cleanup(): Promise<void> {
    this.browserPath = null;
    this.systemOptimized = false;
    this.logger.info('Browser setup cleaned up');
  }
}