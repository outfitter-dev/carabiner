/**
 * Logger factory and hook-specific logger implementations
 */

import type { HookEvent, ToolName } from '../types';
import {
  createDevelopmentConfig,
  createLoggingConfig,
  createProductionConfig,
  createTestConfig,
} from './config';
import { formatDuration, ProductionLogger } from './logger';
import { hashUserId } from './sanitizer';
import type {
  HookExecutionContext,
  HookLogger,
  Logger,
  LoggingConfig,
  LogLevel,
  PerformanceMetrics,
  LogLevel,
} from './types';

/**
 * Global logger instances
 */
const loggerCache = new Map<string, Logger>();

/**
 * Create or get cached logger for a service
 */
export function createLogger(service: string, config?: LoggingConfig): Logger {
  const cacheKey = `${service}-${config ? JSON.stringify(config) : 'default'}`;

  if (loggerCache.has(cacheKey)) {
    return loggerCache.get(cacheKey)!;
  }

  const finalConfig = config || createLoggingConfig(service);
  const logger = new ProductionLogger(finalConfig);

  loggerCache.set(cacheKey, logger);
  return logger;
}

/**
 * Create production-optimized logger
 */
export function createProductionLogger(service: string): Logger {
  return createLogger(service, createProductionConfig(service));
}

/**
 * Create development-optimized logger
 */
export function createDevelopmentLogger(service: string): Logger {
  return createLogger(service, createDevelopmentConfig(service));
}

/**
 * Create test-optimized logger
 */
export function createTestLogger(service: string): Logger {
  return createLogger(service, createTestConfig(service));
}

/**
 * Hook-specific logger implementation
 */
export class HookLoggerImpl implements HookLogger {
  private readonly baseLogger: Logger;

  constructor(baseLogger: Logger) {
    this.baseLogger = baseLogger;
  }

