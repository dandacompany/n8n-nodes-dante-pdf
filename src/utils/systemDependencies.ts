// We'll detect libc without external dependencies to avoid conflicts with sharp
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface SystemInfo {
  platform: string;
  arch: string;
  libc: string | null;
  distro?: string;
  isWSL?: boolean;
  osVersion?: string;
}

interface InstallResult {
  success: boolean;
  message: string;
  installedPackages?: string[];
  failedPackages?: string[];
}

export class SystemDependencyInstaller {
  private static systemInfo: SystemInfo | null = null;
  private static readonly logger = {
    info: (msg: string) => console.log(`[DantePDF] ${msg}`),
    warn: (msg: string) => console.warn(`[DantePDF] ⚠️  ${msg}`),
    error: (msg: string) => console.error(`[DantePDF] ❌ ${msg}`),
    success: (msg: string) => console.log(`[DantePDF] ✅ ${msg}`)
  };

  static async detectSystem(): Promise<SystemInfo> {
    if (this.systemInfo) return this.systemInfo;

    const platform = process.platform;
    const arch = process.arch;
    // Detect libc type without external dependencies
    let libc: string | null = null;
    if (platform === 'linux') {
      try {
        // Check for musl (Alpine Linux)
        if (fs.existsSync('/etc/alpine-release')) {
          libc = 'musl';
        } else {
          // Try to detect from ldd output
          const { stdout } = await execAsync('ldd --version 2>&1', { timeout: 3000 });
          if (stdout.includes('musl')) {
            libc = 'musl';
          } else if (stdout.includes('GNU') || stdout.includes('glibc')) {
            libc = 'glibc';
          }
        }
      } catch (error) {
        // Fallback: assume glibc for non-Alpine Linux
        libc = fs.existsSync('/etc/alpine-release') ? 'musl' : 'glibc';
      }
    }

    let distro = 'unknown';
    let isWSL = false;
    let osVersion = '';

    try {
      if (platform === 'win32') {
        // Windows detection
        const { stdout } = await execAsync('wmic os get Caption,Version /format:csv', { timeout: 5000 });
        const lines = stdout.split('\n').filter(line => line.includes('Microsoft'));
        if (lines.length > 0 && lines[0]) {
          const parts = lines[0].split(',');
          osVersion = parts[2]?.trim() || '';
          distro = 'windows';
        }

        // Check for WSL
        try {
          const { stdout: wslCheck } = await execAsync('wsl --list --quiet', { timeout: 3000 });
          isWSL = wslCheck.length > 0;
        } catch (error) {
          // WSL not available
        }

      } else if (platform === 'linux') {
        // Linux distribution detection
        if (fs.existsSync('/etc/alpine-release')) {
          distro = 'alpine';
          osVersion = fs.readFileSync('/etc/alpine-release', 'utf8').trim();
        } else if (fs.existsSync('/etc/debian_version')) {
          distro = 'debian';
          osVersion = fs.readFileSync('/etc/debian_version', 'utf8').trim();
        } else if (fs.existsSync('/etc/redhat-release')) {
          distro = 'redhat';
          osVersion = fs.readFileSync('/etc/redhat-release', 'utf8').trim();
        } else if (fs.existsSync('/etc/arch-release')) {
          distro = 'arch';
        }

        // Check for WSL on Linux
        try {
          const { stdout } = await execAsync('uname -r', { timeout: 3000 });
          isWSL = stdout.toLowerCase().includes('microsoft') || stdout.toLowerCase().includes('wsl');
        } catch (error) {
          // Ignore error
        }

      } else if (platform === 'darwin') {
        distro = 'macos';
        try {
          const { stdout } = await execAsync('sw_vers -productVersion', { timeout: 3000 });
          osVersion = stdout.trim();
        } catch (error) {
          // Ignore error
        }
      }
    } catch (error) {
      this.logger.warn(`System detection failed: ${(error as Error).message}`);
    }

    this.systemInfo = { platform, arch, libc, distro, isWSL, osVersion };
    this.logger.info(`Detected system: ${platform}/${arch}, distro: ${distro}, libc: ${libc}, WSL: ${isWSL}`);
    
    return this.systemInfo;
  }

