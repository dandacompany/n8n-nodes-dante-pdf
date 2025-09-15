#!/bin/sh
# Docker setup script for n8n-nodes-dante-pdf in Alpine Linux containers
# This script ensures optimal Firefox setup in Docker environments

set -e

echo "🐳 [DantePDF] Docker Alpine Linux setup script"
echo "📦 Setting up Firefox for PDF generation in Docker environment"

# Detect if we're in Alpine Linux
if [ -f /etc/alpine-release ]; then
    echo "✅ Alpine Linux detected: $(cat /etc/alpine-release)"
    
    # Update package index
    echo "📦 Updating package index..."
    apk update || echo "⚠️  Package update failed, continuing..."
    
    # Install essential Firefox and compatibility packages
    echo "🦊 Installing Firefox and dependencies..."
    apk add --no-cache \
        firefox \
        firefox-esr \
        gcompat \
        libstdc++ \
        ttf-liberation \
        fontconfig \
        cairo \
        pango \
        gdk-pixbuf \
        gtk+3.0 \
        nss \
        freetype \
        harfbuzz \
        alsa-lib \
        libx11 \
        libxcomposite \
        libxdamage \
        libxext \
        libxfixes \
        libxrandr \
        libxcb \
        libxkbcommon \
        cups-libs \
        dbus-libs \
        atk \
        at-spi2-atk \
        eudev-libs \
        mesa-gbm || echo "⚠️  Some packages failed to install, continuing..."
    
    echo "✅ Alpine Linux packages installed"
    
    # Check if Firefox was installed successfully
    if command -v firefox >/dev/null 2>&1; then
        echo "✅ System Firefox available: $(firefox --version 2>/dev/null || echo 'version unknown')"
    else
        echo "⚠️  System Firefox not available, will use Playwright Firefox"
    fi
    
else
    echo "ℹ️  Not Alpine Linux, skipping system package installation"
fi

# Set up Playwright browsers directory
BROWSERS_PATH="${HOME}/.n8n/dante-pdf-browsers"
echo "📁 Setting up browser directory: $BROWSERS_PATH"
mkdir -p "$BROWSERS_PATH"

# Set environment variable
export PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_PATH"

# Install Playwright Firefox
echo "🎭 Installing Playwright Firefox..."
if command -v npx >/dev/null 2>&1; then
    npx playwright-core install firefox --force || echo "⚠️  Playwright Firefox install failed, will retry during first use"
    
    # Check if Playwright Firefox was installed
    if [ -d "$BROWSERS_PATH" ] && [ "$(ls -A "$BROWSERS_PATH")" ]; then
        echo "✅ Playwright Firefox installed in: $BROWSERS_PATH"
        ls -la "$BROWSERS_PATH" | head -5
    else
        echo "⚠️  Playwright Firefox directory is empty, installation may have failed"
    fi
else
    echo "⚠️  npx not available, skipping Playwright Firefox installation"
fi

# Verify permissions
echo "🔐 Checking permissions..."
echo "Current user: $(whoami)"
echo "User ID: $(id)"
echo "Browser directory permissions:"
ls -la "$BROWSERS_PATH" 2>/dev/null || echo "Directory not accessible"

# Test basic Firefox functionality (if available)
if command -v firefox >/dev/null 2>&1; then
    echo "🧪 Testing Firefox functionality..."
    timeout 10 firefox --headless --screenshot=/tmp/test.png about:blank >/dev/null 2>&1 && \
        echo "✅ Firefox headless mode working" || \
        echo "⚠️  Firefox test failed, may need additional configuration"
    
    # Clean up test file
    rm -f /tmp/test.png
fi

# Environment summary
echo ""
echo "📊 Docker Setup Summary:"
echo "  OS: $(uname -a)"
echo "  Alpine: $(cat /etc/alpine-release 2>/dev/null || echo 'Not Alpine')"
echo "  Browser Path: $BROWSERS_PATH"
echo "  System Firefox: $(command -v firefox >/dev/null 2>&1 && echo 'Available' || echo 'Not available')"
echo "  Playwright Firefox: $([ -d "$BROWSERS_PATH" ] && [ "$(ls -A "$BROWSERS_PATH")" ] && echo 'Installed' || echo 'Not installed')"
echo "  Node.js: $(node --version 2>/dev/null || echo 'Not available')"
echo "  npm: $(npm --version 2>/dev/null || echo 'Not available')"

echo ""
echo "🎉 Docker setup completed!"
echo "💡 If you encounter issues:"
echo "   1. Check n8n logs for detailed error information"
echo "   2. Verify all dependencies are installed: apk info firefox"
echo "   3. Check browser permissions: ls -la $BROWSERS_PATH"
echo "   4. Restart n8n container after setup"

# Return success
exit 0