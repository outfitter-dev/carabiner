/**
 * Type-safe validation utilities
 * Replaces complex validation functions with composable, type-safe alternatives
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '@outfitter/hooks-config';
import type {
  HookConfiguration,
  ValidationError,
  ValidationReport,
  ValidationSummary,
  ValidationWarning,
} from './validation-types';
import { configTypeGuards, configValidation } from './validation-types';

// Regex patterns for command validation
const HOOK_FILE_REGEX = /\.(ts|js)$/;
const BUN_RUN_REGEX = /bun\s+run\s+(?:-S\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/;

/**
 * Configuration file detection utilities
 */
export const configDetection = {
  /**
   * Get possible configuration file paths
   */
  getConfigPaths(): readonly string[] {
    return [
      '.claude/hooks.json',
      '.claude/hooks.config.ts',
      '.claude/hooks.config.js',
    ];
  },

  /**
   * Find existing configuration file
   */
  findConfigFile(workspacePath: string): string | null {
    for (const configPath of this.getConfigPaths()) {
      const fullPath = join(workspacePath, configPath);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  },

  /**
   * Check if Claude settings file exists and is valid
   */
  async validateClaudeSettings(
    workspacePath: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const settingsPath = join(workspacePath, '.claude/settings.json');

    if (!existsSync(settingsPath)) {
      errors.push({
        type: 'config',
        path: settingsPath,
        message: 'Claude settings file not found',
        fixable: true,
        suggestion: 'Create .claude/settings.json with hooks configuration',
      });
      return errors;
    }

    try {
      const settingsContent = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent) as unknown;

      if (typeof settings !== 'object' || settings === null) {
        errors.push({
          type: 'config',
          path: settingsPath,
          message: 'Settings file contains invalid JSON structure',
          fixable: false,
        });
        return errors;
      }

      const settingsObj = settings as Record<string, unknown>;

      if (!('hooks' in settingsObj)) {
        errors.push({
          type: 'config',
          path: settingsPath,
          message: 'Settings file missing hooks configuration section',
          fixable: true,
          suggestion: 'Add "hooks": {} to settings.json',
        });
      }
    } catch (error) {
      errors.push({
        type: 'config',
        path: settingsPath,
        message: `Failed to parse settings file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fixable: false,
      });
    }

    return errors;
  },
} as const;

/**
 * Command validation utilities
 */
export const commandValidation = {
  /**
   * Extract script path from bun run command
   */
  extractScriptPath(command: string): string | null {
    const match = command.match(BUN_RUN_REGEX);
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
  },

  /**
   * Validate that hook command file exists
   */
  validateCommandFile(
    command: string,
    hookPath: string,
    workspacePath: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const scriptPath = this.extractScriptPath(command);

    if (!scriptPath) {
      errors.push({
        type: 'command',
        path: hookPath,
        message: 'Command does not match expected "bun run <script>" format',
        fixable: false,
        suggestion: 'Use format: bun run path/to/script.ts',
      });
      return errors;
    }

    const fullPath = join(workspacePath, scriptPath);

    if (!existsSync(fullPath)) {
      errors.push({
        type: 'file',
        path: fullPath,
        message: 'Hook script file not found',
        fixable: true,
        suggestion: `Create file at ${scriptPath}`,
      });
      return errors;
    }

    if (!HOOK_FILE_REGEX.test(fullPath)) {
      errors.push({
        type: 'file',
        path: fullPath,
        message: 'Hook file should have .ts or .js extension',
        fixable: false,
        suggestion: 'Rename file to use .ts or .js extension',
      });
    }

    return errors;
  },

  /**
   * Validate hook file permissions
   */
  async validateFilePermissions(filePath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    try {
      const stats = await Bun.file(filePath).exists();
      if (!stats) {
        errors.push({
          type: 'file',
          path: filePath,
          message: 'File is not accessible',
          fixable: false,
        });
      }
    } catch (error) {
      errors.push({
        type: 'permission',
        path: filePath,
        message: `Permission error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fixable: true,
        suggestion: 'Check file permissions and ownership',
      });
    }

    return errors;
  },
} as const;

/**
 * Configuration validation orchestrator
 */
