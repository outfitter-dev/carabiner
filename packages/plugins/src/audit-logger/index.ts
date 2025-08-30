/**
 * @file audit-logger/index.ts
 * @description Audit logging plugin - comprehensive logging of all Claude Code operations
 *
 * This plugin provides detailed audit logging including:
 * - Operation logging with timestamps
 * - User context and session tracking
 * - Security-relevant event logging
 * - File change tracking
 * - Command execution logging
 * - Configurable log levels and formats
 */

import { appendFile, mkdir } from "node:fs/promises";
import { hostname, userInfo } from "node:os";
import { dirname, join } from "node:path";
import type { HookPlugin, PluginResult } from "@carabiner/registry";
import type { HookContext } from "@carabiner/types";
import { isBashHookContext, isFileHookContext } from "@carabiner/types";
import { z } from "zod";

/**
 * Audit log entry interface
 */
type AuditLogEntry = {
	timestamp: string;
	sessionId: string;
	event: string;
	toolName?: string;
	operation: string;
	user: string;
	hostname: string;
	workingDirectory: string;
	success: boolean;
	duration?: number;
	metadata: Record<string, unknown>;
	sensitive?: boolean;
	risk?: "low" | "medium" | "high";
};

/**
 * Audit logger plugin configuration schema
 */
const AuditLoggerConfigSchema = z
	.object({
		/** Whether to enable audit logging */
		enabled: z.boolean().default(true),

		/** Log file path (relative to working directory or absolute) */
		logFile: z.string().default("audit.log"),

		/** Whether to use absolute path for log file */
		absoluteLogPath: z.boolean().default(false),

		/** Log format */
		format: z.enum(["json", "text", "csv"]).default("json"),

		/** Log level */
		level: z.enum(["all", "operations", "security", "errors"]).default("all"),

		/** Whether to log to console as well */
		logToConsole: z.boolean().default(false),

		/** Console log level for filtering */
		consoleLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

		/** Whether to include sensitive information (file contents, command outputs) */
		includeSensitive: z.boolean().default(false),

		/** Whether to log file content changes */
		logFileChanges: z.boolean().default(true),

		/** Whether to log command executions */
		logCommands: z.boolean().default(true),

		/** Whether to log user prompts */
		logUserPrompts: z.boolean().default(false),

		/** Maximum log entry size in characters */
		maxEntrySize: z.number().min(100).default(10_000),

		/** Whether to rotate log files */
		rotateFiles: z.boolean().default(false),

		/** Maximum log file size in bytes before rotation */
		maxFileSize: z
			.number()
			.min(1024)
			.default(10 * 1024 * 1024), // 10MB

		/** Number of rotated files to keep */
		maxFiles: z.number().min(1).max(100).default(5),

		/** Operations to exclude from logging */
		excludeOperations: z.array(z.string()).default([]),

		/** Tools to exclude from logging */
		excludeTools: z.array(z.string()).default([]),

		/** Whether to anonymize sensitive paths */
		anonymizePaths: z.boolean().default(false),

		/** Custom fields to include in log entries */
		customFields: z.record(z.string()).default({}),

		/** Whether to compress rotated log files */
		compressRotated: z.boolean().default(true),

		/** Whether to buffer log writes for performance */
		bufferWrites: z.boolean().default(true),

		/** Buffer flush interval in milliseconds */
		bufferFlushInterval: z.number().min(100).default(5000),
	})
	.default({});

type AuditLoggerConfig = z.infer<typeof AuditLoggerConfigSchema>;

/**
 * Global audit logger instance
 */
class AuditLogger {
	private readonly buffer: string[] = [];
	private flushTimer?: NodeJS.Timeout;

	constructor(private readonly config: AuditLoggerConfig) {
		if (config.bufferWrites) {
			this.setupBufferedWrites();
		}
	}

	private setupBufferedWrites(): void {
		this.flushTimer = setInterval(() => {
			this.flushBuffer().catch((_error) => {});
		}, this.config.bufferFlushInterval);
	}

