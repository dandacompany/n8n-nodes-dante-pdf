import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, ImageOptions } from '../types';
import { createError } from '../utils/errors';

export class ImageConverter extends BaseConverter<ImageOptions> {
  constructor() {
    super('ImageConverter', 20 * 1024 * 1024, [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.tiff',
      '.webp',
      '.svg',
    ]);
  }

  async convert(input: ConversionInput<ImageOptions>): Promise<Buffer> {
    if (!input.files || input.files.length === 0) {
      if (input.file) {
        input.files = [input.file];
      } else {
        throw createError.missingFile('No image files provided');
      }
    }

    const options = input.options || {};

    return new Promise(async (resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: options.format || 'A4',
          layout: options.landscape ? 'landscape' : 'portrait',
          autoFirstPage: false,
          info: {
            Title: 'Images to PDF',
            Author: 'PDF Converter API',
            Creator: 'dante-pdf',
          },
        });

        // Collect PDF buffer
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Process images
        const imagesPerPage = options.imagesPerPage || 1;
        let imageCount = 0;
        let currentPageImages = 0;

        for (const file of input.files!) {
          try {
            // Process image
            const imageBuffer = await this.processImage(file.data, options);
            const imageMetadata = await sharp(imageBuffer).metadata();

            // Add new page if needed
            if (currentPageImages === 0) {
              doc.addPage();
            }

            // Calculate image position and size
            const { x, y, width, height } = this.calculateImagePosition(
              doc,
              imageMetadata,
              options,
              currentPageImages,
              imagesPerPage
            );

            // Add image to PDF
            doc.image(imageBuffer, x, y, { width, height });

            // Add metadata if requested
            if (options.includeMetadata) {
              this.addImageMetadata(doc, file.fileName, imageMetadata, y + height);
            }

            currentPageImages++;
            imageCount++;

            // Check if we need a new page
            if (currentPageImages >= imagesPerPage) {
              currentPageImages = 0;
              if (options.addPageBreaks && imageCount < input.files!.length) {
                // Page break will be added on next iteration
              }
            }
          } catch (error) {
            this.logger.error(`Failed to process image ${file.fileName}:`, error);
            // Continue with other images
          }
        }

        // Finalize PDF
        doc.end();
      } catch (error) {
        this.logger.error('Image conversion failed:', error);
        reject(createError.conversionFailed('Failed to convert images to PDF'));
      }
    });
  }

  private async processImage(buffer: Buffer, options: ImageOptions): Promise<Buffer> {
    let image = sharp(buffer);

    // Apply quality settings
    if (options.quality) {
      image = image.jpeg({ quality: options.quality });
    }

    // Apply compression
    if (options.compression === 'jpeg') {
      image = image.jpeg({ quality: options.quality || 85 });
    } else if (options.compression === 'png') {
      image = image.png({ compressionLevel: 9 });
    }

    return image.toBuffer();
  }

  private calculateImagePosition(
    doc: any,
    metadata: sharp.Metadata,
    options: ImageOptions,
    currentIndex: number,
    imagesPerPage: number
  ): { x: number; y: number; width: number; height: number } {
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

    let width = metadata.width || 100;
    let height = metadata.height || 100;
    let x = doc.page.margins.left;
    let y = doc.page.margins.top;

    // Handle multiple images per page
    if (imagesPerPage > 1) {
      const grid = this.calculateGrid(imagesPerPage);
      const cellWidth = pageWidth / grid.cols;
      const cellHeight = pageHeight / grid.rows;

      const row = Math.floor(currentIndex / grid.cols);
      const col = currentIndex % grid.cols;

      x = doc.page.margins.left + col * cellWidth;
      y = doc.page.margins.top + row * cellHeight;

      // Fit image to cell
      const scale = Math.min(cellWidth / width, cellHeight / height) * 0.9; // 90% to add some padding

      width *= scale;
      height *= scale;

      // Center in cell
      x += (cellWidth - width) / 2;
      y += (cellHeight - height) / 2;
    } else {
      // Single image per page
      const fit = options.fit || 'contain';

      if (fit === 'contain') {
        // Scale to fit within page
        const scale = Math.min(pageWidth / width, pageHeight / height);
        width *= scale;
        height *= scale;
      } else if (fit === 'cover') {
        // Scale to cover entire page
        const scale = Math.max(pageWidth / width, pageHeight / height);
        width *= scale;
        height *= scale;
      } else if (fit === 'fill') {
        // Stretch to fill page
        width = pageWidth;
        height = pageHeight;
      }

      // Position image
      const position = options.position || 'center';
      if (position === 'center') {
        x = doc.page.margins.left + (pageWidth - width) / 2;
        y = doc.page.margins.top + (pageHeight - height) / 2;
      } else if (position === 'top') {
        x = doc.page.margins.left + (pageWidth - width) / 2;
        y = doc.page.margins.top;
      } else if (position === 'bottom') {
        x = doc.page.margins.left + (pageWidth - width) / 2;
        y = doc.page.height - doc.page.margins.bottom - height;
      }
    }

    return { x, y, width, height };
  }

  private calculateGrid(count: number): { rows: number; cols: number } {
    if (count <= 1) return { rows: 1, cols: 1 };
    if (count <= 2) return { rows: 1, cols: 2 };
    if (count <= 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    if (count <= 9) return { rows: 3, cols: 3 };
    return { rows: 3, cols: 3 }; // Max 9 images per page
  }

  private addImageMetadata(
    doc: any,
    filename: string,
    metadata: sharp.Metadata,
    yPosition: number
  ): void {
    const oldFontSize = doc._fontSize;
    doc.fontSize(8);
    doc.fillColor('#666666');

    const info = `${filename} - ${metadata.width}x${metadata.height}px`;
    const textWidth = doc.widthOfString(info);
    const x = (doc.page.width - textWidth) / 2;

    doc.text(info, x, yPosition + 5);

    doc.fontSize(oldFontSize);
    doc.fillColor('#000000');
  }
}
