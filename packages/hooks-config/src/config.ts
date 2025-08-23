/**
 * Configuration management for Claude Code hooks
 * Handles loading, validation, and management of hook configurations
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
  HookConfiguration,
  HookEvent,
  ToolHookConfig,
  ToolName,
} from '@outfitter/hooks-core';
// Note: Error management lives in a separate package. To avoid build-order
// coupling here, we use a local error type and keep integration optional.

/**
 * @deprecated Use ConfigurationError from @outfitter/error-management instead
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Configuration file formats
 */
export type ConfigFormat = 'json' | 'js' | 'ts';

/**
 * Configuration loading options
 */
export type ConfigOptions = {
  format?: ConfigFormat;
  validate?: boolean;
  createDefault?: boolean;
  mergeDefaults?: boolean;
};

/**
 * Partial tool hook config for environment overrides
 */
export type PartialToolHookConfig = {
  command?: string;
  timeout?: number;
  enabled?: boolean;
  detached?: boolean;
};

/**
 * Environment-specific hook configuration structure
 */
export type EnvironmentHookConfiguration = {
  PreToolUse?: Partial<Record<ToolName, PartialToolHookConfig>>;
  PostToolUse?: Partial<Record<ToolName, PartialToolHookConfig>>;
  UserPromptSubmit?: PartialToolHookConfig;
  SessionStart?: PartialToolHookConfig;
  Stop?: PartialToolHookConfig;
  SubagentStop?: PartialToolHookConfig;
};

/**
 * Extended hook configuration with metadata
 */
export interface ExtendedHookConfiguration extends HookConfiguration {
  $schema?: string;
  version?: string;
  extends?: string[];
  variables?: Record<string, string>;
  templates?: Record<string, ToolHookConfig>;
  environments?: Record<string, EnvironmentHookConfiguration>;
}

/**
 * Carabiner configuration type alias for consistency with documentation
 */
export type CarabinerConfig = ExtendedHookConfiguration;

/**
 * Configuration file paths
 */
export type CarabinerConfig = ExtendedHookConfiguration;

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  json: '.claude/hooks.json',
  js: '.claude/hooks.config.js',
  ts: '.claude/hooks.config.ts',
  settings: '.claude/settings.json',
} as const;

/**
 * Default hook configuration
 */
