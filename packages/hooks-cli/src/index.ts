/**
 * @claude-code/hooks-cli
 * CLI tools for Claude Code hooks development
 */

// Export CLI class and main function
export { BaseCommand, ClaudeHooksCli, main } from './cli';
export { ConfigCommand } from './commands/config';
export { GenerateCommand } from './commands/generate';
// Export individual commands
export { InitCommand } from './commands/init';
export { TestCommand } from './commands/test';
export { ValidateCommand } from './commands/validate';

// Version export (derived from package.json)
import pkg from '../package.json' with { type: 'json' };
export const VERSION = pkg.version as string;
