/**
 * Validator generator
 */

import { BaseGenerator } from './base-generator.js';
import { getTemplate } from '../templates/index.js';
import { getHooksLibDir, getFilePath } from '../utils/path-resolution.js';

export class ValidatorGenerator extends BaseGenerator {
  async generate(): Promise<void> {
    const templateFunction = getTemplate('validator', this.getLanguage());
    const content = templateFunction(this.options.name);
    
    const libDir = getHooksLibDir(this.options.workspacePath);
    const filePath = getFilePath(libDir, this.options.name, this.getExtension());

    await this.writeFile(filePath, content);
    
    console.log(`Generated validator: ${filePath}`);
  }
}