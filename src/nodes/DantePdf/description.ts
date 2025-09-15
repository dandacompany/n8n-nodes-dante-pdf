import { INodeProperties } from 'n8n-workflow';

export const dantePdfDescription: INodeProperties[] = [
  // Display Options
  {
    displayName: 'Conversion Type',
    name: 'conversionType',
    type: 'options',
    options: [
      {
        name: 'Markdown to PDF',
        value: 'markdownToPdf',
        description: 'Convert Markdown content to PDF',
      },
      {
        name: 'Text to PDF',
        value: 'textToPdf',
        description: 'Convert plain text to PDF',
      },
      {
        name: 'HTML to PDF',
        value: 'htmlToPdf',
        description: 'Convert HTML content to PDF',
      },
      {
        name: 'Image to PDF',
        value: 'imageToPdf',
        description: 'Convert images to PDF',
      },
      {
        name: 'DOCX to PDF',
        value: 'docxToPdf',
        description: 'Convert Word documents to PDF',
      },
      {
        name: 'Merge PDFs',
        value: 'mergePdfs',
        description: 'Merge multiple PDF files',
      },
    ],
    default: 'markdownToPdf',
    description: 'The type of conversion to perform',
  },

  // Content Input
  {
    displayName: 'Input Source',
    name: 'inputSource',
    type: 'options',
    displayOptions: {
      hide: {
        conversionType: ['mergePdfs'],
      },
    },
    options: [
      {
        name: 'Text Content',
        value: 'content',
        description: 'Provide content directly as text',
      },
      {
        name: 'Binary Data',
        value: 'binaryData',
        description: 'Use binary data from previous node',
      },
      {
        name: 'URL',
        value: 'url',
        description: 'Fetch content from URL (HTML only)',
      },
    ],
    default: 'content',
    description: 'The source of the content to convert',
  },
  
  // Special note for PDF merge
  {
    displayName: 'PDF Merge Input',
    name: 'mergeInfo',
    type: 'notice',
    displayOptions: {
      show: {
        conversionType: ['mergePdfs'],
      },
    },
    default: '',
    description: '🔄 This node will automatically collect all PDF files from all input items and merge them into a single PDF. Connect multiple nodes with PDF outputs to merge them together.',
  },

  {
    displayName: 'Content',
    name: 'content',
    type: 'string',
    typeOptions: {
      rows: 10,
    },
    displayOptions: {
      show: {
        inputSource: ['content'],
      },
    },
    default: '',
    placeholder: 'Enter your content here...',
    description: 'The content to convert to PDF',
  },

  {
    displayName: 'Binary Property',
    name: 'binaryPropertyName',
    type: 'string',
    displayOptions: {
      show: {
        inputSource: ['binaryData'],
      },
      hide: {
        conversionType: ['mergePdfs'],
      },
    },
    default: 'data',
    required: true,
    description: 'The name of the binary property containing the data to convert',
  },

  {
    displayName: 'URL',
    name: 'url',
    type: 'string',
    displayOptions: {
      show: {
        inputSource: ['url'],
        conversionType: ['htmlToPdf'],
      },
    },
    default: '',
    placeholder: 'https://example.com',
    description: 'The URL to fetch content from',
  },

  // Common PDF Options
  {
    displayName: 'Additional Options',
    name: 'additionalOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    options: [
      {
        displayName: 'Page Format',
        name: 'format',
        type: 'options',
        options: [
          { name: 'A4', value: 'A4' },
          { name: 'A3', value: 'A3' },
          { name: 'A5', value: 'A5' },
          { name: 'Letter', value: 'Letter' },
          { name: 'Legal', value: 'Legal' },
          { name: 'Tabloid', value: 'Tabloid' },
        ],
        default: 'A4',
        description: 'Page format for the PDF',
      },
      {
        displayName: 'Landscape',
        name: 'landscape',
        type: 'boolean',
        default: false,
        description: 'Whether to use landscape orientation',
      },
      {
        displayName: 'Output Binary Property Name',
        name: 'outputPropertyName',
        type: 'string',
        default: 'data',
        description: 'Name of the binary property to store the PDF',
      },
    ],
  },

  // Markdown Options
  {
    displayName: 'Markdown Options',
    name: 'markdownOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['markdownToPdf'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Theme',
        name: 'theme',
        type: 'options',
        options: [
          { name: 'Default', value: 'default' },
          { name: 'GitHub', value: 'github' },
          { name: 'Dark', value: 'dark' },
        ],
        default: 'default',
        description: 'Theme for the Markdown rendering',
      },
      {
        displayName: 'Custom CSS',
        name: 'css',
        type: 'string',
        typeOptions: {
          rows: 5,
        },
        default: '',
        description: 'Custom CSS to apply to the Markdown',
      },
      {
        displayName: 'Scale',
        name: 'scale',
        type: 'number',
        typeOptions: {
          minValue: 0.1,
          maxValue: 3.0,
        },
        default: 1,
        description: 'Scale factor for the output',
      },
    ],
  },

  // Text Options
  {
    displayName: 'Text Options',
    name: 'textOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['textToPdf'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Font Size',
        name: 'fontSize',
        type: 'number',
        default: 12,
        description: 'Font size in points',
      },
      {
        displayName: 'Font Family',
        name: 'fontFamily',
        type: 'options',
        options: [
          { name: 'Helvetica', value: 'Helvetica' },
          { name: 'Times Roman', value: 'Times-Roman' },
          { name: 'Courier', value: 'Courier' },
          { name: 'Arial', value: 'Arial' },
        ],
        default: 'Helvetica',
        description: 'Font family to use',
      },
      {
        displayName: 'Alignment',
        name: 'alignment',
        type: 'options',
        options: [
          { name: 'Left', value: 'left' },
          { name: 'Center', value: 'center' },
          { name: 'Right', value: 'right' },
          { name: 'Justify', value: 'justify' },
        ],
        default: 'left',
        description: 'Text alignment',
      },
      {
        displayName: 'Line Height',
        name: 'lineHeight',
        type: 'number',
        typeOptions: {
          minValue: 0.5,
          maxValue: 3.0,
        },
        default: 1.2,
        description: 'Line height multiplier',
      },
      {
        displayName: 'Add Page Numbers',
        name: 'pageNumbers',
        type: 'boolean',
        default: false,
        description: 'Whether to add page numbers',
      },
    ],
  },

  // HTML Options
  {
    displayName: 'HTML Options',
    name: 'htmlOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['htmlToPdf'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Print Background',
        name: 'printBackground',
        type: 'boolean',
        default: false,
        description: 'Whether to print background graphics',
      },
      {
        displayName: 'Display Header/Footer',
        name: 'displayHeaderFooter',
        type: 'boolean',
        default: false,
        description: 'Whether to display header and footer',
      },
      {
        displayName: 'Scale',
        name: 'scale',
        type: 'number',
        typeOptions: {
          minValue: 0.1,
          maxValue: 3.0,
        },
        default: 1,
        description: 'Scale factor for the output',
      },
      {
        displayName: 'Ignore HTTPS Errors',
        name: 'ignoreHTTPSErrors',
        type: 'boolean',
        default: false,
        description: 'Whether to ignore HTTPS certificate errors',
      },
    ],
  },

  // Image Options
  {
    displayName: 'Image Options',
    name: 'imageOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['imageToPdf'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Fit',
        name: 'fit',
        type: 'options',
        options: [
          { name: 'Contain', value: 'contain' },
          { name: 'Cover', value: 'cover' },
          { name: 'Fill', value: 'fill' },
          { name: 'Scale Down', value: 'scale-down' },
        ],
        default: 'contain',
        description: 'How to fit the image on the page',
      },
      {
        displayName: 'Position',
        name: 'position',
        type: 'options',
        options: [
          { name: 'Center', value: 'center' },
          { name: 'Top', value: 'top' },
          { name: 'Bottom', value: 'bottom' },
        ],
        default: 'center',
        description: 'Position of the image on the page',
      },
      {
        displayName: 'Images Per Page',
        name: 'imagesPerPage',
        type: 'number',
        default: 1,
        description: 'Number of images to place on each page',
      },
      {
        displayName: 'Quality',
        name: 'quality',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 85,
        description: 'Image quality (1-100)',
      },
      {
        displayName: 'Include Metadata',
        name: 'includeMetadata',
        type: 'boolean',
        default: false,
        description: 'Whether to include image metadata in the PDF',
      },
    ],
  },

  // DOCX Options
  {
    displayName: 'DOCX Options',
    name: 'docsOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['docxToPdf'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Preserve Styles',
        name: 'preserveStyles',
        type: 'boolean',
        default: true,
        description: 'Whether to preserve document styles',
      },
      {
        displayName: 'Preserve Images',
        name: 'preserveImages',
        type: 'boolean',
        default: true,
        description: 'Whether to preserve embedded images',
      },
      {
        displayName: 'Preserve Links',
        name: 'preserveLinks',
        type: 'boolean',
        default: true,
        description: 'Whether to preserve hyperlinks',
      },
      {
        displayName: 'Image Quality',
        name: 'imageQuality',
        type: 'options',
        options: [
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
        ],
        default: 'medium',
        description: 'Quality of embedded images',
      },
    ],
  },

  // PDF Sources for Merge
  {
    displayName: 'PDF Sources',
    name: 'pdfSources',
    type: 'fixedCollection',
    placeholder: 'Add PDF Source',
    typeOptions: {
      multipleValues: true,
    },
    displayOptions: {
      show: {
        conversionType: ['mergePdfs'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Sources',
        name: 'sources',
        values: [
          {
            displayName: 'Source Type',
            name: 'sourceType',
            type: 'options',
            default: 'binary',
            options: [
              {
                name: 'Binary Data',
                value: 'binary',
                description: 'Use binary data from previous node',
              },
              {
                name: 'URL',
                value: 'url',
                description: 'Download PDF from URL',
              },
            ],
          },
          {
            displayName: 'Binary Property',
            name: 'binaryProperty',
            type: 'string',
            default: 'data',
            required: true,
            displayOptions: {
              show: {
                sourceType: ['binary'],
              },
            },
            description: 'Name of the binary property containing the PDF',
          },
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            required: true,
            displayOptions: {
              show: {
                sourceType: ['url'],
              },
            },
            placeholder: 'https://example.com/document.pdf',
            description: 'URL of the PDF to download',
          },
        ],
      },
    ],
    description: 'Add PDF sources to merge',
  },

  // Merge Options
  {
    displayName: 'Merge Options',
    name: 'mergeOptions',
    type: 'collection',
    placeholder: 'Add Option',
    displayOptions: {
      show: {
        conversionType: ['mergePdfs'],
      },
    },
    default: {},
    options: [
      {
        displayName: 'Remove Blank Pages',
        name: 'removeBlankPages',
        type: 'boolean',
        default: false,
        description: 'Whether to remove blank pages during merge',
      },
      {
        displayName: 'Compress',
        name: 'compress',
        type: 'boolean',
        default: false,
        description: 'Whether to compress the merged PDF',
      },
      {
        displayName: 'Remove Metadata',
        name: 'removeMetadata',
        type: 'boolean',
        default: false,
        description: 'Whether to remove metadata from the merged PDF',
      },
      {
        displayName: 'Page Ranges',
        name: 'pageRanges',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        description: 'Specify page ranges for each file',
        options: [
          {
            name: 'ranges',
            displayName: 'Page Range',
            values: [
              {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: '',
                description: 'Name of the file',
              },
              {
                displayName: 'Pages',
                name: 'pages',
                type: 'string',
                default: '',
                placeholder: '1-3,5,7-9',
                description: 'Page range (e.g., "1-3,5,7-9")',
              },
            ],
          },
        ],
      },
    ],
  },
];
