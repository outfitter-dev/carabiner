/**
 * Hook generator
 */

import { BaseGenerator, type GeneratorOptions } from './base-generator.js';
import { getTemplate, type HookTemplateVariant } from '../templates/index.js';
import { getHooksDir, getFilePath } from '../utils/path-resolution.js';

export interface HookGeneratorOptions extends GeneratorOptions {
  template: HookTemplateVariant;
}

export class HookGenerator extends BaseGenerator {
  private readonly template: HookTemplateVariant;

  constructor(options: HookGeneratorOptions) {
    super(options);
    this.template = options.template;
  }

  async generate(): Promise<void> {
    const templateFunction = getTemplate('hook', this.getLanguage(), this.template);
    const content = templateFunction(this.options.name);
    
    const hooksDir = getHooksDir(this.options.workspacePath);
    const filePath = getFilePath(hooksDir, this.options.name, this.getExtension());

    await this.writeFile(filePath, content);
    
    console.log(`Generated ${this.template} hook: ${filePath}`);
  }
}