  static async installDependencies(): Promise<InstallResult> {
    const systemInfo = await this.detectSystem();
    this.logger.info('Starting automatic dependency installation...');

    try {
      if (systemInfo.platform === 'win32') {
        return await this.installWindowsDependencies(systemInfo);
      } else if (systemInfo.platform === 'linux') {
        if (systemInfo.isWSL) {
          return await this.installWSLDependencies(systemInfo);
        } else if (systemInfo.distro === 'alpine') {
          return await this.installAlpineDependencies(systemInfo);
        } else if (systemInfo.distro === 'debian') {
          return await this.installDebianDependencies(systemInfo);
        } else if (systemInfo.distro === 'redhat') {
          return await this.installRedHatDependencies(systemInfo);
        } else if (systemInfo.distro === 'arch') {
          return await this.installArchDependencies(systemInfo);
        }
      } else if (systemInfo.platform === 'darwin') {
        return await this.installMacOSDependencies(systemInfo);
      }

      return {
        success: true,
        message: `No dependency installation required for ${systemInfo.platform}/${systemInfo.distro}`
      };

    } catch (error) {
      const errorMsg = `Failed to install system dependencies: ${(error as Error).message}`;
      this.logger.error(errorMsg);
      return {
        success: false,
        message: errorMsg
      };
    }
  }

  private static async installWindowsDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing Windows dependencies...');
    
    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      // Check if Chocolatey is available
      const hasChoco = await this.checkCommand('choco --version');
      
      if (hasChoco) {
        const packages = ['vcredist2019', 'visualcpp-build-tools'];
        
        for (const pkg of packages) {
          try {
            this.logger.info(`Installing ${pkg} via Chocolatey...`);
            await execAsync(`choco install ${pkg} -y`, { timeout: 300000 });
            installedPackages.push(pkg);
            this.logger.success(`Installed ${pkg}`);
          } catch (error) {
            this.logger.warn(`Failed to install ${pkg}: ${(error as Error).message}`);
            failedPackages.push(pkg);
          }
        }
      } else {
        this.logger.warn('Chocolatey not found. Please install Visual C++ Redistributable manually.');
      }

      // Check if Windows Features can be enabled
      try {
        // Enable Windows Subsystem for Linux (optional)
        this.logger.info('Checking Windows optional features...');
        // Non-destructive check only
      } catch (error) {
        this.logger.warn('Could not check Windows features');
      }

