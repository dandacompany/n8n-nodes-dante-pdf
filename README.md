# n8n-nodes-dante-pdf

A powerful n8n custom node for PDF conversion with support for multiple formats. Convert Markdown, HTML, Text, DOCX, and Images to PDF with ease, or merge multiple PDFs into one.

## 🌟 Features

- **Multiple Format Support**: Convert various formats to PDF
  - 📝 **Markdown to PDF** - With theme support and Korean/CJK language support
  - 🌐 **HTML to PDF** - Full browser rendering with Chrome/Chromium
  - 📄 **Text to PDF** - Simple text conversion with formatting options
  - 📑 **DOCX to PDF** - Microsoft Word document conversion
  - 🖼️ **Image to PDF** - Convert images with layout options
  - 🔄 **PDF Merge** - Combine multiple PDFs into one

- **Advanced Features**:
  - 🌍 **Multi-language Support** - Full support for Korean, Chinese, Japanese, and other languages
  - 🎨 **Theme Support** - Multiple themes for Markdown (GitHub, Dark, Minimal)
  - 📊 **Custom Styling** - CSS customization for HTML/Markdown
  - 📄 **Page Options** - Headers, footers, page numbers
  - ⚡ **High Performance** - Optimized with Chrome/Chromium for quality and speed
  - 🔒 **System Chrome Priority** - Uses system Chrome/Chromium for better performance

## 📦 Installation

### 🐳 Docker Installation (Recommended for Production)

#### Quick Start with Docker Compose

1. Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    ports:
      - 5678:5678
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=password
    volumes:
      - n8n_data:/home/node/.n8n
      - ./custom-nodes:/home/node/.n8n/custom
    command: >
      sh -c "
        apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig &&
        npm install n8n-nodes-dante-pdf &&
        n8n start
      "

volumes:
  n8n_data:
```

2. Start the container:

```bash
docker-compose up -d
```

3. Access n8n at `http://localhost:5678`

#### Using Dockerfile (Custom Image)

Create a `Dockerfile`:

```dockerfile
FROM docker.n8n.io/n8nio/n8n:latest
USER root
# Install Chromium for web automation
RUN apk add --no-cache chromium chromium-chromedriver
# Install Firefox and all required dependencies for PDF generation
RUN apk add --no-cache \
    firefox \
    firefox-esr \
    ttf-liberation \
    fontconfig \
    gcompat \
    libstdc++ \
    dbus \
    dbus-x11 \
    mesa-gl \
    mesa-dri-gallium \
    udev \
    xvfb
# Install Playwright globally
RUN npm install -g playwright-core
# Create symbolic links for Playwright to find browsers
RUN ln -sf /usr/bin/firefox /usr/bin/firefox-stable && \
    ln -sf /usr/bin/chromium-browser /usr/bin/chromium
# Set environment variables
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH=/usr/bin/firefox

USER node

# Install the PDF node
RUN npm install n8n-nodes-dante-pdf

# The package will automatically use system Chromium
```

Build and run:

```bash
docker build -t n8n-with-pdf .
docker run -d -p 5678:5678 -v n8n_data:/home/node/.n8n n8n-with-pdf
```

### 💻 Windows Installation

#### Prerequisites for Windows

1. **Install Node.js** (18+ recommended):
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version

2. **Install Chrome or Chromium**:
   - **Option A - Google Chrome** (Recommended):
     ```
     Download from: https://www.google.com/chrome/
     ```
   
   - **Option B - Chromium**:
     ```
     Download from: https://www.chromium.org/getting-involved/download-chromium/
     ```

3. **Install n8n globally**:
   ```powershell
   npm install -g n8n
   ```

4. **Install the PDF node**:
   ```powershell
   cd %USERPROFILE%\.n8n\custom
   npm install n8n-nodes-dante-pdf
   ```

5. **Verify Chrome is detected**:
   ```powershell
   # The package will automatically find Chrome at:
   # C:\Program Files\Google\Chrome\Application\chrome.exe
   # or
   # C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
   ```

6. **Start n8n**:
   ```powershell
   n8n start
   ```

#### Troubleshooting Windows

