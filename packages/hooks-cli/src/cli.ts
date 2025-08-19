#!/usr/bin/env bun

/**
 * Claude Code hooks CLI
 * Command-line interface for managing Claude Code hooks
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createCliLogger, type Logger } from '@outfitter/hooks-core';
import { ConfigCommand } from './commands/config';
import { GenerateCommand } from './commands/generate';
// Statically import commands to guarantee inclusion in compiled binary
import { InitCommand } from './commands/init';
import { TestCommand } from './commands/test';
import { ValidateCommand } from './commands/validate';
import { createWorkspaceValidator } from './security/workspace-validator';
import type { CliConfig, Command } from './types';

// Import commands dynamically to avoid circular dependencies

// Command name validation regex
const VALID_COMMAND_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9\-_]*$/;

/**
 * CLI class
 */
export class ClaudeHooksCli {
  private readonly commands: Map<string, Command> = new Map();
  private readonly config: CliConfig;
  private logger: Logger;

  constructor() {
    // Read version from package.json for accurate version reporting
    let version = '0.1.0';
    try {
      // In compiled binary, we need to find the package.json differently
      const isCompiled =
        typeof Bun !== 'undefined' && Bun.main === import.meta.path;
      if (isCompiled) {
        // For compiled binaries, version will be injected at build time
        version = process.env.CLI_VERSION || '0.1.0';
      } else {
        // For development, read from package.json
        const packagePath = join(
          dirname(fileURLToPath(import.meta.url)),
          '..',
          'package.json'
        );
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        version = packageJson.version;
      }
    } catch (_error) {
      // Ignore version parsing errors
    }

    this.config = {
      version,
      workspacePath: process.cwd(),
      verbose: false,
      debug: false,
    };

    // Initialize logger with CLI-specific context
    this.logger = createCliLogger('main');

    // Commands will be registered lazily
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
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
    const { values, positionals } = this.parseCliArgs(args);

    // Handle global help and version
    if (await this.handleGlobalOptions(values, positionals)) {
      return;
    }

    // Update configuration based on parsed options
    this.updateConfig(values);

    const command = positionals[0];
    const commandArgs = positionals.slice(1);

    // Validate command input
    this.validateCommandInput(command, commandArgs);

    if (!command) {
      await this.showHelp();
      return;
    }

    // Execute command
    await this.executeCommand(command, commandArgs);
  }

  /**
   * Parse CLI arguments
   */
  private parseCliArgs(args: string[]) {
    return parseArgs({
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
  }

  /**
   * Handle global options (help, version)
   */
  private async handleGlobalOptions(
    values: any,
    positionals: string[]
  ): Promise<boolean> {
    if (values.help && positionals.length === 0) {
      await this.showHelp();
      return true;
    }

    if (values.version) {
      process.exit(0);
    }

    return false;
  }

  /**
   * Update configuration based on parsed values
   */
  private updateConfig(values: any): void {
    // Update config based on parsed options
    if (values.verbose) {
      this.config.verbose = true;
    }
    if (values.debug) {
      this.config.debug = true;
    }

    // Create new logger with updated context if debug/verbose mode changed
    if (values.debug || values.verbose) {
      this.logger = createCliLogger('main').child({
        verbose: this.config.verbose,
        debug: this.config.debug,
      });
    }

    if (values.workspace) {
      this.validateWorkspacePath(values.workspace);
    }
  }

  /**
   * Validate workspace path
   */
  private validateWorkspacePath(workspace: string): void {
    try {
      const validator = createWorkspaceValidator(workspace);
      this.config.workspacePath = validator.getWorkspaceRoot();
      this.logger.debug(
        `Validated workspace path: ${this.config.workspacePath}`
      );
    } catch (error) {
      this.error(
        `Invalid workspace path: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      process.exit(1);
    }
  }

  /**
   * Validate command input for security
   */
  private validateCommandInput(
    command: string | undefined,
    commandArgs: string[]
  ): void {
    if (!command) return;

    // Sanitize command name (basic validation)
    if (!VALID_COMMAND_NAME_REGEX.test(command)) {
      this.error(`Invalid command name: ${command}`);
      process.exit(1);
    }

    // Validate command arguments for security
    for (const arg of commandArgs) {
      if (
        typeof arg === 'string' &&
        (arg.includes('../') || arg.includes('\x00'))
      ) {
        this.error('Invalid characters in command arguments');
        process.exit(1);
      }
    }
  }

  /**
   * Execute the specified command
   */
  private async executeCommand(
    command: string,
    commandArgs: string[]
  ): Promise<void> {
    // Register commands if not already done
    if (this.commands.size === 0) {
      this.registerCommands();
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
        // Stack trace would be logged here in debug mode
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
    }
  }

  /**
   * Show available commands
   */
  private showAvailableCommands(): void {
    for (const _command of this.commands.values()) {
    }
  }

  /**
   * Log message (user-facing output)
   */
  log(_message: string): void {}

  /**
   * Log verbose message (internal logging)
   */
  verbose(message: string): void {
    this.logger.info(message);
  }

  /**
   * Log debug message (internal logging)
   */
  debug(message: string): void {
    this.logger.debug(message);
  }

  /**
   * Log error message (user-facing)
   */
  error(message: string): void {
    // Also log internally
    this.logger.error(message);
  }

  /**
   * Log warning message (user-facing)
   */
  warn(message: string): void {
    // Also log internally
    this.logger.warn(message);
  }

  /**
   * Log success message (user-facing)
   */
  success(message: string): void {
    // Also log internally
    this.logger.info(message, { type: 'success' });
  }

  /**
   * Log info message (user-facing)
   */
  info(message: string): void {
    // Also log internally
    this.logger.info(message);
  }
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
