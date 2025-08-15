/**
 * Type-safe configuration validation types
 * Replaces 'any' types with proper discriminated unions
 */

import type { HookEvent, ToolName } from '@outfitter/hooks-core';

/**
 * Base configuration structure that all hook configs must have
 */
export type BaseHookConfig = {
  readonly command: string;
  readonly enabled?: boolean;
  readonly timeout?: number;
};

/**
 * Tool-specific hook configuration
 */
export type ToolHookConfig = BaseHookConfig & {
  readonly detached?: boolean;
  readonly env?: Record<string, string>;
};

/**
 * Event-specific configuration mapping
 */
export type EventConfigMap = {
  readonly PreToolUse?: ToolConfigCollection;
  readonly PostToolUse?: ToolConfigCollection;
  readonly UserPromptSubmit?: BaseHookConfig;
  readonly SessionStart?: BaseHookConfig;
  readonly Stop?: BaseHookConfig;
  readonly SubagentStop?: BaseHookConfig;
};

/**
 * Tool configuration collection - maps tool names to their configs
 */
export type ToolConfigCollection = Partial<Record<ToolName, ToolHookConfig>>;

/**
 * Complete hook configuration structure with metadata
 */
export type HookConfiguration = EventConfigMap & {
  readonly $schema?: string;
  readonly $version?: string;
  readonly templates?: Record<string, unknown>;
  readonly variables?: Record<string, unknown>;
  readonly environments?: Record<string, EventConfigMap>;
};

/**
 * Validation result for individual configuration items
 */
export type ValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

/**
 * Comprehensive validation report
 */
export type ValidationReport = {
  readonly configurationValid: boolean;
  readonly hookFilesValid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly summary: ValidationSummary;
};

/**
 * Validation error with context
 */
export type ValidationError = {
  readonly type: 'config' | 'file' | 'command' | 'permission';
  readonly path: string;
  readonly message: string;
  readonly fixable: boolean;
  readonly suggestion?: string;
};

/**
 * Validation warning with context
 */
export type ValidationWarning = {
  readonly type: 'deprecation' | 'performance' | 'security' | 'style';
  readonly path: string;
  readonly message: string;
  readonly recommendation?: string;
};

/**
 * Validation summary statistics
 */
export type ValidationSummary = {
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly fixableErrors: number;
  readonly checkedFiles: number;
  readonly validatedHooks: number;
};

/**
 * Type guards for configuration validation
 */
