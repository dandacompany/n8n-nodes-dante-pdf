import { BaseConverter } from './BaseConverter';
import { ConversionInput, HtmlOptions } from '../types';
import { createError } from '../utils/errors';
import { BrowserInstaller } from '../utils/BrowserInstaller';
import { chromium, Browser, Page } from 'playwright-core';

export class HtmlConverter extends BaseConverter<HtmlOptions> {
  private browserInstaller: BrowserInstaller;
  private browser: Browser | null = null;

  constructor() {
    super('HtmlConverter', 50 * 1024 * 1024, ['.html', '.htm']);
    this.browserInstaller = BrowserInstaller.getInstance();
  }

  override async initialize(): Promise<void> {
    this.logger.info('HtmlConverter initialized (Playwright-based)');
    // Browser installation will be handled during actual conversion
  }

  override async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.logger.info('HtmlConverter cleanup completed');
  }

  async convert(input: ConversionInput<HtmlOptions>): Promise<Buffer> {
    let page: Page | null = null;
    
    try {
      const options = input.options || {};
      
      // Launch browser if not already launched
      if (!this.browser) {
        this.browser = await this.launchBrowser(options);
      }

      // Create a new page
      page = await this.browser.newPage();

      // Set viewport if specified
      if (options.format) {
        const viewport = this.getViewportSize(options.format);
        await page.setViewportSize(viewport);
      }

      // Load content or URL
      if (input.url) {
        await this.loadUrl(page, input.url, options);
      } else {
        const htmlContent = this.getContent(input);
        await this.loadHtml(page, htmlContent, options);
      }

      // Generate PDF with options
      const pdfBuffer = await this.generatePdf(page, options);

      return pdfBuffer;
    } catch (error) {
      this.logger.error('HTML conversion failed:', error);

      if (error instanceof Error) {
        throw createError.conversionFailed(error.message);
      }
      throw createError.conversionFailed('Failed to convert HTML to PDF');
    } finally {
      // Close the page
      if (page) {
        await page.close();
      }
    }
  }

  private async launchBrowser(options: HtmlOptions): Promise<Browser> {
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-speech-api',
        '--disable-sync',
        '--disable-tab-for-desktop-share',
        '--disable-translate',
        '--disable-voice-input',
        '--disable-wake-on-wifi',
        '--enable-async-dns',
        '--enable-simple-cache-backend',
        '--enable-tcp-fast-open',
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding',
        '--disable-accelerated-mjpeg-decode',
        '--disable-accelerated-video-decode',
        '--disable-accelerated-video-encode',
        '--disable-app-list-dismiss-on-blur',
        '--disable-auto-reload',
        '--no-pings',
        '--media-cache-size=33554432',
        '--aggressive-cache-discard',
        '--use-simple-cache-backend=on'
      ],
    };

    // Add proxy if specified
    if (options.credentials) {
      launchOptions.proxy = {
        username: options.credentials.username,
        password: options.credentials.password,
      };
    }

    // Set ignore HTTPS errors
    if (options.ignoreHTTPSErrors) {
      launchOptions.ignoreHTTPSErrors = true;
    }

    // First, ensure browser is installed before attempting to launch
    try {
      await this.browserInstaller.ensureBrowserInstalled();
    } catch (installError) {
      this.logger.warn('Browser installation failed, but proceeding with launch attempt:', installError);
    }

    // Try to launch browser
    try {
      return await chromium.launch(launchOptions);
    } catch (error) {
      this.logger.error('Browser launch failed:', error);
      
      const errorMessage = (error as Error).message;
      
      // Check for specific system library errors
      if (errorMessage.includes('symbol not found') || errorMessage.includes('g_object_notify') || errorMessage.includes('atk_get_version')) {
        throw new Error(`Browser launch failed due to missing system libraries. Please install required dependencies:

For Ubuntu/Debian:
sudo apt-get update && sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libgtk-3-0 libglib2.0-0 libasound2

For Alpine:
apk add --no-cache nss atk-bridge gtk+3.0 glib alsa-lib

For other systems:
npx playwright-core install-deps chromium

Original error: ${errorMessage}`);
      }
      
      throw new Error(`Browser launch failed: ${errorMessage}. Please ensure Playwright browsers and system dependencies are installed.`);
    }
  }

  private async loadUrl(page: Page, url: string, options: HtmlOptions): Promise<void> {
    const navigationOptions: any = {
      waitUntil: options.waitUntil || 'networkidle',
      timeout: 30000,
    };

    // Add HTTP credentials if provided
    if (options.credentials) {
      await page.context().setHTTPCredentials({
        username: options.credentials.username,
        password: options.credentials.password,
      });
    }

    await page.goto(url, navigationOptions);

    // Execute custom script if provided
    if (options.executeScript) {
      await page.evaluate(options.executeScript);
    }

    // Wait for specific selector or time if specified
    if (options.waitFor) {
      if (options.waitFor.startsWith('#') || options.waitFor.startsWith('.')) {
        // It's a selector
        await page.waitForSelector(options.waitFor, { timeout: 30000 });
      } else if (!isNaN(Number(options.waitFor))) {
        // It's a number (milliseconds)
        await page.waitForTimeout(Number(options.waitFor));
      }
    }
  }

  private async loadHtml(page: Page, html: string, options: HtmlOptions): Promise<void> {
    // Set content
    const waitUntilOption = options.waitUntil === 'networkidle0' || options.waitUntil === 'networkidle2' 
      ? 'networkidle' 
      : (options.waitUntil || 'networkidle');
    
    await page.setContent(html, {
      waitUntil: waitUntilOption as 'load' | 'domcontentloaded' | 'networkidle' | 'commit',
      timeout: 30000,
    });

    // Execute custom script if provided
    if (options.executeScript) {
      await page.evaluate(options.executeScript);
    }

    // Wait for specific selector or time if specified
    if (options.waitFor) {
      if (options.waitFor.startsWith('#') || options.waitFor.startsWith('.')) {
        // It's a selector
        await page.waitForSelector(options.waitFor, { timeout: 30000 });
      } else if (!isNaN(Number(options.waitFor))) {
        // It's a number (milliseconds)
        await page.waitForTimeout(Number(options.waitFor));
      }
    }
  }

  private async generatePdf(page: Page, options: HtmlOptions): Promise<Buffer> {
    const pdfOptions: any = {
      format: options.format || 'A4',
      landscape: options.landscape || false,
      printBackground: options.printBackground !== false,
      scale: options.scale || 1,
      displayHeaderFooter: options.displayHeaderFooter || false,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
    };

    // Add header and footer if specified
    if (options.displayHeaderFooter) {
      pdfOptions.displayHeaderFooter = true;
      
      if (options.headerTemplate) {
        pdfOptions.headerTemplate = options.headerTemplate;
      } else {
        // Default header
        pdfOptions.headerTemplate = '<div style="font-size: 10px; text-align: center; width: 100%;"></div>';
      }

      if (options.footerTemplate) {
        pdfOptions.footerTemplate = options.footerTemplate;
      } else {
        // Default footer with page numbers
        pdfOptions.footerTemplate = `
          <div style="font-size: 10px; text-align: center; width: 100%;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `;
      }
    }

    // Handle page ranges if specified
    if (options.pageRanges) {
      pdfOptions.pageRanges = options.pageRanges;
    }

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);
    
    return pdfBuffer;
  }

  private getViewportSize(format: string): { width: number; height: number } {
    // Common paper sizes in pixels at 96 DPI
    const sizes: { [key: string]: { width: number; height: number } } = {
      'A3': { width: 1123, height: 1587 },
      'A4': { width: 794, height: 1123 },
      'A5': { width: 559, height: 794 },
      'Letter': { width: 816, height: 1056 },
      'Legal': { width: 816, height: 1344 },
      'Tabloid': { width: 1056, height: 1632 },
    };

    return sizes[format] || { width: 794, height: 1123 }; // Default to A4
  }
}