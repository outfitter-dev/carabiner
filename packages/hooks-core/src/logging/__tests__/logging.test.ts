/**
 * Tests for the production logging system
 */

import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	createLoggingConfig,
	detectEnvironment,
	detectLogLevel,
} from "../config";
import {
	clearLoggerCache,
	createDevelopmentLogger,
	createHookLogger,
	createLogger,
	createProductionLogger,
	createTestLogger,
} from "../factory";
import {
	generateCorrelationId,
	hashUserId,
	sanitizeForLogging,
} from "../sanitizer";

beforeEach(() => {
	// Clear logger cache before each test
	clearLoggerCache();

	// Reset environment
	process.env.NODE_ENV = undefined;
	process.env.LOG_LEVEL = undefined;
	process.env.DEBUG = undefined;
});

afterEach(() => {
	clearLoggerCache();
});

test("createLogger creates logger with correct configuration", () => {
	const logger = createLogger("test-service");
	expect(logger).toBeDefined();
	expect(typeof logger.info).toBe("function");
	expect(typeof logger.error).toBe("function");
	expect(typeof logger.debug).toBe("function");
	expect(typeof logger.child).toBe("function");
});

test("createProductionLogger configures for production", () => {
	const logger = createProductionLogger("test-service");
	expect(logger).toBeDefined();
	// Production logger should not enable debug by default
	expect(logger.isLevelEnabled("debug")).toBe(false);
});

test("createDevelopmentLogger enables debug logging", () => {
	const logger = createDevelopmentLogger("test-service");
	expect(logger).toBeDefined();
	expect(logger.isLevelEnabled("debug")).toBe(true);
});

test("createTestLogger is silent by default", () => {
	const logger = createTestLogger("test-service");
	expect(logger).toBeDefined();
	// Should not enable info in test mode
	expect(logger.isLevelEnabled("info")).toBe(false);
});

test("createHookLogger creates hook-specific logger", () => {
	const hookLogger = createHookLogger("PreToolUse", "Bash");
	expect(hookLogger).toBeDefined();
	expect(typeof hookLogger.startExecution).toBe("function");
	expect(typeof hookLogger.completeExecution).toBe("function");
	expect(typeof hookLogger.logSecurityEvent).toBe("function");
});

test("sanitizeForLogging removes sensitive data", () => {
	const testData = {
		username: "john",
		password: "secret123",
		apiKey: "abc-def-ghi",
		email: "john@example.com",
		normalField: "safe data",
		nested: {
			token: "sensitive-token",
			data: "normal data",
		},
	};

	const sanitized = sanitizeForLogging(testData);

	expect(sanitized).toBeDefined();
	const sanitizedObj = sanitized as Record<string, unknown>;

	// Sensitive fields should be removed
	expect(sanitizedObj.password).toBeUndefined();
	expect(sanitizedObj.apiKey).toBeUndefined();

	// Email should be masked
	expect(typeof sanitizedObj.email).toBe("string");
	expect(sanitizedObj.email).toContain("***");

	// Normal fields should be preserved
	expect(sanitizedObj.normalField).toBe("safe data");
	expect(sanitizedObj.username).toBe("john");
});

test("generateCorrelationId creates unique IDs", () => {
	const id1 = generateCorrelationId();
	const id2 = generateCorrelationId();

	expect(id1).toBeTruthy();
	expect(id2).toBeTruthy();
	expect(id1).not.toBe(id2);
	expect(typeof id1).toBe("string");
});

test("hashUserId anonymizes user IDs", () => {
	const userId = "user123";
	const hashed = hashUserId(userId);

	expect(hashed).toBeTruthy();
	expect(hashed).toContain("user_");
	expect(hashed).not.toBe(userId);

	// Should be consistent
	expect(hashUserId(userId)).toBe(hashed);
});

test("detectEnvironment detects environment correctly", () => {
	// Test development
	process.env.NODE_ENV = "development";
	expect(detectEnvironment()).toBe("development");

	// Test production
	process.env.NODE_ENV = "production";
	expect(detectEnvironment()).toBe("production");

	// Test test
	process.env.NODE_ENV = "test";
	expect(detectEnvironment()).toBe("test");

	// Test default
	process.env.NODE_ENV = undefined;
	expect(detectEnvironment()).toBe("development");
});

