/**
 * @outfitter/plugins - Example plugin collection for Claude Code hooks
 *
 * This package provides a collection of production-ready plugins demonstrating
 * the plugin architecture patterns and best practices. These plugins can be used
 * directly or serve as templates for creating custom plugins.
 *
 * Included Plugins:
 * - git-safety: Prevents dangerous git operations
 * - file-backup: Creates backups before file modifications
 * - security-scanner: Scans for security vulnerabilities
 * - performance-monitor: Tracks execution time and resource usage
 * - audit-logger: Comprehensive operation logging
 *
 * @example Using Individual Plugins
 * ```typescript
 * import { gitSafetyPlugin, fileBackupPlugin } from '@outfitter/plugins';
 * import { PluginRegistry } from '@outfitter/registry';
 *
 * const registry = new PluginRegistry();
 * registry.register(gitSafetyPlugin);
 * registry.register(fileBackupPlugin);
 * ```
 *
 * @example Using Plugin Collection
 * ```typescript
 * import { createPluginCollection } from '@outfitter/plugins';
 * import { PluginRegistry } from '@outfitter/registry';
 *
 * const plugins = createPluginCollection({
 *   gitSafety: true,
 *   fileBackup: true,
 *   securityScanner: { minSeverity: 'high' },
 *   performanceMonitor: false,
 *   auditLogger: { logFile: 'custom-audit.log' }
 * });
 *
 * const registry = new PluginRegistry();
 * plugins.forEach(plugin => registry.register(plugin));
 * ```
 *
 * @example Configuration File
 * ```typescript
 * // hooks.config.ts
 * export default {
 *   plugins: [
 *     { name: 'git-safety', enabled: true, priority: 90 },
 *     { name: 'file-backup', enabled: true, priority: 80 },
 *     { name: 'security-scanner', enabled: true, priority: 85 },
 *     { name: 'performance-monitor', enabled: true, priority: 10 },
 *     { name: 'audit-logger', enabled: true, priority: 5 }
 *   ],
 *   rules: {
 *     'git-safety': {
 *       blockPatterns: ['push.*--force', 'reset.*--hard'],
 *       allowList: ['git status', 'git diff']
 *     },
 *     'file-backup': {
 *       backupDir: '.backups',
 *       maxBackups: 5,
 *       namingStrategy: 'timestamp'
 *     },
 *     'security-scanner': {
 *       minSeverity: 'medium',
 *       blockOnCritical: true
 *     },
 *     'performance-monitor': {
 *       slowOperationThreshold: 5000,
 *       logAlerts: true
 *     },
 *     'audit-logger': {
 *       format: 'json',
 *       level: 'all',
 *       logFile: 'claude-audit.log'
 *     }
 *   }
 * };
 * ```
 */

export { default as auditLoggerPlugin } from './audit-logger/index';
export { default as fileBackupPlugin } from './file-backup/index';
// Individual plugin exports
export { default as gitSafetyPlugin } from './git-safety/index';
export { default as performanceMonitorPlugin } from './performance-monitor/index';
export { default as securityScannerPlugin } from './security-scanner/index';

// Plugin collection configuration interface
export interface PluginCollectionConfig {
  gitSafety?: boolean | Record<string, unknown>;
  fileBackup?: boolean | Record<string, unknown>;
  securityScanner?: boolean | Record<string, unknown>;
  performanceMonitor?: boolean | Record<string, unknown>;
  auditLogger?: boolean | Record<string, unknown>;
}

/**
 * Create a collection of plugins with optional configuration
 *
 * @param config Configuration for each plugin (true = enabled with defaults, false = disabled, object = custom config)
 * @returns Array of configured plugins
 */
export function createPluginCollection(config: PluginCollectionConfig = {}) {
  const plugins: Array<{ plugin: unknown; config?: Record<string, unknown> }> =
    [];

  // TODO: Implement actual plugin instances
  // The plugins referenced below are placeholders and need to be implemented

  if (config.gitSafety !== false) {
    const gitSafetyConfig =
      typeof config.gitSafety === 'object' ? config.gitSafety : {};
    plugins.push({
      plugin: {
        name: 'git-safety',
        version: '1.0.0',
        description: 'Git safety plugin placeholder',
      },
      config: gitSafetyConfig,
    });
  }

  if (config.fileBackup !== false) {
    const fileBackupConfig =
      typeof config.fileBackup === 'object' ? config.fileBackup : {};
    plugins.push({
      plugin: {
        name: 'file-backup',
        version: '1.0.0',
        description: 'File backup plugin placeholder',
      },
      config: fileBackupConfig,
    });
  }

  if (config.securityScanner !== false) {
    const securityScannerConfig =
      typeof config.securityScanner === 'object' ? config.securityScanner : {};
    plugins.push({
      plugin: {
        name: 'security-scanner',
        version: '1.0.0',
        description: 'Security scanner plugin placeholder',
      },
      config: securityScannerConfig,
    });
  }

  if (config.performanceMonitor !== false) {
    const performanceMonitorConfig =
      typeof config.performanceMonitor === 'object'
        ? config.performanceMonitor
        : {};
    plugins.push({
      plugin: {
        name: 'performance-monitor',
        version: '1.0.0',
        description: 'Performance monitor plugin placeholder',
      },
      config: performanceMonitorConfig,
    });
  }

  if (config.auditLogger !== false) {
    const auditLoggerConfig =
      typeof config.auditLogger === 'object' ? config.auditLogger : {};
    plugins.push({
      plugin: {
        name: 'audit-logger',
        version: '1.0.0',
        description: 'Audit logger plugin placeholder',
      },
      config: auditLoggerConfig,
    });
  }

  return plugins;
}

