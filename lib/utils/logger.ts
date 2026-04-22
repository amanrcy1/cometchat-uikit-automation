/**
 * Structured logger for the QA framework.
 * Prefixes all output with timestamp + context for CI/CD log parsing.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const COLORS: Record<LogLevel, string> = {
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[90m',  // gray
};
const RESET = '\x1b[0m';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const prefix = `${COLORS[level]}[${timestamp()}] [${level.toUpperCase()}] [${context}]${RESET}`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info:  (ctx: string, msg: string, data?: unknown) => log('info', ctx, msg, data),
  warn:  (ctx: string, msg: string, data?: unknown) => log('warn', ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) => log('error', ctx, msg, data),
  debug: (ctx: string, msg: string, data?: unknown) => {
    if (process.env.DEBUG === 'true') log('debug', ctx, msg, data);
  },

  /** Create a scoped logger for a specific module */
  scope: (context: string) => ({
    info:  (msg: string, data?: unknown) => log('info', context, msg, data),
    warn:  (msg: string, data?: unknown) => log('warn', context, msg, data),
    error: (msg: string, data?: unknown) => log('error', context, msg, data),
    debug: (msg: string, data?: unknown) => {
      if (process.env.DEBUG === 'true') log('debug', context, msg, data);
    },
  }),
};