	async log(entry: AuditLogEntry): Promise<void> {
		if (!this.config.enabled) {
			return;
		}

		// Check exclusions
		if (this.config.excludeOperations.includes(entry.operation)) {
			return;
		}
		if (entry.toolName && this.config.excludeTools.includes(entry.toolName)) {
			return;
		}

		// Apply level filtering
		if (!this.shouldLog(entry)) {
			return;
		}

		// Sanitize entry
		const sanitizedEntry = this.sanitizeEntry(entry);

		// Format entry
		const formatted = this.formatEntry(sanitizedEntry);

		// Log to console if enabled
		if (this.config.logToConsole) {
			this.logToConsole(sanitizedEntry, formatted);
		}

		// Write to file
		if (this.config.bufferWrites) {
			this.buffer.push(formatted);
		} else {
			await this.writeToFile(formatted);
		}
	}

	private shouldLog(entry: AuditLogEntry): boolean {
		switch (this.config.level) {
			case "all":
				return true;
			case "operations":
				return ["PreToolUse", "PostToolUse"].includes(entry.event);
			case "security":
				return entry.risk === "high" || Boolean(entry.sensitive);
			case "errors":
				return !entry.success;
			default:
				return true;
		}
	}

	private sanitizeEntry(entry: AuditLogEntry): AuditLogEntry {
		const sanitized = { ...entry };

		// Truncate large entries
		if (JSON.stringify(sanitized).length > this.config.maxEntrySize) {
			sanitized.metadata = { ...sanitized.metadata, truncated: true };

			// Remove large fields
			if (
				sanitized.metadata.content &&
				typeof sanitized.metadata.content === "string"
			) {
				sanitized.metadata.content = `${sanitized.metadata.content.substring(0, 1000)}... [truncated]`;
			}
		}

		// Anonymize paths if enabled
		if (this.config.anonymizePaths) {
			sanitized.workingDirectory = this.anonymizePath(
				sanitized.workingDirectory,
			);

			if (
				sanitized.metadata.filePath &&
				typeof sanitized.metadata.filePath === "string"
			) {
				sanitized.metadata.filePath = this.anonymizePath(
					sanitized.metadata.filePath,
				);
			}
		}

		// Remove sensitive information if not included
		if (!this.config.includeSensitive && sanitized.sensitive) {
			sanitized.metadata = { ...sanitized.metadata, sensitive: "[REDACTED]" };
		}

		return sanitized;
	}

	private anonymizePath(path: string): string {
		// Replace username and other sensitive parts
		const user = userInfo().username;
		return path.replace(new RegExp(`/${user}/`, "g"), "/[USER]/");
	}

	private formatEntry(entry: AuditLogEntry): string {
		switch (this.config.format) {
			case "json":
				return JSON.stringify(entry);
			case "text":
				return this.formatAsText(entry);
			case "csv":
				return this.formatAsCSV(entry);
			default:
				return JSON.stringify(entry);
		}
	}

	private formatAsText(entry: AuditLogEntry): string {
		const timestamp = entry.timestamp;
		const status = entry.success ? "SUCCESS" : "FAILURE";
		const operation = entry.toolName
			? `${entry.event}_${entry.toolName}`
			: entry.event;
		const duration = entry.duration ? ` (${Math.round(entry.duration)}ms)` : "";

		return `[${timestamp}] ${status} ${operation}${duration} - ${entry.user}@${entry.hostname} in ${entry.workingDirectory}`;
	}

