/**
 * @outfitter/hooks-cli
 * CLI tools for Claude Code hooks development
 */

// Export CLI class and main function
export { ClaudeHooksCli, main } from './cli';
export { ConfigCommand } from './commands/config';
export { GenerateCommand } from './commands/generate';
// Export individual commands
export { InitCommand } from './commands/init';
export { TestCommand } from './commands/test';
export { ValidateCommand } from './commands/validate';
export { BaseCommand, type CliConfig, type Command } from './types';

// Version export (prefer env; keep string type)
export const VERSION: string =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.npm_package_version) ||
  (typeof Bun !== 'undefined' && Bun.env && Bun.env.npm_package_version) ||
  '0.0.0';
