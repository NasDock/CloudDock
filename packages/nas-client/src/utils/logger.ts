import pc from 'picocolors';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const levelColors: Record<LogLevel, (s: string) => string> = {
  debug: pc.gray,
  info: pc.blue,
  warn: pc.yellow,
  error: pc.red
};

class Logger {
  private level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private name: string;

  constructor(name: string = 'nas-client') {
    this.name = name;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[this.level];
  }

  private formatTime(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const time = pc.gray(this.formatTime());
    const name = pc.cyan(`[${this.name}]`);
    const levelStr = levelColors[level](level.toUpperCase().padEnd(5));
    const metaStr = meta ? ' ' + JSON.stringify(meta) : '';

    console.log(`${time} ${name} ${levelStr} ${message}${metaStr}`);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }
}

export const logger = new Logger('nas-client');

export function generateMessageId(prefix: string = 'msg'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${timestamp}${random}`;
}
