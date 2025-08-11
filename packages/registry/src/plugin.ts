/**
 * @file plugin.ts
 * @description Plugin interface and related types for the Claude Code hook registry system.
 * Enables composition of small, focused hooks through a plugin architecture.
 */

import type { z } from 'zod';
import type { HookContext, HookResult, HookEvent } from '@outfitter/types';

/**
 * Plugin execution result with enhanced metadata
 */
export interface PluginResult extends HookResult {
  /** Name of the plugin that produced this result */
  pluginName: string;
  /** Version of the plugin that produced this result */
  pluginVersion: string;
  /** Execution duration in milliseconds */
  executionTime?: number;
  /** Memory usage during execution */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
  };
  /** Plugin-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plugin configuration with runtime validation
 */
export interface PluginConfig {
  /** Plugin name (must match plugin.name) */
  name: string;
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Execution priority (higher = runs first) */
  priority: number;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** Events to filter (empty = use plugin.events) */
  events?: string[];
  /** Tools to filter (empty = no filtering) */
  tools?: string[];
  /** Conditions for plugin execution */
  conditions?: PluginCondition[];
}

/**
 * Plugin execution condition
 */
export interface PluginCondition {
  /** Type of condition */
  type: 'env' | 'context' | 'tool' | 'custom';
  /** Field to check (for env/context/tool conditions) */
  field?: string;
  /** Operator for comparison */
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'matches' | 'custom';
  /** Value to compare against */
  value?: unknown;
  /** Custom condition function (for custom type/operator) */
  condition?: (context: HookContext) => boolean | Promise<boolean>;
}

/**
 * Plugin metadata for discovery and management
 */
export interface PluginMetadata {
  /** Unique plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Homepage or repository URL */
  homepage?: string;
  /** Plugin keywords/tags */
  keywords?: string[];
  /** License identifier */
  license?: string;
  /** Dependencies on other plugins */
  dependencies?: Record<string, string>;
  /** Peer dependencies */
  peerDependencies?: Record<string, string>;
  /** Minimum engine version */
  engines?: {
    node?: string;
    bun?: string;
    'claude-code'?: string;
  };
}

/**
 * Core hook plugin interface
 * 
 * Plugins are the fundamental unit of composition in the Claude Code hook system.
 * They encapsulate specific behaviors and can be combined to create complex workflows.
 * 
 * @example Basic Plugin
 * ```typescript
 * export const gitSafetyPlugin: HookPlugin = {
 *   name: 'git-safety',
 *   version: '1.0.0',
 *   description: 'Prevents dangerous git operations',
 *   events: ['PreToolUse'],
 *   
 *   async apply(context) {
 *     if (context.toolName !== 'Bash') return { success: true };
 *     
 *     const command = context.toolInput.command;
 *     if (command.includes('--force')) {
 *       return {
 *         success: false,
 *         block: true,
 *         message: 'Force operations require confirmation'
 *       };
 *     }
 *     
 *     return { success: true };
 *   }
 * };
 * ```
 */
export interface HookPlugin {
  // === Plugin Identity ===
  
  /** Unique plugin name (kebab-case recommended) */
  name: string;
  
  /** Plugin version (semver format) */
  version: string;
  
  /** Human-readable description */
  description?: string;
  
  /** Plugin author */
  author?: string;
  
  // === Event Filtering ===
  
  /** Events this plugin handles (empty = all events) */
  events: HookEvent[];
  
  /** Tools this plugin targets (empty = all tools) */
  tools?: string[];
  
  // === Execution Control ===
  
  /** Execution priority (higher = runs first, default: 0) */
  priority?: number;
  
  /** Whether plugin is enabled by default */
  enabled?: boolean;
  
  // === Configuration ===
  
  /** Zod schema for plugin configuration validation */
  configSchema?: z.ZodSchema<Record<string, unknown>>;
  
  /** Default configuration values */
  defaultConfig?: Record<string, unknown>;
  
  // === Plugin Implementation ===
  
  /**
   * Apply the plugin to a hook context
   * 
   * @param context - The hook context to process
   * @param config - Plugin-specific configuration (validated against configSchema)
   * @returns Plugin execution result
   */
  apply(
    context: HookContext, 
    config?: Record<string, unknown>
  ): Promise<PluginResult> | PluginResult;
  
