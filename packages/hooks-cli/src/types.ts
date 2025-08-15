import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type ParseArgsConfig, parseArgs } from 'node:util';

/**
 * CLI configuration
 */
export type CliConfig = {
  version: string;
  workspacePath: string;
  verbose: boolean;
  debug: boolean;
};

/**
 * Command interface
 */
export type Command = {
  name: string;
  description: string;
  usage: string;
  options: Record<string, string>;
  execute(args: string[], config: CliConfig): Promise<void>;
};

/**
 * Base command class
 */
export abstract class BaseCommand implements Command {
  abstract name: string;
  abstract description: string;
  abstract usage: string;
  abstract options: Record<string, string>;

  abstract execute(args: string[], config: CliConfig): Promise<void>;

  /**
   * Parse command arguments
   */
  protected parseArgs(
    args: string[],
    options: ParseArgsConfig['options']
  ): {
    values: Record<string, string | boolean | undefined>;
    positionals: string[];
  } {
    try {
      const result = parseArgs({
        args,
        allowPositionals: true,
        options,
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
        // TODO: Implement help display formatting
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

  protected parseOptions(args: string[]): Record<string, string | boolean> {
    const options: Record<string, string | boolean> = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg?.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      }
    }
    return options;
  }
}
