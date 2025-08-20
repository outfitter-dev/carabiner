/**
 * Validate command - Validates hook configuration and files
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type ExtendedHookConfiguration,
  loadConfig,
} from '@outfitter/hooks-config';
import type { ToolHookConfig } from '@outfitter/hooks-core';
import { BaseCommand, type CliConfig } from '../types';

// Regex patterns at top level
const HOOK_FILE_REGEX = /\.(ts|js)$/;
const BUN_RUN_REGEX = /bun\s+run\s+(?:-S\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))/;

export class ValidateCommand extends BaseCommand {
  name = 'validate';
  description = 'Validate hook configuration and files';
  usage = 'validate [options]';
  options = {
    '--config, -c': 'Validate configuration only',
    '--hooks, -k': 'Validate hook files only',
    '--fix': 'Automatically fix issues where possible',
    '--verbose, -v': 'Show detailed validation output',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values } = this.parseArgs(args, {
      help: { type: 'boolean', short: 'h' },
      config: { type: 'boolean', short: 'c' },
      hooks: { type: 'boolean', short: 'k' },
      fix: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
    });

    if (values.help) {
      this.showHelp();
      return;
    }

    const validateConfig = !this.getBooleanValue(values.hooks);
    const validateHooks = !this.getBooleanValue(values.config);
    const autoFix = this.getBooleanValue(values.fix);
    const verbose = this.getBooleanValue(values.verbose) || config.verbose;

    let hasErrors = false;

    try {
      if (validateConfig) {
        const configErrors = await this.validateConfiguration(
          config.workspacePath,
          verbose,
          autoFix
        );
        if (configErrors > 0) {
          hasErrors = true;
        }
      }

      if (validateHooks) {
        const hookErrors = await this.validateHookFiles(
          config.workspacePath,
          verbose,
          autoFix
        );
        if (hookErrors > 0) {
          hasErrors = true;
        }
      }

      // biome-ignore lint/nursery/noUnnecessaryConditions: hasErrors can be set to true in the validation blocks above
      if (hasErrors) {
        if (!autoFix) {
          process.stderr.write(
            'Validation found issues. Re-run with --fix to attempt automatic remediation.\n'
          );
        }
        process.exit(1);
      } else if (verbose) {
        process.stdout.write('Validation passed.\n');
      }
    } catch (error) {
      const message = `Validation failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(message, { cause: error as unknown });
    }
  }

  /**
   * Validate configuration files
   */
  private async validateConfiguration(
    workspacePath: string,
    verbose: boolean,
    autoFix: boolean
  ): Promise<number> {
    let errors = 0;

    try {
      // Check if configuration exists
      const configPaths = [
        '.claude/hooks.json',
        '.claude/hooks.config.ts',
        '.claude/hooks.config.js',
      ];

      let configExists = false;

      for (const path of configPaths) {
        const fullPath = join(workspacePath, path);
        if (existsSync(fullPath)) {
          configExists = true;
          // Config path found: path
          break;
        }
      }

      if (!configExists) {
        return ++errors;
      }

      if (verbose) {
        // TODO: Log configuration found
      }

      // Load and validate configuration
      const config = await loadConfig(workspacePath, { validate: true });

      if (verbose) {
        // TODO: Log configuration loaded successfully
      }

      // Validate Claude settings
      const settingsPath = join(workspacePath, '.claude/settings.json');
      if (existsSync(settingsPath)) {
        const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));

        if (!settings.hooks) {
          if (autoFix) {
            // TODO: Implement auto-fix for missing hooks section
          } else {
            // TODO: Log error about missing hooks section
          }
          errors++;
        } else if (verbose) {
          // TODO: Log Claude settings validation passed
        }
      } else {
        errors++;
      }

      // Validate hook commands exist
      errors += this.validateHookCommands(
        config,
        workspacePath,
        verbose,
        autoFix
      );
    } catch (_error) {
      errors++;
    }

    return errors;
  }

  /**
   * Validate hook commands exist
   */
  private validateHookCommands(
    config: ExtendedHookConfiguration,
    workspacePath: string,
    verbose: boolean,
    _autoFix: boolean
  ): number {
    let errors = 0;

    // Check each configured hook
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
          errors += this.validateCommand(eventConfig as ToolHookConfig, {
            event,
            tool: '',
            workspacePath,
            verbose,
            autoFix: _autoFix,
          });
        } else {
          // Tool-specific configs
          for (const [tool, toolConfig] of Object.entries(eventConfig)) {
            if (
              toolConfig &&
              typeof toolConfig === 'object' &&
              'command' in toolConfig
            ) {
              errors += this.validateCommand(toolConfig as ToolHookConfig, {
                event,
                tool,
                workspacePath,
                verbose,
                autoFix: _autoFix,
              });
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate a specific hook command
   */
  private validateCommand(
    hookConfig: ToolHookConfig,
    context: {
      event: string;
      tool: string;
      workspacePath: string;
      verbose: boolean;
      autoFix: boolean;
    }
  ): number {
    // Hook name for context: tool ? `${event}:${tool}` : event

    if (hookConfig.enabled === false) {
      if (context.verbose) {
        // TODO: Log hook is disabled, skipping validation
      }
      return 0;
    }

    // Extract file path from command
    const command = hookConfig.command;
    const match = command.match(BUN_RUN_REGEX);
    const scriptPath = match?.[1] ?? match?.[2] ?? match?.[3];
    if (scriptPath) {
      const fullPath = join(context.workspacePath, scriptPath);

      if (!existsSync(fullPath)) {
        if (context.autoFix) {
          // TODO: Implement auto-generation of missing hook files
        } else {
          // TODO: Log hook file not found
        }
        return 1;
      }
      if (context.verbose) {
        // TODO: Log hook file exists
      }
    } else if (context.verbose) {
      // TODO: Log non-standard command format
    }

    return 0;
  }

  /**
   * Validate hook files
   */
  private async validateHookFiles(
    workspacePath: string,
    verbose: boolean,
    autoFix: boolean
  ): Promise<number> {
    let errors = 0;

    const hooksDir = join(workspacePath, 'hooks');

    if (!existsSync(hooksDir)) {
      return ++errors;
    }

    if (verbose) {
      // TODO: Log validating hook files
    }

    // Find all hook files
    const hookFiles = await this.findHookFiles(hooksDir);

    if (hookFiles.length === 0) {
      // TODO: Log no hook files found
    } else if (verbose) {
      // TODO: Log found X hook files to validate
    }

    // Validate each hook file
    for (const filePath of hookFiles) {
      errors += await this.validateHookFile(
        filePath,
        workspacePath,
        verbose,
        autoFix
      );
    }

    return errors;
  }

  /**
   * Find all hook files
   */
  private async findHookFiles(hooksDir: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const files: string[] = [];

    try {
      const entries = await readdir(hooksDir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.isFile() &&
          HOOK_FILE_REGEX.test(entry.name) &&
          !entry.name.endsWith('.d.ts') &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.')
        ) {
          files.push(join(hooksDir, entry.name));
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      if (error instanceof Error) {
        // TODO: Log could not read hooks directory
      }
    }

    return files;
  }

  /**
   * Validate a single hook file
   */
  private async validateHookFile(
    filePath: string,
    _workspacePath: string,
    verbose: boolean,
    autoFix: boolean
  ): Promise<number> {
    // File path relative to workspace: relative(_workspacePath, filePath)
    let errors = 0;

    try {
      // Check file exists and is readable
      if (!existsSync(filePath)) {
        return ++errors;
      }

      // Check file permissions (executable)
      const { stat } = await import('node:fs/promises');
      const stats = await stat(filePath);

      // On Unix systems, check if file is executable
      if (process.platform !== 'win32') {
        // biome-ignore lint/suspicious/noBitwiseOperators: file permission checking requires bitwise operations
        const isExecutable = Boolean(stats.mode & 0o111);
        if (!isExecutable) {
          if (autoFix) {
            const { chmod } = await import('node:fs/promises');
            // biome-ignore lint/suspicious/noBitwiseOperators: file permission setting requires bitwise operations
            await chmod(filePath, stats.mode | 0o755);
          } else {
            errors++;
          }
        }
      }

      // Basic syntax check by reading the file
      const content = await readFile(filePath, 'utf-8');

      // Check for shebang
      if (!content.startsWith('#!')) {
        if (autoFix) {
          const fixedContent = `#!/usr/bin/env bun\n\n${content}`;
          const { writeFile } = await import('node:fs/promises');
          await writeFile(filePath, fixedContent);
        } else {
          errors++;
        }
      }

      // Check for basic imports (TypeScript/JavaScript)
      const hasImports =
        content.includes('@outfitter/hooks-core') ||
        content.includes('require(') ||
        content.includes('import');

      if (!hasImports) {
        errors++;
      }

      // Check for main execution block
      const hasMainBlock =
        content.includes('import.meta.main') ||
        content.includes('require.main === module');

      if (!hasMainBlock) {
        errors++;
      }

      if (verbose && errors === 0) {
        // TODO: Log hook file validated
      }
    } catch (_error) {
      // TODO: Log failed to validate hook file
      errors++;
    }

    return errors;
  }
}
