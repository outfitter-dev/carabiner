/**
 * Centralized logging configuration using Pino
 * Provides structured logging for hook execution
 */

import pino from 'pino';
import type { HookEvent, ToolName } from './types';

/**
 * Logger configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV === 'development' || Bun.env.DEBUG;
const logLevel = Bun.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

/**
 * Create the base logger instance
 */
export const logger = pino({
  level: logLevel,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    error: pino.stdSerializers.err,
  },
});

/**
 * Hook-specific logger factory
 */
export function createHookLogger(event: HookEvent, toolName?: ToolName) {
  return logger.child({
    event,
    toolName,
    sessionId: Bun.env.CLAUDE_SESSION_ID,
    projectDir: Bun.env.CLAUDE_PROJECT_DIR,
  });
}

/**
 * CLI-specific logger factory
 */
export function createCliLogger(command?: string) {
  return logger.child({
    component: 'cli',
    command,
  });
}

/**
 * Exported logger instances for different components
 */
export const coreLogger = logger.child({ component: 'core' });
export const runtimeLogger = logger.child({ component: 'runtime' });
export const registryLogger = logger.child({ component: 'registry' });
export const builderLogger = logger.child({ component: 'builder' });

/**
 * Type-safe logging utilities
 */
export const HookLogger = {
  info(event: HookEvent, toolName: ToolName, message: string): void {
    const log = createHookLogger(event, toolName);
    log.info(message);
  },

  warn(event: HookEvent, toolName: ToolName, message: string): void {
    const log = createHookLogger(event, toolName);
    log.warn(message);
  },

  error(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    error?: Error
  ): void {
    const log = createHookLogger(event, toolName);
    if (error) {
      log.error({ error }, message);
    } else {
      log.error(message);
    }
  },

  debug(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    data?: unknown
  ): void {
    const log = createHookLogger(event, toolName);
    if (data) {
      log.debug({ data }, message);
    } else {
      log.debug(message);
    }
  },
};
