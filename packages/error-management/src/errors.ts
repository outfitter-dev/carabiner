/**
 * Core Error Classes
 *
 * Production-ready error classes with comprehensive error handling features
 */

import { nanoid } from "nanoid";
import type { JsonValue } from "type-fest";
import type {
	ErrorCategory,
	ErrorCode,
	ErrorContext,
	ErrorReport,
	ErrorSeverity,
	IGrappleError,
} from "./types.js";
import {
	ErrorCategory as Category,
	ErrorCode as Code,
	ErrorSeverity as Severity,
} from "./types.js";

/**
 * Base error class for all Grapple errors
 */
export class GrappleError extends Error implements IGrappleError {
	override readonly name: string;
	readonly code: ErrorCode;
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly context: ErrorContext;
	override readonly cause?: Error;
	readonly isRecoverable: boolean;

	constructor(options: {
		message: string;
		code: ErrorCode;
		category: ErrorCategory;
		severity?: ErrorSeverity;
		cause?: Error;
		isRecoverable?: boolean;
		operation?: string;
		userMessage?: string;
		technicalDetails?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
	}) {
		super(options.message);

		this.name = this.constructor.name;
		this.code = options.code;
		this.category = options.category;
		this.severity = options.severity ?? Severity.ERROR;
		this.cause = options.cause;
		this.isRecoverable =
			options.isRecoverable ?? this.determineRecoverability();

		this.context = {
			correlationId: nanoid(),
			timestamp: new Date(),
			operation: options.operation,
			userMessage: options.userMessage,
			technicalDetails: options.technicalDetails as
				| Record<string, JsonValue>
				| undefined,
			stackTrace: this.stack,
			metadata: options.metadata as Record<string, JsonValue> | undefined,
			environment: this.getEnvironmentInfo(),
		};

		// Ensure proper prototype chain
		Object.setPrototypeOf(this, new.target.prototype);

		// Capture stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}

	/**
	 * Determine if error is recoverable based on category and code
	 */
	private determineRecoverability(): boolean {
		// Non-recoverable errors
		const nonRecoverableCategories = [
			Category.SECURITY,
			Category.AUTH,
			Category.VALIDATION,
		];

		const nonRecoverableCodes = [
			Code.CONFIG_INVALID,
			Code.SCHEMA_VALIDATION_FAILED,
			Code.SECURITY_VIOLATION,
			Code.FORBIDDEN_OPERATION,
			Code.INJECTION_ATTEMPT,
		];

		if (nonRecoverableCategories.includes(this.category)) {
			return false;
		}

		if (nonRecoverableCodes.includes(this.code)) {
			return false;
		}

		// Recoverable errors (typically transient)
		const recoverableCategories = [
			Category.NETWORK,
			Category.TIMEOUT,
			Category.RESOURCE,
		];

		const recoverableCodes = [
			Code.CONNECTION_TIMEOUT,
			Code.CONNECTION_REFUSED,
			Code.HOOK_TIMEOUT,
			Code.OPERATION_TIMEOUT,
			Code.RESOURCE_UNAVAILABLE,
		];

		return (
			recoverableCategories.includes(this.category) ||
			recoverableCodes.includes(this.code)
		);
	}

	/**
	 * Get environment information
	 */
	private getEnvironmentInfo() {
		return {
			nodeVersion: process.version,
			bunVersion: process.versions.bun,
			platform: process.platform,
			arch: process.arch,
		};
	}

	/**
	 * Get user-friendly error message
	 */
	toUserMessage(): string {
		if (this.context.userMessage) {
			return this.context.userMessage;
		}

		// Generate user-friendly messages based on category
		switch (this.category) {
			case Category.CONFIGURATION:
				return "Configuration error: Please check your settings and try again.";
			case Category.VALIDATION:
				return "Invalid input: Please verify your data and try again.";
			case Category.FILESYSTEM:
				return "File system error: Please check file permissions and disk space.";
			case Category.NETWORK:
				return "Network error: Please check your connection and try again.";
			case Category.SECURITY:
				return "Security error: Operation not permitted.";
			case Category.AUTH:
				return "Authentication error: Please verify your credentials.";
			case Category.TIMEOUT:
				return "Operation timed out: Please try again later.";
			case Category.RESOURCE:
				return "System resources unavailable: Please try again later.";
			case Category.USER_INPUT:
				return "Invalid command or input: Please check the documentation.";
			default:
				return "An unexpected error occurred: Please try again or contact support.";
		}
	}

	/**
	 * Get detailed error message for logging
	 */
	toLogMessage(): string {
		const details: string[] = [];

		details.push(`Error: ${this.name}`);
		details.push(`Message: ${this.message}`);
		details.push(`Code: ${this.code} (${Code[this.code]})`);
		details.push(`Category: ${this.category}`);
		details.push(`Severity: ${this.severity}`);
		details.push(`Correlation ID: ${this.context.correlationId}`);

		if (this.context.operation) {
			details.push(`Operation: ${this.context.operation}`);
		}

		if (this.cause) {
			details.push(`Caused by: ${this.cause.message}`);
		}

		if (this.context.technicalDetails) {
			details.push(
				`Technical Details: ${JSON.stringify(this.context.technicalDetails)}`,
			);
		}

		return details.join(" | ");
	}

	/**
	 * Generate error report for monitoring
	 */
	toReport(): ErrorReport {
		return {
			error: {
				name: this.name,
				message: this.message,
				code: this.code,
				category: this.category,
				severity: this.severity,
				stack: this.stack,
			},
			context: this.context,
			metadata: {
				recoverable: this.isRecoverable,
				causedBy: this.cause?.message || null,
				...this.context.metadata,
			},
			reportedAt: new Date(),
		};
	}

	/**
	 * Check if error is retryable
	 */
	isRetryable(): boolean {
		// Only recoverable errors are retryable
		return this.isRecoverable && this.severity !== Severity.CRITICAL;
	}
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.CONFIG_INVALID,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.CONFIGURATION,
			severity: Severity.ERROR,
			...options,
		});
	}
}