If Chrome is not detected:

```powershell
# Set Chrome path explicitly (if needed)
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

# Or install Playwright Chrome as fallback
cd %USERPROFILE%\.n8n\custom\node_modules\n8n-nodes-dante-pdf
npx playwright install chromium
```

### 🍎 macOS Installation

#### Prerequisites for macOS

1. **Install Node.js** (18+ recommended):
   ```bash
   # Using Homebrew
   brew install node
   
   # Or download from nodejs.org
   ```

2. **Install Chrome or Chromium**:
   - **Option A - Google Chrome** (Recommended):
     ```bash
     # Download from website
     open https://www.google.com/chrome/
     
     # Or using Homebrew
     brew install --cask google-chrome
     ```
   
   - **Option B - Chromium**:
     ```bash
     brew install --cask chromium
     ```

3. **Install n8n globally**:
   ```bash
   npm install -g n8n
   ```

4. **Install the PDF node**:
   ```bash
   cd ~/.n8n/custom
   npm install n8n-nodes-dante-pdf
   ```

5. **Verify Chrome is detected**:
   ```bash
   # The package will automatically find Chrome at:
   # /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   # or
   # /Applications/Chromium.app/Contents/MacOS/Chromium
   ```

6. **Start n8n**:
   ```bash
   n8n start
   ```

#### Troubleshooting macOS

If Chrome is not detected:

```bash
# Check if Chrome is installed
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Install Playwright Chrome as fallback (if needed)
cd ~/.n8n/custom/node_modules/n8n-nodes-dante-pdf
npx playwright install chromium
```

### 🐧 Linux Installation (Ubuntu/Debian)

```bash
# Install Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
sudo apt-get update
sudo apt-get install google-chrome-stable

# Or install Chromium
sudo apt-get install chromium-browser

# Install n8n and the PDF node
npm install -g n8n
cd ~/.n8n/custom
npm install n8n-nodes-dante-pdf

# Start n8n
n8n start
```

### Manual Installation (Development)

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

## 🚀 Browser Configuration

### Priority Order

The package searches for browsers in this order:

1. **System Chrome/Chromium** (Recommended)
   - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - macOS: `/Applications/Google Chrome.app`
   - Linux: `/usr/bin/chromium` or `/usr/bin/google-chrome`

2. **Playwright Chrome** (Fallback - not available on Alpine Linux)
   - Automatically downloaded if system Chrome not found
   - Not compatible with Alpine Linux (musl libc)

### Verify Installation

After installation, verify the browser setup:

```javascript
// In n8n, create a test workflow with DantePDF node
{
  "operation": "convertToPdf",
  "conversionType": "textToPdf",
  "inputType": "text",
  "textContent": "Test PDF Generation"
}
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

## 🐛 Troubleshooting

### Common Issues

#### Browser Not Found
- **Windows**: Ensure Chrome is installed in the default location or set `CHROME_PATH` environment variable
- **macOS**: Check if Chrome.app exists in Applications folder
- **Linux**: Install chromium-browser package
- **Docker**: Ensure Chromium is installed in the container

#### Alpine Linux / Docker Issues
- Must use system Chromium (Playwright browsers don't work with musl libc)
- Install required packages: `apk add chromium chromium-chromedriver ttf-liberation fontconfig`

#### Font Issues
- Install additional fonts for better rendering
- Docker: `apk add font-noto font-noto-cjk`
- Ubuntu: `apt-get install fonts-noto fonts-noto-cjk`
- macOS: Fonts are usually pre-installed

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
- Alpine Linux requires system Chromium (Playwright incompatible)

## 📮 Support

- 📧 Email: datapod.k@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/dandacompany/n8n-nodes-dante-pdf/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/dandacompany/n8n-nodes-dante-pdf/discussions)
- 📺 YouTube: [Dante Labs](https://youtube.com/@dante-labs)
- 🎥 Tutorials: Check out our YouTube channel for tutorials and guides

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable PDF generation
- Uses [marked](https://marked.js.org/) for Markdown parsing
- Powered by [pdf-lib](https://pdf-lib.js.org/) for PDF manipulation

---

Made with ❤️ for the n8n community