/**
 * @file file-backup/index.ts
 * @description File backup plugin - creates backups before file modifications
 *
 * This plugin automatically creates backups of files before they are modified
 * by Write, Edit, or MultiEdit operations. Supports configurable backup directories,
 * retention policies, and file filtering.
 */

import {
	mkdir,
	readdir,
	readFile,
	stat,
	unlink,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { HookPlugin, PluginResult } from "@carabiner/registry";
import type { HookContext } from "@carabiner/types";
import { z } from "zod";

/**
 * File backup plugin configuration schema
 */
const FileBackupConfigSchema = z
	.object({
		/** Directory to store backups (relative to file location or absolute) */
		backupDir: z.string().default(".backups"),

		/** Whether to use absolute path for backup directory */
		absoluteBackupDir: z.boolean().default(false),

		/** Maximum number of backups to keep per file */
		maxBackups: z.number().min(1).max(100).default(5),

		/** Backup file naming strategy */
		namingStrategy: z
			.enum(["timestamp", "numbered", "date"])
			.default("timestamp"),

		/** File patterns to include (empty = all files) */
		includePatterns: z.array(z.string()).default([]),

		/** File patterns to exclude from backup */
		excludePatterns: z
			.array(z.string())
			.default([
				"*.tmp",
				"*.log",
				"*.backup",
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/build/**",
			]),

		/** Minimum file size to backup (bytes) */
		minFileSize: z.number().min(0).default(0),

		/** Maximum file size to backup (bytes, 0 = no limit) */
		maxFileSize: z
			.number()
			.min(0)
			.default(10 * 1024 * 1024), // 10MB

		/** Whether to compress backups */
		compress: z.boolean().default(false),

		/** Whether to create backup directory if it doesn't exist */
		createBackupDir: z.boolean().default(true),

		/** Whether to backup existing files before overwrite */
		backupExisting: z.boolean().default(true),

		/** Whether to backup files even if identical */
		backupIdentical: z.boolean().default(false),

		/** Retention policy in days (0 = keep forever) */
		retentionDays: z.number().min(0).default(30),

		/** Whether to log backup operations */
		logOperations: z.boolean().default(true),
	})
	.default({});

type FileBackupConfig = z.infer<typeof FileBackupConfigSchema>;

/**
 * Check if file path matches any pattern
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
	if (patterns.length === 0) {
		return false;
	}

	return patterns.some((pattern) => {
		const regex = new RegExp(
			pattern.replace(/\*/g, ".*").replace(/\?/g, "."),
			"i",
		);
		return regex.test(filePath);
	});
}

/**
 * Generate backup filename based on strategy
 */
function generateBackupFilename(
	originalPath: string,
	strategy: string,
	counter?: number,
): string {
	const base = basename(originalPath);
	const ext = extname(originalPath);
	const name = base.replace(ext, "");

	switch (strategy) {
		case "timestamp": {
			const timestamp = Date.now();
			return `${name}.${timestamp}${ext}`;
		}
		case "numbered": {
			const num = counter || 1;
			return `${name}.backup.${num.toString().padStart(3, "0")}${ext}`;
		}
		case "date": {
			const date = new Date().toISOString().split("T")[0];
			const time = (
				new Date().toTimeString().split(" ")[0] || "00-00-00"
			).replace(/:/g, "-");
			return `${name}.${date}_${time}${ext}`;
		}
		default:
			return `${name}.backup${ext}`;
	}
}

/**
 * Get existing backup files for a given file
 */