/**
 * Runtime execution errors
 */
export class RuntimeError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.RUNTIME_EXCEPTION,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.RUNTIME,
			severity: Severity.ERROR,
			...options,
		});
	}
}

/**
 * Validation errors
 */
export class ValidationError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.INVALID_INPUT,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity" | "isRecoverable"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.VALIDATION,
			severity: Severity.WARNING,
			...options,
			isRecoverable: false, // Validation errors are never recoverable
		});
	}
}

/**
 * File system operation errors
 */
export class FileSystemError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.FILE_NOT_FOUND,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.FILESYSTEM,
			severity: Severity.ERROR,
			...options,
		});
	}
}

/**
 * Network and connectivity errors
 */
export class NetworkError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.CONNECTION_REFUSED,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity" | "isRecoverable"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.NETWORK,
			severity: Severity.ERROR,
			...options,
			isRecoverable: true, // Network errors are typically recoverable
		});
	}
}

/**
 * Security violation errors
 */
export class SecurityError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.SECURITY_VIOLATION,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			| "message"
			| "code"
			| "category"
			| "severity"
			| "isRecoverable"
			| "userMessage"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.SECURITY,
			severity: Severity.CRITICAL,
			...options,
			isRecoverable: false, // Security errors are never recoverable
			userMessage: "Security violation detected. Operation denied.",
		});
	}
}

/**
 * User input and command errors
 */
export class UserInputError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.INVALID_COMMAND,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.USER_INPUT,
			severity: Severity.WARNING,
			...options,
		});
	}
}

/**
 * Resource exhaustion errors
 */
export class ResourceError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.RESOURCE_UNAVAILABLE,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity" | "isRecoverable"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.RESOURCE,
			severity: Severity.ERROR,
			...options,
			isRecoverable: true, // Resource errors are often temporary
		});
	}
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.AUTHENTICATION_FAILED,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			| "message"
			| "code"
			| "category"
			| "severity"
			| "isRecoverable"
			| "userMessage"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.AUTH,
			severity: Severity.ERROR,
			...options,
			isRecoverable: false, // Auth errors require user intervention
			userMessage: "Authentication required. Please verify your credentials.",
		});
	}
}

/**
 * Timeout and performance errors
 */
