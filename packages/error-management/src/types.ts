/**
 * Error Management Types
 *
 * Comprehensive type definitions for production-ready error handling
 */

import type { JsonValue } from "type-fest";

/**
 * Error severity levels for classification and handling
 */
export enum ErrorSeverity {
	/** Critical system failures requiring immediate attention */
	CRITICAL = "critical",
	/** Errors that affect functionality but don't crash the system */
	ERROR = "error",
	/** Warnings about potential issues */
	WARNING = "warning",
	/** Informational notices */
	INFO = "info",
}

/**
 * Error categories for systematic classification
 */
export enum ErrorCategory {
	/** Configuration-related errors */
	CONFIGURATION = "configuration",
	/** Runtime execution errors */
	RUNTIME = "runtime",
	/** Input/output validation errors */
	VALIDATION = "validation",
	/** File system operation errors */
	FILESYSTEM = "filesystem",
	/** Network and connectivity errors */
	NETWORK = "network",
	/** Security-related violations */
	SECURITY = "security",
	/** User input and command errors */
	USER_INPUT = "user_input",
	/** System resource exhaustion */
	RESOURCE = "resource",
	/** Authentication and authorization */
	AUTH = "auth",
	/** Timeout and performance issues */
	TIMEOUT = "timeout",
}

/**
 * Error codes for programmatic handling
 */
export enum ErrorCode {
	// Configuration Errors (1000-1099)
	CONFIG_NOT_FOUND = 1000,
	CONFIG_INVALID = 1001,
	CONFIG_PARSE_ERROR = 1002,
	CONFIG_VALIDATION_FAILED = 1003,
	CONFIG_WRITE_FAILED = 1004,

	// Runtime Errors (1100-1199)
	HOOK_EXECUTION_FAILED = 1100,
	HOOK_TIMEOUT = 1101,
	HOOK_NOT_FOUND = 1102,
	RUNTIME_EXCEPTION = 1103,
	DEPENDENCY_MISSING = 1104,

	// Validation Errors (1200-1299)
	INVALID_INPUT = 1200,
	SCHEMA_VALIDATION_FAILED = 1201,
	TYPE_MISMATCH = 1202,
	CONSTRAINT_VIOLATION = 1203,
	FORMAT_ERROR = 1204,

	// File System Errors (1300-1399)
	FILE_NOT_FOUND = 1300,
	PERMISSION_DENIED = 1301,
	DISK_FULL = 1302,
	FILE_LOCKED = 1303,
	DIRECTORY_NOT_EMPTY = 1304,

	// Network Errors (1400-1499)
	CONNECTION_REFUSED = 1400,
	CONNECTION_TIMEOUT = 1401,
	HOST_NOT_FOUND = 1402,
	CONNECTION_RESET = 1403,
	NETWORK_UNREACHABLE = 1404,

	// Security Errors (1500-1599)
	UNAUTHORIZED_ACCESS = 1500,
	FORBIDDEN_OPERATION = 1501,
	INVALID_CREDENTIALS = 1502,
	TOKEN_EXPIRED = 1503,
	SECURITY_VIOLATION = 1504,
	INJECTION_ATTEMPT = 1505,

	// User Input Errors (1600-1699)
	INVALID_COMMAND = 1600,
	MISSING_ARGUMENT = 1601,
	INVALID_OPTION = 1602,
	COMMAND_NOT_FOUND = 1603,
	ARGUMENT_PARSE_ERROR = 1604,

	// Resource Errors (1700-1799)
	OUT_OF_MEMORY = 1700,
	CPU_LIMIT_EXCEEDED = 1701,
	DISK_QUOTA_EXCEEDED = 1702,
	TOO_MANY_OPEN_FILES = 1703,
	RESOURCE_UNAVAILABLE = 1704,

	// Auth Errors (1800-1899)
	AUTHENTICATION_FAILED = 1800,
	AUTHORIZATION_FAILED = 1801,
	SESSION_EXPIRED = 1802,
	INVALID_TOKEN = 1803,

	// Timeout Errors (1900-1999)
	OPERATION_TIMEOUT = 1900,
	REQUEST_TIMEOUT = 1901,
	DEADLINE_EXCEEDED = 1902,

