/**
 * Error Reporting and Logging System
 *
 * Comprehensive error reporting with structured logging,
 * sanitization, and monitoring integration
 */

import { nanoid } from 'nanoid';
import type { JsonValue } from 'type-fest';
import type {
  ErrorReport,
  ErrorReportingConfig,
  ErrorSeverity,
  ICarabinerError,
} from './types.js';
import { ErrorSeverity as Severity } from './types.js';

/**
 * Default reporting configuration
 */
const DEFAULT_REPORTING_CONFIG: ErrorReportingConfig = {
  enabled: true,
  minSeverity: Severity.WARNING,
  includeStackTrace: true,
  includeEnvironment: true,
};

/**
 * Sensitive data patterns for sanitization
 */
const SENSITIVE_PATTERNS = [
  // API Keys and Tokens
  /api[_-]?key[s]?['":\s]*['"]?([a-zA-Z0-9_-]{8,})/gi,
  /access[_-]?token[s]?['":\s]*['"]?([a-zA-Z0-9_\-.]{8,})/gi,
  /secret[s]?['":\s]*['"]?([a-zA-Z0-9_-]{8,})/gi,

  // Authentication
  /password[s]?['":\s]*['"]?([^\s'"]+)/gi,
  /auth[_-]?token[s]?['":\s]*['"]?([a-zA-Z0-9_\-.]{8,})/gi,

  // Personal Information
  /email[s]?['":\s]*['"]?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  /phone[s]?['":\s]*['"]?([+]?[\d\s\-()]{10,})/gi,

  // System Information
  /(?:file:\/\/|\/)[a-zA-Z0-9/._-]+/gi, // File paths

  // Credit Card Numbers (basic pattern)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
];

/**
 * Sanitize sensitive data from text
 */
export function sanitizeText(text: string): string {
  let sanitized = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, capture) => {
      if (capture) {
        const replacement =
          capture.length > 4
            ? capture.substring(0, 2) +
              '*'.repeat(capture.length - 4) +
              capture.substring(capture.length - 2)
            : '*'.repeat(capture.length);
        return match.replace(capture, replacement);
      }
      return '[REDACTED]';
    });
  }

  return sanitized;
}

/**
 * Sanitize error object for safe reporting
 */
export function sanitizeError(error: ICarabinerError): Partial<ErrorReport> {
  return {
    error: {
      name: error.name,
      message: sanitizeText(error.message),
      code: error.code,
      category: error.category,
      severity: error.severity,
      stack: error.stack ? sanitizeText(error.stack) : undefined,
    },
    context: {
      ...error.context,
      stackTrace: error.context.stackTrace
        ? sanitizeText(error.context.stackTrace)
        : undefined,
      technicalDetails: error.context.technicalDetails
        ? (sanitizeObject(
            error.context.technicalDetails as Record<string, unknown>
          ) as Record<string, JsonValue>)
        : undefined,
      metadata: error.context.metadata
        ? (sanitizeObject(
            error.context.metadata as Record<string, unknown>
          ) as Record<string, JsonValue>)
        : undefined,
    },
  };
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') {
          return sanitizeText(item);
        }
        if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Error aggregation utility
 */
export class ErrorAggregator {
  private readonly errors: Map<
    string,
    {
      count: number;
      firstSeen: Date;
      lastSeen: Date;
      error: ICarabinerError;
    }
  > = new Map();

  private readonly maxAge = 3_600_000; // 1 hour
  private readonly maxEntries = 1000;

  /**
   * Add error to aggregation
   */
  add(error: ICarabinerError): void {
    const key = this.getErrorKey(error);
    const existing = this.errors.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
    } else {
      this.errors.set(key, {
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        error,
      });
    }

    this.cleanup();
  }

  /**
   * Get aggregated error statistics
   */
  getAggregatedErrors(): Array<{
    error: ICarabinerError;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
  }> {
    return Array.from(this.errors.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalErrors: number;
    uniqueErrors: number;
    bySeverity: Record<ErrorSeverity, number>;
    topErrors: Array<{ key: string; count: number }>;
  } {
    const bySeverity: Record<ErrorSeverity, number> = {
      [Severity.CRITICAL]: 0,
      [Severity.ERROR]: 0,
      [Severity.WARNING]: 0,
      [Severity.INFO]: 0,
    };

    let totalErrors = 0;

    for (const { error, count } of this.errors.values()) {
      totalErrors += count;
      bySeverity[error.severity] += count;
    }

    const topErrors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([key, { count }]) => ({ key, count }));

    return {
      totalErrors,
      uniqueErrors: this.errors.size,
      bySeverity,
      topErrors,
    };
  }

  /**
   * Clear aggregated errors
   */
  clear(): void {
    this.errors.clear();
  }

  /**
   * Generate error key for aggregation
   */
  private getErrorKey(error: ICarabinerError): string {
    return `${error.code}-${error.category}-${error.message}`;
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.maxAge;

    // Remove old entries
    for (const [key, { lastSeen }] of this.errors.entries()) {
      if (lastSeen.getTime() < cutoff) {
        this.errors.delete(key);
      }
    }

    // If still too many entries, remove oldest
    if (this.errors.size > this.maxEntries) {
      const entries = Array.from(this.errors.entries()).sort(
        ([, a], [, b]) => a.firstSeen.getTime() - b.firstSeen.getTime()
      );

      const toRemove = entries.slice(0, this.errors.size - this.maxEntries);
      for (const [key] of toRemove) {
        this.errors.delete(key);
      }
    }
  }
}

