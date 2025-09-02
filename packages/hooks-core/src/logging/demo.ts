#!/usr/bin/env bun

/**
 * Demo script showing production logging in action
 *
 * Usage:
 *   bun run demo.ts                          # Development mode (pretty)
 *   NODE_ENV=production bun run demo.ts      # Production mode (JSON)
 *   LOG_LEVEL=debug bun run demo.ts          # Debug level
 */

import { createCliLogger, createHookLogger, createLogger } from "./factory";
import type { HookExecutionContext, PerformanceMetrics } from "./types";

/**
 * Demonstrate basic logging
 */
function basicLoggingDemo(): void {
	const logger = createLogger("demo-service");

	logger.info("Demo service started", {
		version: "1.0.0",
		environment: process.env.NODE_ENV || "development",
		logLevel: process.env.LOG_LEVEL || "auto",
	});

	logger.debug("Debug information", {
		memoryUsage: process.memoryUsage(),
		uptime: process.uptime(),
	});

	logger.warn("This is a warning", {
		reason: "demo-purpose",
		severity: "low",
	});

	// Demonstrate sensitive data sanitization
	logger.info("User data logged safely", {
		username: "john_doe",
		email: "john@example.com", // Will be masked
		password: "secret123", // Will be removed
		apiKey: "sk-1234567890abcdef", // Will be removed
		sessionToken: "sess_abcdef123456", // Will be removed
		normalData: "this is fine",
		userId: "user_12345", // Will be hashed
	});
}

/**
 * Demonstrate hook execution logging
 */
function hookExecutionDemo(): void {
	const hookLogger = createHookLogger("PreToolUse", "Bash");

	const executionContext: HookExecutionContext = {
		event: "PreToolUse",
		toolName: "Bash",
		executionId: `demo_${Date.now()}`,
		sessionId: "demo-session-123",
		projectDir: "/demo/workspace",
		userId: "demo-user-456",
	};

	// Start execution
	hookLogger.startExecution(executionContext);

	// Log a security event
	hookLogger.logSecurityEvent(
		"command_validation",
		"medium",
		executionContext,
		{
			command: "ls -la /workspace",
			validation: "passed",
			restrictions: ["workspace-only"],
		},
	);

	// Simulate execution completion
	const performanceMetrics: PerformanceMetrics = {
		duration: 125,
		memoryBefore: 1024 * 1024 * 10, // 10MB
		memoryAfter: 1024 * 1024 * 12, // 12MB
		memoryDelta: 1024 * 1024 * 2, // 2MB increase
		cpuUsage: 15.5,
	};

	hookLogger.completeExecution(executionContext, true, performanceMetrics, {
		success: true,
		message: "Command executed successfully",
		output: "file1.txt\nfile2.txt\nfile3.txt",
	});
}

/**
 * Demonstrate CLI logging
 */
function cliLoggingDemo(): void {
	const cliLogger = createCliLogger("demo");

	cliLogger.info("Starting CLI demo command", {
		command: "demo",
		args: ["--example"],
		workDir: process.cwd(),
	});

	cliLogger.debug("Loading configuration", {
		configFile: "./hooks.config.json",
		schema: "v1.0",
	});

	cliLogger.info("Processing files", {
		inputFiles: ["input1.ts", "input2.ts"],
		outputDir: "./output",
	});

	cliLogger.info("✅ Command completed successfully", {
		filesProcessed: 2,
		duration: "1.2s",
		warnings: 0,
		errors: 0,
	});
}

/**
 * Demonstrate error handling
 */
function errorHandlingDemo(): void {
	const logger = createLogger("error-demo");

	try {
		throw new Error("Simulated database connection error");
	} catch (error) {
		if (error instanceof Error) {
			logger.error(error, "Database operation failed", {
				operation: "user-lookup",
				database: "users-db",
				retryable: true,
				retryCount: 0,
				maxRetries: 3,
			});
		}
	}

	// Log different error severities
	logger.error("Critical system failure", {
		component: "auth-service",
		impact: "service-unavailable",
		escalation: "immediate",
	});

	logger.warn("Deprecated API usage detected", {
		api: "/v1/users",
		deprecatedSince: "2024-01-01",
		replacementApi: "/v2/users",
		client: "mobile-app",
	});
}

/**
 * Demonstrate child loggers
 */
function childLoggerDemo(): void {
	const baseLogger = createLogger("request-handler");

	// Create child logger for a specific request
	const requestLogger = baseLogger.child({
		requestId: "req-abc-123",
		userId: "user-456",
		endpoint: "/api/data",
		method: "GET",
	});

	requestLogger.info("Request received");
	requestLogger.debug("Validating request parameters");
	requestLogger.info("Database query executed", {
		query: "SELECT * FROM data",
	});
	requestLogger.info("Response sent", {
		statusCode: 200,
		responseTime: "45ms",
	});

	// Create nested child logger
	const auditLogger = requestLogger.child({
		component: "audit",
		action: "data-access",
	});

	auditLogger.info("Data access logged for compliance");
}

/**
 * Show environment-specific behavior
 */
function environmentDemo(): void {
	const logger = createLogger("env-demo");

	logger.info("Environment information", {
		nodeEnv: process.env.NODE_ENV,
		logLevel: process.env.LOG_LEVEL,
		debug: process.env.DEBUG,
		prettyPrint: process.env.NODE_ENV !== "production",
	});

	// These will only show in debug mode
	logger.debug("Detailed debug info - only visible in debug mode");
	logger.trace("Trace level info - only visible in trace mode");
}

/**
 * Main demo function
 */
async function main(): Promise<void> {
	basicLoggingDemo();
	hookExecutionDemo();
	cliLoggingDemo();
	errorHandlingDemo();
	childLoggerDemo();
	environmentDemo();
}

// Run the demo
if (import.meta.main) {
	main().catch((_error) => {
		process.exit(1);
	});
}
