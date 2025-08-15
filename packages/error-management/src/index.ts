/**
 * Error Management System
 * 
 * Production-ready error handling for the Grapple monorepo
 * 
 * @example Basic usage:
 * ```typescript
 * import { GrappleError, ErrorCode, ErrorCategory, reportError } from '@outfitter/error-management';
 * 
 * try {
 *   // Some operation
 * } catch (error) {
 *   const grappleError = new GrappleError(
 *     'Operation failed',
 *     ErrorCode.RUNTIME_EXCEPTION,
 *     ErrorCategory.RUNTIME
 *   );
 *   await reportError(grappleError);
 *   throw grappleError;
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

// Core Types
export type {
  ErrorContext,
  RecoveryStrategy,
  ErrorReportingConfig,
  ErrorReport,
  CircuitBreakerConfig,
  HealthStatus,
  IGrappleError,
} from './types.js';

// Export enums and constants
export {
  ErrorSeverity,
  ErrorCategory,
  ErrorCode,
  CircuitState,
} from './types.js';

// Core Error Classes
export {
  GrappleError,
  ConfigurationError,
  RuntimeError,
  ValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  UserInputError,
  ResourceError,
  AuthError,
  TimeoutError,
  ErrorFactory,
} from './errors.js';

// Recovery Mechanisms
export {
  RetryManager,
  CircuitBreaker,
  ErrorRecoveryManager,
  GracefulDegradation,
} from './recovery.js';

// Error Boundaries
export type {
  ErrorBoundaryConfig,
  ErrorBoundaryContext,
} from './boundaries.js';

export {
  ErrorBoundary,
  ErrorBoundaryRegistry,
  ErrorBoundaryState,
  withErrorBoundary,
  executeWithBoundary,
} from './boundaries.js';

// Reporting and Logging
export {
  ErrorReporter,
  ErrorSanitizer,
  ErrorAggregator,
  StructuredLogger,
  getGlobalReporter,
  configureGlobalReporter,
  reportError,
} from './reporting.js';

// Utility Functions
export {
  createStandardError,
  wrapWithErrorHandling,
  safeAsync,
  withTimeout,
  createHealthChecker,
} from './utils.js';

/**
 * Quick setup function for common error handling patterns
 */
export function setupErrorHandling(config: {
  reporting?: any;
  recovery?: {
    retry?: any;
    circuitBreaker?: any;
  };
  boundaries?: {
    [key: string]: any;
  };
} = {}) {
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

  return undefined;
}

/**
 * Default error handling setup for production
 */
export function setupProductionErrorHandling() {
  return setupErrorHandling({
    reporting: {
      enabled: true,
      minSeverity: 'warning' as any,
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
        timeout: 60000,
        successThreshold: 2,
        monitoringPeriod: 300000,
        expectedFailureRate: 0.5,
        minimumRequestVolume: 10,
      },
    },
    boundaries: {
      'config-operations': {
        errorThreshold: 3,
        timeWindow: 300000,
        autoRecover: true,
      },
      'hook-execution': {
        errorThreshold: 5,
        timeWindow: 300000,
        autoRecover: true,
      },
      'file-operations': {
        errorThreshold: 10,
        timeWindow: 300000,
        autoRecover: true,
      },
    },
  });
}