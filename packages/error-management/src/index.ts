/**
 * Error Management System
 *
 * Production-ready error handling for the Carabiner monorepo
 *
 * @example Basic usage:
 * ```typescript
 * import { CarabinerError, ErrorCode, ErrorCategory, reportError } from '@outfitter/error-management';
 *
 * try {
 *   // Some operation
 * } catch (error) {
 *   const carabinerError = new CarabinerError({
 *     message: 'Operation failed',
 *     code: ErrorCode.RUNTIME_EXCEPTION,
 *     category: ErrorCategory.RUNTIME,
 *   });
 *   await reportError(carabinerError);
 *   throw carabinerError;
 * }
 * ```
 *
 * @example With error recovery:
 * ```typescript
 * import { RetryManager, CircuitBreaker } from '@outfitter/error-management';
 *
 * const retryManager = new RetryManager({ maxRetries: 3 });
 * const result = await retryManager.execute(async () => {
 *   // Potentially failing operation
 *   return await someOperation();
 * });
 * ```
 *
 * @example With error boundaries:
 * ```typescript
 * import { executeWithBoundary } from '@outfitter/error-management';
 *
 * const result = await executeWithBoundary(
 *   async () => await riskyOperation(),
 *   'risky-operation-boundary'
 * );
 * ```
 */

// Error Boundaries
export type {
  ErrorBoundaryConfig,
  ErrorBoundaryContext,
} from './boundaries.js';
export {
  ErrorBoundary,
  ErrorBoundaryRegistry,
  ErrorBoundaryState,
  executeWithBoundary,
  withErrorBoundary,
} from './boundaries.js';

// Core Error Classes
export {
  AuthError,
  ConfigurationError,
  FileSystemError,
  fromError,
  fromMessage,
  fromSystemError,
  CarabinerError,
  NetworkError,
  ResourceError,
  RuntimeError,
  SecurityError,
  TimeoutError,
  UserInputError,
  ValidationError,
} from './errors.js';

// Recovery Mechanisms
export {
  CircuitBreaker,
  ErrorRecoveryManager,
  RetryManager,
  withCleanup,
  withFallback,
  withPriorityFallback,
} from './recovery.js';
// Reporting and Logging
export {
  configureGlobalReporter,
  ErrorAggregator,
  ErrorReporter,
  getGlobalReporter,
  reportError,
  StructuredLogger,
  sanitizeError,
  sanitizeText,
} from './reporting.js';
// Core Types
export type {
  CircuitBreakerConfig,
  ErrorContext,
  ErrorReport,
  ErrorReportingConfig,
  HealthStatus,
  ICarabinerError,
  RecoveryStrategy,
} from './types.js';
// Export enums and constants
export {
  CircuitState,
  ErrorCategory,
  ErrorCode,
  ErrorSeverity,
} from './types.js';

// Utility Functions
export {
  createHealthChecker,
  createStandardError,
  safeAsync,
  withTimeout,
  wrapWithErrorHandling,
} from './utils.js';

/**
 * Quick setup function for common error handling patterns
 */
export function setupErrorHandling(
  config: {
    reporting?: unknown;
    recovery?: {
      retry?: unknown;
      circuitBreaker?: unknown;
    };
    boundaries?: {
      [key: string]: unknown;
    };
  } = {}
) {
  // Configure global reporter
  if (config.reporting) {
    const { configureGlobalReporter } = require('./reporting.js');
    configureGlobalReporter(config.reporting);
  }

  // Setup common error boundaries
  if (config.boundaries) {
    const { ErrorBoundaryRegistry } = require('./boundaries.js');
    const registry = ErrorBoundaryRegistry.getInstance();

    for (const [name, boundaryConfig] of Object.entries(config.boundaries)) {
      registry.createBoundary(name, boundaryConfig);
    }
  }

  // Create recovery manager with config
  if (config.recovery) {
    const { ErrorRecoveryManager } = require('./recovery.js');
    return new ErrorRecoveryManager(
      config.recovery.retry,
      config.recovery.circuitBreaker
    );
  }

  return;
}

/**
 * Default error handling setup for production
 */
export function setupProductionErrorHandling() {
  return setupErrorHandling({
    reporting: {
      enabled: true,
      minSeverity: 'warning' as const,
      includeStackTrace: true,
      includeEnvironment: true,
    },
    recovery: {
      retry: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        useJitter: true,
      },
      circuitBreaker: {
        failureThreshold: 5,
        timeout: 60_000,
        successThreshold: 2,
        monitoringPeriod: 300_000,
        expectedFailureRate: 0.5,
        minimumRequestVolume: 10,
      },
    },
    boundaries: {
      'config-operations': {
        errorThreshold: 3,
        timeWindow: 300_000,
        autoRecover: true,
      },
      'hook-execution': {
        errorThreshold: 5,
        timeWindow: 300_000,
        autoRecover: true,
      },
      'file-operations': {
        errorThreshold: 10,
        timeWindow: 300_000,
        autoRecover: true,
      },
    },
  });
}
