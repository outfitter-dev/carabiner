#!/usr/bin/env node

/**
 * Claude Code hooks CLI
 * Command-line interface for managing Claude Code hooks
 */

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pino from 'pino';
import type { CliConfig, Command } from './types';
// Import commands dynamically to avoid circular dependencies

/**
 * CLI class
 */
export class ClaudeHooksCli {
  private readonly commands: Map<string, Command> = new Map();
  private readonly config: CliConfig;
  private readonly logger: pino.Logger;

  constructor() {
    this.config = {
      version: '0.1.0',
      workspacePath: process.cwd(),
      verbose: false,
      debug: false,
    };

    // Initialize logger
    let logLevel: string;
    if (this.config.debug) {
      logLevel = 'debug';
    } else if (this.config.verbose) {
      logLevel = 'info';
    } else {
      logLevel = 'warn';
    }
    this.logger = pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });

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
      this.logger.level = 'info';
    }
    if (values.debug) {
      this.config.debug = true;
      this.logger.level = 'debug';
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
    this.logger.info({ type: 'success' }, message);
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
