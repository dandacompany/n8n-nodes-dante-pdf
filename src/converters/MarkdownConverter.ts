import { marked } from 'marked';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, MarkdownOptions } from '../types';
import { createError } from '../utils/errors';
import { BrowserInstaller } from '../utils/BrowserInstaller';
import { chromium, Browser, Page } from 'playwright-core';

export class MarkdownConverter extends BaseConverter<MarkdownOptions> {
  private browserInstaller: BrowserInstaller;
  private browser: Browser | null = null;

  constructor() {
    super('MarkdownConverter', 10 * 1024 * 1024, ['.md', '.markdown']);
    this.browserInstaller = BrowserInstaller.getInstance();
  }

  override async initialize(): Promise<void> {
    this.logger.info('MarkdownConverter initialized (Playwright-based)');
    // Ensure browser is installed
    await this.browserInstaller.ensureBrowserInstalled();
  }

  override async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.logger.info('MarkdownConverter cleanup completed');
  }

  async convert(input: ConversionInput<MarkdownOptions>): Promise<Buffer> {
    let page: Page | null = null;
    
    try {
      const options = input.options || {};
      
      // Get markdown content
      const markdown = this.getContent(input);

      if (!markdown || markdown.trim().length === 0) {
        throw createError.invalidInput('Markdown content is empty');
      }

      // Convert markdown to HTML with custom renderer for better styling
      const htmlContent = await marked(markdown, {
        breaks: true,
        gfm: true,
      });

      // Create styled HTML document
      const styledHtml = this.createStyledHtml(htmlContent, options);

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

      // Load the styled HTML
      await page.setContent(styledHtml, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Generate PDF with options
      const pdfBuffer = await this.generatePdf(page, options);

      return pdfBuffer;
    } catch (error) {
      this.logger.error('Markdown conversion failed:', error);

      if (error instanceof Error) {
        throw createError.conversionFailed(error.message);
      }
      throw createError.conversionFailed('Unknown error during markdown conversion');
    } finally {
      // Close the page
      if (page) {
        await page.close();
      }
    }
  }

  private createStyledHtml(htmlContent: string, options: MarkdownOptions): string {
    const theme = options.theme || 'default';
    const css = this.getThemeStyles(theme);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>${css}</style>
        </head>
        <body>
          <div class="markdown-body">
            ${htmlContent}
          </div>
        </body>
      </html>
    `;
  }

  private getThemeStyles(theme: string): string {
    const baseStyles = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Noto Sans KR', 'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        padding: 40px;
        background: white;
      }
      
      .markdown-body {
        max-width: 800px;
        margin: 0 auto;
      }
      
      h1, h2, h3, h4, h5, h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
      }
      
      h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      h3 { font-size: 1.25em; }
      h4 { font-size: 1em; }
      h5 { font-size: 0.875em; }
      h6 { font-size: 0.85em; color: #6a737d; }
      
      p {
        margin-bottom: 16px;
      }
      
      ul, ol {
        padding-left: 2em;
        margin-bottom: 16px;
      }
      
      li {
        margin-bottom: 4px;
      }
      
      blockquote {
        padding: 0 1em;
        color: #6a737d;
        border-left: 0.25em solid #dfe2e5;
        margin-bottom: 16px;
      }
      
      code {
        padding: 0.2em 0.4em;
        margin: 0;
        font-size: 85%;
        background-color: rgba(27,31,35,0.05);
        border-radius: 3px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'Noto Sans KR', monospace;
      }
      
      pre {
        padding: 16px;
        overflow: auto;
        font-size: 85%;
        line-height: 1.45;
        background-color: #f6f8fa;
        border-radius: 3px;
        margin-bottom: 16px;
      }
      
      pre code {
        display: inline;
        padding: 0;
        margin: 0;
        border: 0;
        background-color: transparent;
      }
      
      table {
        border-spacing: 0;
        border-collapse: collapse;
        margin-bottom: 16px;
        width: 100%;
      }
      
      table th,
      table td {
        padding: 6px 13px;
        border: 1px solid #dfe2e5;
      }
      
      table tr:nth-child(2n) {
        background-color: #f6f8fa;
      }
      
      table th {
        font-weight: 600;
        background-color: #f6f8fa;
      }
      
      hr {
        height: 0.25em;
        padding: 0;
        margin: 24px 0;
        background-color: #e1e4e8;
        border: 0;
      }
      
      a {
        color: #0366d6;
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
        margin-bottom: 16px;
      }
      
      strong {
        font-weight: 600;
      }
      
      em {
        font-style: italic;
      }
    `;

    switch (theme) {
      case 'github':
        return baseStyles;
      
      case 'dark':
        return baseStyles + `
          body {
            background: #1e1e1e;
            color: #d4d4d4;
          }
          
          h1, h2, h3, h4, h5, h6 {
            color: #e0e0e0;
          }
          
          h1, h2 {
            border-bottom-color: #333;
          }
          
          blockquote {
            color: #999;
            border-left-color: #444;
          }
          
          code {
            background-color: rgba(255,255,255,0.1);
            color: #e0e0e0;
          }
          
          pre {
            background-color: #2d2d2d;
            color: #d4d4d4;
          }
          
          table th,
          table td {
            border-color: #444;
          }
          
          table tr:nth-child(2n) {
            background-color: #2a2a2a;
          }
          
          table th {
            background-color: #333;
          }
          
          hr {
            background-color: #444;
          }
          
          a {
            color: #58a6ff;
          }
        `;
      
      case 'minimal':
        return `
          body {
            font-family: 'Noto Sans KR', Georgia, serif;
            line-height: 1.8;
            color: #2c3e50;
            padding: 60px 40px;
            background: white;
          }
          
          .markdown-body {
            max-width: 700px;
            margin: 0 auto;
          }
          
          h1, h2, h3, h4, h5, h6 {
            margin-top: 30px;
            margin-bottom: 20px;
            font-weight: normal;
          }
          
          h1 { font-size: 2.5em; }
          h2 { font-size: 2em; }
          h3 { font-size: 1.5em; }
          
          p {
            margin-bottom: 20px;
            text-align: justify;
          }
          
          ul, ol {
            padding-left: 30px;
            margin-bottom: 20px;
          }
          
          blockquote {
            font-style: italic;
            padding-left: 20px;
            border-left: 3px solid #333;
            margin: 20px 0;
          }
          
          code {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            padding: 2px 6px;
          }
          
          pre {
            background: #f5f5f5;
            padding: 20px;
            overflow-x: auto;
            margin: 20px 0;
          }
          
          a {
            color: #2c3e50;
            text-decoration: underline;
          }
        `;
      
      default:
        return baseStyles;
    }
  }

  private async launchBrowser(options: MarkdownOptions): Promise<Browser> {
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };

    try {
      return await chromium.launch(launchOptions);
    } catch (error) {
      // If browser launch fails, try to install and retry once
      this.logger.warn('Browser launch failed, attempting to install browsers...', error);
      
      try {
        await this.browserInstaller.ensureBrowserInstalled();
        this.logger.info('Browser installation completed, retrying launch...');
        return await chromium.launch(launchOptions);
      } catch (installError) {
        this.logger.error('Failed to install browser:', installError);
        throw new Error(`Browser launch failed and installation failed: ${(error as Error).message}`);
      }
    }
  }

  private async generatePdf(page: Page, options: MarkdownOptions): Promise<Buffer> {
    const pdfOptions: any = {
      format: options.format || 'A4',
      landscape: options.landscape || false,
      printBackground: options.printBackground !== false,
      scale: options.scale || 1,
      displayHeaderFooter: options.displayHeaderFooter || false,
      margin: options.margin || {
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
