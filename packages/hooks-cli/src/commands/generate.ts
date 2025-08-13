/**
 * Generate command - Creates new hooks and templates
 */

import { BaseCommand, type CliConfig } from '../cli.js';
import {
  type GeneratorOptions,
  HookGenerator,
  type HookGeneratorOptions,
  MiddlewareGenerator,
  TestGenerator,
  ValidatorGenerator,
} from '../generators/index.js';
import type { HookTemplateVariant } from '../templates/index.js';

export class GenerateCommand extends BaseCommand {
  name = 'generate';
  description = 'Generate new hook files and templates';
  usage = 'generate <type> <name> [options]';
  options = {
    '--typescript, -t': 'Generate TypeScript file (default)',
    '--javascript, -j': 'Generate JavaScript file',
    '--template': 'Template to use (basic, validation, security)',
    '--force, -f': 'Overwrite existing files',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values, positionals } = this.parseArgs(args, {
      help: { type: 'boolean', short: 'h' },
      typescript: { type: 'boolean', short: 't', default: true },
      javascript: { type: 'boolean', short: 'j' },
      template: { type: 'string', default: 'basic' },
      force: { type: 'boolean', short: 'f' },
    });

    if (values.help) {
      this.showHelp();
      return;
    }

    const [type, name] = positionals;
    if (!(type && name)) {
      throw new Error(
        'Both type and name are required. Usage: generate <type> <name>'
      );
    }

    const baseOptions: GeneratorOptions = {
      workspacePath: config.workspacePath,
      name,
      useTypeScript: !this.getBooleanValue(values.javascript),
      force: this.getBooleanValue(values.force),
    };

    const template = this.getStringValue(values.template);
    const generator = this.createGenerator(
      type.toLowerCase(),
      baseOptions,
      template
    );
    await generator.generate();
  }

  private createGenerator(
    type: string,
    baseOptions: GeneratorOptions,
    template?: string
  ) {
    switch (type) {
      case 'hook': {
        const hookOptions: HookGeneratorOptions = {
          ...baseOptions,
          template: (template as HookTemplateVariant) || 'basic',
        };
        return new HookGenerator(hookOptions);
      }
      case 'validator':
        return new ValidatorGenerator(baseOptions);
      case 'middleware':
        return new MiddlewareGenerator(baseOptions);
      case 'test':
        return new TestGenerator(baseOptions);
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }
  }
}