	// Generic/Unknown (9000+)
	UNKNOWN_ERROR = 9000,
	INTERNAL_ERROR = 9001,
}

/**
 * Error context information for debugging and reporting
 */
export type ErrorContext = {
	/** Unique correlation ID for tracing across operations */
	correlationId: string;
	/** Timestamp when error occurred */
	timestamp: Date;
	/** Operation or function where error occurred */
	operation?: string;
	/** User-facing error message */
	userMessage?: string;
	/** Technical details for developers */
	technicalDetails?: Record<string, JsonValue>;
	/** Stack trace context */
	stackTrace?: string;
	/** Additional metadata */
	metadata?: Record<string, JsonValue>;
	/** Environment information */
	environment?: {
		nodeVersion?: string;
		bunVersion?: string;
		platform?: string;
		arch?: string;
	};
};

/**
 * Recovery strategy options
 */
export type RecoveryStrategy = {
	/** Maximum number of retry attempts */
	maxRetries: number;
	/** Delay between retries (ms) */
	retryDelay: number;
	/** Exponential backoff multiplier */
	backoffMultiplier: number;
	/** Maximum retry delay (ms) */
	maxRetryDelay: number;
	/** Whether to use jitter in retry delays */
	useJitter: boolean;
	/** Conditions under which to retry */
	retryCondition?: (error: IGrappleError) => boolean;
	/** Fallback function to execute if all retries fail */
	fallback?: () => unknown;
};

/**
 * Error reporting configuration
 */
export type ErrorReportingConfig = {
	/** Whether to enable error reporting */
	enabled: boolean;
	/** Minimum severity level to report */
	minSeverity: ErrorSeverity;
	/** Whether to include stack traces */
	includeStackTrace: boolean;
	/** Whether to include environment info */
	includeEnvironment: boolean;
	/** Custom error transformation function */
	transform?: (error: IGrappleError) => Record<string, JsonValue>;
	/** Custom reporting handler */
	reporter?: (report: ErrorReport) => Promise<void> | void;
};

/**
 * Error report structure for monitoring systems
 */
export type ErrorReport = {
	/** Error details */
	error: {
		name: string;
		message: string;
		code: ErrorCode;
		category: ErrorCategory;
		severity: ErrorSeverity;
		stack?: string;
	};
	/** Context information */
	context: ErrorContext;
	/** Additional metadata */
	metadata: Record<string, JsonValue>;
	/** Report generation timestamp */
	reportedAt: Date;
};

/**
 * Circuit breaker state
 */
export enum CircuitState {
	CLOSED = "closed",
	OPEN = "open",
	HALF_OPEN = "half_open",
}

/**
 * Circuit breaker configuration
 */
export type CircuitBreakerConfig = {
	/** Number of failures to trigger open state */
	failureThreshold: number;
	/** Number of successful requests to close circuit */
	successThreshold: number;
	/** Time to wait before trying half-open (ms) */
	timeout: number;
	/** Window size for failure counting (ms) */
	monitoringPeriod: number;
	/** Expected failure rate to trigger circuit (0-1) */
	expectedFailureRate: number;
	/** Minimum number of requests before circuit can trip */
	minimumRequestVolume: number;
};

/**
 * Health check status
 */
export type HealthStatus = {
	/** Overall health status */
	healthy: boolean;
	/** Individual component statuses */
	components: Record<
		string,
		{
			healthy: boolean;
			lastCheck: Date;
			error?: string;
		}
	>;
	/** Overall status message */
	message: string;
	/** Status check timestamp */
	timestamp: Date;
};

/**
 * Base interface for all Grapple errors
 */
export interface IGrappleError extends Error {
	readonly code: ErrorCode;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly context: ErrorContext;
	readonly cause?: Error;
	readonly isRecoverable: boolean;

	/** Get sanitized error for user display */
	toUserMessage(): string;
	/** Get detailed error for logging */
	toLogMessage(): string;
	/** Get error report for monitoring */
	toReport(): ErrorReport;
	/** Check if error is retryable */
	isRetryable(): boolean;
}
