/**
 * Validate command - Validates hook configuration and files
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { loadConfig } from '@outfitter/hooks-config';
import { BaseCommand, type CliConfig } from '../cli';

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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: configuration validation requires complex logic
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
      let _configPath = '';

      for (const path of configPaths) {
        const fullPath = join(workspacePath, path);
        if (existsSync(fullPath)) {
          configExists = true;
          _configPath = path;
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: hook validation requires complex nested logic
  private validateHookCommands(
    // biome-ignore lint/suspicious/noExplicitAny: configuration structure is dynamic
    config: any,
    workspacePath: string,
    verbose: boolean,
    autoFix: boolean
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
          errors += this.validateCommand(
            // biome-ignore lint/suspicious/noExplicitAny: event config structure varies
            eventConfig as any,
            event,
            '',
            workspacePath,
            verbose,
            autoFix
          );
        } else {
          // Tool-specific configs
          for (const [tool, toolConfig] of Object.entries(eventConfig)) {
            if (
              toolConfig &&
              typeof toolConfig === 'object' &&
              'command' in toolConfig
            ) {
              errors += this.validateCommand(
                // biome-ignore lint/suspicious/noExplicitAny: tool config structure varies
                toolConfig as any,
                event,
                tool,
                workspacePath,
                verbose,
                autoFix
              );
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
    hookConfig: { command: string; enabled?: boolean },
    event: string,
    tool: string,
    workspacePath: string,
    verbose: boolean,
    autoFix: boolean
  ): number {
    const _hookName = tool ? `${event}:${tool}` : event;

    if (hookConfig.enabled === false) {
      if (verbose) {
        // TODO: Log hook is disabled, skipping validation
      }
      return 0;
    }

    // Extract file path from command
    const command = hookConfig.command;
    const match = command.match(BUN_RUN_REGEX);
    const scriptPath = match?.[1] ?? match?.[2] ?? match?.[3];
    if (scriptPath) {
      const fullPath = join(workspacePath, scriptPath);

      if (!existsSync(fullPath)) {
        if (autoFix) {
          // TODO: Implement auto-generation of missing hook files
        } else {
          // TODO: Log hook file not found
        }
        return 1;
      }
      if (verbose) {
        // TODO: Log hook file exists
      }
    } else if (verbose) {
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: file validation requires extensive checks
  private async validateHookFile(
    filePath: string,
    workspacePath: string,
    verbose: boolean,
    autoFix: boolean
  ): Promise<number> {
    const _relativePath = relative(workspacePath, filePath);
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
        // biome-ignore lint/nursery/noBitwiseOperators: file permission checking requires bitwise operations
        const isExecutable = Boolean(stats.mode & 0o111);
        if (!isExecutable) {
          if (autoFix) {
            const { chmod } = await import('node:fs/promises');
            // biome-ignore lint/nursery/noBitwiseOperators: file permission setting requires bitwise operations
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