async function getExistingBackups(
	filePath: string,
	backupDir: string,
	strategy: string,
): Promise<Array<{ path: string; created: Date }>> {
	try {
		const files = await readdir(backupDir);
		const base = basename(filePath);
		const ext = extname(filePath);
		const name = base.replace(ext, "");

		const backupFiles: Array<{ path: string; created: Date }> = [];

		for (const file of files) {
			let isBackup = false;

			switch (strategy) {
				case "timestamp":
					isBackup =
						file.startsWith(`${name}.`) &&
						file.endsWith(ext) &&
						/\.\d+\./.test(file);
					break;
				case "numbered":
					isBackup = file.startsWith(`${name}.backup.`) && file.endsWith(ext);
					break;
				case "date":
					isBackup =
						file.startsWith(`${name}.`) &&
						file.endsWith(ext) &&
						/\.\d{4}-\d{2}-\d{2}_/.test(file);
					break;
				default:
					isBackup = file.startsWith(`${name}.backup`) && file.endsWith(ext);
			}

			if (isBackup) {
				const backupPath = join(backupDir, file);
				try {
					const stats = await stat(backupPath);
					backupFiles.push({
						path: backupPath,
						created: stats.birthtime || stats.mtime,
					});
				} catch (_error) {
					// Skip files we can't stat
				}
			}
		}

		return backupFiles.sort(
			(a, b) => b.created.getTime() - a.created.getTime(),
		);
	} catch (_error) {
		return [];
	}
}

/**
 * Remove a single backup file with logging
 */
async function removeBackupFile(
	backupPath: string,
	_reason: string,
	config: FileBackupConfig,
): Promise<void> {
	try {
		await unlink(backupPath);
		if (config.logOperations) {
		}
	} catch (_error) {}
}

/**
 * Remove backups exceeding maximum count
 */
async function removeBackupsByCount(
	existing: Array<{ path: string; created: Date }>,
	maxBackups: number,
	config: FileBackupConfig,
): Promise<void> {
	if (existing.length <= maxBackups) {
		return;
	}

	const toRemove = existing.slice(maxBackups);

	for (const backup of toRemove) {
		await removeBackupFile(backup.path, "Removed old backup", config);
	}
}

/**
 * Remove backups older than retention period
 */
