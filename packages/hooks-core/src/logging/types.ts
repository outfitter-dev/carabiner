/**
 * Type definitions for the logging system
 */

import type { HookEvent } from '../types';

/**
 * Standard log levels following RFC 5424
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Environment types that affect logging configuration
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * Base structured log entry
 */
export type BaseLogEntry = {
  /** RFC 3339 timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Human-readable message */
  message: string;
  /** Process ID */
  pid: number;
  /** Hostname (sanitized) */
  hostname: string;
  /** Service name/component */
  service: string;
  /** Environment */
  env: Environment;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Session ID for Claude Code sessions */
  sessionId?: string;
  /** Additional structured data */
  [key: string]: unknown;
};

/**
 * Hook execution context for logging
 */
export type HookExecutionContext = {
  /** Hook event type */
  event: HookEvent;
  /** Tool being used (if applicable) */
  toolName?: string;
  /** Execution session ID */
  sessionId?: string;
  /** Project directory */
  projectDir?: string;
  /** Hook execution ID */
  executionId: string;
  /** User ID (sanitized) */
  userId?: string;
};

/**
 * Performance metrics for logging
 */
export type PerformanceMetrics = {
  /** Execution duration in milliseconds */
  duration: number;
  /** Memory usage before execution */
  memoryBefore: number;
  /** Memory usage after execution */
  memoryAfter: number;
  /** Memory delta */
  memoryDelta: number;
  /** CPU usage percentage */
  cpuUsage?: number;
};

/**
 * Error context for structured error logging
 */
export type ErrorContext = {
  /** Error name/type */
  name: string;
  /** Error message (sanitized) */
  message: string;
  /** Stack trace (in development only) */
  stack?: string;
  /** Error code */
  code?: string;
  /** Additional error metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Logging configuration options
 */
export type LoggingConfig = {
  /** Log level threshold */
  level: LogLevel;
  /** Environment */
  environment: Environment;
  /** Service/component name */
  service: string;
  /** Enable pretty printing (development only) */
  pretty: boolean;
  /** Enable console output */
  console: boolean;
  /** File output configuration */
  file?: {
    /** Log file path */
    path: string;
    /** Maximum file size in bytes */
    maxSize: number;
    /** Number of backup files to keep */
    maxBackups: number;
  };
  /** Disable all logging (for tests) */
  silent?: boolean;
  /** Additional static context */
  context?: Record<string, unknown>;
};

/**
 * Sanitization options
 */
export type SanitizationOptions = {
  /** Fields to completely remove */
  removeFields: string[];
  /** Fields to mask (replace with [REDACTED]) */
  maskFields: string[];
  /** Patterns to search for and mask */
  sensitivePatterns: RegExp[];
  /** Maximum string length before truncation */
  maxStringLength: number;
  /** Maximum object depth */
  maxDepth: number;
};

/**
 * Logger interface
 */
export type Logger = {
  error(message: string, context?: Record<string, unknown>): void;
  error(
    error: Error,
    message?: string,
    context?: Record<string, unknown>
  ): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  trace(message: string, context?: Record<string, unknown>): void;

  /** Create child logger with additional context */
  child(context: Record<string, unknown>): Logger;

  /** Check if log level is enabled */
  isLevelEnabled(level: LogLevel): boolean;
};

/**
 * Hook-specific logger interface
 */
export interface HookLogger extends Logger {
  /** Create child logger with additional context - returns HookLogger */
  child(context: Record<string, unknown>): HookLogger;

  /** Log hook execution start */
  startExecution(context: HookExecutionContext): void;

  /** Log hook execution completion */
  completeExecution(
    context: HookExecutionContext,
    success: boolean,
    metrics: PerformanceMetrics,
    result?: unknown
  ): void;

  /** Log hook execution failure */
  failExecution(
    context: HookExecutionContext,
    error: Error,
    metrics: PerformanceMetrics
  ): void;

  /** Log user action */
  logUserAction(
    action: string,
    context: HookExecutionContext,
    metadata?: Record<string, unknown>
  ): void;

  /** Log security event */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: HookExecutionContext,
    details?: Record<string, unknown>
  ): void;
}
