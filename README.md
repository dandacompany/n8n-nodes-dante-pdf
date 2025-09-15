# n8n-nodes-dante-pdf

A powerful n8n custom node for PDF conversion with support for multiple formats. Convert Markdown, HTML, Text, DOCX, and Images to PDF with ease, or merge multiple PDFs into one.

## 🌟 Features

- **Multiple Format Support**: Convert various formats to PDF
  - 📝 **Markdown to PDF** - With theme support and Korean/CJK language support
  - 🌐 **HTML to PDF** - Full browser rendering with Playwright
  - 📄 **Text to PDF** - Simple text conversion with formatting options
  - 📑 **DOCX to PDF** - Microsoft Word document conversion
  - 🖼️ **Image to PDF** - Convert images with layout options
  - 🔄 **PDF Merge** - Combine multiple PDFs into one

- **Advanced Features**:
  - 🌍 **Multi-language Support** - Full support for Korean, Chinese, Japanese, and other languages
  - 🎨 **Theme Support** - Multiple themes for Markdown (GitHub, Dark, Minimal)
  - 📊 **Custom Styling** - CSS customization for HTML/Markdown
  - 📄 **Page Options** - Headers, footers, page numbers
  - ⚡ **High Performance** - Optimized with Playwright for quality and speed
  - 🔒 **No System Dependencies** - Automatic browser management

## 📦 Installation

### In n8n (Recommended)

1. Go to **Settings** > **Community Nodes**
2. Search for `n8n-nodes-dante-pdf`
3. Click **Install**

### Manual Installation

```bash
# Navigate to your n8n custom nodes folder
cd ~/.n8n/custom

# Clone the repository
git clone https://github.com/dante-pdf/n8n-nodes-dante-pdf.git

# Install dependencies
cd n8n-nodes-dante-pdf
npm install

# Build the node
npm run build

# Restart n8n
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/dante-pdf/n8n-nodes-dante-pdf.git
cd n8n-nodes-dante-pdf

# Install dependencies
npm install

# Build and link to n8n
npm run build
npm run link

# Start n8n
n8n start
```

## 🚀 Usage

### Basic Workflow Example

1. Add a **DantePDF** node to your workflow
2. Select the operation: **Convert to PDF**
3. Choose conversion type (e.g., Markdown to PDF)
4. Configure options:
   - Input source (text, file, or binary data)
   - Format options (A4, Letter, etc.)
   - Theme (for Markdown)
   - Additional settings

### Markdown to PDF

```javascript
// Node configuration
{
  "operation": "convertToPdf",
  "conversionType": "markdownToPdf",
  "inputType": "text",
  "markdownContent": "# Hello World\n\nThis is **markdown** content.",
  "markdownOptions": {
    "format": "A4",
    "theme": "github",
    "displayHeaderFooter": true
  }
}
```

### HTML to PDF

```javascript
// Node configuration
{
  "operation": "convertToPdf",
  "conversionType": "htmlToPdf",
  "inputType": "text",
  "htmlContent": "<h1>Hello World</h1><p>HTML content</p>",
  "htmlOptions": {
    "format": "A4",
    "printBackground": true,
    "waitUntil": "networkidle"
  }
}
```

## 🎨 Markdown Themes

The node includes 4 built-in themes for Markdown conversion:

- **Default** - Clean and professional
- **GitHub** - GitHub-style markdown rendering
- **Dark** - Dark mode theme
- **Minimal** - Simple, typography-focused

## 🌏 Language Support

Full support for international languages including:
- 🇰🇷 Korean (한국어)
- 🇨🇳 Chinese (中文)
- 🇯🇵 Japanese (日本語)
- And many more...

The node automatically handles font embedding for proper rendering of all languages.

## ⚙️ Configuration Options

### Common Options
- `format`: Page size (A4, A3, A5, Letter, Legal, Tabloid)
- `landscape`: Landscape orientation
- `displayHeaderFooter`: Show header and footer
- `scale`: Scale of the webpage rendering (0.1 - 2)

### Markdown Specific
- `theme`: Visual theme
- `printBackground`: Print background graphics
- `pageRanges`: Page ranges to print (e.g., '1-5, 8, 11-13')

### HTML Specific
- `waitUntil`: When to consider navigation succeeded
- `waitFor`: Wait for specific element or timeout
- `executeScript`: JavaScript to execute before conversion

## 🛠️ Development

### Prerequisites
- Node.js 18+
- n8n 1.0+
- TypeScript 5+

### Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format code
npm run format
```

### Project Structure

```
n8n-nodes-dante-pdf/
├── src/
│   ├── nodes/          # n8n node definitions
│   ├── converters/     # Format converters
│   ├── utils/          # Utility functions
│   └── types.ts        # TypeScript types
├── test/               # Test files
├── package.json
└── tsconfig.json
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific converter
node test/test-markdown-converter.js
node test/test-html-converter.js

# Test with Korean content
node test/test-korean-converter.js
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- Large files (>50MB) may cause memory issues
- Some complex CSS animations may not render in HTML to PDF

## 📮 Support

- 📧 Email: support@dantepdf.com
- 🐛 Issues: [GitHub Issues](https://github.com/dante-pdf/n8n-nodes-dante-pdf/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/dante-pdf/n8n-nodes-dante-pdf/discussions)
- 📖 Docs: [Documentation Site](https://docs.dantepdf.com)
- 📺 YouTube: [Dante Labs](https://youtube.com/@dante-labs)
- 🎥 Tutorials: Check out our YouTube channel for tutorials and guides

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable PDF generation
- Uses [marked](https://marked.js.org/) for Markdown parsing
- Powered by [pdf-lib](https://pdf-lib.js.org/) for PDF manipulation

---

Made with ❤️ for the n8n community