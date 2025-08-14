/**
 * @file config.ts
 * @description Configuration system for plugin registry.
 * Supports JSON/TypeScript configuration files with validation and hot reload.
 */

import { access, readFile, watch } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { PluginConfig } from './plugin';

/**
 * Plugin condition schema for validation
 */
const PluginConditionSchema = z
  .object({
    type: z.enum(['env', 'context', 'tool', 'custom']),
    field: z.string().optional(),
    operator: z.enum([
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'matches',
      'custom',
    ]),
    value: z.unknown().optional(),
  })
  .refine(
    (condition) => {
      // Custom conditions don't need field/value
      if (condition.type === 'custom') {
        return true;
      }

      // Other conditions need field (except tool conditions)
      if (condition.type !== 'tool' && !condition.field) {
        return false;
      }

      return true;
    },
    {
      message: 'Condition must have required fields for its type',
    }
  );

/**
 * Plugin configuration schema for validation
 */
const PluginConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().default(0),
  events: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  conditions: z.array(PluginConditionSchema).optional(),
});

/**
 * Hook registry configuration schema
 */
const HookConfigSchema = z.object({
  // Plugin configurations
  plugins: z.array(PluginConfigSchema).default([]),

  // Plugin-specific rules/settings
  rules: z.record(z.record(z.unknown())).default({}),

  // Global settings
  settings: z
    .object({
      defaultTimeout: z.number().min(100).max(60_000).default(5000),
      continueOnFailure: z.boolean().default(false),
      collectMetrics: z.boolean().default(true),
      enableHotReload: z.boolean().default(false),
      logLevel: z
        .enum(['debug', 'info', 'warn', 'error', 'silent'])
        .default('info'),
      maxConcurrency: z.number().min(1).max(100).default(10),
    })
    .default({}),

  // Loader configuration
  loader: z
    .object({
      searchPaths: z.array(z.string()).default(['./plugins']),
      includePatterns: z
        .array(z.string())
        .default(['*.plugin.js', '*.plugin.ts', '*.plugin.mjs']),
      excludePatterns: z
        .array(z.string())
        .default(['*.test.*', '*.spec.*', '**/node_modules/**']),
      recursive: z.boolean().default(true),
      maxDepth: z.number().min(1).max(10).default(5),
      enableCache: z.boolean().default(true),
      validateOnLoad: z.boolean().default(true),
    })
    .default({}),

  // Environment-specific overrides
  environments: z
    .record(
      z.object({
        plugins: z.array(PluginConfigSchema).optional(),
        rules: z.record(z.record(z.unknown())).optional(),
        settings: z
          .object({
            defaultTimeout: z.number().optional(),
            continueOnFailure: z.boolean().optional(),
            collectMetrics: z.boolean().optional(),
            enableHotReload: z.boolean().optional(),
            logLevel: z
              .enum(['debug', 'info', 'warn', 'error', 'silent'])
              .optional(),
            maxConcurrency: z.number().optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

/**
 * Inferred configuration types
 */
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type HookConfigSettings = z.infer<typeof HookConfigSchema>['settings'];
export type HookConfigLoader = z.infer<typeof HookConfigSchema>['loader'];
export type EnvironmentConfig = NonNullable<
  z.infer<typeof HookConfigSchema>['environments']
>[string];

/**
 * Configuration load result
 */
export interface ConfigLoadResult {
  config: HookConfig;
  source: string;
  duration: number;
  environment?: string;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  type: 'loaded' | 'changed' | 'error';
  config?: HookConfig;
  error?: Error;
  source: string;
  timestamp: Date;
}

/**
 * Configuration change listener
 */
export type ConfigChangeListener = (
  event: ConfigChangeEvent
) => void | Promise<void>;

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Base directory for resolving relative paths */
  baseDir: string;
  /** Environment to load (defaults to NODE_ENV or 'development') */
  environment: string;
  /** Whether to enable hot reload */
  enableHotReload: boolean;
  /** Hot reload debounce time (ms) */
  hotReloadDebounce: number;
  /** Whether to validate configuration */
  validate: boolean;
  /** Default configuration to merge with */
  defaults: Partial<HookConfig>;
}

/**
 * Configuration file module interface
 */
interface ConfigModule {
  default?: HookConfig | (() => HookConfig) | (() => Promise<HookConfig>);
  config?: HookConfig | (() => HookConfig) | (() => Promise<HookConfig>);
  [key: string]: unknown;
}

/**
 * Configuration loader class
 *
 * Loads and manages hook configuration from various sources:
 * - TypeScript configuration files
 * - JSON configuration files
 * - Environment-specific configurations
 * - Hot reload support for development
 *
 * @example Basic Usage
 * ```typescript
 * const loader = new ConfigLoader();
 * const { config } = await loader.load('./hooks.config.ts');
 *
 * console.log(`Loaded ${config.plugins.length} plugin configurations`);
 * ```
 *
 * @example With Environment
 * ```typescript
 * const loader = new ConfigLoader({
 *   environment: 'production'
 * });
 *
 * const { config } = await loader.load('./hooks.config.js');
 * // Automatically applies production environment overrides
 * ```
 *
 * @example With Hot Reload
 * ```typescript
 * const loader = new ConfigLoader({
 *   enableHotReload: true
 * });
 *
 * loader.onChange(async (event) => {
 *   if (event.type === 'changed' && event.config) {
 *     await registry.reconfigure(event.config);
 *   }
 * });
 *
 * await loader.load('./hooks.config.ts');
 * ```
 */
export class ConfigLoader {
  private readonly options: ConfigLoaderOptions;
  private readonly changeListeners: ConfigChangeListener[] = [];
  private watcher?: AbortController;
  private currentConfig?: HookConfig;
  private watchedFile?: string;

  constructor(options: Partial<ConfigLoaderOptions> = {}) {
    this.options = {
      baseDir: process.cwd(),
      environment: Bun.env.NODE_ENV || 'development',
      enableHotReload: false,
      hotReloadDebounce: 300,
      validate: true,
      defaults: {},
      ...options,
    };
  }

  // === Configuration Loading ===

  /**
   * Load configuration from file
   */
  async load(configPath?: string): Promise<ConfigLoadResult> {
    const startTime = Date.now();
    const resolvedPath = await this.resolveConfigPath(configPath);

    try {
      const rawConfig = await this.loadConfigFile(resolvedPath);
      const config = await this.processConfig(rawConfig);

      this.currentConfig = config;

      // Start watching if enabled
      if (this.options.enableHotReload && resolvedPath !== this.watchedFile) {
        await this.stopWatching();
        await this.startWatching(resolvedPath);
      }

      const result: ConfigLoadResult = {
        config,
        source: resolvedPath,
        duration: Date.now() - startTime,
        environment: this.options.environment,
      };

      await this.emitChange({
        type: 'loaded',
        config,
        source: resolvedPath,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const configError =
        error instanceof Error ? error : new Error(String(error));

      await this.emitChange({
        type: 'error',
        error: configError,
        source: resolvedPath,
        timestamp: new Date(),
      });

      throw new Error(
        `Failed to load configuration from ${resolvedPath}: ${configError.message}`
      );
    }
  }

  /**
   * Reload current configuration
   */
  async reload(): Promise<ConfigLoadResult> {
    if (!this.watchedFile) {
      throw new Error('No configuration file is currently loaded');
    }

    return this.load(this.watchedFile);
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): HookConfig | undefined {
    return this.currentConfig;
  }

  // === Configuration File Loading ===

  /**
   * Resolve configuration file path
   */
  private async resolveConfigPath(configPath?: string): Promise<string> {
    if (configPath) {
      const resolved = resolve(this.options.baseDir, configPath);
      await this.checkFileExists(resolved);
      return resolved;
    }

    // Try common configuration file names
    const commonNames = [
      'hooks.config.ts',
      'hooks.config.js',
      'hooks.config.mjs',
      'hooks.config.json',
      '.hooksrc.ts',
      '.hooksrc.js',
      '.hooksrc.json',
    ];

    for (const name of commonNames) {
      const path = resolve(this.options.baseDir, name);
      try {
        await this.checkFileExists(path);
        return path;
      } catch {
        // Continue to next file
      }
    }

    throw new Error(
      `Configuration file not found. Tried: ${commonNames.join(', ')}`
    );
  }

  /**
   * Load configuration from a specific file
   */
  private async loadConfigFile(filePath: string): Promise<HookConfig> {
    const ext = extname(filePath);

    if (ext === '.json') {
      return this.loadJSONConfig(filePath);
    }
    if (ext === '.js' || ext === '.mjs' || ext === '.ts') {
      return this.loadModuleConfig(filePath);
    }
    throw new Error(`Unsupported configuration file extension: ${ext}`);
  }

  /**
   * Load JSON configuration file
   */
  private async loadJSONConfig(filePath: string): Promise<HookConfig> {
    const content = await readFile(filePath, 'utf-8');

    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON in configuration file: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Load JavaScript/TypeScript module configuration
   */
  private async loadModuleConfig(filePath: string): Promise<HookConfig> {
    const isESModule =
      extname(filePath) === '.mjs' || this.isESModuleEnvironment();

    let module: ConfigModule;

    try {
      if (isESModule || extname(filePath) === '.ts') {
        // Use dynamic import
        const fileUrl = pathToFileURL(filePath).href;
        module = await import(`${fileUrl}?t=${Date.now()}`);
      } else {
        // Use require (clear cache first)
        delete require.cache[require.resolve(filePath)];
        module = require(filePath);
      }
    } catch (error) {
      throw new Error(
        `Failed to load configuration module: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return this.extractConfigFromModule(module);
  }

  /**
   * Extract configuration from loaded module
   */
  private async extractConfigFromModule(
    module: ConfigModule
  ): Promise<HookConfig> {
    // Try default export
    if (module.default !== undefined) {
      const config = await this.resolveConfigValue(module.default);
      if (config) {
        return config;
      }
    }

    // Try named export
    if (module.config !== undefined) {
      const config = await this.resolveConfigValue(module.config);
      if (config) {
        return config;
      }
    }

    // Check if the entire module is the config
    if (this.isConfigLike(module)) {
      return module as HookConfig;
    }

    throw new Error('No valid configuration found in module');
  }

  /**
   * Resolve configuration value (could be function that returns config)
   */
  private async resolveConfigValue(value: unknown): Promise<HookConfig | null> {
    if (typeof value === 'function') {
      const result = (value as () => HookConfig | Promise<HookConfig>)();
      return result instanceof Promise ? await result : result;
    }

    if (this.isConfigLike(value)) {
      return value as HookConfig;
    }

    return null;
  }

  // === Configuration Processing ===

  /**
   * Process and validate configuration
   */
  private async processConfig(rawConfig: unknown): Promise<HookConfig> {
    // Merge with defaults
    const mergedConfig = this.mergeConfigs(this.options.defaults, rawConfig);

    // Validate configuration
    if (this.options.validate) {
      try {
        const validated = HookConfigSchema.parse(mergedConfig);
        return this.applyEnvironmentOverrides(validated);
      } catch (error) {
        throw new Error(
          `Configuration validation failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return this.applyEnvironmentOverrides(mergedConfig as HookConfig);
  }

  /**
   * Apply environment-specific overrides
   */
  private applyEnvironmentOverrides(config: HookConfig): HookConfig {
    if (!config.environments?.[this.options.environment]) {
      return config;
    }

    const envOverrides = config.environments[this.options.environment];
    if (!envOverrides) {
      return config;
    }

    return this.mergeConfigs(config, {
      plugins: envOverrides.plugins || config.plugins,
      rules: { ...config.rules, ...envOverrides.rules },
      settings: { ...config.settings, ...envOverrides.settings },
    }) as HookConfig;
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfigs(base: unknown, override: unknown): unknown {
    if (!(this.isPlainObject(base) && this.isPlainObject(override))) {
      return override !== undefined ? override : base;
    }

    const result = { ...(base as Record<string, unknown>) };

    for (const [key, value] of Object.entries(
      override as Record<string, unknown>
    )) {
      if (this.isPlainObject(value) && this.isPlainObject(result[key])) {
        result[key] = this.mergeConfigs(result[key], value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // === Hot Reload ===

  /**
   * Start watching configuration file for changes
   */
  private async startWatching(filePath: string): Promise<void> {
    if (!this.options.enableHotReload) {
      return;
    }

    this.watcher = new AbortController();
    this.watchedFile = filePath;

    try {
      const watcher = watch(filePath, { signal: this.watcher.signal });

      const debouncedHandler = this.debounce((path: string) => {
        this.handleConfigChange(path).catch((error) => {
          console.error('[ConfigLoader] Error handling config change:', error);
        });
      }, this.options.hotReloadDebounce);

      for await (const event of watcher) {
        if (event.eventType === 'change') {
          debouncedHandler(filePath);
        }
      }
    } catch (error) {
      if (!this.watcher.signal.aborted) {
        console.error(`[ConfigLoader] Error watching ${filePath}:`, error);
      }
    }
  }

  /**
   * Stop watching configuration file
   */
  private async stopWatching(): Promise<void> {
    if (this.watcher) {
      this.watcher.abort();
      this.watcher = undefined;
      this.watchedFile = undefined;
    }
  }

  /**
   * Handle configuration file change
   */
  private async handleConfigChange(filePath: string): Promise<void> {
    try {
      const result = await this.load(filePath);

      await this.emitChange({
        type: 'changed',
        config: result.config,
        source: filePath,
        timestamp: new Date(),
      });
    } catch (error) {
      await this.emitChange({
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        source: filePath,
        timestamp: new Date(),
      });
    }
  }

  // === Event System ===

  /**
   * Add configuration change listener
   */
  onChange(listener: ConfigChangeListener): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove configuration change listener
   */
  offChange(listener: ConfigChangeListener): boolean {
    const index = this.changeListeners.indexOf(listener);
    if (index >= 0) {
      this.changeListeners.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Emit configuration change event
   */
  private async emitChange(event: ConfigChangeEvent): Promise<void> {
    const promises = this.changeListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        console.error('[ConfigLoader] Change listener error:', error);
      }
    });

    await Promise.all(promises);
  }

  // === Utilities ===

  private async checkFileExists(filePath: string): Promise<void> {
    try {
      await access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  private isPlainObject(value: unknown): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private isConfigLike(value: unknown): boolean {
    if (!this.isPlainObject(value)) {
      return false;
    }

    const obj = value as Record<string, unknown>;
    return (
      obj.plugins !== undefined ||
      obj.rules !== undefined ||
      obj.settings !== undefined
    );
  }

  private isESModuleEnvironment(): boolean {
    try {
      const pkg = require(join(process.cwd(), 'package.json'));
      return pkg.type === 'module';
    } catch {
      return false;
    }
  }

  private debounce<Args extends unknown[]>(
    func: (...args: Args) => void,
    wait: number
  ): (...args: Args) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // === Cleanup ===

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopWatching();
    this.changeListeners.length = 0;
    this.currentConfig = undefined;
  }
}

/**
 * Create default hook configuration
 */
export function createDefaultConfig(): HookConfig {
  return {
    plugins: [],
    rules: {},
    settings: {
      defaultTimeout: 5000,
      continueOnFailure: false,
      collectMetrics: true,
      enableHotReload: false,
      logLevel: 'info',
      maxConcurrency: 10,
    },
    loader: {
      searchPaths: ['./plugins'],
      includePatterns: ['*.plugin.js', '*.plugin.ts', '*.plugin.mjs'],
      excludePatterns: ['*.test.*', '*.spec.*', '**/node_modules/**'],
      recursive: true,
      maxDepth: 5,
      enableCache: true,
      validateOnLoad: true,
    },
  };
}

/**
 * Validate plugin configuration
 */
export function validatePluginConfig(config: unknown): PluginConfig {
  return PluginConfigSchema.parse(config);
}

/**
 * Validate hook configuration
 */
export function validateHookConfig(config: unknown): HookConfig {
  return HookConfigSchema.parse(config);
}
