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
      console.log(`claude-hooks version ${this.config.version}`);
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
        console.error('\nStack trace:');
        console.error(error.stack);
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

    console.log('Claude Code Hooks CLI');
    console.log(`Version: ${this.config.version}\n`);
    console.log('Usage: claude-hooks [options] <command> [command-options]\n');
    console.log('Options:');
    console.log('  -h, --help      Show help');
    console.log('  -v, --version   Show version');
    console.log('  --verbose       Enable verbose output');
    console.log('  --debug         Enable debug output');
    console.log('  -w, --workspace Set workspace path\n');
    console.log('Commands:');
    
    for (const command of this.commands.values()) {
      console.log(`  ${command.name.padEnd(12)} ${command.description}`);
    }
    
    console.log('\nRun "claude-hooks <command> --help" for command-specific help');
  }

  /**
   * Show available commands
   */
  private showAvailableCommands(): void {
    console.log('\nAvailable commands:');
    for (const command of this.commands.values()) {
      console.log(`  ${command.name.padEnd(12)} ${command.description}`);
    }
  }

  /**
   * Log message
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Log verbose message
   */
  verbose(message: string): void {
    if (this.config.verbose) {
      console.log(`[VERBOSE] ${message}`);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log error message
   */
  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  /**
   * Log success message
   */
  success(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * Log info message
   */
  info(message: string): void {
    console.info(`ℹ️  ${message}`);
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
        // biome-ignore lint/suspicious/noExplicitAny: parseArgs requires flexible options type
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
    console.log(`\nUsage: claude-hooks ${this.name} ${this.usage}\n`);
    console.log(this.description);
    
    if (Object.keys(this.options).length > 0) {
      console.log('\nOptions:');
      for (const [option, desc] of Object.entries(this.options)) {
        console.log(`  ${option.padEnd(20)} ${desc}`);
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
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