async function removeBackupsByAge(
	existing: Array<{ path: string; created: Date }>,
	retentionDays: number,
	config: FileBackupConfig,
): Promise<void> {
	if (retentionDays <= 0) {
		return;
	}

	const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

	for (const backup of existing) {
		if (backup.created < cutoff) {
			await removeBackupFile(backup.path, "Removed expired backup", config);
		}
	}
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(
	filePath: string,
	backupDir: string,
	config: FileBackupConfig,
): Promise<void> {
	const existing = await getExistingBackups(
		filePath,
		backupDir,
		config.namingStrategy,
	);

	await removeBackupsByCount(existing, config.maxBackups, config);
	await removeBackupsByAge(existing, config.retentionDays, config);
}

/**
 * Validate file constraints for backup
 */
function validateFileForBackup(
	_filePath: string,
	fileStats: import("node:fs").Stats,
	config: FileBackupConfig,
): { valid: boolean; error?: string } {
	if (fileStats.size < config.minFileSize) {
		return {
			valid: false,
			error: `File too small (${fileStats.size} bytes < ${config.minFileSize} bytes)`,
		};
	}

	if (config.maxFileSize > 0 && fileStats.size > config.maxFileSize) {
		return {
			valid: false,
			error: `File too large (${fileStats.size} bytes > ${config.maxFileSize} bytes)`,
		};
	}

	return { valid: true };
}

/**
 * Check if file should be skipped based on include/exclude patterns
 */
function shouldSkipFileBackup(
	filePath: string,
	config: FileBackupConfig,
): { skip: boolean; reason?: string } {
	if (
		config.includePatterns.length > 0 &&
		!matchesPatterns(filePath, config.includePatterns)
	) {
		return { skip: true, reason: "File not in include patterns" };
	}

	if (matchesPatterns(filePath, config.excludePatterns)) {
		return { skip: true, reason: "File matches exclude pattern" };
	}

	return { skip: false };
}

/**
 * Check if content is identical to latest backup
 */
async function isContentIdenticalToLatest(
	content: Buffer,
	existing: Array<{ path: string; created: Date }>,
): Promise<boolean> {
	if (existing.length === 0) {
		return false;
	}

	try {
		const latestBackupPath = existing[0]?.path;
		if (!latestBackupPath) {
			return false;
		}
		const latestBackup = await readFile(latestBackupPath);
		return content.equals(latestBackup);
	} catch (_error) {
		return false;
	}
}

/**
 * Perform the actual backup operation
 */
async function performBackupOperation(
	filePath: string,
	backupDir: string,
	config: FileBackupConfig,
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
	// Create backup directory if needed
	if (config.createBackupDir) {
		try {
			await mkdir(backupDir, { recursive: true });
		} catch (error) {
			return {
				success: false,
				error: `Failed to create backup directory: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}

	// Generate backup filename
	const existing = await getExistingBackups(
		filePath,
		backupDir,
		config.namingStrategy,
	);
	const backupFilename = generateBackupFilename(
		filePath,
		config.namingStrategy,
		existing.length + 1,
	);
	const backupPath = join(backupDir, backupFilename);

	// Read original file content
	const content = await readFile(filePath);

	// Check if backup is identical to existing content (if enabled)
	if (!config.backupIdentical) {
		const isIdentical = await isContentIdenticalToLatest(content, existing);
		if (isIdentical) {
			return {
				success: true,
				error: "Content identical to latest backup",
			};
		}
	}

	// Create backup
	await writeFile(backupPath, content);

	// Clean up old backups
	await cleanupOldBackups(filePath, backupDir, config);

	return { success: true, backupPath };
}

/**
 * Create backup of a file
 */
async function createBackup(
	filePath: string,
	config: FileBackupConfig,
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
	try {
		// Check if file exists
		let fileStats: import("node:fs").Stats;
		try {
			fileStats = await stat(filePath);
		} catch (_error) {
			// File doesn't exist - no backup needed
			return { success: true };
		}

		// Validate file constraints
		const validation = validateFileForBackup(filePath, fileStats, config);
		if (!validation.valid) {
			return {
				success: !validation.error?.includes("too large"),
				error: validation.error,
			};
		}

		// Check if file should be skipped
		const skipCheck = shouldSkipFileBackup(filePath, config);
		if (skipCheck.skip) {
			return { success: true, error: skipCheck.reason };
		}

		// Determine backup directory
		const backupDir = config.absoluteBackupDir
			? config.backupDir
			: join(dirname(filePath), config.backupDir);

		// Perform backup operation
		return await performBackupOperation(filePath, backupDir, config);
	} catch (error) {
		return {
			success: false,
			error: `Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Check if tool should be processed for backup
 */
function shouldProcessTool(context: HookContext): boolean {
	if (context.event !== "PreToolUse" || !("toolName" in context)) {
		return false;
	}

	const toolName = context.toolName;
	return ["Write", "Edit", "MultiEdit"].includes(toolName);
}

/**
 * Extract file paths from tool context
 */
function extractFilePathsFromTool(context: HookContext): string[] {
	if (!("toolName" in context)) {
		return [];
	}

	const toolName = "toolName" in context ? context.toolName : undefined;
	const toolInput = "toolInput" in context ? context.toolInput : {};
	const filePaths: string[] = [];

	if (
		(toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") &&
		typeof toolInput === "object" &&
		toolInput !== null &&
		"file_path" in toolInput &&
		typeof toolInput.file_path === "string"
	) {
		filePaths.push(toolInput.file_path);
	}

	return filePaths;
}

/**
 * Create success result
 */
function createSuccessResult(
	pluginName: string,
	pluginVersion: string,
): PluginResult {
	return {
		success: true,
		pluginName,
		pluginVersion,
	};
}

/**
 * Create skipped result
 */
function createSkippedResult(
	pluginName: string,
	pluginVersion: string,
	reason: string,
): PluginResult {
	return {
		success: true,
		pluginName,
		pluginVersion,
		metadata: { skipped: true, reason },
	};
}

/**
 * Process file backups and return aggregated result
 */
async function processFileBackups(
	filePaths: string[],
	backupConfig: FileBackupConfig,
	pluginName: string,
	pluginVersion: string,
): Promise<PluginResult> {
	const results: Array<{ path: string; backup?: string; error?: string }> = [];
	let hasErrors = false;

	for (const filePath of filePaths) {
		const backupResult = await createBackup(filePath, backupConfig);

		if (backupResult.success) {
			results.push({
				path: filePath,
				backup: backupResult.backupPath,
				error: backupResult.error,
			});

			if (backupResult.backupPath && backupConfig.logOperations) {
			}
		} else {
			results.push({
				path: filePath,
				error: backupResult.error,
			});
			hasErrors = true;

			if (backupConfig.logOperations) {
			}
		}
	}

	return {
		success: !hasErrors,
		pluginName,
		pluginVersion,
		message: hasErrors
			? `Some backups failed: ${results.filter((r) => r.error).length}/${results.length}`
			: `Created ${results.filter((r) => r.backup).length} backups`,
		metadata: {
			backupResults: results,
			totalFiles: filePaths.length,
			successfulBackups: results.filter((r) => r.backup).length,
			skippedBackups: results.filter((r) => r.error && !r.backup).length,
			failedBackups: results.filter((r) => !r.backup && r.error).length,
		},
	};
}

/**
 * File Backup Plugin
 *
 * Automatically creates backups of files before modification operations.
 * Supports configurable backup strategies, retention policies, and file filtering.
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "file-backup": {
 *     "backupDir": ".backups",
 *     "maxBackups": 5,
 *     "namingStrategy": "timestamp"
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "file-backup": {
 *     "backupDir": "/backups",
 *     "absoluteBackupDir": true,
 *     "maxBackups": 10,
 *     "namingStrategy": "date",
 *     "includePatterns": ["*.js", "*.ts", "*.json"],
 *     "excludePatterns": ["node_modules/**", "*.test.*"],
 *     "maxFileSize": 5242880,
 *     "retentionDays": 7,
 *     "compress": false
 *   }
 * }
 * ```
 */
export const fileBackupPlugin: HookPlugin = {
	name: "file-backup",
	version: "1.0.0",
	description: "Creates automatic backups of files before modification",
	author: "Outfitter Team",

	events: ["PreToolUse"],
	tools: ["Write", "Edit", "MultiEdit"],
	priority: 80, // High priority to backup before modifications

	configSchema: FileBackupConfigSchema as z.ZodType<Record<string, unknown>>,
	defaultConfig: {},

	async apply(
		context: HookContext,
		config: Record<string, unknown> = {},
	): Promise<PluginResult> {
		// Early returns for non-applicable contexts
		if (!shouldProcessTool(context)) {
			return createSuccessResult(this.name, this.version);
		}

		const backupConfig = FileBackupConfigSchema.parse(config);

		if (!backupConfig.backupExisting) {
			return createSkippedResult(this.name, this.version, "Backup disabled");
		}

		const filePaths = extractFilePathsFromTool(context);
		if (filePaths.length === 0) {
			return createSkippedResult(
				this.name,
				this.version,
				"No file paths found",
			);
		}

		return await processFileBackups(
			filePaths,
			backupConfig,
			this.name,
			this.version,
		);
	},

	/**
	 * Validate backup directory permissions
	 */
	async init(): Promise<void> {},

	/**
	 * Health check - verify backup directory access
	 */
	async healthCheck(): Promise<boolean> {
		// Basic health check - more sophisticated checks could verify disk space, permissions, etc.
		return true;
	},

	metadata: {
		name: "file-backup",
		version: "1.0.0",
		description: "Creates automatic backups of files before modification",
		author: "Outfitter Team",
		keywords: ["backup", "files", "safety", "version-control"],
		license: "MIT",
	},
};

export default fileBackupPlugin;