  // === Lifecycle Hooks ===
  
  /**
   * Initialize the plugin (called once during registry startup)
   */
  init?(): Promise<void> | void;
  
  /**
   * Shutdown the plugin (called during registry shutdown)
   */
  shutdown?(): Promise<void> | void;
  
  /**
   * Health check for the plugin
   * 
   * @returns true if plugin is healthy, false otherwise
   */
  healthCheck?(): Promise<boolean> | boolean;
  
  /**
   * Validate plugin configuration
   * 
   * @param config - Configuration to validate
   * @returns true if valid, error message if invalid
   */
  validateConfig?(config: Record<string, unknown>): boolean | string;
  
  // === Plugin Metadata ===
  
  /** Additional metadata for discovery and management */
  metadata?: PluginMetadata;
}

/**
 * Plugin factory function for dynamic plugin creation
 */
export type PluginFactory = (options?: Record<string, unknown>) => HookPlugin | Promise<HookPlugin>;

/**
 * Plugin module interface for ES6 module loading
 */
export interface PluginModule {
  /** Default export should be the plugin */
  default?: HookPlugin | PluginFactory;
  /** Named export for the plugin */
  plugin?: HookPlugin | PluginFactory;
  /** Alternative named exports */
  [key: string]: HookPlugin | PluginFactory | unknown;
}

/**
 * Plugin discovery result
 */
export interface PluginDiscovery {
  /** Plugin file path */
  path: string;
  /** Plugin name from file/package */
  name: string;
  /** Plugin module */
  module?: PluginModule;
  /** Discovery error if failed to load */
  error?: Error;
  /** Last modification time */
  lastModified?: Date;
}

/**
 * Plugin execution context with additional registry information
 */
export interface PluginExecutionContext {
  /** Original hook context */
  context: HookContext;
  /** Plugin configuration */
  config?: Record<string, unknown>;
  /** Registry instance */
  registry: unknown; // Forward reference to avoid circular dependency
  /** Other plugins in execution chain */
  plugins: HookPlugin[];
  /** Current plugin index in chain */
  index: number;
  /** Previous plugin results */
  previousResults: PluginResult[];
}

/**
 * Plugin execution options
 */
export interface PluginExecutionOptions {
  /** Maximum execution time per plugin (ms) */
  timeout?: number;
  /** Whether to collect performance metrics */
  collectMetrics?: boolean;
  /** Whether to continue on plugin failure */
  continueOnFailure?: boolean;
  /** Context-specific options */
  context?: Record<string, unknown>;
}

/**
 * Type guard to check if an object is a valid HookPlugin
 */
export function isHookPlugin(obj: unknown): obj is HookPlugin {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const plugin = obj as Partial<HookPlugin>;
  
  return (
    typeof plugin.name === 'string' &&
    typeof plugin.version === 'string' &&
    Array.isArray(plugin.events) &&
    typeof plugin.apply === 'function'
  );
}

/**
 * Type guard to check if an object is a PluginResult
 */
export function isPluginResult(obj: unknown): obj is PluginResult {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const result = obj as Partial<PluginResult>;
  
  return (
    typeof result.success === 'boolean' &&
    typeof result.pluginName === 'string' &&
    typeof result.pluginVersion === 'string'
  );
}

/**
 * Create a plugin result from a HookResult
 */
export function createPluginResult(
  plugin: HookPlugin,
  hookResult: HookResult,
  executionTime?: number,
  memoryUsage?: PluginResult['memoryUsage']
): PluginResult {
  return {
    ...hookResult,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    executionTime,
    memoryUsage,
    metadata: hookResult.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Plugin validation error
 */
export class PluginValidationError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly field: string,
    message: string
  ) {
    super(`Plugin ${pluginName}: ${field} - ${message}`);
    this.name = 'PluginValidationError';
  }
}

/**
 * Plugin execution error
 */
export class PluginExecutionError extends Error {
  constructor(
    public readonly pluginName: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`Plugin ${pluginName}: ${message}`);
    this.name = 'PluginExecutionError';
    
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * Plugin configuration error
 */
export class PluginConfigurationError extends Error {
  constructor(
    public readonly pluginName: string,
    message: string,
    public readonly configField?: string
  ) {
    super(`Plugin ${pluginName} configuration error: ${message}`);
    this.name = 'PluginConfigurationError';
  }
}