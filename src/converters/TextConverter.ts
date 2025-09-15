import PDFDocument from 'pdfkit';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, TextOptions } from '../types';
import { createError } from '../utils/errors';

export class TextConverter extends BaseConverter<TextOptions> {
  constructor() {
    super('TextConverter', 5 * 1024 * 1024, ['.txt', '.text']);
  }

  async convert(input: ConversionInput<TextOptions>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Get text content
        const text = this.getContent(input);
        const options = input.options || {};

        // Create PDF document
        const doc = new PDFDocument({
          size: options.format || 'A4',
          layout: options.landscape ? 'landscape' : 'portrait',
          margins: {
            top: options.margins || 72,
            bottom: options.margins || 72,
            left: options.margins || 72,
            right: options.margins || 72,
          },
          info: {
            Title: 'Text to PDF',
            Author: 'PDF Converter API',
            Creator: 'dante-pdf',
          },
        });

        // Collect PDF buffer
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Apply text formatting
        this.applyTextFormatting(doc, options);

        // Add page numbers if requested
        if (options.pageNumbers) {
          this.addPageNumbers(doc);
        }

        // Process text based on options
        if (options.columns && options.columns > 1) {
          this.addMultiColumnText(doc, text, options);
        } else {
          this.addSingleColumnText(doc, text, options);
        }

        // Finalize PDF
        doc.end();
      } catch (error) {
        this.logger.error('Text conversion failed:', error);
        reject(createError.conversionFailed('Failed to convert text to PDF'));
      }
    });
  }

  private applyTextFormatting(doc: any, options: TextOptions): void {
    // Set font
    const fontFamily = options.fontFamily || 'Helvetica';
    const fontSize = options.fontSize || 12;

    doc.font(fontFamily);
    doc.fontSize(fontSize);

    // Set font color
    if (options.fontColor) {
      doc.fillColor(options.fontColor);
    }
  }

  private addSingleColumnText(doc: any, text: string, options: TextOptions): void {
    const lines = text.split('\n');
    const lineHeight = options.lineHeight || 1.2;
    const alignment = options.alignment || 'left';

    lines.forEach(line => {
      // Check if we need a new page
      if (doc.y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      // Add text with alignment
      const textOptions: any = {
        align: alignment,
        lineBreak: options.wordWrap !== false,
        lineGap: (options.fontSize || 12) * (lineHeight - 1),
      };

      doc.text(line || ' ', doc.page.margins.left, undefined, textOptions);
    });
  }

  private addMultiColumnText(doc: any, text: string, options: TextOptions): void {
    const columns = options.columns || 2;
    const columnGap = 20;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = (pageWidth - columnGap * (columns - 1)) / columns;

    const lines = text.split('\n');
    const lineHeight = options.lineHeight || 1.2;
    const alignment = options.alignment || 'left';

    let currentColumn = 0;
    let currentY = doc.page.margins.top;

    lines.forEach(line => {
      // Calculate column X position
      const columnX = doc.page.margins.left + currentColumn * (columnWidth + columnGap);

      // Check if we need to move to next column or page
      if (currentY > doc.page.height - doc.page.margins.bottom) {
        currentColumn++;
        currentY = doc.page.margins.top;

        if (currentColumn >= columns) {
          doc.addPage();
          currentColumn = 0;
        }
      }

      // Add text to current column
      doc.text(line || ' ', columnX, currentY, {
        width: columnWidth,
        align: alignment,
        lineBreak: options.wordWrap !== false,
        lineGap: (options.fontSize || 12) * (lineHeight - 1),
      });

      // Update Y position
      currentY +=
        doc.heightOfString(line || ' ', {
          width: columnWidth,
          align: alignment,
        }) +
        (options.fontSize || 12) * (lineHeight - 1);
    });
  }

  private addPageNumbers(doc: any): void {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Save current state
      const oldFontSize = doc._fontSize;
      const oldY = doc.y;

      // Add page number at bottom center
      doc.fontSize(10);
      const pageNumberText = `Page ${i + 1} of ${pages.count}`;
      const textWidth = doc.widthOfString(pageNumberText);
      const textX = (doc.page.width - textWidth) / 2;
      const textY = doc.page.height - 40;

      doc.text(pageNumberText, textX, textY);

      // Restore state
      doc.fontSize(oldFontSize);
      doc.y = oldY;
    }
  }
}