/**
 * Get all available plugins as an array
 */
export function getAllPlugins() {
  // TODO: Replace with actual plugin implementations
  return [
    {
      name: 'git-safety',
      version: '1.0.0',
      description: 'Git safety plugin placeholder',
    },
    {
      name: 'file-backup',
      version: '1.0.0',
      description: 'File backup plugin placeholder',
    },
    {
      name: 'security-scanner',
      version: '1.0.0',
      description: 'Security scanner plugin placeholder',
    },
    {
      name: 'performance-monitor',
      version: '1.0.0',
      description: 'Performance monitor plugin placeholder',
    },
    {
      name: 'audit-logger',
      version: '1.0.0',
      description: 'Audit logger plugin placeholder',
    },
  ];
}

/**
 * Get plugin by name
 */
export function getPluginByName(name: string) {
  // TODO: Replace with actual plugin implementations
  const plugins = {
    'git-safety': {
      name: 'git-safety',
      version: '1.0.0',
      description: 'Git safety plugin placeholder',
    },
    'file-backup': {
      name: 'file-backup',
      version: '1.0.0',
      description: 'File backup plugin placeholder',
    },
    'security-scanner': {
      name: 'security-scanner',
      version: '1.0.0',
      description: 'Security scanner plugin placeholder',
    },
    'performance-monitor': {
      name: 'performance-monitor',
      version: '1.0.0',
      description: 'Performance monitor plugin placeholder',
    },
    'audit-logger': {
      name: 'audit-logger',
      version: '1.0.0',
      description: 'Audit logger plugin placeholder',
    },
  };

  return plugins[name as keyof typeof plugins];
}

/**
 * Create a default plugin configuration suitable for most use cases
 */
export function createDefaultConfiguration(): PluginCollectionConfig {
  return {
    gitSafety: {
      blockPatterns: [
        'push.*--force',
        'push.*-f(?:\\s|$)',
        'reset.*--hard',
        'clean.*-f.*-d',
      ],
      allowList: [
        'git status',
        'git log',
        'git diff',
        'git branch',
        'git show',
      ],
      logBlocked: true,
    },
    fileBackup: {
      backupDir: '.backups',
      maxBackups: 5,
      namingStrategy: 'timestamp',
      excludePatterns: ['*.tmp', '*.log', '**/node_modules/**', '**/.git/**'],
    },
    securityScanner: {
      scanCommands: true,
      scanFiles: true,
      minSeverity: 'medium',
      blockOnCritical: true,
      logFindings: true,
    },
    performanceMonitor: {
      trackExecutionTime: true,
      trackMemoryUsage: true,
      slowOperationThreshold: 5000,
      logAlerts: true,
      logStats: false,
    },
    auditLogger: {
      enabled: true,
      format: 'json',
      level: 'all',
      logFile: 'claude-audit.log',
      logToConsole: false,
      includeSensitive: false,
    },
  };
}

/**
 * Create a security-focused plugin configuration
 */
export function createSecurityConfiguration(): PluginCollectionConfig {
  return {
    gitSafety: {
      blockPatterns: [
        'push.*--force',
        'push.*-f(?:\\s|$)',
        'reset.*--hard',
        'clean.*-f.*-d',
        'branch.*-D',
        'tag.*-d',
      ],
      allowWithConfirmation: false,
      logBlocked: true,
    },
    fileBackup: {
      backupDir: '.security-backups',
      maxBackups: 10,
      namingStrategy: 'timestamp',
      backupIdentical: false,
    },
    securityScanner: {
      scanCommands: true,
      scanFiles: true,
      minSeverity: 'low',
      blockOnCritical: true,
      blockOnHigh: true,
      logFindings: true,
      customRules: [
        {
          id: 'sudo-usage',
          name: 'Sudo Command',
          pattern: '\\bsudo\\b',
          severity: 'high' as const,
          category: 'privilege-escalation',
          description: 'Sudo command detected - requires elevated privileges',
        },
      ],
    },
    performanceMonitor: {
      trackExecutionTime: true,
      trackMemoryUsage: true,
      slowOperationThreshold: 3000,
      logAlerts: true,
      enableProfiling: true,
    },
    auditLogger: {
      enabled: true,
      format: 'json',
      level: 'all',
      logFile: 'security-audit.log',
      logToConsole: true,
      includeSensitive: false,
      anonymizePaths: true,
      rotateFiles: true,
    },
  };
}

/**
 * Create a development-friendly plugin configuration
 */
export function createDevelopmentConfiguration(): PluginCollectionConfig {
  return {
    gitSafety: {
      blockPatterns: ['reset.*--hard'],
      allowWithConfirmation: true,
      logBlocked: false,
    },
    fileBackup: {
      backupDir: '.dev-backups',
      maxBackups: 3,
      namingStrategy: 'numbered',
      maxFileSize: 1024 * 1024, // 1MB
    },
    securityScanner: {
      scanFiles: true,
      minSeverity: 'high',
      blockOnCritical: false,
      logFindings: false,
    },
    performanceMonitor: {
      trackExecutionTime: true,
      trackMemoryUsage: false,
      slowOperationThreshold: 10_000,
      logAlerts: false,
      logStats: true,
      statsInterval: 60_000,
    },
    auditLogger: {
      enabled: true,
      format: 'text',
      level: 'operations',
      logFile: 'dev-audit.log',
      logToConsole: true,
      bufferWrites: false,
    },
  };
}

/**
 * Package version
 */
export const VERSION = '1.0.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@outfitter/plugins',
  version: VERSION,
  description: 'Example plugin collection for Claude Code hooks',
  repository: 'https://github.com/outfitter-dev/carabiner',
} as const;