export class TimeoutError extends GrappleError {
	constructor(
		message: string,
		code: ErrorCode = Code.OPERATION_TIMEOUT,
		options: Omit<
			ConstructorParameters<typeof GrappleError>[0],
			"message" | "code" | "category" | "severity" | "isRecoverable"
		> = {},
	) {
		super({
			message,
			code,
			category: Category.TIMEOUT,
			severity: Severity.WARNING,
			...options,
			isRecoverable: true, // Timeouts are typically recoverable
		});
	}
}

/**
 * Create GrappleError from Node.js system error
 */
export function fromSystemError(
	error: NodeJS.ErrnoException,
	operation?: string,
): GrappleError {
	const code = error.code;
	let grappleError: GrappleError;

	switch (code) {
		case "ENOENT":
			grappleError = new FileSystemError(error.message, Code.FILE_NOT_FOUND, {
				cause: error,
				operation,
			});
			break;
		case "EACCES":
		case "EPERM":
			grappleError = new FileSystemError(
				error.message,
				Code.PERMISSION_DENIED,
				{ cause: error, operation },
			);
			break;
		case "ENOSPC":
			grappleError = new FileSystemError(error.message, Code.DISK_FULL, {
				cause: error,
				operation,
			});
			break;
		case "EMFILE":
		case "ENFILE":
			grappleError = new ResourceError(
				error.message,
				Code.TOO_MANY_OPEN_FILES,
				{ cause: error, operation },
			);
			break;
		case "ECONNREFUSED":
			grappleError = new NetworkError(error.message, Code.CONNECTION_REFUSED, {
				cause: error,
				operation,
			});
			break;
		case "ETIMEDOUT":
			grappleError = new TimeoutError(error.message, Code.CONNECTION_TIMEOUT, {
				cause: error,
				operation,
			});
			break;
		case "ENOTFOUND":
			grappleError = new NetworkError(error.message, Code.HOST_NOT_FOUND, {
				cause: error,
				operation,
			});
			break;
		case "ECONNRESET":
			grappleError = new NetworkError(error.message, Code.CONNECTION_RESET, {
				cause: error,
				operation,
			});
			break;
		default:
			grappleError = new RuntimeError(error.message, Code.INTERNAL_ERROR, {
				cause: error,
				operation,
			});
			break;
	}

	return grappleError;
}

/**
 * Create GrappleError from generic Error
 */
export function fromError(error: Error, operation?: string): GrappleError {
	if (error instanceof GrappleError) {
		return error;
	}

	// Check for Node.js system error
	if ("code" in error) {
		return fromSystemError(error as NodeJS.ErrnoException, operation);
	}

	// Default to runtime error
	return new RuntimeError(error.message, Code.RUNTIME_EXCEPTION, {
		cause: error,
		operation,
	});
}

/**
 * Create appropriate error based on error message patterns
 */
export function fromMessage(message: string, operation?: string): GrappleError {
	const lowerMessage = message.toLowerCase();

	if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
		return new TimeoutError(message, Code.OPERATION_TIMEOUT, { operation });
	}

	if (
		lowerMessage.includes("permission") ||
		lowerMessage.includes("access denied")
	) {
		return new FileSystemError(message, Code.PERMISSION_DENIED, {
			operation,
		});
	}

	if (lowerMessage.includes("not found")) {
		return new FileSystemError(message, Code.FILE_NOT_FOUND, { operation });
	}

	if (lowerMessage.includes("connection") || lowerMessage.includes("network")) {
		return new NetworkError(message, Code.CONNECTION_REFUSED, { operation });
	}

	if (lowerMessage.includes("validation") || lowerMessage.includes("invalid")) {
		return new ValidationError(message, Code.INVALID_INPUT, { operation });
	}

	if (lowerMessage.includes("config")) {
		return new ConfigurationError(message, Code.CONFIG_INVALID, {
			operation,
		});
	}

	if (
		lowerMessage.includes("unauthorized") ||
		lowerMessage.includes("forbidden")
	) {
		return new SecurityError(message, Code.UNAUTHORIZED_ACCESS, {
			operation,
		});
	}

	// Default to runtime error
	return new RuntimeError(message, Code.RUNTIME_EXCEPTION, { operation });
}