  // Delegate basic logging methods
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
      this.baseLogger.error(
        messageOrError,
        messageOrContext as Record<string, unknown>
      );
    } else {
      this.baseLogger.error(
        messageOrError,
        messageOrContext as string,
        context
      );
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.warn(message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.info(message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.debug(message, context);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.baseLogger.trace(message, context);
  }

  child(context: Record<string, unknown>): HookLogger {
    return new HookLoggerImpl(this.baseLogger.child(context));
  }

  isLevelEnabled(level: LogLevel): boolean {
    return this.baseLogger.isLevelEnabled(level);
  }

  // Hook-specific logging methods
  startExecution(context: HookExecutionContext): void {
    this.info('Hook execution started', {
      event: context.event,
      toolName: context.toolName,
      executionId: context.executionId,
      sessionId: context.sessionId,
      projectDir: this.sanitizeProjectPath(context.projectDir),
      userId: context.userId ? hashUserId(context.userId) : undefined,
    });
  }

  completeExecution(
    context: HookExecutionContext,
    success: boolean,
    metrics: PerformanceMetrics,
    result?: unknown
  ): void {
    const logMethod = success ? this.info.bind(this) : this.warn.bind(this);

    logMethod('Hook execution completed', {
      event: context.event,
      toolName: context.toolName,
      executionId: context.executionId,
      sessionId: context.sessionId,
      success,
      performance: {
        duration: formatDuration(metrics.duration),
        durationMs: metrics.duration,
        memoryBefore: `${(metrics.memoryBefore / 1024 / 1024).toFixed(2)}MB`,
        memoryAfter: `${(metrics.memoryAfter / 1024 / 1024).toFixed(2)}MB`,
        memoryDelta: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        cpuUsage: metrics.cpuUsage
          ? `${metrics.cpuUsage.toFixed(2)}%`
          : undefined,
      },
      // Only log result in debug mode and sanitize it
      result: this.isLevelEnabled('debug')
        ? this.sanitizeResult(result)
        : undefined,
    });
  }

  failExecution(
    context: HookExecutionContext,
    error: Error,
    metrics: PerformanceMetrics
  ): void {
    this.error(error, 'Hook execution failed', {
      event: context.event,
      toolName: context.toolName,
      executionId: context.executionId,
      sessionId: context.sessionId,
      performance: {
        duration: formatDuration(metrics.duration),
        durationMs: metrics.duration,
        memoryBefore: `${(metrics.memoryBefore / 1024 / 1024).toFixed(2)}MB`,
        memoryAfter: `${(metrics.memoryAfter / 1024 / 1024).toFixed(2)}MB`,
        memoryDelta: `${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`,
      },
    });
  }

  logUserAction(
    action: string,
    context: HookExecutionContext,
    metadata?: Record<string, unknown>
  ): void {
    this.info('User action logged', {
      action,
      event: context.event,
      toolName: context.toolName,
      executionId: context.executionId,
      sessionId: context.sessionId,
      userId: context.userId ? hashUserId(context.userId) : undefined,
      metadata,
    });
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: HookExecutionContext,
    details?: Record<string, unknown>
  ): void {
    const logMethod =
      severity === 'critical' || severity === 'high'
        ? this.error.bind(this)
        : this.warn.bind(this);

    logMethod(`Security event: ${event}`, {
      securityEvent: event,
      severity,
      event: context.event,
      toolName: context.toolName,
      executionId: context.executionId,
      sessionId: context.sessionId,
      userId: context.userId ? hashUserId(context.userId) : undefined,
      details,
    });
  }

  /**
   * Sanitize project path to avoid exposing sensitive directory structure
   */
  private sanitizeProjectPath(projectDir?: string): string | undefined {
    if (!projectDir) {
      return;
    }

    // Only show the last two directory components
    const parts = projectDir.split('/');
    if (parts.length > 2) {
      return `.../${parts.slice(-2).join('/')}`;
    }

    return projectDir;
  }

  /**
   * Sanitize result data for logging
   */
  private sanitizeResult(result: unknown): unknown {
    if (result === null || result === undefined) {
      return result;
    }

    if (typeof result === 'object') {
      return {
        type: Array.isArray(result) ? 'array' : 'object',
        size: Array.isArray(result)
          ? result.length
          : Object.keys(result as object).length,
      };
    }

    if (typeof result === 'string') {
      return result.length > 100
        ? `${result.slice(0, 100)}...[truncated]`
        : result;
    }

    return result;
  }
}

/**
 * Create hook-specific logger
 */
export function createHookLogger(
  event: HookEvent,
  toolName?: ToolName
): HookLogger {
  const baseLogger = createLogger('hook-runtime').child({
    event,
    toolName,
  });

  return new HookLoggerImpl(baseLogger);
}

/**
 * CLI-specific logger factory
 */
export function createCliLogger(command?: string): Logger {
  return createLogger('cli').child({
    component: 'cli',
    command,
  });
}

/**
 * Pre-configured logger instances for different components
 */
export const coreLogger = createLogger('core');
export const runtimeLogger = createLogger('runtime');
export const registryLogger = createLogger('registry');
export const builderLogger = createLogger('builder');
export const executionLogger = new HookLoggerImpl(createLogger('execution'));
export const configLogger = createLogger('config');

/**
 * Clear logger cache (useful for testing)
 */
export function clearLoggerCache(): void {
  loggerCache.clear();
}

/**
 * Type-safe logging utilities (legacy compatibility)
 */
export const LegacyHookLogger = {
  info(event: HookEvent, toolName: ToolName, message: string): void {
    const logger = createHookLogger(event, toolName);
    logger.info(message);
  },

  warn(event: HookEvent, toolName: ToolName, message: string): void {
    const logger = createHookLogger(event, toolName);
    logger.warn(message);
  },

  error(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    error?: Error
  ): void {
    const logger = createHookLogger(event, toolName);
    if (error) {
      logger.error(error, message);
    } else {
      logger.error(message);
    }
  },

  debug(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    data?: unknown
  ): void {
    const logger = createHookLogger(event, toolName);
    logger.debug(message, data ? { data } : undefined);
  },
} as const;
