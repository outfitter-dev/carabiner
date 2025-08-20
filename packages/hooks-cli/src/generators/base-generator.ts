/**
 * Base generator class
 */

import {
  type FileWriteOptions,
  writeFileWithChecks,
} from '../utils/file-operations.js';

export type GeneratorOptions = {
  workspacePath: string;
  name: string;
  useTypeScript: boolean;
  force: boolean;
};

export abstract class BaseGenerator {
  protected readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate the file
   */
  abstract generate(): Promise<void>;

  /**
   * Get the file extension
   */
  protected getExtension(): string {
    return this.options.useTypeScript ? 'ts' : 'js';
  }

  /**
   * Get the language key
   */
  protected getLanguage(): 'typescript' | 'javascript' {
    return this.options.useTypeScript ? 'typescript' : 'javascript';
  }

  /**
   * Write file with standard options
   */
  protected async writeFile(filePath: string, content: string): Promise<void> {
    const writeOptions: FileWriteOptions = {
      force: this.options.force,
      createDirs: true,
    };

    await writeFileWithChecks(filePath, content, writeOptions);
  }
}
