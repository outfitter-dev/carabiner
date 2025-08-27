/**
 * Core logger implementation using Pino with enterprise features
 */

import pino from 'pino';
import {
  generateCorrelationId,
  sanitizeError,
  sanitizeForLogging,
} from './sanitizer';
import type { BaseLogEntry, Logger, LoggingConfig, LogLevel } from './types';

/**
 * Production-ready logger implementation
 */
export class ProductionLogger implements Logger {
  private readonly pino: pino.Logger;
  private readonly config: LoggingConfig;
  private readonly correlationId: string;

  constructor(config: LoggingConfig) {
    this.config = config;
    this.correlationId = generateCorrelationId();
    this.pino = this.createPinoInstance();
  }

  /**
   * Create the underlying Pino logger instance
   */
  private createPinoInstance(): pino.Logger {
    const pinoConfig: pino.LoggerOptions = {
      level: this.config.level,

      // Base configuration
      base: {
        service: this.config.service,
        env: this.config.environment,
        correlationId: this.correlationId,
        ...this.config.context,
      },

      // Timestamp configuration
      timestamp: pino.stdTimeFunctions.isoTime,

      // Formatters for consistent output
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (object: Record<string, unknown>) => {
          // Sanitize all logged data
          return sanitizeForLogging(object) as Record<string, unknown>;
        },
      },

      // Error serialization
      serializers: {
        error: (error: Error) => sanitizeError(error),
        err: (error: Error) => sanitizeError(error),
      },

      // Transport configuration (pretty printing for development)
      transport: this.createTransportConfig(),
    };

    // Silent mode for tests
    if (this.config.silent) {
      pinoConfig.level = 'silent';
    }

    return pino(pinoConfig);
  }

  /**
   * Create transport configuration based on environment
   */
  private createTransportConfig(): pino.TransportSingleOptions | undefined {
    // Production: structured JSON logging only
    if (this.config.environment === 'production') {
      return; // No transport = raw JSON output
    }

    // Development: pretty printing if enabled and not disabled
    if (this.config.pretty && !this.config.silent) {
      return {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname,service,env,correlationId',
          messageFormat: '{service}[{level}]: {msg}',
          errorLikeObjectKeys: ['error', 'err', 'failure'],
        },
      };
    }

    // Test/other: no transport (structured JSON)
    return;
  }

  /**
   * Log error with proper error handling
   */
  error(message: string, context?: Record<string, unknown>): void;
  error(
    error: Error,
    message?: string,
    context?: Record<string, unknown>
  ): void;
  error(
    messageOrError: string | Error,
    messageOrContext?: string | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (typeof messageOrError === 'string') {
      // error(message, context)
      this.pino.error(
        messageOrContext as Record<string, unknown>,
        messageOrError
      );
    } else {
      // error(error, message?, context?)
      const error = messageOrError;
      const message =
        typeof messageOrContext === 'string' ? messageOrContext : error.message;
      const ctx =
        typeof messageOrContext === 'string' ? context : messageOrContext;

      this.pino.error({ error, ...ctx }, message);
    }
  }

  /**
   * Log warning
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.pino.warn(context, message);
  }

  /**
   * Log info
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.pino.info(context, message);
  }

  /**
   * Log debug
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.pino.debug(context, message);
  }

  /**
   * Log trace
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.pino.trace(context, message);
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childConfig = { ...this.config };
    const childPino = this.pino.child(
      sanitizeForLogging(context) as Record<string, unknown>
    );

    return new ChildLogger(childPino, childConfig);
  }

  /**
   * Check if log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.pino.isLevelEnabled(level);
  }
}

/**
 * Child logger implementation that wraps a Pino child logger
 */
class ChildLogger implements Logger {
  constructor(
    private readonly pino: pino.Logger,
    private readonly config: LoggingConfig
  ) {}

  error(message: string, context?: Record<string, unknown>): void;
  error(
    error: Error,
    message?: string,
    context?: Record<string, unknown>
  ): void;
  error(
    messageOrError: string | Error,
    messageOrContext?: string | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (typeof messageOrError === 'string') {
      this.pino.error(
        messageOrContext as Record<string, unknown>,
        messageOrError
      );
    } else {
      const error = messageOrError;
      const message =
        typeof messageOrContext === 'string' ? messageOrContext : error.message;
      const ctx =
        typeof messageOrContext === 'string' ? context : messageOrContext;

      this.pino.error({ error, ...ctx }, message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.pino.warn(context, message);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.pino.info(context, message);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.pino.debug(context, message);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.pino.trace(context, message);
  }

  child(context: Record<string, unknown>): Logger {
    const childPino = this.pino.child(
      sanitizeForLogging(context) as Record<string, unknown>
    );
    return new ChildLogger(childPino, this.config);
  }

  isLevelEnabled(level: LogLevel): boolean {
    return this.pino.isLevelEnabled(level);
  }
}

/**
 * Performance metrics calculation helper
 */
export function calculateMemoryDelta(before: number, after: number): number {
  return after - before;
}

/**
 * Format duration for human readability
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = (milliseconds / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): BaseLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    pid: process.pid,
    hostname: 'localhost', // Sanitized hostname
    service: 'unknown',
    env: 'unknown',
    correlationId: generateCorrelationId(),
    ...context,
  };
}
