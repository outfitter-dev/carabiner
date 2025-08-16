/**
 * Middleware generator
 */

import { getTemplate } from '../templates/index.js';
import { getFilePath, getHooksLibDir } from '../utils/path-resolution.js';
import { BaseGenerator } from './base-generator.js';

export class MiddlewareGenerator extends BaseGenerator {
  async generate(): Promise<void> {
    const templateFunction = getTemplate('middleware', this.getLanguage());
    const content = templateFunction(this.options.name);

    const libDir = getHooksLibDir(this.options.workspacePath);
    const filePath = getFilePath(
      libDir,
      this.options.name,
      this.getExtension()
    );

    await this.writeFile(filePath, content);
  }
}