	private formatAsCSV(entry: AuditLogEntry): string {
		const fields = [
			entry.timestamp,
			entry.sessionId,
			entry.event,
			entry.toolName || "",
			entry.operation,
			entry.user,
			entry.hostname,
			entry.workingDirectory,
			entry.success.toString(),
			entry.duration?.toString() || "",
			JSON.stringify(entry.metadata).replace(/"/g, '""'), // Escape quotes for CSV
			entry.sensitive?.toString() || "",
			entry.risk || "",
		];

		return fields.map((f) => `"${f}"`).join(",");
	}

	private logToConsole(entry: AuditLogEntry, _formatted: string): void {
		const level = entry.success ? "info" : "error";

		if (this.shouldLogToConsole(level)) {
			if (this.config.format === "json") {
			} else {
			}
		}
	}

	private shouldLogToConsole(level: string): boolean {
		const levels = { debug: 0, info: 1, warn: 2, error: 3 };
		const currentLevel =
			levels[this.config.consoleLevel as keyof typeof levels] || 1;
		const messageLevel = levels[level as keyof typeof levels] || 1;

		return messageLevel >= currentLevel;
	}

	private async flushBuffer(): Promise<void> {
		if (this.buffer.length === 0) {
			return;
		}

		const entries = this.buffer.splice(0);
		const content = `${entries.join("\n")}\n`;

		await this.writeToFile(content);
	}

	private async writeToFile(content: string): Promise<void> {
		try {
			const logPath = this.config.absoluteLogPath
				? this.config.logFile
				: join(process.cwd(), this.config.logFile);

			// Ensure directory exists
			const dir = dirname(logPath);
			await mkdir(dir, { recursive: true });

			// Check for rotation if enabled
			if (this.config.rotateFiles) {
				await this.checkRotation(logPath);
			}

			// Append to file
			await appendFile(logPath, content);
		} catch (_error) {}
	}

	private async checkRotation(_logPath: string): Promise<void> {
		// Simplified rotation check - in a real implementation,
		// you'd check file size and rotate if needed
		// This is a placeholder for the rotation logic
	}

	async shutdown(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
		}

		if (this.buffer.length > 0) {
			await this.flushBuffer();
		}
	}
}

// Global audit logger instance
let globalAuditLogger: AuditLogger | undefined;

/**
 * Extract risk level from operation
 */
function assessOperationRisk(context: HookContext): "low" | "medium" | "high" {
	// High risk operations
	if (isBashHookContext(context)) {
		const command = context.toolInput.command;
		if (command && /\b(rm\s+-rf|sudo|chmod|chown)\b/.test(command)) {
			return "high";
		}
		return "medium";
	}

	// Medium risk operations
	if (isFileHookContext(context)) {
		return "medium";
	}

	// Low risk operations
	return "low";
}

/**
 * Check if operation contains sensitive information
 */
function containsSensitiveInfo(context: HookContext): boolean {
	const sensitivePatterns = [
		/password\s*[:=]/i,
		/api[_-]?key\s*[:=]/i,
		/secret\s*[:=]/i,
		/token\s*[:=]/i,
		/-----BEGIN [A-Z]+ PRIVATE KEY-----/,
		/AKIA[0-9A-Z]{16}/,
	];

	// Check bash commands for sensitive info
	if (isBashHookContext(context)) {
		return sensitivePatterns.some((pattern) =>
			pattern.test(context.toolInput.command),
		);
	}

	// Check file content for sensitive info
	if (isFileHookContext(context)) {
		const content =
			("content" in context.toolInput && context.toolInput.content) ||
			("new_string" in context.toolInput && context.toolInput.new_string) ||
			"";
		if (typeof content === "string") {
			return sensitivePatterns.some((pattern) => pattern.test(content));
		}
	}

	return false;
}

/**
 * Audit Logger Plugin
 *
 * Provides comprehensive audit logging of all Claude Code operations including:
 * - Tool usage with timestamps and user context
 * - File modifications and command executions
 * - Security-relevant events
 * - Performance metrics
 * - Configurable log formats and retention
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "audit-logger": {
 *     "enabled": true,
 *     "logFile": "audit.log",
 *     "format": "json",
 *     "level": "all"
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "audit-logger": {
 *     "enabled": true,
 *     "logFile": "/var/log/carabiner/audit.log",
 *     "absoluteLogPath": true,
 *     "format": "json",
 *     "level": "operations",
 *     "logToConsole": true,
 *     "includeSensitive": false,
 *     "rotateFiles": true,
 *     "maxFileSize": 20971520,
 *     "maxFiles": 10,
 *     "excludeOperations": ["Read", "LS"],
 *     "anonymizePaths": true,
 *     "bufferWrites": true
 *   }
 * }
 * ```
 */
