import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  NodeConnectionType,
} from 'n8n-workflow';

import { dantePdfDescription } from './description';
import {
  TextConverter,
  MarkdownConverter,
  HtmlConverter,
  ImageConverter,
  DocsConverter,
  PdfMerger,
} from '../../converters';
import {
  ConversionInput,
  ConversionType,
  N8nConversionOptions,
  TextOptions,
  MarkdownOptions,
  HtmlOptions,
  ImageOptions,
  DocsOptions,
  MergeOptions,
} from '../../types';
import { logger } from '../../utils/logger';
import { resolveInputs, PdfSource } from '../../utils/resolveInputs';

export class DantePdf implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Dante PDF',
    name: 'dantePdf',
    icon: 'file:dante-pdf.icon.png',
    group: ['output'],
    version: 1,
    subtitle: '={{ $parameter["conversionType"] }}',
    description: 'Convert various formats to PDF using Dante PDF converters',
    defaults: {
      name: 'Dante PDF',
    },
    inputs: ['main' as NodeConnectionType],
    outputs: ['main' as NodeConnectionType],
    properties: dantePdfDescription,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = [];

    // Check if this is a PDF merge operation
    const firstConversionType = this.getNodeParameter('conversionType', 0) as ConversionType;

    if (firstConversionType === 'mergePdfs') {
      // Handle PDF merge specially - collect PDFs using configured sources
      try {
        const mergeOptions = this.getNodeParameter('mergeOptions', 0, {}) as MergeOptions;
        const additionalOptions = this.getNodeParameter('additionalOptions', 0, {}) as any;

        // Get PDF sources configuration
        const pdfSourcesParam = this.getNodeParameter('pdfSources', 0, {}) as {
          sources?: PdfSource[];
        };
        const sourcesConfig = pdfSourcesParam.sources || [];

        // Resolve all PDF inputs using the configured sources
        const { paths: allPdfs, cleanup } = await resolveInputs(this, 0, sourcesConfig);

        try {
          if (allPdfs.length < 2) {
            throw new Error(`Need at least 2 PDFs to merge. Found ${allPdfs.length} PDF(s).`);
          }

          // Prepare merge input
          const mergeInput = {
            files: allPdfs,
            options: mergeOptions,
          };

          // Perform merge
          const result = await performConversion('mergePdfs', mergeInput, {
            conversionType: 'mergePdfs',
            mergeOptions,
          });

          // Create output binary data
          const outputPropertyName = additionalOptions.outputPropertyName || 'data';
          const binaryData = {
            [outputPropertyName]: {
              data: result.pdf.toString('base64'),
              mimeType: 'application/pdf',
              fileName: generateFileName('mergePdfs', 0),
              fileExtension: 'pdf',
            },
          };

          returnData.push({
            json: {
              success: true,
              pages: result.metadata.pages || 0,
              size: result.metadata.size,
              processingTime: result.metadata.processingTime,
              totalInputFiles: allPdfs.length,
              mergedFiles: allPdfs.map(f => f.fileName),
            },
            binary: binaryData,
            pairedItem: { item: 0 },
          });
        } finally {
          // Always cleanup temporary files
          await cleanup();
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            pairedItem: { item: 0 },
          });
        } else {
          throw error;
        }
      }

      return [returnData];
    }

    // Handle other conversion types normally (one by one)
    // For non-merge operations, we process the input data
    const items = this.getInputData();

    for (let i = 0; i < items.length; i++) {
      try {
        const conversionType = this.getNodeParameter('conversionType', i) as ConversionType;
        const inputSource = this.getNodeParameter('inputSource', i) as string;
        const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as any;

        // Get conversion-specific options
        const options: N8nConversionOptions = { conversionType };

        if (conversionType === 'markdownToPdf') {
          options.markdownOptions = this.getNodeParameter(
            'markdownOptions',
            i,
            {}
          ) as MarkdownOptions;
        } else if (conversionType === 'textToPdf') {
          options.textOptions = this.getNodeParameter('textOptions', i, {}) as TextOptions;
        } else if (conversionType === 'htmlToPdf') {
          options.htmlOptions = this.getNodeParameter('htmlOptions', i, {}) as HtmlOptions;
        } else if (conversionType === 'imageToPdf') {
          options.imageOptions = this.getNodeParameter('imageOptions', i, {}) as ImageOptions;
        } else if (conversionType === 'docxToPdf') {
          options.docsOptions = this.getNodeParameter('docsOptions', i, {}) as DocsOptions;
        }

        // Merge additional options
        const baseOptions = {
          format: additionalOptions.format || 'A4',
          landscape: additionalOptions.landscape || false,
        };

        // Prepare conversion input
        const conversionInput = await prepareConversionInput(
          this,
          i,
          inputSource,
          baseOptions,
          options
        );

        // Perform conversion
        const result = await performConversion(conversionType, conversionInput, options);

        // Create output binary data
        const outputPropertyName = additionalOptions.outputPropertyName || 'data';
        const binaryData = {
          [outputPropertyName]: {
            data: result.pdf.toString('base64'),
            mimeType: 'application/pdf',
            fileName: generateFileName(conversionType, i),
            fileExtension: 'pdf',
          },
        };

        returnData.push({
          json: {
            ...(items[i]?.json || {}),
            conversionType,
            metadata: result.metadata,
          },
          binary: binaryData,
        });
      } catch (error) {
        logger.error('PDF conversion failed:', error);

        if (this.continueOnFail()) {
          returnData.push({
            json: {
              ...(items[i]?.json || {}),
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          continue;
        } else {
          throw new NodeOperationError(
            this.getNode(),
            error instanceof Error ? error.message : 'PDF conversion failed',
            { itemIndex: i }
          );
        }
      }
    }

    return [returnData];
  }
}

async function prepareConversionInput(
  context: IExecuteFunctions,
  itemIndex: number,
  inputSource: string,
  baseOptions: any,
  options: N8nConversionOptions
): Promise<ConversionInput> {
  const input: ConversionInput = { options: { ...baseOptions } };

  // Merge specific options
  if (options.markdownOptions) {
    input.options = { ...input.options, ...options.markdownOptions };
  }
  if (options.textOptions) {
    input.options = { ...input.options, ...options.textOptions };
  }
  if (options.htmlOptions) {
    input.options = { ...input.options, ...options.htmlOptions };
  }
  if (options.imageOptions) {
    input.options = { ...input.options, ...options.imageOptions };
  }
  if (options.docsOptions) {
    input.options = { ...input.options, ...options.docsOptions };
  }
  if (options.mergeOptions) {
    // Handle page ranges transformation
    const mergeOptions = options.mergeOptions;
    if (mergeOptions.pageRanges && (mergeOptions.pageRanges as any).ranges) {
      const ranges: { [filename: string]: string } = {};
      for (const range of (mergeOptions.pageRanges as any).ranges) {
        ranges[range.fileName] = range.pages;
      }
      mergeOptions.pageRanges = ranges;
    }
    input.options = { ...input.options, ...mergeOptions };
  }

  switch (inputSource) {
    case 'content':
      input.content = context.getNodeParameter('content', itemIndex) as string;
      break;

    case 'url':
      if (options.conversionType === 'htmlToPdf') {
        input.url = context.getNodeParameter('url', itemIndex) as string;
      } else {
        throw new Error('URL input is only supported for HTML to PDF conversion');
      }
      break;

    case 'binaryData':
      const binaryPropertyName = context.getNodeParameter(
        'binaryPropertyName',
        itemIndex
      ) as string;
      const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);

      if (options.conversionType === 'mergePdfs') {
        // For PDF merge, we need all binary properties that contain PDFs
        const item = context.getInputData()[itemIndex];
        if (!item) {
          throw new Error('No input data found');
        }
        input.files = [];

        if (item.binary) {
          for (const [key, binary] of Object.entries(item.binary)) {
            if ((binary as any).mimeType === 'application/pdf') {
              input.files.push({
                data: Buffer.from((binary as any).data, 'base64'),
                mimeType: (binary as any).mimeType,
                fileName: (binary as any).fileName || `file_${key}.pdf`,
              });
            }
          }
        }

        if (input.files.length === 0) {
          throw new Error('No PDF files found in binary data for merging');
        }
      } else if (options.conversionType === 'imageToPdf') {
        // For image conversion, collect all image binaries
        const item = context.getInputData()[itemIndex];
        if (!item) {
          throw new Error('No input data found');
        }
        input.files = [];

        if (item.binary) {
          for (const [key, binary] of Object.entries(item.binary)) {
            if ((binary as any).mimeType.startsWith('image/')) {
              input.files.push({
                data: Buffer.from((binary as any).data, 'base64'),
                mimeType: (binary as any).mimeType,
                fileName: (binary as any).fileName || `image_${key}`,
              });
            }
          }
        }

        if (input.files.length === 0) {
          // Fall back to single file
          input.file = {
            data: Buffer.from(binaryData.data, 'base64'),
            mimeType: binaryData.mimeType,
            fileName: binaryData.fileName || 'image',
          };
        }
      } else {
        // Single file conversion
        input.file = {
          data: Buffer.from(binaryData.data, 'base64'),
          mimeType: binaryData.mimeType,
          fileName: binaryData.fileName || 'file',
        };
      }
      break;

    default:
      throw new Error(`Unsupported input source: ${inputSource}`);
  }

  return input;
}