export const configurationValidator = {
  /**
   * Validate complete configuration with type safety
   */
  async validateConfiguration(
    workspacePath: string
  ): Promise<ValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check configuration file exists
    const configPath = configDetection.findConfigFile(workspacePath);
    if (!configPath) {
      errors.push({
        type: 'config',
        path: workspacePath,
        message: 'No hook configuration file found',
        fixable: true,
        suggestion: 'Create .claude/hooks.json or hooks.config.ts',
      });

      return this.createValidationReport(false, errors, warnings);
    }

    // Load and validate configuration structure
    let config: unknown;
    try {
      config = await loadConfig(workspacePath, { validate: true });
    } catch (error) {
      errors.push({
        type: 'config',
        path: configPath,
        message: `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fixable: false,
      });

      return this.createValidationReport(false, errors, warnings);
    }

    // Type-safe configuration validation
    if (!configTypeGuards.isHookConfiguration(config)) {
      errors.push({
        type: 'config',
        path: configPath,
        message: 'Configuration does not match expected structure',
        fixable: false,
        suggestion: 'Check configuration against the schema',
      });

      return this.createValidationReport(false, errors, warnings);
    }

    // Validate Claude settings
    const settingsErrors =
      await configDetection.validateClaudeSettings(workspacePath);
    errors.push(...settingsErrors);

    // Validate configuration content
    const configReport = configValidation.validateConfiguration(
      config,
      configPath
    );
    errors.push(...configReport.errors);
    warnings.push(...configReport.warnings);

    // Validate hook commands and files
    const commandErrors = await this.validateHookCommands(
      config,
      workspacePath
    );
    errors.push(...commandErrors);

    return this.createValidationReport(errors.length === 0, errors, warnings);
  },

  /**
   * Validate hook commands and their associated files
   */
  async validateHookCommands(
    config: HookConfiguration,
    workspacePath: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

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

      if (event === 'PreToolUse' || event === 'PostToolUse') {
        // Tool-specific configurations
        if (configTypeGuards.isToolConfigCollection(eventConfig)) {
          for (const [tool, toolConfig] of Object.entries(eventConfig)) {
            if (!toolConfig || toolConfig.enabled === false) {
              continue;
            }

            const hookPath = `${event}.${tool}`;
            const commandErrors = commandValidation.validateCommandFile(
              toolConfig.command,
              hookPath,
              workspacePath
            );
            errors.push(...commandErrors);
          }
        }
      } else if (configTypeGuards.isBaseHookConfig(eventConfig)) {
        // Single hook configuration
        if (eventConfig.enabled !== false) {
          const commandErrors = commandValidation.validateCommandFile(
            eventConfig.command,
            event,
            workspacePath
          );
          errors.push(...commandErrors);
        }
      }
    }

    return errors;
  },

  /**
   * Create validation report with summary
   */
  createValidationReport(
    configValid: boolean,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): ValidationReport {
    const summary: ValidationSummary = {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      fixableErrors: errors.filter((e) => e.fixable).length,
      checkedFiles: 0, // Would be updated by file validation
      validatedHooks: 0, // Would be updated by hook counting
    };

    return {
      configurationValid: configValid,
      hookFilesValid: true, // Would be determined by separate file validation
      errors,
      warnings,
      summary,
    };
  },
} as const;

/**
 * Hook file validation utilities
 */
export const hookFileValidator = {
  /**
   * Find all hook files in hooks directory
   */
  async findHookFiles(hooksDir: string): Promise<string[]> {
    if (!existsSync(hooksDir)) {
      return [];
    }

    const files: string[] = [];

    try {
      // Use Bun's file system utilities for efficient directory traversal
      const entries = await Array.fromAsync(
        (await import('node:fs/promises')).readdir(hooksDir, {
          recursive: true,
        })
      );

      for (const entry of entries) {
        if (typeof entry === 'string' && HOOK_FILE_REGEX.test(entry)) {
          files.push(join(hooksDir, entry));
        }
      }
    } catch (_error) {
      // Silently handle directory read errors
    }

    return files.sort();
  },

  /**
   * Validate individual hook file
   */
  async validateHookFile(filePath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check file exists and is accessible
    const permissionErrors =
      await commandValidation.validateFilePermissions(filePath);
    errors.push(...permissionErrors);

    if (errors.length > 0) {
      return errors; // Don't continue if file is not accessible
    }

    // Additional hook file validation could go here
    // - Syntax checking
    // - Import validation
    // - Hook registration validation

    return errors;
  },

  /**
   * Validate all hook files in directory
   */
  async validateHookFiles(workspacePath: string): Promise<ValidationReport> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const hooksDir = join(workspacePath, 'hooks');
    if (!existsSync(hooksDir)) {
      errors.push({
        type: 'file',
        path: hooksDir,
        message: 'Hooks directory not found',
        fixable: true,
        suggestion: 'Create hooks/ directory for hook files',
      });

      return this.createFileValidationReport(false, errors, warnings, 0);
    }

    const hookFiles = await this.findHookFiles(hooksDir);

    if (hookFiles.length === 0) {
      warnings.push({
        type: 'style',
        path: hooksDir,
        message: 'No hook files found in hooks directory',
        recommendation: 'Add hook implementation files',
      });
    }

    // Validate each hook file
    for (const filePath of hookFiles) {
      const fileErrors = await this.validateHookFile(filePath);
      errors.push(...fileErrors);
    }

    return this.createFileValidationReport(
      errors.length === 0,
      errors,
      warnings,
      hookFiles.length
    );
  },

  /**
   * Create file validation report
   */
  createFileValidationReport(
    valid: boolean,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    fileCount: number
  ): ValidationReport {
    const summary: ValidationSummary = {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      fixableErrors: errors.filter((e) => e.fixable).length,
      checkedFiles: fileCount,
      validatedHooks: fileCount,
    };

    return {
      configurationValid: true, // File validation doesn't affect config validity
      hookFilesValid: valid,
      errors,
      warnings,
      summary,
    };
  },
} as const;