      return {
        success: true,
        message: `Windows dependencies installation completed. Installed: ${installedPackages.length}, Failed: ${failedPackages.length}`,
        installedPackages,
        failedPackages
      };

    } catch (error) {
      return {
        success: false,
        message: `Windows dependency installation failed: ${(error as Error).message}`,
        failedPackages
      };
    }
  }

  private static async installWSLDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing WSL (Windows Subsystem for Linux) dependencies...');
    
    // WSL usually runs Ubuntu/Debian, so use Debian installation
    const debianResult = await this.installDebianDependencies(systemInfo);
    
    // Additional WSL-specific optimizations
    try {
      // WSL-specific environment variables
      process.env.DISPLAY = process.env.DISPLAY || ':0';
      process.env.PULSE_RUNTIME_PATH = process.env.PULSE_RUNTIME_PATH || '/mnt/wslg/runtime';
      
      this.logger.info('WSL environment optimized');
    } catch (error) {
      this.logger.warn(`WSL optimization failed: ${(error as Error).message}`);
    }

    return {
      ...debianResult,
      message: `WSL ${debianResult.message}`
    };
  }

  private static async installAlpineDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing Alpine Linux dependencies...');
    
    const packages = [
      'gcompat',           // glibc compatibility
      'libstdc++',         // C++ standard library
      'chromium',          // System Chromium (fallback)
      'ttf-liberation',    // Fonts
      'fontconfig',        // Font configuration
      'cairo',             // Graphics library
      'pango',             // Text rendering
      'gdk-pixbuf',        // Image loading
      'gtk+3.0',           // GTK (for some dependencies)
      'nss',               // Network Security Services
      'freetype',          // Font rendering
      'harfbuzz',          // Text shaping
      'alsa-lib',          // ALSA sound library (required even in headless mode)
      'alsa-lib-dev',      // ALSA development files
      'pulseaudio-libs'    // PulseAudio libraries (fallback for audio)
    ];

    // Additional packages for musl environments
    if (systemInfo.libc === 'musl') {
      packages.push('glib', 'atk', 'at-spi2-atk', 'cups-libs');
    }

    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      // Update package index first
      await execAsync('apk update', { timeout: 60000 });
      this.logger.info('Package index updated');

      for (const pkg of packages) {
        try {
          // Check if package is already installed
          const { stdout } = await execAsync(`apk info ${pkg} 2>/dev/null || echo "not_installed"`, { timeout: 10000 });
          
          if (stdout.includes('not_installed')) {
            this.logger.info(`Installing ${pkg}...`);
            await execAsync(`apk add --no-cache ${pkg}`, { timeout: 120000 });
            installedPackages.push(pkg);
            this.logger.success(`Installed ${pkg}`);
          } else {
            this.logger.info(`${pkg} already installed`);
            installedPackages.push(pkg);
          }
        } catch (error) {
          this.logger.warn(`Failed to install ${pkg}: ${(error as Error).message}`);
          failedPackages.push(pkg);
        }
      }

      return {
        success: failedPackages.length < packages.length / 2, // Success if more than half succeeded
        message: `Alpine dependencies installation completed. Installed: ${installedPackages.length}, Failed: ${failedPackages.length}`,
        installedPackages,
        failedPackages
      };

    } catch (error) {
      return {
        success: false,
        message: `Alpine dependency installation failed: ${(error as Error).message}`,
        failedPackages
      };
    }
  }

  private static async installDebianDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing Debian/Ubuntu dependencies...');
    
    const packages = [
      'libnss3',
      'libatk-bridge2.0-0',
      'libxcomposite1',
      'libxdamage1',
      'libxrandr2',
      'libgbm1',
      'libxss1',
      'libasound2',
      'libatspi2.0-0',
      'libgtk-3-0',
      'libgdk-pixbuf2.0-0',
      'libglib2.0-0',
      'fonts-liberation',
      'libappindicator3-1',
      'xdg-utils'
    ];

    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      // Update package index
      this.logger.info('Updating package index...');
      await execAsync('apt-get update -qq', { timeout: 120000 });
      
      // Install packages in batch for efficiency
      try {
        const installCmd = `apt-get install -y ${packages.join(' ')}`;
        this.logger.info('Installing packages in batch...');
        await execAsync(installCmd, { timeout: 300000 });
        installedPackages.push(...packages);
        this.logger.success(`Installed all packages successfully`);
      } catch (batchError) {
        // If batch install fails, try individual installation
        this.logger.warn('Batch installation failed, trying individual packages...');
        
        for (const pkg of packages) {
          try {
            await execAsync(`apt-get install -y ${pkg}`, { timeout: 60000 });
            installedPackages.push(pkg);
            this.logger.success(`Installed ${pkg}`);
          } catch (error) {
            this.logger.warn(`Failed to install ${pkg}: ${(error as Error).message}`);
            failedPackages.push(pkg);
          }
        }
      }

      return {
        success: failedPackages.length < packages.length / 2,
        message: `Debian dependencies installation completed. Installed: ${installedPackages.length}, Failed: ${failedPackages.length}`,
        installedPackages,
        failedPackages
      };

    } catch (error) {
      return {
        success: false,
        message: `Debian dependency installation failed: ${(error as Error).message}`,
        failedPackages
      };
    }
  }

  private static async installRedHatDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing RedHat/CentOS dependencies...');
    
    const packages = [
      'nss',
      'atk',
      'cups-libs',
      'gtk3',
      'libXcomposite',
      'libXdamage',
      'libXrandr',
      'libgbm',
      'libXss',
      'alsa-lib'
    ];

    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      // Try yum first, then dnf
      const packageManager = await this.checkCommand('dnf --version') ? 'dnf' : 'yum';
      this.logger.info(`Using ${packageManager} package manager...`);

      for (const pkg of packages) {
        try {
          await execAsync(`${packageManager} install -y ${pkg}`, { timeout: 120000 });
          installedPackages.push(pkg);
          this.logger.success(`Installed ${pkg}`);
        } catch (error) {
          this.logger.warn(`Failed to install ${pkg}: ${(error as Error).message}`);
          failedPackages.push(pkg);
        }
      }

      return {
        success: failedPackages.length < packages.length / 2,
        message: `RedHat dependencies installation completed. Installed: ${installedPackages.length}, Failed: ${failedPackages.length}`,
        installedPackages,
        failedPackages
      };

    } catch (error) {
      return {
        success: false,
        message: `RedHat dependency installation failed: ${(error as Error).message}`,
        failedPackages
      };
    }
  }

  private static async installArchDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing Arch Linux dependencies...');
    
    const packages = [
      'nss',
      'atk',
      'gtk3',
      'libxcomposite',
      'libxdamage',
      'libxrandr',
      'mesa',
      'libxss',
      'alsa-lib'
    ];

    const installedPackages: string[] = [];
    const failedPackages: string[] = [];

    try {
      for (const pkg of packages) {
        try {
          await execAsync(`pacman -S --noconfirm ${pkg}`, { timeout: 120000 });
          installedPackages.push(pkg);
          this.logger.success(`Installed ${pkg}`);
        } catch (error) {
          this.logger.warn(`Failed to install ${pkg}: ${(error as Error).message}`);
          failedPackages.push(pkg);
        }
      }

      return {
        success: failedPackages.length < packages.length / 2,
        message: `Arch dependencies installation completed. Installed: ${installedPackages.length}, Failed: ${failedPackages.length}`,
        installedPackages,
        failedPackages
      };

    } catch (error) {
      return {
        success: false,
        message: `Arch dependency installation failed: ${(error as Error).message}`,
        failedPackages
      };
    }
  }

  private static async installMacOSDependencies(systemInfo: SystemInfo): Promise<InstallResult> {
    this.logger.info('Installing macOS dependencies...');
    
    // macOS usually has most dependencies built-in or available via Xcode Command Line Tools
    try {
      // Check for Xcode Command Line Tools
      await execAsync('xcode-select --print-path', { timeout: 10000 });
      this.logger.success('Xcode Command Line Tools detected');
      
      // Check for Homebrew
      const hasBrew = await this.checkCommand('brew --version');
      if (hasBrew) {
        this.logger.info('Homebrew detected, system should be compatible');
      } else {
        this.logger.warn('Homebrew not found, but Playwright should work with system libraries');
      }

      return {
        success: true,
        message: 'macOS dependencies verified successfully',
        installedPackages: ['xcode-command-line-tools']
      };

    } catch (error) {
      this.logger.warn('Xcode Command Line Tools not found. Please install with: xcode-select --install');
      return {
        success: false,
        message: 'Please install Xcode Command Line Tools: xcode-select --install',
        failedPackages: ['xcode-command-line-tools']
      };
    }
  }

  private static async checkCommand(command: string): Promise<boolean> {
    try {
      await execAsync(command, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getSystemStatus(): Promise<{systemInfo: SystemInfo, dependenciesInstalled: boolean}> {
    const systemInfo = await this.detectSystem();
    
    // Quick check if dependencies are likely installed
    let dependenciesInstalled = true;
    
    try {
      if (systemInfo.platform === 'linux') {
        if (systemInfo.distro === 'alpine') {
          await execAsync('apk info gcompat', { timeout: 5000 });
        } else if (systemInfo.distro === 'debian') {
          await execAsync('dpkg -l libnss3', { timeout: 5000 });
        }
      }
    } catch (error) {
      dependenciesInstalled = false;
    }

    return { systemInfo, dependenciesInstalled };
  }
}