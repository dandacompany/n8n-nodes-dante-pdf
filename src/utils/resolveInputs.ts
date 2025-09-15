import { IExecuteFunctions, NodeOperationError, INodeExecutionData } from 'n8n-workflow';
import * as fs from 'fs-extra';
import * as path from 'path';
import fetch from 'node-fetch';
import { logger } from './logger';

export interface PdfSource {
  sourceType: 'binary' | 'url';
  binaryProperty?: string;
  url?: string;
}

export interface ResolvedInputs {
  paths: Array<{ data: Buffer; mimeType: string; fileName: string }>;
  cleanup: () => Promise<void>;
}

async function downloadPdf(url: string): Promise<{ data: Buffer; fileName: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const fileName = path.basename(url) || 'downloaded.pdf';

    return { data: Buffer.from(buffer), fileName };
  } catch (error) {
    throw new Error(`Failed to download PDF from URL: ${(error as Error).message}`);
  }
}

export async function resolveInputs(
  executeFunctions: IExecuteFunctions,
  itemIndex: number,
  sourcesConfig: PdfSource[]
): Promise<ResolvedInputs> {
  const pdfs: Array<{ data: Buffer; mimeType: string; fileName: string }> = [];
  const cleanupFunctions: (() => Promise<void>)[] = [];

  // If no sources are configured, try to collect all PDFs from input data
  if (!sourcesConfig || sourcesConfig.length === 0) {
    logger.info('No PDF sources configured, collecting all PDFs from input data');

    const inputData = executeFunctions.getInputData();

    for (let i = 0; i < inputData.length; i++) {
      const item = inputData[i];
      if (item && item.binary) {
        for (const [key, binary] of Object.entries(item.binary)) {
          if ((binary as any).mimeType === 'application/pdf') {
            pdfs.push({
              data: Buffer.from((binary as any).data, 'base64'),
              mimeType: (binary as any).mimeType,
              fileName: (binary as any).fileName || `pdf_${i}_${key}.pdf`,
            });
            logger.info(`Found PDF in item ${i}, property ${key}`);
          }
        }
      }
    }
  } else {
    // Process configured sources
    for (const source of sourcesConfig) {
      switch (source.sourceType) {
        case 'url': {
          if (!source.url) {
            throw new NodeOperationError(
              executeFunctions.getNode(),
              'URL is required for URL source type',
              { itemIndex }
            );
          }

          logger.info(`Downloading PDF from URL: ${source.url}`);
          const { data, fileName } = await downloadPdf(source.url);
          pdfs.push({
            data,
            mimeType: 'application/pdf',
            fileName,
          });
          break;
        }

        case 'binary': {
          if (!source.binaryProperty) {
            throw new NodeOperationError(
              executeFunctions.getNode(),
              'Binary property name is required for binary source type',
              { itemIndex }
            );
          }

          const inputData = executeFunctions.getInputData();
          let found = false;

          // Try to find the binary property in any input item
          for (let i = 0; i < inputData.length; i++) {
            const item = inputData[i];
            if (item?.binary && item.binary[source.binaryProperty]) {
              const binary = item.binary[source.binaryProperty];

              if ((binary as any).mimeType !== 'application/pdf') {
                logger.warn(
                  `Binary property ${source.binaryProperty} is not a PDF (${(binary as any).mimeType})`
                );
                continue;
              }

              pdfs.push({
                data: Buffer.from((binary as any).data, 'base64'),
                mimeType: (binary as any).mimeType,
                fileName: (binary as any).fileName || `${source.binaryProperty}.pdf`,
              });

              logger.info(`Found PDF in item ${i}, property ${source.binaryProperty}`);
              found = true;
              break; // Only take the first match for each configured source
            }
          }

          if (!found) {
            // Check if we can find the property in the current item
            const currentItem = inputData[itemIndex];
            const availableProps = currentItem?.binary ? Object.keys(currentItem.binary) : [];

            throw new NodeOperationError(
              executeFunctions.getNode(),
              `Binary property "${source.binaryProperty}" not found. Available properties: ${availableProps.join(', ') || 'none'}`,
              { itemIndex }
            );
          }
          break;
        }

        default:
          throw new NodeOperationError(
            executeFunctions.getNode(),
            `Unknown source type: ${source.sourceType}`,
            { itemIndex }
          );
      }
    }
  }

  const cleanup = async () => {
    for (const cleanupFn of cleanupFunctions) {
      try {
        await cleanupFn();
      } catch (error) {
        logger.error('Cleanup error:', error);
      }
    }
  };

  return { paths: pdfs, cleanup };
}