test("detectLogLevel respects DEBUG flag", () => {
	process.env.DEBUG = "true";
	expect(detectLogLevel()).toBe("debug");

	process.env.DEBUG = undefined;
	process.env.LOG_LEVEL = "info";
	expect(detectLogLevel()).toBe("info");
});

test("logger child creates child with context", () => {
	const logger = createLogger("test");
	const child = logger.child({ component: "test-component" });

	expect(child).toBeDefined();
	expect(typeof child.info).toBe("function");
	expect(typeof child.child).toBe("function");
});

test("logger handles errors correctly", () => {
	const logger = createTestLogger("test"); // Silent logger for tests
	const testError = new Error("Test error");

	// Should not throw
	expect(() => {
		logger.error("Test message");
		logger.error(testError, "Error with context");
	}).not.toThrow();
});

test("logging configuration uses environment variables", () => {
	process.env.LOG_LEVEL = "warn";
	process.env.NODE_ENV = "production";

	const config = createLoggingConfig("test-service");

	expect(config.level).toBe("warn");
	expect(config.environment).toBe("production");
	expect(config.service).toBe("test-service");
	expect(config.pretty).toBe(false); // No pretty printing in production
});

test("sanitizer handles deep nested objects", () => {
	const deepObject = {
		level1: {
			level2: {
				level3: {
					password: "secret",
					data: "normal",
				},
			},
		},
	};

	const sanitized = sanitizeForLogging(deepObject) as {
		level1: {
			level2: {
				level3: {
					data?: string;
					password?: string;
				};
			};
		};
	};

	// Should traverse deep structures
	expect(sanitized.level1.level2.level3.data).toBe("normal");
	expect(sanitized.level1.level2.level3.password).toBeUndefined();
});

test("sanitizer handles arrays correctly", () => {
	const arrayData = [
		{ name: "item1", password: "secret1" },
		{ name: "item2", token: "secret2" },
	];

	const sanitized = sanitizeForLogging(arrayData) as Array<{
		name: string;
		password?: string;
		token?: string;
	}>;

	expect(Array.isArray(sanitized)).toBe(true);
	expect(sanitized[0].name).toBe("item1");
	expect(sanitized[0].password).toBeUndefined();
	expect(sanitized[1].name).toBe("item2");
	expect(sanitized[1].token).toBeUndefined();
});

test("hook logger logs execution lifecycle", () => {
	const hookLogger = createHookLogger("PreToolUse", "Bash");

	const executionContext = {
		event: "PreToolUse" as const,
		toolName: "Bash" as const,
		executionId: "test-exec-123",
		sessionId: "test-session",
		projectDir: "/test/project",
	};

	const performanceMetrics = {
		duration: 100,
		memoryBefore: 1000,
		memoryAfter: 1200,
		memoryDelta: 200,
	};

	// Should not throw
	expect(() => {
		hookLogger.startExecution(executionContext);
		hookLogger.completeExecution(executionContext, true, performanceMetrics);
	}).not.toThrow();
});

test("hook logger logs security events", () => {
	const hookLogger = createHookLogger("PreToolUse", "Bash");

	const executionContext = {
		event: "PreToolUse" as const,
		toolName: "Bash" as const,
		executionId: "test-exec-123",
	};

	// Should not throw
	expect(() => {
		hookLogger.logSecurityEvent(
			"suspicious_command",
			"high",
			executionContext,
			{ command: "rm -rf /" },
		);
	}).not.toThrow();
});

test("logger caching works correctly", () => {
	const logger1 = createLogger("test-service");
	const logger2 = createLogger("test-service");

	// Should return same instance
	expect(logger1).toBe(logger2);

	clearLoggerCache();

	const logger3 = createLogger("test-service");
	// After clearing cache, should be different instance
	expect(logger1).not.toBe(logger3);
});
