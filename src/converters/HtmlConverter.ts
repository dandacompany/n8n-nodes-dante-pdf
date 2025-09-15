import { BaseConverter } from './BaseConverter';
import { ConversionInput, HtmlOptions } from '../types';
import { createError } from '../utils/errors';
import { BrowserSetup } from '../utils/browserSetup';
import { Browser, Page } from 'playwright-core';

export class HtmlConverter extends BaseConverter<HtmlOptions> {
  private browser: Browser | null = null;

  constructor() {
    super('HtmlConverter', 50 * 1024 * 1024, ['.html', '.htm']);
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
        const browserResult = await BrowserSetup.createOptimizedBrowser({
          headless: true,
          timeout: 30000,
          useSystemChrome: true,
        });
        this.browser = browserResult.browser;
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
    // Ensure proper encoding and add Korean font support
    const enhancedHtml = this.enhanceHtmlWithKoreanSupport(html);
    
    // Set content
    const waitUntilOption =
      options.waitUntil === 'networkidle0' || options.waitUntil === 'networkidle2'
        ? 'networkidle'
        : options.waitUntil || 'networkidle';

    await page.setContent(enhancedHtml, {
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
    // Wait for fonts to load
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    // Additional wait for web fonts
    await page.waitForTimeout(1000);

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
        pdfOptions.headerTemplate =
          '<div style="font-size: 10px; text-align: center; width: 100%;"></div>';
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
      A3: { width: 1123, height: 1587 },
      A4: { width: 794, height: 1123 },
      A5: { width: 559, height: 794 },
      Letter: { width: 816, height: 1056 },
      Legal: { width: 816, height: 1344 },
      Tabloid: { width: 1056, height: 1632 },
    };

    return sizes[format] || { width: 794, height: 1123 }; // Default to A4
  }

  private enhanceHtmlWithKoreanSupport(html: string): string {
    // Check if HTML already has proper meta tags and CSS
    const hasCharset = /<meta[^>]*charset/i.test(html);
    const hasViewport = /<meta[^>]*viewport/i.test(html);
    const hasHtmlTag = /<html/i.test(html);
    const hasHeadTag = /<head/i.test(html);
    const hasBodyTag = /<body/i.test(html);

    // Korean font CSS
    const koreanFontStyle = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        
        * {
          font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 
                       'Helvetica Neue', Arial, sans-serif !important;
        }
        
        body {
          font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 
                       'Helvetica Neue', Arial, sans-serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        pre, code {
          font-family: 'Noto Sans Mono CJK KR', 'D2Coding', Consolas, Monaco, monospace !important;
        }
      </style>
    `;

    // Build enhanced HTML
    let enhancedHtml = html;

    if (!hasHtmlTag) {
      // Wrap content in proper HTML structure
      enhancedHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${koreanFontStyle}
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;
    } else {
      // Add meta tags and styles to existing HTML
      if (!hasCharset) {
        enhancedHtml = enhancedHtml.replace(
          /<head[^>]*>/i,
          '$&\n<meta charset="UTF-8">'
        );
      }

      if (!hasViewport) {
        enhancedHtml = enhancedHtml.replace(
          /<head[^>]*>/i,
          '$&\n<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        );
      }

      // Add Korean font styles
      if (hasHeadTag) {
        enhancedHtml = enhancedHtml.replace(
          /<\/head>/i,
          `${koreanFontStyle}\n</head>`
        );
      } else {
        enhancedHtml = enhancedHtml.replace(
          /<html[^>]*>/i,
          `$&\n<head>${koreanFontStyle}</head>`
        );
      }

      // Set lang attribute if not present
      enhancedHtml = enhancedHtml.replace(
        /<html(?![^>]*lang)/i,
        '<html lang="ko"'
      );
    }

    return enhancedHtml;
  }
}
