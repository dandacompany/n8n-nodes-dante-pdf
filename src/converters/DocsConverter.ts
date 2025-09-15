import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import { parse } from 'node-html-parser';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, DocsOptions } from '../types';
import { createError } from '../utils/errors';

export class DocsConverter extends BaseConverter<DocsOptions> {
  constructor() {
    super('DocsConverter', 25 * 1024 * 1024, ['.docx', '.doc']);
  }

  override async initialize(): Promise<void> {
    this.logger.info('DocsConverter initialized (PDFKit-based)');
  }

  override async cleanup(): Promise<void> {
    this.logger.info('DocsConverter cleanup completed');
  }

  async convert(input: ConversionInput<DocsOptions>): Promise<Buffer> {
    if (!input.file) {
      throw createError.missingFile('DOCX file is required');
    }

    try {
      const options = input.options || {};

      // Convert DOCX to HTML using mammoth
      const html = await this.docxToHtml(input.file.data, options);

      // Parse HTML
      const root = parse(html);

      // Create PDF document
      const doc = new PDFDocument({
        size: options.format || 'A4',
        layout: options.landscape ? 'landscape' : 'portrait',
        margin: 72, // 1 inch margins
        bufferPages: true,
      });

      // Collect PDF chunks
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));

      // Process HTML to PDF
      this.processHtmlToPdf(doc, root);

      // Finalize document
      doc.end();

