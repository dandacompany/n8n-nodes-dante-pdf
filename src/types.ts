// Base interfaces for PDF conversion
export interface ConversionInput<T = any> {
  content?: string;
  file?: {
    data: Buffer;
    mimeType: string;
    fileName: string;
  };
  url?: string;
  files?: Array<{
    data: Buffer;
    mimeType: string;
    fileName: string;
  }>;
  options?: T;
}

export interface ConversionResult {
  pdf: Buffer;
  metadata: {
    pages?: number;
    size: number;
    format?: string;
    generatedAt: string;
    processingTime: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BaseOptions {
  format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
}

export interface MarkdownOptions extends BaseOptions {
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  css?: string;
  theme?: 'github' | 'default' | 'dark' | 'minimal';
  scale?: number;
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  pageRanges?: string;
}

export interface TextOptions extends BaseOptions {
  fontSize?: number;
  fontFamily?: 'Helvetica' | 'Times-Roman' | 'Courier' | 'Arial';
  fontColor?: string;
  lineHeight?: number;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  margins?: number;
  columns?: number;
  wordWrap?: boolean;
  pageNumbers?: boolean;
}

export interface HtmlOptions extends BaseOptions {
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitFor?: string;
  executeScript?: string;
  scale?: number;
  pageRanges?: string;
  ignoreHTTPSErrors?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface ImageOptions extends BaseOptions {
  fit?: 'contain' | 'cover' | 'fill' | 'scale-down';
  position?: 'center' | 'top' | 'bottom';
  quality?: number;
  compression?: 'none' | 'jpeg' | 'png';
  imagesPerPage?: number;
  addPageBreaks?: boolean;
  includeMetadata?: boolean;
}

export interface DocsOptions extends BaseOptions {
  preserveStyles?: boolean;
  preserveImages?: boolean;
  preserveLinks?: boolean;
  fitToPage?: boolean;
  imageQuality?: 'low' | 'medium' | 'high';
  embedFonts?: boolean;
}

export interface MergeOptions {
  pageRanges?: { [filename: string]: string };
  order?: number[];
  removeBlankPages?: boolean;
  compress?: boolean;
  removeMetadata?: boolean;
  password?: string;
  permissions?: {
    printing?: boolean;
    modifying?: boolean;
    copying?: boolean;
  };
}

// n8n specific types
export type ConversionType =
  | 'markdownToPdf'
  | 'textToPdf'
  | 'htmlToPdf'
  | 'imageToPdf'
  | 'docxToPdf'
  | 'mergePdfs';

export interface N8nConversionOptions {
  conversionType: ConversionType;
  markdownOptions?: MarkdownOptions | undefined;
  textOptions?: TextOptions | undefined;
  htmlOptions?: HtmlOptions | undefined;
  imageOptions?: ImageOptions | undefined;
  docsOptions?: DocsOptions | undefined;
  mergeOptions?: MergeOptions | undefined;
}

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FILE = 'MISSING_FILE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