export const DEFAULT_CONFIG: ExtendedHookConfiguration = {
  $schema: 'https://claude-code-hooks.dev/schema.json',
  version: '1.0.0',

  PreToolUse: {
    Bash: {
      command: 'bun run hooks/pre-tool-use.ts',
      timeout: 5000,
      enabled: true,
    },
    Write: {
      command: 'bun run hooks/pre-tool-use.ts',
      timeout: 3000,
      enabled: true,
    },
    Edit: {
      command: 'bun run hooks/pre-tool-use.ts',
      timeout: 3000,
      enabled: true,
    },
  },

  PostToolUse: {
    Write: {
      command: 'bun run hooks/post-tool-use.ts',
      timeout: 30_000,
      enabled: true,
    },
    Edit: {
      command: 'bun run hooks/post-tool-use.ts',
      timeout: 30_000,
      enabled: true,
    },
    Bash: {
      command: 'bun run hooks/post-tool-use.ts',
      timeout: 10_000,
      enabled: true,
    },
  },

  SessionStart: {
    command: 'bun run hooks/session-start.ts',
    timeout: 10_000,
    enabled: true,
  },

  UserPromptSubmit: {
    command: 'bun run hooks/user-prompt-submit.ts',
    timeout: 5000,
    enabled: false,
  },

  templates: {
    typescript: {
      command: 'bun run {hookPath}',
      timeout: 10_000,
      enabled: true,
    },
    shell: {
      command: 'bash {hookPath}',
      timeout: 5000,
      enabled: true,
    },
  },

  variables: {
    hookPath: 'hooks/{event}.ts',
  },

  environments: {
    development: {
      PreToolUse: {
        Bash: { timeout: 10_000 },
        Write: { timeout: 5000 },
      },
    },
    production: {
      PreToolUse: {
        Bash: { timeout: 3000 },
        Write: { timeout: 2000 },
      },
      PostToolUse: {
        Write: { timeout: 15_000 },
      },
    },
  },
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private readonly config: ExtendedHookConfiguration | null = null;
  private configPath: string | null = null;
  private readonly watchCallbacks: Array<
    (config: ExtendedHookConfiguration) => void
  > = [];

  constructor(private readonly workspacePath: string) {}

  /**
   * Private setter method to assign readonly config property
   */
  private setConfig(config: ExtendedHookConfiguration | null): void {
    // Use Object.defineProperty to set readonly property
    Object.defineProperty(this, 'config', {
      value: config,
      writable: false,
      configurable: true,
    });
  }

  /**
   * Feature toggle: advanced error management integration
   * Controlled by ENABLE_ADVANCED_ERROR_MANAGEMENT env ("true" to enable)
   */
  private get advancedErrorManagementEnabled(): boolean {
    const env = typeof Bun !== 'undefined' ? Bun.env : process.env;
    return (
      (env?.ENABLE_ADVANCED_ERROR_MANAGEMENT || '').toLowerCase() === 'true'
    );
  }

  /**
   * Conditionally execute with error boundary if error-management is enabled
   */
  private async withBoundary<T>(
    op: () => Promise<T>,
    boundaryName: string,
    operationId: string,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (!this.advancedErrorManagementEnabled) {
      return await op();
    }
    try {
      const em = await import('@outfitter/error-management');
      return await em.executeWithBoundary(
        op,
        boundaryName,
        {
          errorThreshold: 3,
          timeWindow: 300_000,
          autoRecover: Boolean(fallback),
          fallbackProvider: fallback,
        },
        operationId
      );
    } catch {
      // If dynamic import fails, execute directly
      return await op();
    }
  }

  /**
   * Get workspace path
   */
  getWorkspacePath(): string {
    return this.workspacePath;
  }

  /**
   * Load configuration from workspace
   */
  async load(options: ConfigOptions = {}): Promise<ExtendedHookConfiguration> {
    return this.withBoundary(
      () => this._loadInternal(options),
      'config-operations',
      'load-config',
      () => this.createDefaultConfig()
    );
  }

  /**
   * Internal load implementation
   */
  private async _loadInternal(
    options: ConfigOptions = {}
  ): Promise<ExtendedHookConfiguration> {
    const {
      format,
      validate = true,
      createDefault = true,
      mergeDefaults = true,
    } = options;

    // Find configuration file
    const configPath = this.findConfigFile(format);

    if (!configPath && createDefault) {
      return this.createDefaultConfig();
    }

    if (!configPath) {
      throw new ConfigError('No configuration file found', 'CONFIG_NOT_FOUND');
    }

    this.configPath = configPath;

    try {
      const config = await this.loadFromFile(configPath);

      if (validate) {
        this.validateConfig(config);
      }

      const processedConfig = mergeDefaults
        ? this.mergeWithDefaults(config)
        : config;

      // Apply environment-specific overrides
      const finalConfig = this.applyEnvironmentOverrides(processedConfig);

      this.setConfig(finalConfig);
      return finalConfig;
    } catch (error) {
      // Optionally report via error-management if available
      if (this.advancedErrorManagementEnabled) {
        try {
          const em = await import('@outfitter/error-management');
          await em.reportError(
            new em.ConfigurationError(
              `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
              em.ErrorCode.CONFIG_PARSE_ERROR
            )
          );
        } catch {
          /* ignore reporting errors */
        }
      }
      throw new ConfigError(
        `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_ERROR'
      );
    }
  }

  /**
   * Save configuration to file
   */
  async save(
    config: ExtendedHookConfiguration,
    format: ConfigFormat = 'json'
  ): Promise<void> {
    return this.withBoundary(
      () => this._saveInternal(config, format),
      'config-operations',
      'save-config'
    );
  }

  /**
   * Internal save implementation
   */
  private async _saveInternal(
    config: ExtendedHookConfiguration,
    format: ConfigFormat = 'json'
  ): Promise<void> {
    const configPath = join(this.workspacePath, CONFIG_PATHS[format]);
    const configDir = dirname(configPath);

    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    try {
      let content: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(config, null, 2);
          break;

        case 'js':
          content = this.generateJSConfig(config);
          break;

        case 'ts':
          content = this.generateTSConfig(config);
          break;

        default:
          throw new ConfigError(
            `Unsupported format: ${format}`,
            'UNSUPPORTED_FORMAT'
          );
      }

      writeFileSync(configPath, content, 'utf-8');
      this.configPath = configPath;
      this.setConfig(config);

      // Notify watchers
      this.notifyWatchers(config);
    } catch (error) {
      if (this.advancedErrorManagementEnabled) {
        try {
          const em = await import('@outfitter/error-management');
          await em.reportError(
            new em.ConfigurationError(
              `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
              em.ErrorCode.CONFIG_WRITE_FAILED
            )
          );
        } catch {
          /* ignore */
        }
      }
      throw new ConfigError(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SAVE_ERROR'
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ExtendedHookConfiguration {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded', 'NOT_LOADED');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  async updateConfig(
    updates: Partial<ExtendedHookConfiguration>
  ): Promise<ExtendedHookConfiguration> {
    const current = this.getConfig();
    const updated = this.deepMerge<ExtendedHookConfiguration>(current, updates);

    if (this.configPath) {
      const format = this.getFormatFromPath(this.configPath);
      await this.save(updated, format);
    }

    return updated;
  }

  /**
   * Get hook configuration for specific event and tool
   */
  getHookConfig(event: HookEvent, tool?: ToolName): ToolHookConfig | undefined {
    const config = this.getConfig();
    const eventConfig = config[event];

    if (!eventConfig) {
      return;
    }

    // For events that support tool-specific configuration
    if (
      tool &&
      typeof eventConfig === 'object' &&
      !('command' in eventConfig)
    ) {
      const toolConfig = (eventConfig as Record<string, ToolHookConfig>)[tool];
      return toolConfig && 'command' in toolConfig ? toolConfig : undefined;
    }

    // For events with single configuration
    if (typeof eventConfig === 'object' && 'command' in eventConfig) {
      return eventConfig as ToolHookConfig;
    }

    return;
  }

  /**
   * Set hook configuration for specific event and tool
   */
  async setHookConfig(
    event: HookEvent,
    toolOrConfig: ToolName | ToolHookConfig,
    config?: ToolHookConfig
  ): Promise<void> {
    const currentConfig = this.getConfig();
    const nextConfig = { ...currentConfig } as ExtendedHookConfiguration;

    if (typeof toolOrConfig === 'string' && config) {
      // Setting tool-specific config - create immutable copy
      const existing = nextConfig[event];
      const eventMap =
        existing && typeof existing === 'object' && !('command' in existing)
          ? { ...existing }
          : {};
      eventMap[toolOrConfig] = { ...config };
      (nextConfig as Record<string, unknown>)[event] = eventMap;
    } else if (typeof toolOrConfig === 'object' && 'command' in toolOrConfig) {
      // Setting event-level config - create immutable copy
      (nextConfig as Record<string, unknown>)[event] = { ...toolOrConfig };
    }

    await this.updateConfig(nextConfig);
  }

  /**
   * Enable/disable hook
   */
  async toggleHook(
    event: HookEvent,
    tool: ToolName | undefined,
    enabled: boolean
  ): Promise<void> {
    const currentConfig = this.getConfig();
    const hookConfig = this.getHookConfig(event, tool);
    if (!hookConfig) {
      return;
    }

    // Create immutable copy of config with enabled toggle
    const nextHookConfig = { ...hookConfig, enabled };

    if (tool) {
      // Tool-specific config update
      const eventMap = {
        ...(currentConfig[event] as Record<string, ToolHookConfig>),
      };
      eventMap[tool] = nextHookConfig;
      await this.updateConfig({
        ...currentConfig,
        [event]: eventMap,
      } as ExtendedHookConfiguration);
    } else {
      // Event-level config update
      await this.updateConfig({
        ...currentConfig,
        [event]: nextHookConfig,
      } as ExtendedHookConfiguration);
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: ExtendedHookConfiguration) => void): () => void {
    this.watchCallbacks.push(callback);

    // Return unwatch function
    return () => {
      const index = this.watchCallbacks.indexOf(callback);
      if (index > -1) {
        this.watchCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Generate Claude settings.json from hook configuration
   */
  generateClaudeSettings(): Record<string, unknown> {
    const config = this.getConfig();
    const settings: Record<string, unknown> = { hooks: {} };
    const hooks = settings.hooks as Record<string, unknown>;

    for (const [event, eventConfig] of Object.entries(config)) {
      if (
        event.startsWith('$') ||
        ['templates', 'variables', 'environments'].includes(event)
      ) {
        continue;
      }

      if (eventConfig && typeof eventConfig === 'object') {
        if ('command' in eventConfig) {
          // Single hook config
          hooks[event] = this.processHookConfig(eventConfig);
        } else {
          // Tool-specific configs
          const eventHooks: Record<string, unknown> = {};
          for (const [tool, toolConfig] of Object.entries(eventConfig)) {
            if (
              toolConfig &&
              typeof toolConfig === 'object' &&
              'command' in toolConfig
            ) {
              eventHooks[tool] = this.processHookConfig(
                toolConfig as ToolHookConfig
              );
            }
          }
          hooks[event] = eventHooks;
        }
      }
    }

    return settings;
  }

  /**
   * Process hook config for Claude settings
   */
  private processHookConfig(config: ToolHookConfig): Record<string, unknown> {
    const processed: Record<string, unknown> = {
      command: this.interpolateVariables(config.command),
    };

    if (config.timeout !== undefined) {
      processed.timeoutMs = config.timeout;
    }

    if (config.detached !== undefined) {
      processed.detached = config.detached;
    }

    return processed;
  }

  /**
   * Interpolate variables in strings
   */
  private interpolateVariables(str: string): string {
    const config = this.getConfig();
    const variables = config.variables || {};

    return str.replace(/\{(\w+)\}/g, (match, varName) => {
      return variables[varName] || match;
    });
  }

  /**
   * Find configuration file in workspace
   */
  private findConfigFile(preferredFormat?: ConfigFormat): string | null {
    const formats: ConfigFormat[] = preferredFormat
      ? [preferredFormat]
      : ['ts', 'js', 'json'];

    for (const format of formats) {
      const path = join(this.workspacePath, CONFIG_PATHS[format]);
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(path: string): Promise<ExtendedHookConfiguration> {
    const format = this.getFormatFromPath(path);

    switch (format) {
      case 'json': {
        const jsonConfig = JSON.parse(readFileSync(path, 'utf-8'));
        // Security: Validate JSON configuration
        this.validateConfigSecurity(jsonConfig);
        return jsonConfig;
      }

      case 'js':
      case 'ts':
        return await this.loadJsOrTsConfig(path);

      default:
        throw new ConfigError(
          `Unknown configuration format: ${format}`,
          'UNKNOWN_FORMAT'
        );
    }
  }

  /**
   * Load JS or TS configuration file using dynamic import
   * Enhanced with security validation
   */
  private async loadJsOrTsConfig(
    path: string
  ): Promise<ExtendedHookConfiguration> {
    try {
      // Security: Validate the configuration file path
      const resolvedPath = resolve(path);
      const workspaceRoot = resolve(this.workspacePath);

      // Ensure the config file is within the workspace
      if (!resolvedPath.startsWith(workspaceRoot)) {
        throw new ConfigError(
          `Configuration file outside workspace boundary: ${path}`,
          'SECURITY_VIOLATION'
        );
      }

      // Validate file extension
      if (!(resolvedPath.endsWith('.js') || resolvedPath.endsWith('.ts'))) {
        throw new ConfigError(
          `Invalid configuration file extension: ${path}`,
          'INVALID_EXTENSION'
        );
      }

      // Check if we're running under Bun
      if (typeof Bun !== 'undefined') {
        // Use dynamic import with validated absolute path
        const module = await import(resolvedPath);

        // Handle both default export and named exports
        const config = module.default || module;

        if (!config || typeof config !== 'object') {
          throw new ConfigError(
            'Configuration file must export a configuration object',
            'INVALID_EXPORT'
          );
        }

        // Security: Validate the loaded configuration
        this.validateConfigSecurity(config);

        return config;
      }
      // Fallback for Node.js environments
      throw new ConfigError(
        'JS/TS configuration files are only supported under Bun runtime. Please use JSON format or switch to Bun.',
        'RUNTIME_NOT_SUPPORTED'
      );
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error;
      }

      throw new ConfigError(
        `Failed to load ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMPORT_ERROR'
      );
    }
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<ExtendedHookConfiguration> {
    const defaultConfig = { ...DEFAULT_CONFIG };
    await this.save(defaultConfig, 'json');
    return defaultConfig;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(
    config: ExtendedHookConfiguration
  ): ExtendedHookConfiguration {
    return this.deepMerge<ExtendedHookConfiguration>(DEFAULT_CONFIG, config);
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironmentOverrides(
    config: ExtendedHookConfiguration
  ): ExtendedHookConfiguration {
    const env = Bun.env.NODE_ENV || 'development';
    const envOverrides = config.environments?.[env];

    if (!envOverrides) {
      return config;
    }

    return this.deepMerge<ExtendedHookConfiguration>(
      config,
      envOverrides as ExtendedHookConfiguration
    );
  }

  /**
   * Deep merge objects
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (!Object.hasOwn(source, key)) {
        continue;
      }
      const targetValue = result[key];
      const sourceValue = source[key];

      if (sourceValue !== undefined) {
        if (
          typeof targetValue === 'object' &&
          targetValue !== null &&
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(targetValue) &&
          !Array.isArray(sourceValue)
        ) {
          result[key] = this.deepMerge(targetValue, sourceValue) as T[Extract<
            keyof T,
            string
          >];
        } else {
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }

    return result;
  }

  /**
   * Get format from file path
   */
  private getFormatFromPath(path: string): ConfigFormat {
    if (path.endsWith('.ts')) {
      return 'ts';
    }
    if (path.endsWith('.js')) {
      return 'js';
    }
    return 'json';
  }

  /**
   * Generate JavaScript config content
   */
  private generateJSConfig(config: ExtendedHookConfiguration): string {
    return `/**
 * Claude Code hooks configuration
 * @type {import('@outfitter/hooks-config').ExtendedHookConfiguration}
 */
module.exports = ${JSON.stringify(config, null, 2)};
`;
  }

  /**
   * Generate TypeScript config content
   */
  private generateTSConfig(config: ExtendedHookConfiguration): string {
    return `import type { ExtendedHookConfiguration } from '@outfitter/hooks-config';

/**
 * Claude Code hooks configuration
 */
const config: ExtendedHookConfiguration = ${JSON.stringify(config, null, 2)};

export default config;
`;
  }

  /**
   * Validate configuration security
   */
  private validateConfigSecurity(config: ExtendedHookConfiguration): void {
    // Check for dangerous command patterns in hook commands
    const checkCommand = (cmd: string, context: string) => {
      // First, replace legitimate template variables to avoid false positives
      const cmdWithoutTemplates = cmd.replace(
        /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g,
        'TEMPLATE_VAR'
      );

      // Block commands with shell injection attempts
      const dangerousPatterns = [
        /[;&|`$(){}[\]]/, // Shell metacharacters (after template removal)
        /\.\.[/\\]/, // Directory traversal
        /\/proc\//, // Process filesystem access
        /\/dev\//, // Device access
        /\beval\b/i, // Code evaluation
        /\bexec\b/i, // Code execution
        /system\s*\(/, // System calls
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(cmdWithoutTemplates)) {
          throw new ConfigError(
            `Dangerous command pattern detected in ${context}: ${cmd}`,
            'SECURITY_VIOLATION'
          );
        }
      }

      // Ensure commands start with allowed executables
      const allowedExecutables = ['bun', 'node', 'npm', 'yarn', 'pnpm', 'bash'];
      const executable = cmd.trim().split(/\s+/)[0];
      if (!(executable && allowedExecutables.includes(executable))) {
        throw new ConfigError(
          `Unsafe executable in ${context}: ${executable}. Only ${allowedExecutables.join(', ')} are allowed.`,
          'SECURITY_VIOLATION'
        );
      }
    };

    // Recursively check all commands in configuration
    const checkConfigCommands = (obj: unknown, path = ''): void => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (key === 'command' && typeof value === 'string') {
          checkCommand(value, currentPath);
        } else if (typeof value === 'object' && value !== null) {
          checkConfigCommands(value, currentPath);
        }
      }
    };

    checkConfigCommands(config);
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: ExtendedHookConfiguration): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigError(
        'Configuration must be an object',
        'INVALID_CONFIG'
      );
    }

    // Validate hook events
    for (const [event, eventConfig] of Object.entries(config)) {
      if (
        event.startsWith('$') ||
        ['version', 'templates', 'variables', 'environments'].includes(event)
      ) {
        continue;
      }

      if (!this.isValidHookEvent(event)) {
        throw new ConfigError(`Invalid hook event: ${event}`, 'INVALID_EVENT');
      }

      if (eventConfig && typeof eventConfig === 'object') {
        this.validateEventConfig(event, eventConfig);
      }
    }
  }

  /**
   * Check if event is valid hook event
   */
  private isValidHookEvent(event: string): boolean {
    return [
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ].includes(event);
  }

  /**
   * Validate event configuration
   */
  private validateEventConfig(event: string, config: unknown): void {
    if (config && typeof config === 'object' && 'command' in config) {
      // Single hook config
      this.validateToolHookConfig(config, `${event} hook`);
    } else if (config && typeof config === 'object') {
      // Tool-specific configs
      for (const [tool, toolConfig] of Object.entries(config)) {
        if (toolConfig && typeof toolConfig === 'object') {
          this.validateToolHookConfig(toolConfig, `${event}:${tool} hook`);
        }
      }
    }
  }

  /**
   * Validate tool hook configuration
   */
  private validateToolHookConfig(config: unknown, context: string): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigError(
        `${context}: config must be an object`,
        'INVALID_CONFIG'
      );
    }

    const hookConfig = config as Record<string, unknown>;

    if (!hookConfig.command || typeof hookConfig.command !== 'string') {
      throw new ConfigError(
        `${context}: command is required and must be a string`,
        'INVALID_COMMAND'
      );
    }

    if (
      hookConfig.timeout !== undefined &&
      (typeof hookConfig.timeout !== 'number' || hookConfig.timeout < 0)
    ) {
      throw new ConfigError(
        `${context}: timeout must be a positive number`,
        'INVALID_TIMEOUT'
      );
    }

    if (
      hookConfig.enabled !== undefined &&
      typeof hookConfig.enabled !== 'boolean'
    ) {
      throw new ConfigError(
        `${context}: enabled must be a boolean`,
        'INVALID_ENABLED'
      );
    }

    if (
      hookConfig.detached !== undefined &&
      typeof hookConfig.detached !== 'boolean'
    ) {
      throw new ConfigError(
        `${context}: detached must be a boolean`,
        'INVALID_DETACHED'
      );
    }
  }

  /**
   * Notify configuration watchers
   */
  private notifyWatchers(config: ExtendedHookConfiguration): void {
    for (const callback of this.watchCallbacks) {
      try {
        callback(config);
      } catch (_error) {
        // Ignore errors in watchers
      }
    }
  }
}

/**
 * Create configuration manager for workspace
 */
export function createConfigManager(workspacePath: string): ConfigManager {
  return new ConfigManager(workspacePath);
}

/**
 * Load configuration from workspace
 */
export async function loadConfig(
  workspacePath: string,
  options?: ConfigOptions
): Promise<ExtendedHookConfiguration> {
  const manager = createConfigManager(workspacePath);
  return manager.load(options);
}

/**
 * Save configuration to workspace
 */
export async function saveConfig(
  workspacePath: string,
  config: ExtendedHookConfiguration,
  format: ConfigFormat = 'json'
): Promise<void> {
  const manager = createConfigManager(workspacePath);
  await manager.save(config, format);
}
