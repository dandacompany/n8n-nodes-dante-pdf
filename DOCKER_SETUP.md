# Docker Setup Guide for n8n-nodes-dante-pdf

This guide provides instructions for setting up n8n-nodes-dante-pdf in Docker environments, particularly Alpine Linux containers.

## Quick Start for Alpine Linux

The package uses **system Chrome/Chromium** for optimal Alpine Linux compatibility. Playwright bundled browsers do NOT work on Alpine due to musl/glibc incompatibility.

### Requirements

- System Chromium must be installed in the container
- Alpine Linux containers require musl-compatible binaries

### Installation

```bash
# Install the package
npm install n8n-nodes-dante-pdf

# System Chromium will be automatically detected and used
```

## Docker Compose Example

```yaml
services:
  n8n:
    build: .
    ports:
      - 5678:5678
    environment:
      - GENERIC_TIMEZONE=Asia/Seoul
      - TZ=Asia/Seoul
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - N8N_RUNNERS_ENABLED=true
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - n8n_network

volumes:
  n8n_data:
    driver: local

networks:
  n8n_network:
    driver: bridge
```

## Dockerfile Example

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

# Install the n8n-nodes-dante-pdf package
RUN npm install n8n-nodes-dante-pdf

# The package will automatically detect and use system Chromium
```

## Minimal Dockerfile (Essential Only)

```dockerfile
FROM docker.n8n.io/n8nio/n8n:latest

USER root

# Install only essential packages
RUN apk add --no-cache chromium chromium-chromedriver ttf-liberation fontconfig

USER node

RUN npm install n8n-nodes-dante-pdf
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | Skip Playwright browser download (recommended for Alpine) | `1` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Path to system Chromium | `/usr/bin/chromium` |

## Building and Running

### Using Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Using Docker CLI

```bash
# Build the image
docker build -t n8n-with-pdf .

# Run the container
docker run -d \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  --name n8n \
  n8n-with-pdf

# View logs
docker logs -f n8n
```

## Troubleshooting

### Verify Chromium Installation

```bash
# Enter the container
docker exec -it n8n sh

# Check if Chromium is installed
chromium --version
which chromium

# Test Chromium headless mode
chromium --headless --disable-gpu --print-to-pdf=/tmp/test.pdf https://example.com
```

### Common Issues and Solutions

#### Issue: "No Chrome/Chromium browser found"

**Solution:**
```bash
# Ensure Chromium is installed
apk add --no-cache chromium chromium-chromedriver
```

#### Issue: Font rendering problems

**Solution:**
```bash
# Install additional fonts
apk add --no-cache ttf-liberation fontconfig font-noto
```

#### Issue: Permission denied errors

**Solution:**
```bash
# Check user permissions
whoami  # Should be 'node' for n8n operations

# If running as root (not recommended)
su - node
```

#### Issue: Alpine-specific errors

**Solution:**
```bash
# Verify you're on Alpine
cat /etc/os-release

# Check libc type (should be musl)
ldd --version

# Install Alpine compatibility packages if needed
apk add --no-cache libstdc++ gcompat
```

### Debug Mode

Enable detailed logging to troubleshoot issues:

```bash
# Check n8n logs
docker logs n8n 2>&1 | grep DantePDF

# Run with debug output
docker run -it --rm \
  -e DEBUG=* \
  n8n-with-pdf
```

## Performance Optimization

The package automatically applies Alpine-specific optimizations:

- Uses system Chromium (no Playwright overhead)
- Single process mode for container compatibility
- Disabled GPU acceleration (not available in containers)
- Optimized memory usage with `--no-sandbox` flag
- Minimal resource consumption

### Recommended Container Resources

```yaml
# docker-compose.yml
services:
  n8n:
    # ... other config ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Security Considerations

### Running in Production

1. **Non-root User**: Always run n8n as the `node` user (default in official image)
2. **Network Isolation**: Use Docker networks to isolate services
3. **Volume Permissions**: Ensure proper permissions on mounted volumes
4. **Resource Limits**: Set memory and CPU limits to prevent resource exhaustion

### Browser Security Flags

The package uses these security-related flags:
- `--no-sandbox`: Required for Docker containers
- `--disable-setuid-sandbox`: Prevents privilege escalation
- `--disable-dev-shm-usage`: Uses /tmp instead of /dev/shm

## Multi-Architecture Support

### AMD64 (x86_64)
```dockerfile
FROM docker.n8n.io/n8nio/n8n:latest
# Standard installation works
```

### ARM64 (Apple Silicon, AWS Graviton)
```dockerfile
FROM docker.n8n.io/n8nio/n8n:latest
# Chromium ARM64 build is used automatically
```

## Advanced Configuration

### Custom Fonts

```dockerfile
# Add custom fonts for specific languages
RUN apk add --no-cache \
    font-noto-cjk \     # Chinese, Japanese, Korean
    font-noto-arabic \  # Arabic
    font-noto-thai      # Thai
```

### Proxy Configuration

```dockerfile
# If behind a corporate proxy
ENV HTTP_PROXY=http://proxy.company.com:8080
ENV HTTPS_PROXY=http://proxy.company.com:8080
ENV NO_PROXY=localhost,127.0.0.1
```

### Custom Chromium Flags

```javascript
// In your n8n workflow, you can pass custom options
{
  "browserOptions": {
    "headless": true,
    "args": ["--window-size=1920,1080"]
  }
}
```

## Testing the Installation

Create a simple n8n workflow to test PDF generation:

1. Add a "Dante PDF" node
2. Configure it with:
   - Type: "Text to PDF"
   - Content: "Hello World"
3. Execute the workflow
4. Verify PDF is generated successfully

## Known Limitations

- **Alpine Linux**: Must use system Chromium (Playwright browsers incompatible)
- **Fonts**: Limited font selection in minimal Alpine containers
- **GPU**: No GPU acceleration in containers
- **Audio/Video**: Media features disabled for PDF generation

## Support

For Docker-specific issues:

1. Verify Chromium is installed: `chromium --version`
2. Check container logs: `docker logs n8n`
3. Ensure running as correct user: `whoami`
4. Test with minimal configuration first
5. Report issues at: https://github.com/your-repo/issues

## Version Compatibility

| n8n Version | Package Version | Notes |
|-------------|-----------------|-------|
| 1.0.0+ | 2.2.0+ | Chrome/Chromium based |
| 1.0.0+ | 2.0.x-2.1.x | Firefox based (deprecated) |
| 0.x.x | 1.x.x | Legacy Chrome implementation |

## Migration from Firefox (v2.0.x-2.1.x)

If upgrading from Firefox-based versions:

1. Update package: `npm install n8n-nodes-dante-pdf@latest`
2. Install Chromium: `apk add --no-cache chromium chromium-chromedriver`
3. Remove Firefox (optional): `apk del firefox firefox-esr`
4. Restart n8n container

The package will automatically detect and use the system Chromium.