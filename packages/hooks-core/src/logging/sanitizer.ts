/**
 * Data sanitization for secure logging
 *
 * Ensures no sensitive data is logged while maintaining observability
 */

import { DEFAULT_SANITIZATION } from "./config";
import type { SanitizationOptions } from "./types";

/**
 * Sanitize data for safe logging
 *
 * @param data - Raw data to sanitize
 * @param options - Sanitization options
 * @returns Sanitized data safe for logging
 */
export function sanitizeForLogging(
	data: unknown,
	options: SanitizationOptions = DEFAULT_SANITIZATION,
): unknown {
	return sanitizeValue(data, options, 0);
}

/**
 * Recursively sanitize a value
 */
function sanitizeValue(
	value: unknown,
	options: SanitizationOptions,
	depth: number,
): unknown {
	// Prevent infinite recursion
	if (depth >= options.maxDepth) {
		return "[MAX_DEPTH_EXCEEDED]";
	}

	// Handle null/undefined
	if (value === null || value === undefined) {
		return value;
	}

	// Handle arrays
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeValue(item, options, depth + 1));
	}

	// Handle objects
	if (typeof value === "object") {
		return sanitizeObject(value as Record<string, unknown>, options, depth);
	}

	// Handle strings
	if (typeof value === "string") {
		return sanitizeString(value, options);
	}

	// Handle other primitive types
	if (typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	// Handle functions and other types
	return "[UNSUPPORTED_TYPE]";
}

/**
 * Sanitize object properties
 */
function sanitizeObject(
	obj: Record<string, unknown>,
	options: SanitizationOptions,
	depth: number,
): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		const lowerKey = key.toLowerCase();

		// Remove sensitive fields entirely
		if (
			options.removeFields.some((field) =>
				lowerKey.includes(field.toLowerCase()),
			)
		) {
			continue; // Skip this field
		}

		// Mask sensitive fields
		if (
			options.maskFields.some((field) => lowerKey.includes(field.toLowerCase()))
		) {
			sanitized[key] = maskValue(value);
			continue;
		}

		// Recursively sanitize the value
		sanitized[key] = sanitizeValue(value, options, depth + 1);
	}

	return sanitized;
}

/**
 * Sanitize string values
 */
function sanitizeString(str: string, options: SanitizationOptions): string {
	if (!str || typeof str !== "string") {
		return String(str || "");
	}

	let sanitized = str;

	// Apply sensitive pattern masking
	for (const pattern of options.sensitivePatterns) {
		sanitized = sanitized.replace(pattern, (match) => {
			// For email addresses, show first letter and domain
			if (pattern.source.includes("@")) {
				const parts = match.split("@");
				if (parts.length === 2 && parts[0]) {
					return `${parts[0][0]}***@${parts[1]}`;
				}
			}

			// For other patterns, show first few characters
			if (match.length > 8) {
				return `${match.slice(0, 3)}***${match.slice(-2)}`;
			}

			return "[REDACTED]";
		});
	}

	// Truncate long strings
	if (sanitized.length > options.maxStringLength) {
		sanitized = `${sanitized.slice(0, options.maxStringLength)}...[TRUNCATED]`;
	}

	return sanitized;
}

/**
 * Mask a value for sensitive fields
 */
function maskValue(value: unknown): string {
	if (typeof value === "string") {
		// For short strings, completely mask
		if (value.length <= 4) {
			return "[REDACTED]";
		}

		// For longer strings, show first and last characters
		return `${value[0]}***${value.slice(-1)}`;
	}

	return "[REDACTED]";
}

/**
 * Sanitize error objects for logging
 */
export function sanitizeError(error: Error): {
	name: string;
	message: string;
	stack?: string;
	code?: string;
	[key: string]: unknown;
} {
	const sanitized: Record<string, unknown> = {
		name: error.name,
		message: error.message
			? sanitizeString(error.message, DEFAULT_SANITIZATION)
			: "Unknown error",
	};

	// Include stack trace in development/debug mode
	if (Bun.env.NODE_ENV === "development" || Bun.env.DEBUG) {
		sanitized.stack = error.stack;
	}

	// Include error code if present
	if ("code" in error && typeof error.code === "string") {
		sanitized.code = error.code;
	}

	// Sanitize additional error properties
	for (const [key, value] of Object.entries(error)) {
		if (!["name", "message", "stack"].includes(key)) {
			sanitized[key] = sanitizeValue(value, DEFAULT_SANITIZATION, 0);
		}
	}

	return sanitized as {
		name: string;
		message: string;
		stack?: string;
		code?: string;
		[key: string]: unknown;
	};
}

/**
 * Create a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
	// Use crypto for better randomness in production
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	// Fallback to timestamp + random for environments without crypto
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${timestamp}-${random}`;
}

/**
 * Hash user ID for privacy-preserving logging
 */
export function hashUserId(userId: string): string {
	// Simple hash for user ID anonymization
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		const char = userId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash &= hash; // Convert to 32-bit integer
	}
	return `user_${Math.abs(hash).toString(36)}`;
}
