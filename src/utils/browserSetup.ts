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
    success: (msg: string) => console.log(`[DantePDF] ✅ ${msg}`)
  };

  static async setupBrowser(options: BrowserSetupOptions = {}): Promise<string> {
    if (this.browserPath && this.systemOptimized) {
      return this.browserPath;
    }

    this.logger.info('Setting up browser environment...');

    // Install system dependencies first
    const installResult = await SystemDependencyInstaller.installDependencies();
    if (installResult.success) {
      this.logger.success('System dependencies installed successfully');
      this.systemOptimized = true;
    } else {
      this.logger.warn(`System dependency installation had issues: ${installResult.message}`);
    }

    const systemInfo = await SystemDependencyInstaller.detectSystem();
    
    // For Alpine Linux, MUST use system Chromium - Playwright browsers are incompatible with musl
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      this.logger.info('Alpine/musl detected - using system Chromium only (Playwright incompatible with musl)');
      options.useSystemChrome = true;
    }
    
    this.browserPath = await this.findOptimalBrowserPath(systemInfo, options);

    return this.browserPath;
  }

  private static async findOptimalBrowserPath(systemInfo: any, options: BrowserSetupOptions): Promise<string> {
    // Try different browser paths based on platform
    const candidatePaths: string[] = [];

    if (systemInfo.platform === 'win32') {
      // Windows paths
      candidatePaths.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      );
    } else if (systemInfo.platform === 'darwin') {
      // macOS paths
      candidatePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      );
    } else if (systemInfo.platform === 'linux') {
      // Linux paths - Alpine paths FIRST for Alpine systems
      if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
        // Alpine-specific paths prioritized
        candidatePaths.push(
          '/usr/bin/chromium-browser',  // Most common Alpine Chromium path
          '/usr/bin/chromium',
          '/usr/lib/chromium/chromium',  // Alternative Alpine location
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome'
        );
      } else {
        candidatePaths.push(
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/snap/bin/chromium',
          '/var/lib/flatpak/app/org.chromium.Chromium/current/active/export/bin/org.chromium.Chromium'
        );
      }
    }

    // For Alpine/musl, ONLY use system browsers
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl' || options.useSystemChrome) {
      this.logger.info('Checking for system Chromium (required for Alpine/musl)...');
      for (const browserPath of candidatePaths) {
        if (fs.existsSync(browserPath)) {
          this.logger.success(`Found system browser: ${browserPath}`);
          return browserPath;
        }
      }
      
      // If no system browser found on Alpine, provide clear error
      if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
        throw new Error('Alpine Linux requires system Chromium. Please install with: apk add chromium chromium-chromedriver');
      }
    }

    // For non-Alpine systems, try Playwright's bundled browser
    if (systemInfo.distro !== 'alpine' && systemInfo.libc !== 'musl') {
      try {
        const playwrightPath = chromium.executablePath();
        if (playwrightPath && fs.existsSync(playwrightPath)) {
          this.logger.success(`Using Playwright browser: ${playwrightPath}`);
          return playwrightPath;
        }
      } catch (error) {
        this.logger.warn(`Playwright browser not found: ${(error as Error).message}`);
      }
    }

    // Try system browsers as final fallback
    for (const browserPath of candidatePaths) {
      if (fs.existsSync(browserPath)) {
        this.logger.success(`Fallback to system browser: ${browserPath}`);
        return browserPath;
      }
    }

    // Provide helpful error message
    if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
      throw new Error('Alpine Linux requires system Chromium. Please install with: apk add chromium chromium-chromedriver');
    }

    throw new Error('No suitable browser found. Please install Chrome, Chromium, or run: npx playwright-core install chromium');
  }

  static async createOptimizedBrowser(options: BrowserSetupOptions = {}): Promise<BrowserLaunchResult> {
    const executablePath = await this.setupBrowser(options);
    const systemInfo = await SystemDependencyInstaller.detectSystem();

    const launchOptions = this.generateLaunchOptions(systemInfo, executablePath, options);

    try {
      this.logger.info(`Launching browser with optimized settings for ${systemInfo.platform}/${systemInfo.distro}...`);
      const browser = await chromium.launch(launchOptions);
      
      this.logger.success('Browser launched successfully');
      return {
        browser,
        executablePath,
        systemOptimized: this.systemOptimized
      };

    } catch (error) {
      this.logger.error(`Browser launch failed: ${(error as Error).message}`);
      
      // Try fallback options
      if (launchOptions.executablePath) {
        this.logger.info('Trying fallback launch without executable path...');
        delete launchOptions.executablePath;
        
        try {
          const browser = await chromium.launch(launchOptions);
          this.logger.success('Browser launched with fallback configuration');
          return {
            browser,
            executablePath: chromium.executablePath(),
            systemOptimized: false
          };
        } catch (fallbackError) {
          this.logger.error(`Fallback launch also failed: ${(fallbackError as Error).message}`);
        }
      }

      throw new Error(`Failed to launch browser: ${(error as Error).message}. Please ensure Chrome/Chromium is properly installed.`);
    }
  }

  private static generateLaunchOptions(systemInfo: any, executablePath: string, options: BrowserSetupOptions): any {
    const launchOptions: any = {
      headless: options.headless !== false,
      executablePath,
      timeout: options.timeout || 30000,
      args: []
    };

    // Base security and performance arguments
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection'
    ];

    // Platform-specific optimizations
    if (systemInfo.platform === 'win32') {
      // Windows optimizations
      launchOptions.args.push(
        ...baseArgs,
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu-sandbox',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--disable-features=site-per-process'
      );

      if (systemInfo.isWSL) {
        // WSL-specific optimizations
        launchOptions.args.push(
          '--virtual-time-budget=5000',
          '--no-zygote',
          '--single-process'
        );
      }

    } else if (systemInfo.platform === 'linux') {
      launchOptions.args.push(...baseArgs);

      if (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl') {
        // Alpine/musl optimizations with complete audio/video disable
        launchOptions.args.push(
          '--no-zygote',
          '--single-process',
          '--disable-features=VizDisplayCompositor',
          '--disable-software-rasterizer',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-speech-api',
          '--disable-sync',
          '--disable-tab-for-desktop-share',
          '--disable-voice-input',
          '--disable-wake-on-wifi',
          '--enable-async-dns',
          '--enable-simple-cache-backend',
          '--enable-tcp-fast-open',
          '--media-cache-size=33554432',
          '--aggressive-cache-discard',
          '--use-simple-cache-backend=on',
          // Complete audio subsystem disable
          '--disable-features=AudioServiceSandbox',
          '--disable-audio-output',
          '--disable-audio-input',
          '--mute-audio',
          '--no-audio',
          '--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox',
          '--disable-web-audio',
          '--disable-speech-synthesis',
          '--disable-speech-dispatcher',
          // Additional Alpine/Docker compatibility
          '--disable-features=UseOzonePlatform',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-features=BlockInsecurePrivateNetworkRequests',
          '--disable-features=OutOfBlinkCors',
          // Force software rendering
          '--use-gl=swiftshader',
          '--disable-gpu-sandbox',
          '--disable-software-rasterizer',
          '--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer',
          // Permissions
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-features=RendererCodeIntegrity'
        );
      } else {
        // Regular Linux optimizations
        launchOptions.args.push(
          '--disable-accelerated-2d-canvas',
          '--disable-accelerated-jpeg-decoding',
          '--disable-accelerated-mjpeg-decode',
          '--disable-accelerated-video-decode',
          '--disable-accelerated-video-encode'
        );
      }

      if (systemInfo.isWSL) {
        // WSL optimizations
        launchOptions.args.push(
          '--virtual-time-budget=5000',
          '--no-zygote',
          '--single-process'
        );
      }

    } else if (systemInfo.platform === 'darwin') {
      // macOS optimizations
      launchOptions.args.push(
        ...baseArgs,
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding'
      );
    }

    // Memory and performance optimizations
    launchOptions.args.push(
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--no-pings',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-hang-monitor'
    );

    // Font and rendering optimizations
    if (systemInfo.platform === 'linux') {
      launchOptions.args.push(
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning'
      );
    }

    return launchOptions;
  }

  static async createOptimizedContext(browser: Browser): Promise<BrowserContext> {
    const systemInfo = await SystemDependencyInstaller.detectSystem();
    
    const contextOptions: any = {
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      acceptDownloads: false,
      ignoreHTTPSErrors: true
    };

    // Platform-specific context optimizations
    if (systemInfo.platform === 'linux' && (systemInfo.distro === 'alpine' || systemInfo.libc === 'musl')) {
      // Alpine-specific context settings
      contextOptions.extraHTTPHeaders = {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate'
      };
    }

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
    error?: string;
  }> {
    try {
      const executablePath = await this.setupBrowser();
      return {
        available: true,
        executablePath,
        systemOptimized: this.systemOptimized
      };
    } catch (error) {
      return {
        available: false,
        systemOptimized: false,
        error: (error as Error).message
      };
    }
  }

  static async cleanup(): Promise<void> {
    this.browserPath = null;
    this.systemOptimized = false;
    this.logger.info('Browser setup cleaned up');
  }
}