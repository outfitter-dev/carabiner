/**
 * Error Management System
 *
 * Production-ready error handling for the Grapple monorepo
 *
 * @example Basic usage:
 * ```typescript
 * import { GrappleError, ErrorCode, ErrorCategory, reportError } from '@carabiner/error-management';
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
 * import { RetryManager, CircuitBreaker } from '@carabiner/error-management';
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
 * import { executeWithBoundary } from '@carabiner/error-management';
 *
 * const result = await executeWithBoundary(
 *   async () => await riskyOperation(),
 *   'risky-operation-boundary'
 * );
 * ```
 */

// ESM require compatibility for dynamic imports
import { createRequire } from "node:module";
const nodeRequire = createRequire(import.meta.url);

// Error Boundaries
export type {
	ErrorBoundaryConfig,
	ErrorBoundaryContext,
} from "./boundaries.js";
export {
	ErrorBoundary,
	ErrorBoundaryRegistry,
	ErrorBoundaryState,
	executeWithBoundary,
	withErrorBoundary,
} from "./boundaries.js";

// Core Error Classes
export {
	AuthError,
	ConfigurationError,
	FileSystemError,
	fromError,
	fromMessage,
	fromSystemError,
	GrappleError,
	NetworkError,
	ResourceError,
	RuntimeError,
	SecurityError,
	TimeoutError,
	UserInputError,
	ValidationError,
} from "./errors.js";

// Recovery Mechanisms
export {
	CircuitBreaker,
	ErrorRecoveryManager,
	RetryManager,
	withCleanup,
	withFallback,
	withPriorityFallback,
} from "./recovery.js";
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
} from "./reporting.js";
// Core Types
export type {
	CircuitBreakerConfig,
	ErrorContext,
	ErrorReport,
	ErrorReportingConfig,
	HealthStatus,
	IGrappleError,
	RecoveryStrategy,
} from "./types.js";
// Export enums and constants
export {
	CircuitState,
	ErrorCategory,
	ErrorCode,
	ErrorSeverity,
} from "./types.js";

// Utility Functions
export {
	createHealthChecker,
	createStandardError,
	safeAsync,
	withTimeout,
	wrapWithErrorHandling,
} from "./utils.js";

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
	} = {},
) {
	// Configure global reporter
	if (config.reporting) {
		const { configureGlobalReporter } = nodeRequire("./reporting.js");
		configureGlobalReporter(config.reporting);
	}

	// Setup common error boundaries
	if (config.boundaries) {
		const { ErrorBoundaryRegistry } = nodeRequire("./boundaries.js");
		const registry = ErrorBoundaryRegistry.getInstance();

		for (const [name, boundaryConfig] of Object.entries(config.boundaries)) {
			registry.createBoundary(name, boundaryConfig);
		}
	}

	// Create recovery manager with config
	if (config.recovery) {
		const { ErrorRecoveryManager } = nodeRequire("./recovery.js");
		return new ErrorRecoveryManager(
			config.recovery.retry,
			config.recovery.circuitBreaker,
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
			minSeverity: "warning" as const,
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
			"config-operations": {
				errorThreshold: 3,
				timeWindow: 300_000,
				autoRecover: true,
			},
			"hook-execution": {
				errorThreshold: 5,
				timeWindow: 300_000,
				autoRecover: true,
			},
			"file-operations": {
				errorThreshold: 10,
				timeWindow: 300_000,
				autoRecover: true,
			},
		},
	});
}
