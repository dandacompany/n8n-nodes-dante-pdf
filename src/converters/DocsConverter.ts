import mammoth from 'mammoth';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, DocsOptions } from '../types';
import { createError } from '../utils/errors';
import { BrowserSetup } from '../utils/browserSetup';
import { Browser, Page } from 'playwright-core';

export class DocsConverter extends BaseConverter<DocsOptions> {
  private browser: Browser | null = null;

  constructor() {
    super('DocsConverter', 25 * 1024 * 1024, ['.docx', '.doc']);
  }

  override async initialize(): Promise<void> {
    this.logger.info('DocsConverter initialized (Playwright-based)');
    // Browser will be initialized on first use
  }

  override async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.logger.info('DocsConverter cleanup completed');
  }

  async convert(input: ConversionInput<DocsOptions>): Promise<Buffer> {
    if (!input.file) {
      throw createError.missingFile('DOCX file is required');
    }

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

      // Set viewport for proper rendering
      await page.setViewportSize({
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
      });

      // Convert DOCX to HTML using mammoth
      const html = await this.docxToHtml(input.file.data, options);

      // Enhance HTML with Korean font support and proper styling
      const enhancedHtml = this.enhanceHtmlWithStyling(html, options);

      // Set content and wait for fonts to load
      await page.setContent(enhancedHtml, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for fonts to load
      await page.evaluate(() => {
        return document.fonts.ready;
      });

      // Additional wait for web fonts
      await page.waitForTimeout(1000);

      // Generate PDF with options
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.landscape || false,
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm',
        },
      });

      return pdfBuffer;
    } catch (error) {
      this.logger.error('DOCX conversion failed:', error);

      if (error instanceof Error) {
        throw createError.conversionFailed(error.message);
      }
      throw createError.conversionFailed('Failed to convert DOCX to PDF');
    } finally {
      // Close the page
      if (page) {
        await page.close();
      }
    }
  }

  private async docxToHtml(buffer: Buffer, options: DocsOptions): Promise<string> {
    try {
      const mammothOptions: any = {
        convertImage:
          options.preserveImages !== false
            ? mammoth.images.imgElement((image: any) => {
                return image.read('base64').then((imageBuffer: string) => {
                  return {
                    src: `data:${image.contentType};base64,${imageBuffer}`,
                  };
                });
              })
            : undefined,
      };

      // Add style mapping if preserving styles
      if (options.preserveStyles !== false) {
        mammothOptions.styleMap = [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          "p[style-name='List Paragraph'] => li:fresh",
          "r[style-name='Strong'] => strong",
          "r[style-name='Emphasis'] => em",
          "p[style-name='Quote'] => blockquote:fresh",
          "p[style-name='Code'] => pre:fresh",
        ];
      }

      const result = await mammoth.convertToHtml({ buffer }, mammothOptions);

      if (result.messages && result.messages.length > 0) {
        this.logger.warn('Mammoth conversion warnings:', result.messages);
      }

      return result.value;
    } catch (error) {
      throw createError.conversionFailed('Failed to parse DOCX file');
    }
  }

  private enhanceHtmlWithStyling(html: string, options: DocsOptions): string {
    // Check if HTML already has proper structure
    const hasHtmlTag = /<html/i.test(html);
    const hasHeadTag = /<head/i.test(html);
    const hasBodyTag = /<body/i.test(html);
    const hasCharset = /<meta[^>]*charset/i.test(html);

    // Korean font and styling CSS
    const styleContent = `
      <style>
        /* Korean font support */
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap');
        
        /* Base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo',
                       'Helvetica Neue', Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #333;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          padding: 20px;
        }
        
        /* Headings */
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Noto Serif KR', 'Noto Sans KR', serif;
          font-weight: 700;
          margin-top: 1em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }
        
        h1 { font-size: 24pt; color: #2c3e50; }
        h2 { font-size: 20pt; color: #34495e; }
        h3 { font-size: 16pt; color: #34495e; }
        h4 { font-size: 14pt; color: #34495e; }
        h5 { font-size: 12pt; color: #34495e; }
        h6 { font-size: 11pt; color: #34495e; }
        
        /* Paragraphs */
        p {
          margin-bottom: 1em;
          text-align: justify;
        }
        
        /* Lists */
        ul, ol {
          margin-left: 30px;
          margin-bottom: 1em;
        }
        
        li {
          margin-bottom: 0.3em;
        }
        
        /* Blockquotes */
        blockquote {
          border-left: 4px solid #ddd;
          padding-left: 20px;
          margin: 1em 0;
          font-style: italic;
          color: #666;
        }
        
        /* Code blocks */
        pre {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 1em;
          font-family: 'D2Coding', Consolas, Monaco, monospace;
        }
        
        code {
          background-color: #f5f5f5;
          padding: 2px 4px;
          border-radius: 2px;
          font-family: 'D2Coding', Consolas, Monaco, monospace;
          font-size: 0.9em;
        }
        
        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1em;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        /* Images */
        img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1em auto;
        }
        
        /* Links */
        a {
          color: #3498db;
          text-decoration: none;
        }
        
        a:hover {
          text-decoration: underline;
        }
        
        /* Strong and emphasis */
        strong, b {
          font-weight: 700;
        }
        
        em, i {
          font-style: italic;
        }
        
        /* Horizontal rule */
        hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 2em 0;
        }
      </style>
    `;

    // Build complete HTML document
    let enhancedHtml = html;

    if (!hasHtmlTag) {
      // Wrap content in proper HTML structure
      enhancedHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${styleContent}
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

      // Add styles
      if (hasHeadTag) {
        enhancedHtml = enhancedHtml.replace(
          /<\/head>/i,
          `${styleContent}\n</head>`
        );
      } else {
        enhancedHtml = enhancedHtml.replace(
          /<html[^>]*>/i,
          `$&\n<head>${styleContent}</head>`
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
