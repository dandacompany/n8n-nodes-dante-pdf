// Simple logger implementation for n8n nodes
export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  child(options: { service?: string }): Logger;
}

class ConsoleLogger implements Logger {
  private serviceName: string | undefined;

  constructor(serviceName?: string) {
    this.serviceName = serviceName;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const service = this.serviceName ? `[${this.serviceName}]` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase()}${service} ${message}${metaStr}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage('info', message, meta));
  }

  error(message: string, error?: any): void {
    const errorInfo =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error;
    console.error(this.formatMessage('error', message, errorInfo));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  debug(message: string, meta?: any): void {
    // Only log debug messages if NODE_ENV is development
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  child(options: { service?: string }): Logger {
    const serviceName = options.service || this.serviceName;
    return new ConsoleLogger(serviceName);
  }
}

export const logger = new ConsoleLogger('dante-pdf');
