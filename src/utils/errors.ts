import { ErrorCode } from '../types';

export class ConversionError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, code: ErrorCode, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'ConversionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConversionError);
    }
  }

  public toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export const createError = {
  invalidInput: (message: string = 'Invalid input provided', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.INVALID_INPUT, 400, details),

  missingFile: (message: string = 'Required file is missing', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.MISSING_FILE, 400, details),

  unsupportedFormat: (
    message: string = 'Unsupported file format',
    details?: any
  ): ConversionError => new ConversionError(message, ErrorCode.UNSUPPORTED_FORMAT, 400, details),

  fileTooLarge: (message: string = 'File size exceeds limit', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.FILE_TOO_LARGE, 400, details),

  conversionFailed: (message: string = 'PDF conversion failed', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.CONVERSION_FAILED, 500, details),

  rateLimitExceeded: (message: string = 'Rate limit exceeded', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, details),

  unauthorized: (message: string = 'Unauthorized access', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.UNAUTHORIZED, 401, details),

  internalError: (message: string = 'Internal server error', details?: any): ConversionError =>
    new ConversionError(message, ErrorCode.INTERNAL_ERROR, 500, details),
};

export function isConversionError(error: unknown): error is ConversionError {
  return error instanceof ConversionError;
}

export function formatErrorMessage(error: unknown): string {
  if (isConversionError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}
