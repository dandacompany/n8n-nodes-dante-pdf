import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { chromium } from 'playwright-core';
import { execSync } from 'child_process';

export class BrowserInstaller {
  private static instance: BrowserInstaller;
  private installationPath: string;
  private isInstalling: boolean = false;
  private installPromise: Promise<void> | null = null;

  private constructor() {
    // Set custom path for browser binaries
    this.installationPath = join(homedir(), '.n8n', 'dante-pdf-browsers');
    
    // Ensure directory exists
    if (!existsSync(this.installationPath)) {
      mkdirSync(this.installationPath, { recursive: true });
    }

    // Set environment variable for Playwright
    process.env.PLAYWRIGHT_BROWSERS_PATH = this.installationPath;
  }

  static getInstance(): BrowserInstaller {
    if (!BrowserInstaller.instance) {
      BrowserInstaller.instance = new BrowserInstaller();
    }
    return BrowserInstaller.instance;
  }

  async ensureBrowserInstalled(): Promise<void> {
    // If already installing, wait for that to complete
    if (this.isInstalling && this.installPromise) {
      return this.installPromise;
    }

    // Check if browser is already installed
    const browserInstalled = await this.checkBrowserInstalled();
    if (browserInstalled) {
      console.log('DantePDF: Chromium browser already installed');
      return;
    }

    // Start installation
    this.isInstalling = true;
    console.log('DantePDF: Installing Chromium browser for PDF generation...');
    
    this.installPromise = this.installBrowser();
    
    try {
      await this.installPromise;
      console.log('DantePDF: Chromium installation completed');
    } catch (error) {
      console.error('DantePDF: Failed to install Chromium:', error);
      throw error;
    } finally {
      this.isInstalling = false;
      this.installPromise = null;
    }
  }

  private async checkBrowserInstalled(): Promise<boolean> {
    try {
      // Try to get executable path for chromium
      const executablePath = chromium.executablePath();
      if (!executablePath || !existsSync(executablePath)) {
        console.log(`DantePDF: Chromium not found at ${executablePath}`);
        return false;
      }
      return true;
    } catch (error) {
      console.log('DantePDF: Chromium not installed');
      return false;
    }
  }

  private async installBrowser(): Promise<void> {
    try {
      console.log('DantePDF: Installing Chromium...');
      
      // Use npx to run playwright install for chromium only
      const command = 'npx playwright-core install chromium';
      
      execSync(command, {
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: this.installationPath,
        },
      });
      
      console.log('DantePDF: Chromium installed successfully');

      // Try to install system dependencies (may require sudo)
      try {
        console.log('DantePDF: Installing system dependencies...');
        execSync('npx playwright-core install-deps chromium', {
          stdio: 'inherit',
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: this.installationPath,
          },
        });
      } catch (error) {
        // System dependencies might require sudo, so we'll just warn
        console.warn('DantePDF: Could not install system dependencies. Some features might not work.');
        console.warn('DantePDF: You may need to run: npx playwright-core install-deps chromium');
      }
    } catch (error) {
      throw new Error(`Failed to install Chromium: ${(error as Error).message}`);
    }
  }

  getInstallationPath(): string {
    return this.installationPath;
  }

  async getBrowserExecutablePath(): Promise<string | undefined> {
    try {
      return chromium.executablePath();
    } catch (error) {
      console.error('DantePDF: Failed to get executable path for Chromium:', error);
      return undefined;
    }
  }
}