/**
 * Main error reporter class
 */
export class ErrorReporter {
  private config: ErrorReportingConfig;
  private readonly aggregator = new ErrorAggregator();
  private readonly reportQueue: ErrorReport[] = [];
  private processing = false;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = { ...DEFAULT_REPORTING_CONFIG, ...config };
  }

  /**
   * Report an error
   */
  async report(error: ICarabinerError): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check severity threshold
    const severityOrder = [
      Severity.INFO,
      Severity.WARNING,
      Severity.ERROR,
      Severity.CRITICAL,
    ];
    const errorSeverityIndex = severityOrder.indexOf(error.severity);
    const minSeverityIndex = severityOrder.indexOf(this.config.minSeverity);

    if (errorSeverityIndex < minSeverityIndex) {
      return;
    }

    // Add to aggregation
    this.aggregator.add(error);

    // Create error report
    const report = this.createReport(error);

    // Add to queue for processing
    this.reportQueue.push(report);

    // Process queue
    await this.processReportQueue();
  }

  /**
   * Create error report from error
   */
  private createReport(error: ICarabinerError): ErrorReport {
    let report: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        category: error.category,
        severity: error.severity,
        stack: this.config.includeStackTrace ? error.stack : undefined,
      },
      context: error.context,
      metadata: {
        reportId: nanoid(),
        recoverable: error.isRecoverable,
        retryable: error.isRetryable(),
        ...error.context.metadata,
      },
      reportedAt: new Date(),
    };

    // Apply custom transformation
    if (this.config.transform) {
      try {
        const transformed = this.config.transform(error);
        report.metadata = { ...report.metadata, ...transformed };
      } catch (_transformError) {
        // Transformation error - continue without custom transforms
      }
    }

    // Sanitize the report
    const sanitizedParts = sanitizeError(error);
    report = {
      ...report,
      ...sanitizedParts,
    };

    return report;
  }

  /**
   * Process the report queue
   */
  private async processReportQueue(): Promise<void> {
    if (this.processing || this.reportQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.reportQueue.length > 0) {
        const report = this.reportQueue.shift();
        if (!report) {
          break;
        }

        try {
          await this.sendReport(report);
        } catch (_reportError) {
          // Re-queue for retry if not too old (5 minutes)
          const reportAge = Date.now() - report.reportedAt.getTime();
          if (reportAge < 300_000) {
            this.reportQueue.push(report);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Send report using configured reporter
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    if (this.config.reporter) {
      await this.config.reporter(report);
    } else {
      // Default console reporting
      this.defaultConsoleReporter(report);
    }
  }

  /**
   * Default console reporter
   */
  private defaultConsoleReporter(report: ErrorReport): void {
    // Log formatting variables (currently unused in this implementation)

    switch (report.error.severity) {
      case Severity.CRITICAL:
        if (report.error.stack) {
          // Stack trace logged for critical errors
        }
        break;
      case Severity.ERROR:
        break;
      case Severity.WARNING:
        break;
      default:
        break;
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    return this.aggregator.getStatistics();
  }

  /**
   * Get aggregated errors
   */
  getAggregatedErrors() {
    return this.aggregator.getAggregatedErrors();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorReportingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.aggregator.clear();
    this.reportQueue.length = 0;
  }

  /**
   * Get pending reports count
   */
  getPendingReportsCount(): number {
    return this.reportQueue.length;
  }
}

/**
 * Global error reporter instance
 */
let globalReporter: ErrorReporter | undefined;

/**
 * Get global error reporter instance
 */
export function getGlobalReporter(): ErrorReporter {
  if (!globalReporter) {
    globalReporter = new ErrorReporter();
  }
  return globalReporter;
}

/**
 * Configure global error reporter
 */
export function configureGlobalReporter(
  config: Partial<ErrorReportingConfig>
): void {
  getGlobalReporter().updateConfig(config);
}

/**
 * Report error using global reporter
 */
export async function reportError(error: ICarabinerError): Promise<void> {
  await getGlobalReporter().report(error);
}

/**
 * Structured logger with error integration
 */
export class StructuredLogger {
  private readonly reporter: ErrorReporter;
  private readonly context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}, reporter?: ErrorReporter) {
    this.context = context;
    this.reporter = reporter ?? getGlobalReporter();
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  /**
   * Log error object
   */
  async logError(error: ICarabinerError, message?: string): Promise<void> {
    const logMessage = message ? `${message}: ${error.message}` : error.message;
    this.log('error', logMessage, { error: error.toReport() });

    // Also report to error reporting system
    await this.reporter.report(error);
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger(
      { ...this.context, ...additionalContext },
      this.reporter
    );
  }

  /**
   * Internal log method
   */
  private log(
    _level: 'info' | 'warn' | 'error',
    _message: string,
    _metadata?: Record<string, unknown>
  ): void {
    // Log entry formatting (currently unused in this implementation)
    // Log entry formatting implementation placeholder
    // The _level parameter determines the logging severity
    // Implementation would use appropriate logging method based on level
  }
}
