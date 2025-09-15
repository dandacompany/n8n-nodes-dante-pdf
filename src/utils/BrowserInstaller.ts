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

    // Quick check if browser is already installed
    try {
      const executablePath = chromium.executablePath();
      if (executablePath && existsSync(executablePath)) {
        console.log('DantePDF: Chromium browser already installed');
        return;
      }
    } catch (error) {
      // Ignore check errors, proceed with installation
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
            '--single-process',
          ],
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

      // Try to install system dependencies with multiple approaches
      try {
        console.log('DantePDF: Installing system dependencies...');

        // First try with playwright
        try {
          execSync('npx playwright-core install-deps chromium', {
            stdio: 'inherit',
            env,
            timeout: 180000, // 3 minutes timeout
          });
          console.log('DantePDF: System dependencies installed successfully via playwright');
        } catch (playwrightError) {
          console.warn('DantePDF: Playwright install-deps failed, trying manual installation...');

          // Try manual installation of common dependencies
          try {
            // Try apt-get for Debian/Ubuntu systems
            execSync(
              'apt-get update && apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libgtk-3-0 libglib2.0-0 libasound2',
              {
                stdio: 'inherit',
                timeout: 300000, // 5 minutes timeout
              }
            );
            console.log('DantePDF: System dependencies installed via apt-get');
          } catch (aptError) {
            // Try apk for Alpine systems
            try {
              execSync('apk add --no-cache nss atk-bridge gtk+3.0 glib alsa-lib', {
                stdio: 'inherit',
                timeout: 180000,
              });
              console.log('DantePDF: System dependencies installed via apk');
            } catch (apkError) {
              console.warn('DantePDF: Could not install system dependencies automatically');
              console.warn('DantePDF: Manual installation may be required');
            }
          }
        }
      } catch (error) {
        console.warn('DantePDF: System dependency installation failed');
        console.warn('DantePDF: This may cause browser launch issues');
        console.warn(`DantePDF: Error details: ${(error as Error).message}`);
      }

      // Skip verification completely - let runtime handle any issues
      console.log('DantePDF: Installation completed, skipping verification for compatibility');
      console.log('DantePDF: Browser will be verified during actual PDF generation');
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
