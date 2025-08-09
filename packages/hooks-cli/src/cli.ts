#!/usr/bin/env node

/**
 * Claude Code hooks CLI
 * Command-line interface for managing Claude Code hooks
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
// Import commands dynamically to avoid circular dependencies

/**
 * CLI configuration
 */
export interface CliConfig {
  version: string;
  workspacePath: string;
  verbose: boolean;
  debug: boolean;
}

/**
 * Command interface
 */
interface Command {
  name: string;
  description: string;
  usage: string;
  options: Record<string, string>;
  execute(args: string[], config: CliConfig): Promise<void>;
}

/**
 * CLI class
 */
export class ClaudeHooksCli {
  private commands: Map<string, Command> = new Map();
  private config: CliConfig;

  constructor() {
    this.config = {
      version: '0.1.0',
      workspacePath: process.cwd(),
      verbose: false,
      debug: false,
    };

    // Commands will be registered lazily
  }

  /**
   * Register all commands
   */
  private async registerCommands(): Promise<void> {
    const { InitCommand } = await import('./commands/init');
    const { GenerateCommand } = await import('./commands/generate');
    const { ValidateCommand } = await import('./commands/validate');
    const { ConfigCommand } = await import('./commands/config');
    const { TestCommand } = await import('./commands/test');

    const commands = [
      new InitCommand(),
      new GenerateCommand(),
      new ValidateCommand(),
      new ConfigCommand(),
      new TestCommand(),
    ];

    for (const command of commands) {
      this.commands.set(command.name, command);
    }
  }

  /**
   * Run the CLI
   */
  async run(args: string[]): Promise<void> {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        verbose: { type: 'boolean' },
        debug: { type: 'boolean' },
        workspace: { type: 'string', short: 'w' },
      },
    });

    // Handle global help option
    if (values.help && positionals.length === 0) {
      await this.showHelp();
      return;
    }

    if (values.version) {
      process.exit(0);
    }

    // Update config based on parsed options
    if (values.verbose) {
      this.config.verbose = true;
    }
    if (values.debug) {
      this.config.debug = true;
    }
    if (values.workspace) {
      this.config.workspacePath = resolve(values.workspace);
    }

    const command = positionals[0];
    const commandArgs = positionals.slice(1);

    if (!command) {
      await this.showHelp();
      return;
    }

    // Register commands if not already done
    if (this.commands.size === 0) {
      await this.registerCommands();
    }

    const cmd = this.commands.get(command);
    if (!cmd) {
      this.error(`Unknown command: ${command}`);
      this.showAvailableCommands();
      process.exit(1);
    }

    try {
      await cmd.execute(commandArgs, this.config);
    } catch (error) {
      this.error(
        `Command failed: ${error instanceof Error ? error.message : error}`
      );
      if (this.config.debug && error instanceof Error && error.stack) {
        // TODO: Implement debug stack trace display
        // Debug mode stack trace display not yet implemented
      }
      process.exit(1);
    }
  }

  /**
   * Show help message
   */
  private async showHelp(): Promise<void> {
    // Register commands if not already done
    if (this.commands.size === 0) {
      await this.registerCommands();
    }

    for (const _command of this.commands.values()) {
      // TODO: Implement help display for available commands
      // Command list display not yet implemented
    }
  }

  /**
   * Show available commands
   */
  private showAvailableCommands(): void {
    for (const _command of this.commands.values()) {
      // TODO: Implement available commands display
      // Commands display not yet implemented
    }
  }

  /**
   * Log message
   */
  log(_message: string): void {
    // TODO: Implement logging
    // Logging not yet implemented
  }

  /**
   * Log verbose message
   */
  verbose(_message: string): void {
    if (this.config.verbose) {
      // TODO: Implement verbose logging
      // Verbose logging not yet implemented
    }
  }

  /**
   * Log debug message
   */
  debug(_message: string): void {
    if (this.config.debug) {
      // TODO: Implement debug logging
      // Debug logging not yet implemented
    }
  }

  /**
   * Log error message
   */
  error(_message: string): void {
    // TODO: Implement error logging
    // Error logging not yet implemented
  }

  /**
   * Log warning message
   */
  warn(_message: string): void {
    // TODO: Implement warning logging
    // Warning logging not yet implemented
  }

  /**
   * Log success message
   */
  success(_message: string): void {
    // TODO: Implement success logging
    // Success logging not yet implemented
  }

  /**
   * Log info message
   */
  info(_message: string): void {
    // TODO: Implement info logging
    // Info logging not yet implemented
  }
}

/**
 * Abstract base command class
 */
export abstract class BaseCommand implements Command {
  abstract name: string;
  abstract description: string;
  abstract usage: string;
  abstract options: Record<string, string>;

  protected cli: ClaudeHooksCli | null = null;

  /**
   * Parse command arguments
   */
  protected parseArgs(
    args: string[],
    options: Record<string, unknown>
  ): {
    values: Record<string, string | boolean | undefined>;
    positionals: string[];
  } {
    try {
      const result = parseArgs({
        args,
        allowPositionals: true,
        options: options as any,
      });
      return {
        values: result.values as Record<string, string | boolean | undefined>,
        positionals: result.positionals,
      };
    } catch (error) {
      throw new Error(
        `Invalid arguments: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Show command help
   */
  protected showHelp(): void {
    if (Object.keys(this.options).length > 0) {
      for (const [_option, _desc] of Object.entries(this.options)) {
        // TODO: Implement help display for command options
        // Command-specific help display not yet implemented
      }
    }
  }

  /**
   * Get boolean value from parsed args with fallback
   */
  protected getBooleanValue(
    value: string | boolean | undefined,
    defaultValue = false
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return defaultValue;
  }

  /**
   * Get string value from parsed args with fallback
   */
  protected getStringValue(
    value: string | boolean | undefined,
    defaultValue = ''
  ): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'boolean') {
      return value.toString();
    }
    return defaultValue;
  }

  /**
   * Check if workspace is a Claude Code hooks project
   */
  protected isHooksProject(workspacePath: string): boolean {
    const claudeDir = join(workspacePath, '.claude');
    const hooksDir = join(workspacePath, 'hooks');
    return existsSync(claudeDir) || existsSync(hooksDir);
  }

  /**
   * Get hooks directory path
   */
  protected getHooksDir(workspacePath: string): string {
    return join(workspacePath, 'hooks');
  }

  /**
   * Get Claude directory path
   */
  protected getClaudeDir(workspacePath: string): string {
    return join(workspacePath, '.claude');
  }

  abstract execute(args: string[], config: CliConfig): Promise<void>;
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const cli = new ClaudeHooksCli();
  await cli.run(process.argv.slice(2));
}

// Run CLI if this file is executed directly
if (import.meta.main) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export { main };
