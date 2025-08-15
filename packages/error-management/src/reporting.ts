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
  IGrappleError,
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
  /api[_-]?key[s]?['":\s]*['"]?([a-zA-Z0-9_\-]{8,})/gi,
  /access[_-]?token[s]?['":\s]*['"]?([a-zA-Z0-9_\-\.]{8,})/gi,
  /secret[s]?['":\s]*['"]?([a-zA-Z0-9_\-]{8,})/gi,
  
  // Authentication
  /password[s]?['":\s]*['"]?([^\s'"]+)/gi,
  /auth[_-]?token[s]?['":\s]*['"]?([a-zA-Z0-9_\-\.]{8,})/gi,
  
  // Personal Information
  /email[s]?['":\s]*['"]?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  /phone[s]?['":\s]*['"]?([+]?[\d\s\-\(\)]{10,})/gi,
  
  // System Information
  /(?:file:\/\/|\/)[a-zA-Z0-9\/\._\-]+/gi, // File paths
  
  // Credit Card Numbers (basic pattern)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
];

/**
 * Error sanitization utility
 */
export class ErrorSanitizer {
  /**
   * Sanitize sensitive data from text
   */
  static sanitizeText(text: string): string {
    let sanitized = text;
    
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match, capture) => {
        if (capture) {
          const replacement = capture.length > 4 
            ? capture.substring(0, 2) + '*'.repeat(capture.length - 4) + capture.substring(capture.length - 2)
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
  static sanitizeError(error: IGrappleError): Partial<ErrorReport> {
    return {
      error: {
        name: error.name,
        message: this.sanitizeText(error.message),
        code: error.code,
        category: error.category,
        severity: error.severity,
        stack: error.stack ? this.sanitizeText(error.stack) : undefined,
      },
      context: {
        ...error.context,
        stackTrace: error.context.stackTrace ? this.sanitizeText(error.context.stackTrace) : undefined,
        technicalDetails: error.context.technicalDetails 
          ? this.sanitizeObject(error.context.technicalDetails as Record<string, unknown>) as Record<string, JsonValue>
          : undefined,
        metadata: error.context.metadata 
          ? this.sanitizeObject(error.context.metadata as Record<string, unknown>) as Record<string, JsonValue>
          : undefined,
      },
    };
  }

  /**
   * Sanitize object recursively
   */
  private static sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeText(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? this.sanitizeText(item) :
          typeof item === 'object' && item !== null ? this.sanitizeObject(item as Record<string, unknown>) :
          item
        );
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

/**
 * Error aggregation utility
 */
export class ErrorAggregator {
  private errors: Map<string, {
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    error: IGrappleError;
  }> = new Map();

  private readonly maxAge = 3600000; // 1 hour
  private readonly maxEntries = 1000;

  /**
   * Add error to aggregation
   */
  add(error: IGrappleError): void {
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
    error: IGrappleError;
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
  private getErrorKey(error: IGrappleError): string {
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
      const entries = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.firstSeen.getTime() - b.firstSeen.getTime());
      
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
  private aggregator = new ErrorAggregator();
  private reportQueue: ErrorReport[] = [];
  private processing = false;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = { ...DEFAULT_REPORTING_CONFIG, ...config };
  }

  /**
   * Report an error
   */
  async report(error: IGrappleError): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check severity threshold
    const severityOrder = [Severity.INFO, Severity.WARNING, Severity.ERROR, Severity.CRITICAL];
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
  private createReport(error: IGrappleError): ErrorReport {
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
      } catch (transformError) {
        console.error('Error report transformation failed:', transformError);
      }
    }

    // Sanitize the report
    const sanitizedParts = ErrorSanitizer.sanitizeError(error);
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
        const report = this.reportQueue.shift()!;
        
        try {
          await this.sendReport(report);
        } catch (reportError) {
          console.error('Failed to send error report:', reportError);
          
          // Re-queue for retry if not too old (5 minutes)
          const reportAge = Date.now() - report.reportedAt.getTime();
          if (reportAge < 300000) {
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
    const timestamp = report.reportedAt.toISOString();
    const severity = report.error.severity.toUpperCase();
    const correlation = report.context.correlationId;
    
    const logMessage = [
      `[${timestamp}]`,
      `[${severity}]`,
      `[${correlation}]`,
      `${report.error.name}: ${report.error.message}`,
      report.error.code ? `(Code: ${report.error.code})` : '',
      report.context.operation ? `(Operation: ${report.context.operation})` : '',
    ].filter(Boolean).join(' ');

    switch (report.error.severity) {
      case Severity.CRITICAL:
        console.error(logMessage);
        if (report.error.stack) {
          console.error('Stack trace:', report.error.stack);
        }
        break;
      case Severity.ERROR:
        console.error(logMessage);
        break;
      case Severity.WARNING:
        console.warn(logMessage);
        break;
      case Severity.INFO:
      default:
        console.info(logMessage);
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
export function configureGlobalReporter(config: Partial<ErrorReportingConfig>): void {
  getGlobalReporter().updateConfig(config);
}

/**
 * Report error using global reporter
 */
export async function reportError(error: IGrappleError): Promise<void> {
  await getGlobalReporter().report(error);
}

/**
 * Structured logger with error integration
 */
export class StructuredLogger {
  private reporter: ErrorReporter;
  private context: Record<string, unknown>;

  constructor(
    context: Record<string, unknown> = {},
    reporter?: ErrorReporter
  ) {
    this.context = context;
    this.reporter = reporter || getGlobalReporter();
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
  async logError(error: IGrappleError, message?: string): Promise<void> {
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
  private log(level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: ErrorSanitizer.sanitizeText(message),
      correlationId: nanoid(),
      ...this.context,
      ...metadata,
    };

    const logString = JSON.stringify(logEntry, null, 2);

    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'info':
      default:
        console.info(logString);
        break;
    }
  }
}