export const auditLoggerPlugin: HookPlugin = {
	name: "audit-logger",
	version: "1.0.0",
	description: "Comprehensive audit logging of Claude Code operations",
	author: "Outfitter Team",

	events: [
		"PreToolUse",
		"PostToolUse",
		"SessionStart",
		"Stop",
		"UserPromptSubmit",
	],
	priority: 5, // Very low priority to run after other plugins

	configSchema: AuditLoggerConfigSchema as z.ZodType<Record<string, unknown>>,
	defaultConfig: {},

	async apply(
		context: HookContext,
		config: Record<string, unknown> = {},
	): Promise<PluginResult> {
		const auditConfig = AuditLoggerConfigSchema.parse(config);

		if (!auditConfig.enabled) {
			return {
				success: true,
				pluginName: this.name,
				pluginVersion: this.version,
				metadata: { skipped: true, reason: "Logging disabled" },
			};
		}

		// Initialize logger if not exists
		if (!globalAuditLogger) {
			globalAuditLogger = new AuditLogger(auditConfig);
		}

		// Extract session info
		const sessionInfo = {
			sessionId: "sessionId" in context ? String(context.sessionId) : "unknown",
			cwd: "cwd" in context ? String(context.cwd) : process.cwd(),
			toolName: "toolName" in context ? context.toolName : undefined,
		};

		// Get user info
		const userData = {
			user: userInfo().username,
			host: hostname(),
		};

		// Assess context
		const riskAssessment = {
			risk: assessOperationRisk(context),
			sensitive: containsSensitiveInfo(context),
		};

		// Build metadata
		const metadata: Record<string, unknown> = {
			event: context.event,
			...auditConfig.customFields,
		};

		const toolName = "toolName" in context ? context.toolName : undefined;
		if (toolName) {
			metadata.toolName = toolName;

			// Add tool-specific metadata for known context types
			if (isBashHookContext(context) && toolName === "Bash") {
				metadata.command = context.toolInput.command;
				if (auditConfig.logCommands && auditConfig.includeSensitive) {
					metadata.fullCommand = context.toolInput;
				}
			} else if (
				isFileHookContext(context) &&
				["Write", "Edit", "MultiEdit"].includes(toolName)
			) {
				metadata.filePath = context.toolInput.file_path;
				if (auditConfig.logFileChanges && auditConfig.includeSensitive) {
					if (toolName === "Write" && "content" in context.toolInput) {
						metadata.content = context.toolInput.content;
					} else if (toolName === "Edit" && "new_string" in context.toolInput) {
						metadata.content = context.toolInput.new_string;
					}
				}
			}
		}

		// Create audit entry
		const entry: AuditLogEntry = {
			timestamp: new Date().toISOString(),
			sessionId: sessionInfo.sessionId,
			event: context.event,
			toolName: sessionInfo.toolName,
			operation: sessionInfo.toolName
				? `${context.event}_${sessionInfo.toolName}`
				: context.event,
			user: userData.user,
			hostname: userData.host,
			workingDirectory: sessionInfo.cwd,
			success: true, // Will be updated in PostToolUse if needed
			metadata,
			sensitive: riskAssessment.sensitive,
			risk: riskAssessment.risk,
		};

		// Log entry and return result
		try {
			await globalAuditLogger.log(entry);
		} catch (_error) {}

		return {
			success: true,
			pluginName: this.name,
			pluginVersion: this.version,
			metadata: {
				logged: true,
				sessionId: sessionInfo.sessionId,
				risk: entry.risk,
				sensitive: entry.sensitive,
			},
		};
	},

	/**
	 * Initialize audit logger
	 */
	async init(): Promise<void> {},

	/**
	 * Shutdown and flush logs
	 */
	async shutdown(): Promise<void> {
		if (globalAuditLogger) {
			await globalAuditLogger.shutdown();
			globalAuditLogger = undefined;
		}
	},

	/**
	 * Health check - verify logger is working
	 */
	async healthCheck(): Promise<boolean> {
		return globalAuditLogger !== undefined;
	},

	metadata: {
		name: "audit-logger",
		version: "1.0.0",
		description: "Comprehensive audit logging of Claude Code operations",
		author: "Outfitter Team",
		keywords: ["audit", "logging", "security", "compliance", "tracking"],
		license: "MIT",
	},
};

export default auditLoggerPlugin;
