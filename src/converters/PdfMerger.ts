import { PDFDocument } from 'pdf-lib';
import { BaseConverter } from './BaseConverter';
import { ConversionInput, MergeOptions } from '../types';
import { createError } from '../utils/errors';

export class PdfMerger extends BaseConverter<MergeOptions> {
  constructor() {
    super('PdfMerger', 50 * 1024 * 1024, ['.pdf']);
  }

  async convert(input: ConversionInput<MergeOptions>): Promise<Buffer> {
    if (!input.files || input.files.length === 0) {
      throw createError.missingFile('No PDF files provided for merging');
    }

    if (input.files.length < 2) {
      throw createError.invalidInput('At least 2 PDF files are required for merging');
    }

    try {
      const options = input.options || {};

      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();

      // Process files in specified order or default order
      const fileOrder = options.order || input.files.map((_, index) => index);

      for (const fileIndex of fileOrder) {
        if (fileIndex >= input.files.length) {
          this.logger.warn(`Invalid file index ${fileIndex}, skipping`);
          continue;
        }

        const file = input.files[fileIndex];
        if (!file) {
          this.logger.warn(`File at index ${fileIndex} is undefined, skipping`);
          continue;
        }

        const fileName = file.fileName;

        try {
          // Load the PDF
          const pdfBytes = file.data;
          const pdf = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: true,
          });

          // Determine which pages to copy
          const pageIndices = this.getPageIndices(fileName, pdf.getPageCount(), options.pageRanges);

          // Copy pages
          const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

          // Add pages to merged document
          for (const page of copiedPages) {
            // Check if page is blank and should be removed
            if (options.removeBlankPages && (await this.isBlankPage(page))) {
              this.logger.info(`Skipping blank page from ${fileName}`);
              continue;
            }

            mergedPdf.addPage(page);
          }
        } catch (error) {
          this.logger.error(`Failed to process PDF ${fileName}:`, error);
          throw createError.conversionFailed(`Failed to process ${fileName}`);
        }
      }

      // Check if we have any pages
      if (mergedPdf.getPageCount() === 0) {
        throw createError.conversionFailed('No pages to merge after processing');
      }

      // Apply metadata removal if requested
      if (options.removeMetadata) {
        this.removeMetadata(mergedPdf);
      }

      // Apply compression if requested
      let pdfBytes: Uint8Array;
      if (options.compress) {
        // Note: pdf-lib doesn't have built-in compression beyond what it already does
        // For better compression, you might want to use a different library
        pdfBytes = await mergedPdf.save({
          useObjectStreams: true, // This provides some compression
        });
      } else {
        pdfBytes = await mergedPdf.save();
      }

      // Apply password protection if requested
      if (options.password) {
        return this.applyPasswordProtection(
          Buffer.from(pdfBytes),
          options.password,
          options.permissions
        );
      }

      return Buffer.from(pdfBytes);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to')) {
        throw error;
      }
      this.logger.error('PDF merge failed:', error);
      throw createError.conversionFailed('Failed to merge PDF files');
    }
  }

  private getPageIndices(
    fileName: string,
    totalPages: number,
    pageRanges?: { [filename: string]: string }
  ): number[] {
    // If no page ranges specified, return all pages
    if (!pageRanges || !pageRanges[fileName]) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const range = pageRanges[fileName];
    const indices: number[] = [];

    // Parse page range string (e.g., "1-3,5,7-9")
    const parts = range.split(',');
    for (const part of parts) {
      const trimmed = part.trim();

      if (trimmed.includes('-')) {
        // Range (e.g., "1-3")
        const parts = trimmed.split('-');
        const start = parseInt(parts[0]?.trim() || '0');
        const end = parseInt(parts[1]?.trim() || '0');
        if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
          for (let i = start - 1; i < Math.min(end, totalPages); i++) {
            if (i >= 0 && i < totalPages) {
              indices.push(i);
            }
          }
        }
      } else {
        // Single page (e.g., "5")
        const pageNum = parseInt(trimmed);
        if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
          indices.push(pageNum - 1);
        }
      }
    }

    // Return unique indices in order
    return [...new Set(indices)].sort((a, b) => a - b);
  }

  private async isBlankPage(page: any): Promise<boolean> {
    // This is a simplified check
    // A more sophisticated check would analyze the actual content
    try {
      // const { width, height } = page.getSize();
      const content = page.node.Contents;

      // If there's no content stream, consider it blank
      if (!content) {
        return true;
      }

      // You could add more sophisticated checks here
      // For now, we'll consider very small content as potentially blank
      const contentSize = content.toString().length;
      return contentSize < 100; // Arbitrary threshold
    } catch {
      return false; // If we can't determine, assume it's not blank
    }
  }

  private removeMetadata(pdf: PDFDocument): void {
    try {
      pdf.setTitle('');
      pdf.setAuthor('');
      pdf.setSubject('');
      pdf.setKeywords([]);
      pdf.setProducer('PDF Merger');
      pdf.setCreator('dante-pdf');
      pdf.setCreationDate(new Date());
      pdf.setModificationDate(new Date());
    } catch (error) {
      this.logger.warn('Failed to remove some metadata:', error);
    }
  }

  private async applyPasswordProtection(
    pdfBuffer: Buffer,
    _password: string,
    _permissions?: {
      printing?: boolean;
      modifying?: boolean;
      copying?: boolean;
    }
  ): Promise<Buffer> {
    // Note: pdf-lib doesn't support password protection directly
    // You would need to use another library like qpdf or pdftk for this
    // For now, we'll return the unprotected PDF with a warning

    this.logger.warn('Password protection is not yet implemented in pdf-lib');
    this.logger.warn('Consider using qpdf or pdftk for password protection');

    // TODO: Implement password protection using qpdf or similar
    // Example with qpdf (would need to be installed):
    // const { exec } = require('child_process');
    // exec(`qpdf --encrypt ${password} ${password} 256 -- input.pdf output.pdf`);

    return pdfBuffer;
  }
}
