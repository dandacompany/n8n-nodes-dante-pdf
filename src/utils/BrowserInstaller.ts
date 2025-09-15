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

      console.log(`DantePDF: Chromium executable found at ${executablePath}`);
      
      // For basic verification, just check if the file exists and is executable
      // Skip the actual browser launch test as it might fail in headless server environments
      try {
        // Try a quick launch test with a very short timeout
        console.log('DantePDF: Quick verification of Chromium...');
        const browser = await chromium.launch({ 
          headless: true,
          timeout: 3000,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
          ]
        });
        await browser.close();
        console.log('DantePDF: Chromium verification successful');
        return true;
      } catch (launchError) {
        // If launch fails, still consider it installed if the executable exists
        // This is important for Docker/headless environments
        console.warn('DantePDF: Chromium launch test failed, but executable exists:', launchError);
        console.log('DantePDF: Considering Chromium as installed (executable exists)');
        return true;
      }
    } catch (error) {
      console.log('DantePDF: Chromium verification failed:', error);
      return false;
    }
  }

  private async installBrowser(): Promise<void> {
    try {
      console.log('DantePDF: Installing Chromium...');
      
      // Set environment for the installation
      const env = {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: this.installationPath,
        // Force installation even if already exists
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: undefined,
      };
      
      // Use npx to run playwright install for chromium only
      const command = 'npx playwright-core install chromium --force';
      
      console.log(`DantePDF: Running command: ${command}`);
      console.log(`DantePDF: Browser path: ${this.installationPath}`);
      
      execSync(command, {
        stdio: 'inherit',
        env,
        timeout: 300000, // 5 minutes timeout
      });
      
      console.log('DantePDF: Chromium installed successfully');

      // Try to install system dependencies (may require sudo)
      try {
        console.log('DantePDF: Installing system dependencies...');
        execSync('npx playwright-core install-deps chromium', {
          stdio: 'inherit',
          env,
          timeout: 180000, // 3 minutes timeout
        });
        console.log('DantePDF: System dependencies installed successfully');
      } catch (error) {
        // System dependencies might require sudo, so we'll just warn
        console.warn('DantePDF: Could not install system dependencies. Some features might not work.');
        console.warn('DantePDF: You may need to run: npx playwright-core install-deps chromium');
        console.warn(`DantePDF: Error details: ${(error as Error).message}`);
      }

      // Final verification - just check if executable exists
      try {
        const executablePath = chromium.executablePath();
        if (!executablePath || !existsSync(executablePath)) {
          throw new Error(`Browser executable not found after installation: ${executablePath}`);
        }
        console.log(`DantePDF: Installation verification passed - executable exists at ${executablePath}`);
      } catch (verifyError) {
        console.warn('DantePDF: Post-installation verification failed:', verifyError);
        // Don't throw error, just warn - let runtime execution handle browser issues
        console.log('DantePDF: Proceeding despite verification warning - will retry at runtime if needed');
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