      // Wait for stream to finish
      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);
      });
    } catch (error) {
      this.logger.error('DOCX conversion failed:', error);

      if (error instanceof Error) {
        throw createError.conversionFailed(error.message);
      }
      throw createError.conversionFailed('Failed to convert DOCX to PDF');
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

  private processHtmlToPdf(doc: any, root: any): void {
    const elements = root.childNodes || [];

    for (const element of elements) {
      if (typeof element === 'string') {
        continue;
      }

      this.processElement(doc, element, 0);
    }
  }

  private processElement(doc: any, element: any, depth: number): void {
    const tagName = element.tagName?.toLowerCase();
    const text = this.extractText(element);

    switch (tagName) {
      case 'h1':
        doc.fontSize(24).font('Helvetica-Bold').text(text, { align: 'left' });
        doc.moveDown(0.5);
        break;
      case 'h2':
        doc.fontSize(20).font('Helvetica-Bold').text(text, { align: 'left' });
        doc.moveDown(0.5);
        break;
      case 'h3':
        doc.fontSize(16).font('Helvetica-Bold').text(text, { align: 'left' });
        doc.moveDown(0.5);
        break;
      case 'h4':
        doc.fontSize(14).font('Helvetica-Bold').text(text, { align: 'left' });
        doc.moveDown(0.5);
        break;
      case 'h5':
      case 'h6':
        doc.fontSize(12).font('Helvetica-Bold').text(text, { align: 'left' });
        doc.moveDown(0.5);
        break;
      case 'p':
        if (text) {
          doc.fontSize(11).font('Helvetica').text(text, { align: 'justify' });
          doc.moveDown(0.5);
        }
        break;
      case 'ul':
      case 'ol':
        this.processList(doc, element, tagName === 'ol');
        doc.moveDown(0.5);
        break;
      case 'li':
        // Handled by processList
        break;
      case 'blockquote':
        if (text) {
          doc.fontSize(11).font('Helvetica-Oblique').text(text, {
            align: 'left',
            indent: 20,
          });
          doc.moveDown(0.5);
        }
        break;
      case 'pre':
        // Code block
        if (text) {
          doc
            .fontSize(10)
            .font('Courier')
            .fillColor('#333333')
            .text(text, {
              align: 'left',
              indent: 10,
            })
            .fillColor('#000000');
          doc.moveDown(0.5);
        }
        break;
      case 'code':
        // Inline code - handled within text processing
        break;
      case 'hr':
        doc.moveDown(0.5);
        const y = doc.y;
        doc
          .moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.width - doc.page.margins.right, y)
          .stroke();
        doc.moveDown(0.5);
        break;
      case 'table':
        this.processTable(doc, element);
        doc.moveDown(0.5);
        break;
      case 'strong':
      case 'b':
        if (text) {
          doc.font('Helvetica-Bold').text(text, { continued: true });
          doc.font('Helvetica');
        }
        break;
      case 'em':
      case 'i':
        if (text) {
          doc.font('Helvetica-Oblique').text(text, { continued: true });
          doc.font('Helvetica');
        }
        break;
      case 'a':
        const href = element.getAttribute('href');
        if (text || href) {
          doc
            .fillColor('#0066cc')
            .text(text || href || 'Link', {
              continued: true,
              underline: true,
            })
            .fillColor('#000000');
        }
        break;
      case 'img':
        // Handle embedded images from DOCX
        const src = element.getAttribute('src');
        if (src && src.startsWith('data:')) {
          try {
            // Extract base64 data
            const matches = src.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const imageData = Buffer.from(matches[2], 'base64');
              // Add image to PDF (centered, with max width)
              doc.image(imageData, {
                fit: [400, 300],
                align: 'center',
              });
              doc.moveDown(0.5);
            }
          } catch (err) {
            // If image fails, add alt text
            const alt = element.getAttribute('alt');
            if (alt) {
              doc
                .fontSize(10)
                .font('Helvetica-Oblique')
                .text(`[Image: ${alt}]`, { align: 'center' });
              doc.moveDown(0.5);
            }
          }
        }
        break;
      case 'br':
        doc.moveDown(0.3);
        break;
      default:
        // For unknown tags or containers, process children
        if (element.childNodes && element.childNodes.length > 0) {
          for (const child of element.childNodes) {
            if (typeof child !== 'string') {
              this.processElement(doc, child, depth + 1);
            } else if (child.trim()) {
              // Process text nodes
              doc.fontSize(11).font('Helvetica').text(child.trim());
            }
          }
        } else if (text) {
          // If no children but has text, output it
          doc.fontSize(11).font('Helvetica').text(text);
          doc.moveDown(0.3);
        }
        break;
    }
  }

  private extractText(element: any): string {
    // Extract only direct text content, not from children
    if (element.childNodes) {
      let text = '';
      for (const child of element.childNodes) {
        if (typeof child === 'string') {
          text += child;
        } else if (
          child.tagName?.toLowerCase() === 'strong' ||
          child.tagName?.toLowerCase() === 'b'
        ) {
          text += child.text || '';
        } else if (child.tagName?.toLowerCase() === 'em' || child.tagName?.toLowerCase() === 'i') {
          text += child.text || '';
        } else if (child.tagName?.toLowerCase() === 'code') {
          text += child.text || '';
        }
      }
      return text.trim();
    }
    return element.text?.trim() || '';
  }

  private processList(doc: any, listElement: any, isOrdered: boolean): void {
    const items = listElement.querySelectorAll('li') || [];

    items.forEach((item: any, index: number) => {
      const bullet = isOrdered ? `${index + 1}. ` : '• ';
      const text = this.extractText(item);

      if (text) {
        doc
          .fontSize(11)
          .font('Helvetica')
          .text(bullet, {
            continued: true,
            indent: 20,
          })
          .text(text);
        doc.moveDown(0.3);
      }
    });
  }

  private processTable(doc: any, tableElement: any): void {
    const rows = tableElement.querySelectorAll('tr') || [];

    rows.forEach((row: any) => {
      const cells = row.querySelectorAll('td, th') || [];
      const cellTexts: string[] = [];

      cells.forEach((cell: any) => {
        const text = this.extractText(cell);
        cellTexts.push(text);
      });

      if (cellTexts.length > 0) {
        const isHeader = row.querySelector('th') !== null;
        if (isHeader) {
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }

        doc.fontSize(10).text(cellTexts.join(' | '), { align: 'left' });
        doc.moveDown(0.2);
      }
    });
  }
}
