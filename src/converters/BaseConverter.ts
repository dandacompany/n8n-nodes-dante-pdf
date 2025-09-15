import { Logger } from '../utils/logger';
import { ValidationResult, ConversionInput, ConversionResult } from '../types';
import { logger } from '../utils/logger';
import { createError } from '../utils/errors';

export abstract class BaseConverter<TOptions = any> {
  protected logger: Logger;
  protected readonly maxFileSize: number;
  protected readonly supportedFormats: string[];
  protected readonly converterName: string;

  constructor(
    converterName: string,
    maxFileSize: number = 10 * 1024 * 1024, // 10MB default
    supportedFormats: string[] = []
  ) {
    this.converterName = converterName;
    this.logger = logger.child({ service: converterName });
    this.maxFileSize = maxFileSize;
    this.supportedFormats = supportedFormats;
  }

  /**
   * Initialize any required resources
   */
  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Main conversion method to be implemented by subclasses
   */
  abstract convert(input: ConversionInput<TOptions>): Promise<Buffer>;

  /**
   * Validate input before conversion
   */
  validate(input: ConversionInput<TOptions>): ValidationResult {
    const errors: string[] = [];

    // Check if any input is provided
    if (!input.content && !input.file && !input.files && !input.url) {
      errors.push('No input provided. Please provide content, file, or URL');
    }

    // Validate single file
    if (input.file) {
      if (input.file.data.length > this.maxFileSize) {
        errors.push(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
      }

      if (this.supportedFormats.length > 0) {
        const hasValidFormat = this.supportedFormats.some(format => {
          const fileName = input.file!.fileName.toLowerCase();
          return fileName.endsWith(format.toLowerCase());
        });

        if (!hasValidFormat) {
          errors.push(
            `Unsupported file format. Supported formats: ${this.supportedFormats.join(', ')}`
          );
        }
      }
    }

    // Validate multiple files
    if (input.files && input.files.length > 0) {
      const totalSize = input.files.reduce((sum, file) => sum + file.data.length, 0);
      if (totalSize > this.maxFileSize * 5) {
        // Allow 5x size for multiple files
        errors.push(`Total file size exceeds maximum limit`);
      }

      if (this.supportedFormats.length > 0) {
        input.files.forEach((file, index) => {
          const hasValidFormat = this.supportedFormats.some(format => {
            const fileName = file.fileName.toLowerCase();
            return fileName.endsWith(format.toLowerCase());
          });

          if (!hasValidFormat) {
            errors.push(`File ${index + 1} has unsupported format`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Pre-process input before conversion
   */
  protected async preProcess(input: ConversionInput<TOptions>): Promise<ConversionInput<TOptions>> {
    this.logger.info(`Starting ${this.converterName} conversion`, {
      hasContent: !!input.content,
      hasFile: !!input.file,
      hasFiles: !!input.files?.length,
      hasUrl: !!input.url,
    });

    // Validate input
    const validation = this.validate(input);
    if (!validation.isValid) {
      throw createError.invalidInput(`Validation failed: ${validation.errors.join(', ')}`, {
        errors: validation.errors,
      });
    }

    return input;
  }

  /**
   * Post-process the generated PDF
   */
  protected async postProcess(buffer: Buffer): Promise<Buffer> {
    this.logger.info(`Completed ${this.converterName} conversion`, {
      size: buffer.length,
    });

    // Could add compression or optimization here
    return buffer;
  }

  /**
   * Execute the complete conversion pipeline
   */
  public async execute(input: ConversionInput<TOptions>): Promise<ConversionResult> {
    const startTime = Date.now();

    try {
      // Pre-process
      const processedInput = await this.preProcess(input);

      // Convert
      const buffer = await this.convert(processedInput);

      // Post-process
      const finalBuffer = await this.postProcess(buffer);

      const processingTime = Date.now() - startTime;

      return {
        pdf: finalBuffer,
        metadata: {
          size: finalBuffer.length,
          generatedAt: new Date().toISOString(),
          processingTime,
        },
      };
    } catch (error) {
      this.logger.error(`Conversion failed in ${this.converterName}:`, error);

      if (error instanceof Error) {
        throw createError.conversionFailed(error.message);
      }
      throw createError.conversionFailed('Unknown conversion error');
    }
  }

  /**
   * Get content from input (helper method)
   */
  protected getContent(input: ConversionInput<TOptions>): string {
    if (input.content) {
      return input.content;
    }

    if (input.file) {
      return input.file.data.toString('utf-8');
    }

    return '';
  }
}