export const configTypeGuards = {
  /**
   * Check if value is a valid base hook config
   */
  isBaseHookConfig(value: unknown): value is BaseHookConfig {
    return (
      typeof value === 'object' &&
      value !== null &&
      'command' in value &&
      typeof (value as Record<string, unknown>).command === 'string'
    );
  },

  /**
   * Check if value is a valid tool hook config
   */
  isToolHookConfig(value: unknown): value is ToolHookConfig {
    if (!this.isBaseHookConfig(value)) {
      return false;
    }

    const config = value as Record<string, unknown>;

    // Check optional properties
    if ('detached' in config && typeof config.detached !== 'boolean') {
      return false;
    }

    if ('env' in config) {
      const env = config.env;
      if (typeof env !== 'object' || env === null) {
        return false;
      }
      // Check that all env values are strings
      for (const [key, val] of Object.entries(env)) {
        if (typeof key !== 'string' || typeof val !== 'string') {
          return false;
        }
      }
    }

    return true;
  },

  /**
   * Check if value is a valid tool config collection
   */
  isToolConfigCollection(value: unknown): value is ToolConfigCollection {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    for (const [toolName, config] of Object.entries(value)) {
      if (typeof toolName !== 'string') {
        return false;
      }
      if (config !== undefined && !this.isToolHookConfig(config)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Check if value is a valid event config map
   */
  isEventConfigMap(value: unknown): value is EventConfigMap {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const config = value as Record<string, unknown>;
    const validEvents: readonly HookEvent[] = [
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ];

    for (const [event, eventConfig] of Object.entries(config)) {
      if (!validEvents.includes(event as HookEvent)) {
        continue; // Skip non-event properties
      }

      if (eventConfig === undefined) {
        continue;
      }

      if (event === 'PreToolUse' || event === 'PostToolUse') {
        if (!this.isToolConfigCollection(eventConfig)) {
          return false;
        }
      } else if (!this.isBaseHookConfig(eventConfig)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Check if value is a complete hook configuration
   */
  isHookConfiguration(value: unknown): value is HookConfiguration {
    if (!this.isEventConfigMap(value)) {
      return false;
    }

    const config = value as Record<string, unknown>;

    // Check optional metadata properties
    if ('$schema' in config && typeof config.$schema !== 'string') {
      return false;
    }

    if ('$version' in config && typeof config.$version !== 'string') {
      return false;
    }

    if (
      'templates' in config &&
      (typeof config.templates !== 'object' || config.templates === null)
    ) {
      return false;
    }

    if (
      'variables' in config &&
      (typeof config.variables !== 'object' || config.variables === null)
    ) {
      return false;
    }

    if ('environments' in config) {
      const environments = config.environments;
      if (typeof environments !== 'object' || environments === null) {
        return false;
      }

      for (const [envName, envConfig] of Object.entries(environments)) {
        if (typeof envName !== 'string' || !this.isEventConfigMap(envConfig)) {
          return false;
        }
      }
    }

    return true;
  },
} as const;

/**
 * Configuration validation utilities
 */
export const configValidation = {
  /**
   * Validate a base hook configuration
   */
  validateBaseConfig(config: BaseHookConfig, path: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate command
    if (!config.command.trim()) {
      errors.push(`${path}: Command cannot be empty`);
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (config.timeout < 0) {
        errors.push(`${path}: Timeout must be non-negative`);
      } else if (config.timeout > 300_000) {
        warnings.push(
          `${path}: Timeout is very high (${config.timeout}ms), consider reducing`
        );
      } else if (config.timeout < 1000) {
        warnings.push(
          `${path}: Timeout is very low (${config.timeout}ms), might cause premature failures`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validate a tool hook configuration
   */
  validateToolConfig(config: ToolHookConfig, path: string): ValidationResult {
    const baseResult = this.validateBaseConfig(config, path);
    const errors = [...baseResult.errors];
    const warnings = [...baseResult.warnings];

    // Additional tool-specific validation
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        if (key.includes(' ')) {
          errors.push(
            `${path}: Environment variable key "${key}" contains spaces`
          );
        }
        if (value.includes('\n')) {
          warnings.push(
            `${path}: Environment variable "${key}" contains newlines`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validate complete configuration structure
   */
  validateConfiguration(
    config: HookConfiguration,
    basePath: string
  ): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each event configuration
    for (const [event, eventConfig] of Object.entries(config)) {
      if (
        event.startsWith('$') ||
        ['templates', 'variables', 'environments'].includes(event)
      ) {
        continue;
      }

      if (!eventConfig) {
        continue;
      }

      const eventPath = `${basePath}.${event}`;

      if (event === 'PreToolUse' || event === 'PostToolUse') {
        // Tool-specific configs
        if (configTypeGuards.isToolConfigCollection(eventConfig)) {
          for (const [tool, toolConfig] of Object.entries(eventConfig)) {
            if (!toolConfig) {
              continue;
            }

            const toolPath = `${eventPath}.${tool}`;
            const result = this.validateToolConfig(toolConfig, toolPath);

            errors.push(
              ...result.errors.map((message) => ({
                type: 'config' as const,
                path: toolPath,
                message,
                fixable: false,
              }))
            );

            warnings.push(
              ...result.warnings.map((message) => ({
                type: 'performance' as const,
                path: toolPath,
                message,
              }))
            );
          }
        }
      } else if (configTypeGuards.isBaseHookConfig(eventConfig)) {
        // Single hook config
        const result = this.validateBaseConfig(eventConfig, eventPath);

        errors.push(
          ...result.errors.map((message) => ({
            type: 'config' as const,
            path: eventPath,
            message,
            fixable: false,
          }))
        );

        warnings.push(
          ...result.warnings.map((message) => ({
            type: 'performance' as const,
            path: eventPath,
            message,
          }))
        );
      }
    }

    return {
      configurationValid: errors.length === 0,
      hookFilesValid: true, // This would be determined by file validation
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        fixableErrors: errors.filter((e) => e.fixable).length,
        checkedFiles: 0, // Would be populated by file validation
        validatedHooks: 0, // Would be populated by hook validation
      },
    };
  },
} as const;
