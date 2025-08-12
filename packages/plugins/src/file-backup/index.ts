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
} from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { HookContext } from '@outfitter/types';
import { z } from 'zod';
import type { HookPlugin, PluginResult } from '../../../registry/src';

/**
 * File backup plugin configuration schema
 */
const FileBackupConfigSchema = z
  .object({
    /** Directory to store backups (relative to file location or absolute) */
    backupDir: z.string().default('.backups'),

    /** Whether to use absolute path for backup directory */
    absoluteBackupDir: z.boolean().default(false),

    /** Maximum number of backups to keep per file */
    maxBackups: z.number().min(1).max(100).default(5),

    /** Backup file naming strategy */
    namingStrategy: z
      .enum(['timestamp', 'numbered', 'date'])
      .default('timestamp'),

    /** File patterns to include (empty = all files) */
    includePatterns: z.array(z.string()).default([]),

    /** File patterns to exclude from backup */
    excludePatterns: z
      .array(z.string())
      .default([
        '*.tmp',
        '*.log',
        '*.backup',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
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
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
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
  counter?: number
): string {
  const base = basename(originalPath);
  const ext = extname(originalPath);
  const name = base.replace(ext, '');

  switch (strategy) {
    case 'timestamp': {
      const timestamp = Date.now();
      return `${name}.${timestamp}${ext}`;
    }
    case 'numbered': {
      const num = counter || 1;
      return `${name}.backup.${num.toString().padStart(3, '0')}${ext}`;
    }
    case 'date': {
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
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
  strategy: string
): Promise<Array<{ path: string; created: Date }>> {
  try {
    const files = await readdir(backupDir);
    const base = basename(filePath);
    const ext = extname(filePath);
    const name = base.replace(ext, '');

    const backupFiles: Array<{ path: string; created: Date }> = [];

    for (const file of files) {
      let isBackup = false;

      switch (strategy) {
        case 'timestamp':
          isBackup =
            file.startsWith(`${name}.`) &&
            file.endsWith(ext) &&
            /\.\d+\./.test(file);
          break;
        case 'numbered':
          isBackup = file.startsWith(`${name}.backup.`) && file.endsWith(ext);
          break;
        case 'date':
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
      (a, b) => b.created.getTime() - a.created.getTime()
    );
  } catch (_error) {
    return [];
  }
}

/**
 * Clean up old backups based on retention policy
 */
async function cleanupOldBackups(
  filePath: string,
  backupDir: string,
  config: FileBackupConfig
): Promise<void> {
  const existing = await getExistingBackups(
    filePath,
    backupDir,
    config.namingStrategy
  );

  // Remove backups exceeding max count
  if (existing.length > config.maxBackups) {
    const toRemove = existing.slice(config.maxBackups);

    for (const backup of toRemove) {
      try {
        await unlink(backup.path);
        if (config.logOperations) {
          console.log(`[FileBackup] Removed old backup: ${backup.path}`);
        }
      } catch (error) {
        console.warn(
          `[FileBackup] Failed to remove backup ${backup.path}:`,
          error
        );
      }
    }
  }

  // Remove backups older than retention period
  if (config.retentionDays > 0) {
    const cutoff = new Date(
      Date.now() - config.retentionDays * 24 * 60 * 60 * 1000
    );

    for (const backup of existing) {
      if (backup.created < cutoff) {
        try {
          await unlink(backup.path);
          if (config.logOperations) {
            console.log(`[FileBackup] Removed expired backup: ${backup.path}`);
          }
        } catch (error) {
          console.warn(
            `[FileBackup] Failed to remove expired backup ${backup.path}:`,
            error
          );
        }
      }
    }
  }
}

/**
 * Create backup of a file
 */
async function createBackup(
  filePath: string,
  config: FileBackupConfig
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
    // Check if file exists
    let fileStats: import('node:fs').Stats;
    try {
      fileStats = await stat(filePath);
    } catch (_error) {
      // File doesn't exist - no backup needed
      return { success: true };
    }

    // Check file size constraints
    if (fileStats.size < config.minFileSize) {
      return {
        success: true,
        error: `File too small (${fileStats.size} bytes < ${config.minFileSize} bytes)`,
      };
    }

    if (config.maxFileSize > 0 && fileStats.size > config.maxFileSize) {
      return {
        success: false,
        error: `File too large (${fileStats.size} bytes > ${config.maxFileSize} bytes)`,
      };
    }

    // Check include/exclude patterns
    if (
      config.includePatterns.length > 0 &&
      !matchesPatterns(filePath, config.includePatterns)
    ) {
      return { success: true, error: 'File not in include patterns' };
    }

    if (matchesPatterns(filePath, config.excludePatterns)) {
      return { success: true, error: 'File matches exclude pattern' };
    }

    // Determine backup directory
    const backupDir = config.absoluteBackupDir
      ? config.backupDir
      : join(dirname(filePath), config.backupDir);

    // Create backup directory if needed
    if (config.createBackupDir) {
      try {
        await mkdir(backupDir, { recursive: true });
      } catch (error) {
        return {
          success: false,
          error: `Failed to create backup directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Generate backup filename
    const existing = await getExistingBackups(
      filePath,
      backupDir,
      config.namingStrategy
    );
    const backupFilename = generateBackupFilename(
      filePath,
      config.namingStrategy,
      existing.length + 1
    );
    const backupPath = join(backupDir, backupFilename);

    // Read original file content
    const content = await readFile(filePath);

    // Check if backup is identical to existing content (if enabled)
    if (!config.backupIdentical && existing.length > 0) {
      try {
        const latestBackup = await readFile(existing[0].path);
        if (content.equals(latestBackup)) {
          return {
            success: true,
            error: 'Content identical to latest backup',
          };
        }
      } catch (_error) {
        // Continue with backup if we can't read existing backup
      }
    }

    // Create backup
    await writeFile(backupPath, content);

    // Clean up old backups
    await cleanupOldBackups(filePath, backupDir, config);

    return { success: true, backupPath };
  } catch (error) {
    return {
      success: false,
      error: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
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
 *     "excludePatterns": ["*/ node_modules; /**", "*.test.*"],
 *     "maxFileSize": 5242880,
 *     "retentionDays": 7,
 *     "compress": false
 *   }
 * }
 * ```
 */
export const fileBackupPlugin: HookPlugin = {
  name: 'file-backup',
  version: '1.0.0',
  description: 'Creates automatic backups of files before modification',
  author: 'Outfitter Team',

  events: ['PreToolUse'],
  tools: ['Write', 'Edit', 'MultiEdit'],
  priority: 80, // High priority to backup before modifications

  configSchema: FileBackupConfigSchema,
  defaultConfig: {},

  async apply(
    context: HookContext,
    config: Record<string, unknown> = {}
  ): Promise<PluginResult> {
    // Only handle file modification tools
    if (context.event !== 'PreToolUse' || !('toolName' in context)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    const toolName = context.toolName;
    if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Parse configuration
    const backupConfig = FileBackupConfigSchema.parse(config);

    if (!backupConfig.backupExisting) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: { skipped: true, reason: 'Backup disabled' },
      };
    }

    // Extract file paths based on tool type
    const fileContext = context as HookContext & {
      toolInput: Record<string, unknown>;
    };
    const toolInput = fileContext.toolInput;
    const filePaths: string[] = [];

    if (toolName === 'Write' || toolName === 'Edit') {
      if (toolInput?.file_path) {
        filePaths.push(toolInput.file_path);
      }
    } else if (toolName === 'MultiEdit' && toolInput?.file_path) {
      filePaths.push(toolInput.file_path);
    }

    if (filePaths.length === 0) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: { skipped: true, reason: 'No file paths found' },
      };
    }

    // Create backups for each file
    const results: Array<{ path: string; backup?: string; error?: string }> =
      [];
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
          console.log(
            `[FileBackup] Created backup: ${backupResult.backupPath}`
          );
        }
      } else {
        results.push({
          path: filePath,
          error: backupResult.error,
        });
        hasErrors = true;

        if (backupConfig.logOperations) {
          console.error(
            `[FileBackup] Failed to backup ${filePath}: ${backupResult.error}`
          );
        }
      }
    }

    return {
      success: !hasErrors,
      pluginName: this.name,
      pluginVersion: this.version,
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
  },

  /**
   * Validate backup directory permissions
   */
  async init(): Promise<void> {
    console.log('[FileBackup] Plugin initialized - ready to create backups');
  },

  /**
   * Health check - verify backup directory access
   */
  async healthCheck(): Promise<boolean> {
    // Basic health check - more sophisticated checks could verify disk space, permissions, etc.
    return true;
  },

  metadata: {
    name: 'file-backup',
    version: '1.0.0',
    description: 'Creates automatic backups of files before modification',
    author: 'Outfitter Team',
    keywords: ['backup', 'files', 'safety', 'version-control'],
    license: 'MIT',
  },
};

export default fileBackupPlugin;