async function performConversion(
  conversionType: ConversionType,
  input: ConversionInput,
  options: N8nConversionOptions
) {
  let converter: any;

  switch (conversionType) {
    case 'markdownToPdf':
      converter = new MarkdownConverter();
      break;
    case 'textToPdf':
      converter = new TextConverter();
      break;
    case 'htmlToPdf':
      converter = new HtmlConverter();
      break;
    case 'imageToPdf':
      converter = new ImageConverter();
      break;
    case 'docxToPdf':
      converter = new DocsConverter();
      break;
    case 'mergePdfs':
      converter = new PdfMerger();
      break;
    default:
      throw new Error(`Unsupported conversion type: ${conversionType}`);
  }

  try {
    await converter.initialize();
    const result = await converter.execute(input);
    await converter.cleanup();
    return result;
  } catch (error) {
    await converter.cleanup();
    throw error;
  }
}

function generateFileName(conversionType: ConversionType, itemIndex: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseNames: { [key in ConversionType]: string } = {
    markdownToPdf: 'markdown',
    textToPdf: 'text',
    htmlToPdf: 'html',
    imageToPdf: 'images',
    docxToPdf: 'document',
    mergePdfs: 'merged',
  };

  return `${baseNames[conversionType]}_${itemIndex}_${timestamp}.pdf`;
}
