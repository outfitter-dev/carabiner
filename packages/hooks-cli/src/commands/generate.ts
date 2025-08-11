/**
 * Generate command - Creates new hooks and templates
 */

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseCommand, type CliConfig } from '../cli';

// Regex patterns at top level
const _SESSION_ID_REGEX = /^[a-zA-Z0-9-]+$/;
const _CURL_INJECTION_REGEX = /\$\(curl/;
const _BASE64_DECODE_REGEX = /base64.*decode/;
const _EVAL_SHELL_REGEX = /eval.*\$/;
const WORD_SPLIT_REGEX = /[-_\s]+/;

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
      this.showGenerateHelp();
      return;
    }

    const [type, name] = positionals;
    if (!(type && name)) {
      throw new Error(
        'Both type and name are required. Usage: generate <type> <name>'
      );
    }

    const useTypeScript = !this.getBooleanValue(values.javascript);
    const template = this.getStringValue(values.template, 'basic');
    const force = this.getBooleanValue(values.force);

    try {
      switch (type.toLowerCase()) {
        case 'hook':
          await this.generateHook(
            config.workspacePath,
            name,
            useTypeScript,
            template,
            force
          );
          break;
        case 'validator':
          await this.generateValidator(
            config.workspacePath,
            name,
            useTypeScript,
            force
          );
          break;
        case 'middleware':
          await this.generateMiddleware(
            config.workspacePath,
            name,
            useTypeScript,
            force
          );
          break;
        case 'test':
          await this.generateTest(
            config.workspacePath,
            name,
            useTypeScript,
            force
          );
          break;
        default:
          throw new Error(`Unknown generation type: ${type}`);
      }
    } catch (error) {
      throw new Error(
        `Generation failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Show additional help for generate command
   */
  private showGenerateHelp(): void {
    // TODO: Display generate-specific help and examples
  }

  /**
   * Generate a new hook file
   */
  private async generateHook(
    workspacePath: string,
    name: string,
    useTypeScript: boolean,
    template: string,
    force: boolean
  ): Promise<void> {
    const extension = useTypeScript ? 'ts' : 'js';
    const hooksDir = join(workspacePath, 'hooks');
    const filePath = join(hooksDir, `${name}.${extension}`);

    if (existsSync(filePath) && !force) {
      throw new Error(
        `File already exists: ${filePath}. Use --force to overwrite.`
      );
    }

    let content: string;
    switch (template) {
      case 'basic':
        content = this.getBasicHookTemplate(name, useTypeScript);
        break;
      case 'validation':
        content = this.getValidationHookTemplate(name, useTypeScript);
        break;
      case 'security':
        content = this.getSecurityHookTemplate(name, useTypeScript);
        break;
      default:
        throw new Error(`Unknown template: ${template}`);
    }

    await writeFile(filePath, content);
  }

  /**
   * Generate a custom validator
   */
  private async generateValidator(
    workspacePath: string,
    name: string,
    useTypeScript: boolean,
    force: boolean
  ): Promise<void> {
    const extension = useTypeScript ? 'ts' : 'js';
    const libDir = join(workspacePath, 'hooks', 'lib');
    const filePath = join(libDir, `${name}.${extension}`);

    if (existsSync(filePath) && !force) {
      throw new Error(
        `File already exists: ${filePath}. Use --force to overwrite.`
      );
    }

    const content = this.getValidatorTemplate(name, useTypeScript);
    await writeFile(filePath, content);
  }

  /**
   * Generate middleware
   */
  private async generateMiddleware(
    workspacePath: string,
    name: string,
    useTypeScript: boolean,
    force: boolean
  ): Promise<void> {
    const extension = useTypeScript ? 'ts' : 'js';
    const libDir = join(workspacePath, 'hooks', 'lib');
    const filePath = join(libDir, `${name}.${extension}`);

    if (existsSync(filePath) && !force) {
      throw new Error(
        `File already exists: ${filePath}. Use --force to overwrite.`
      );
    }

    const content = this.getMiddlewareTemplate(name, useTypeScript);
    await writeFile(filePath, content);
  }

  /**
   * Generate test file
   */
  private async generateTest(
    workspacePath: string,
    name: string,
    useTypeScript: boolean,
    force: boolean
  ): Promise<void> {
    const extension = useTypeScript ? 'ts' : 'js';
    const testDir = join(workspacePath, 'hooks', 'test');
    const filePath = join(testDir, `${name}.test.${extension}`);

    if (existsSync(filePath) && !force) {
      throw new Error(
        `File already exists: ${filePath}. Use --force to overwrite.`
      );
    }

    const content = this.getTestTemplate(name, useTypeScript);
    await writeFile(filePath, content);
  }

  /**
   * Get basic hook template
   */
  private getBasicHookTemplate(name: string, useTypeScript: boolean): string {
    if (useTypeScript) {
      return `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@claude-code/hooks-core';

async function handler(ctx: HookContext) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    console.log('Executing custom hook logic...');
    return HookResults.success('${name} hook completed successfully');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;
    }
    return `#!/usr/bin/env bun

const { runClaudeHook, HookResults } = require('@claude-code/hooks-core');

async function handler(ctx) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    console.log('Executing custom hook logic...');
    return HookResults.success('${name} hook completed successfully');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
  }

  /**
   * Get validation hook template
   */
  private getValidationHookTemplate(
    name: string,
    useTypeScript: boolean
  ): string {
    if (useTypeScript) {
      return `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@claude-code/hooks-core';
import { validateHookContext } from '@claude-code/hooks-validators';

async function handler(ctx: HookContext) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);

  try {
    // Validate hook context
    const validationResult = await validateHookContext(ctx);
    if (!validationResult.valid) {
      return HookResults.failure(
        \`Validation failed: \${validationResult.errors.map(e => e.message).join(', ')}\`
      );
    }

    // Custom validation logic
    const customValidation = await performCustomValidation(ctx);
    if (!customValidation.valid) {
      return HookResults.failure(customValidation.message);
    }

    return HookResults.success('${name} hook validation passed');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Validation error occurred'
    );
  }
}

/**
 * Perform custom validation logic
 */
async function performCustomValidation(context: HookContext): Promise<{ valid: boolean; message?: string }> {
  // Add your custom validation logic here
  
  // Example: Check tool name
  if (!context.toolName) {
    return { valid: false, message: 'Tool name is required' };
  }

  // Example: Validate environment
  if (!context.environment?.CLAUDE_PROJECT_DIR) {
    return { valid: false, message: 'Invalid project environment' };
  }

  return { valid: true };
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;
    }
    return `#!/usr/bin/env bun

const { runClaudeHook, HookResults } = require('@claude-code/hooks-core');
const { validateHookContext } = require('@claude-code/hooks-validators');

async function handler(ctx) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);

  try {
    // Validate hook context
    const validationResult = await validateHookContext(ctx);
    if (!validationResult.valid) {
      return HookResults.failure(
        \`Validation failed: \${validationResult.errors.map(e => e.message).join(', ')}\`
      );
    }

    // Custom validation logic
    const customValidation = await performCustomValidation(ctx);
    if (!customValidation.valid) {
      return HookResults.failure(customValidation.message);
    }

    return HookResults.success('${name} hook validation passed');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Validation error occurred'
    );
  }
}

/**
 * Perform custom validation logic
 */
async function performCustomValidation(context) {
  // Add your custom validation logic here
  
  // Example: Check tool name
  if (!context.toolName) {
    return { valid: false, message: 'Tool name is required' };
  }

  // Example: Validate environment
  if (!context.environment?.CLAUDE_PROJECT_DIR) {
    return { valid: false, message: 'Invalid project environment' };
  }

  return { valid: true };
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
  }

  /**
   * Get security hook template
   */
  private getSecurityHookTemplate(
    name: string,
    useTypeScript: boolean
  ): string {
    if (useTypeScript) {
      return `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@claude-code/hooks-core';
import { SecurityValidators } from '@claude-code/hooks-validators';

async function handler(ctx: HookContext) {
  console.log(\`🔒 ${name} security hook triggered for: \${ctx.toolName}\`);

  try {
    // Apply security validation based on environment
    const environment = Bun.env.NODE_ENV as 'development' | 'production' | 'test' || 'development';
    
    switch (environment) {
      case 'production':
        SecurityValidators.production(ctx);
        break;
      case 'development':
        SecurityValidators.development(ctx);
        break;
      default:
        SecurityValidators.strict(ctx);
    }

    // Additional custom security checks
    await performSecurityChecks(ctx);

    return HookResults.success(\`Security validation passed for \${ctx.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Security validation failed'
    );
  }
}

/**
 * Perform additional security checks
 */
async function performSecurityChecks(context: HookContext): Promise<void> {
  // Add your custom security logic here
  
  // Example: Check for suspicious patterns in bash commands
  if (context.toolName === 'Bash' && 'command' in context.toolInput) {
    const command = context.toolInput.command as string;
    const suspiciousPatterns = [
      /curl.*|.*sh/i,     // Piped curl to shell
      /base64.*-d/i,       // Base64 decoding
      /eval.*\\$\\(/i,        // Shell evaluation
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(command)) {
        throw new Error(\`Suspicious pattern detected in command\`);
      }
    }
  }

  // Example: Rate limiting check
  const rateLimitKey = \`\${context.sessionId}:\${context.toolName}\`;
  // Implement rate limiting logic here
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;
    }
    return `#!/usr/bin/env bun

const { runClaudeHook, HookResults } = require('@claude-code/hooks-core');
const { SecurityValidators } = require('@claude-code/hooks-validators');

async function handler(ctx) {
  console.log(\`🔒 ${name} security hook triggered for: \${ctx.toolName}\`);

  try {
    // Apply security validation based on environment
    const environment = process.env.NODE_ENV || 'development';
    
    switch (environment) {
      case 'production':
        SecurityValidators.production(ctx);
        break;
      case 'development':
        SecurityValidators.development(ctx);
        break;
      default:
        SecurityValidators.strict(ctx);
    }

    // Additional custom security checks
    await performSecurityChecks(ctx);

    return HookResults.success(\`Security validation passed for \${ctx.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Security validation failed'
    );
  }
}

/**
 * Perform additional security checks
 */
async function performSecurityChecks(context) {
  // Add your custom security logic here
  
  // Example: Check for suspicious patterns in bash commands
  if (context.toolName === 'Bash' && context.toolInput?.command) {
    const suspiciousPatterns = [
      /curl.*|.*sh/i,     // Piped curl to shell
      /base64.*-d/i,       // Base64 decoding
      /eval.*\\$\\(/i,        // Shell evaluation
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(context.toolInput.command)) {
        throw new Error(\`Suspicious pattern detected in command\`);
      }
    }
  }

  // Example: Rate limiting check
  const rateLimitKey = \`\${context.sessionId}:\${context.toolName}\`;
  // Implement rate limiting logic here
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
  }

  /**
   * Get validator template
   */
  private getValidatorTemplate(name: string, useTypeScript: boolean): string {
    if (useTypeScript) {
      return `/**
 * Custom validator: ${name}
 */

import type { HookContext, ValidationResult } from '@claude-code/hooks-core';
import { ValidationError } from '@claude-code/hooks-validators';

/**
 * ${this.pascalCase(name)} validator
 */
export class ${this.pascalCase(name)}Validator {
  /**
   * Validate hook context
   */
  static async validate(context: HookContext): Promise<ValidationResult> {
    const errors: Array<{ field?: string; message: string; code?: string }> = [];
    const warnings: Array<{ field?: string; message: string; code?: string }> = [];

    try {
      // Add your validation logic here
      await this.performValidation(context, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Validation error',
        code: 'VALIDATION_ERROR'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Perform the actual validation
   */
  private static async performValidation(
    context: HookContext,
    errors: Array<{ field?: string; message: string; code?: string }>,
    warnings: Array<{ field?: string; message: string; code?: string }>
  ): Promise<void> {
    // Example validation: Check session ID format
    if (!SESSION_ID_REGEX.test(context.sessionId)) {
      errors.push({
        field: 'sessionId',
        message: 'Session ID must be alphanumeric with dashes only',
        code: 'INVALID_SESSION_ID'
      });
    }

    // Example warning: Check workspace path length
    if (context.workspacePath.length > 200) {
      warnings.push({
        field: 'workspacePath',
        message: 'Workspace path is very long',
        code: 'LONG_WORKSPACE_PATH'
      });
    }

    // Add more validation logic as needed
  }

  /**
   * Quick validation that throws on error
   */
  static async validateOrThrow(context: HookContext): Promise<void> {
    const result = await this.validate(context);
    if (!result.valid) {
      throw new ValidationError(
        result.errors.map(e => e.message).join(', ')
      );
    }
  }
}

export default ${this.pascalCase(name)}Validator;
`;
    }
    return `/**
 * Custom validator: ${name}
 */

const { ValidationError } = require('@claude-code/hooks-validators');

/**
 * ${this.pascalCase(name)} validator
 */
class ${this.pascalCase(name)}Validator {
  /**
   * Validate hook context
   */
  static async validate(context) {
    const errors = [];
    const warnings = [];

    try {
      // Add your validation logic here
      await this.performValidation(context, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Validation error',
        code: 'VALIDATION_ERROR'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Perform the actual validation
   */
  static async performValidation(context, errors, warnings) {
    // Example validation: Check session ID format
    if (!SESSION_ID_REGEX.test(context.sessionId)) {
      errors.push({
        field: 'sessionId',
        message: 'Session ID must be alphanumeric with dashes only',
        code: 'INVALID_SESSION_ID'
      });
    }

    // Example warning: Check workspace path length
    if (context.workspacePath.length > 200) {
      warnings.push({
        field: 'workspacePath',
        message: 'Workspace path is very long',
        code: 'LONG_WORKSPACE_PATH'
      });
    }

    // Add more validation logic as needed
  }

  /**
   * Quick validation that throws on error
   */
  static async validateOrThrow(context) {
    const result = await this.validate(context);
    if (!result.valid) {
      throw new ValidationError(
        result.errors.map(e => e.message).join(', ')
      );
    }
  }
}

module.exports = { ${this.pascalCase(name)}Validator };
`;
  }

  /**
   * Get middleware template
   */
  private getMiddlewareTemplate(name: string, useTypeScript: boolean): string {
    if (useTypeScript) {
      return `/**
 * Custom middleware: ${name}
 */

import type { HookMiddleware, HookContext, HookResult } from '@claude-code/hooks-core';

/**
 * ${this.pascalCase(name)} middleware
 */
export function ${this.camelCase(name)}Middleware<T extends HookContext>(): HookMiddleware<T> {
  return async (context: T, next: (context: T) => Promise<HookResult>): Promise<HookResult> => {
    const startTime = Date.now();
    
    try {
      // Pre-processing logic
      console.log(\`[${name}] Starting middleware for \${context.event}:\${context.toolName}\`);
      
      // Add your pre-processing logic here
      await preProcess(context);

      // Execute next middleware or handler
      const result = await next(context);

      // Post-processing logic
      await postProcess(context, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Error handling
      console.error(\`[\${name}] Middleware error:\`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Middleware error',
        metadata: {
          duration: Date.now() - startTime,
          middleware: '${name}'
        }
      };
    }
  };
}

/**
 * Pre-processing logic
 */
async function preProcess(context: HookContext): Promise<void> {
  // Add your pre-processing logic here
  // Examples:
  // - Rate limiting
  // - Authentication checks
  // - Context enrichment
  // - Logging preparation
}

/**
 * Post-processing logic
 */
async function postProcess(
  context: HookContext,
  result: HookResult,
  duration: number
): Promise<void> {
  // Add your post-processing logic here
  // Examples:
  // - Metrics collection
  // - Audit logging
  // - Result transformation
  // - Cleanup tasks
  
  console.log(\`[${name}] Completed in \${duration}ms - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
}

export default ${this.camelCase(name)}Middleware;
`;
    }
    return `/**
 * Custom middleware: ${name}
 */

/**
 * ${this.pascalCase(name)} middleware
 */
function ${this.camelCase(name)}Middleware() {
  return async (context, next) => {
    const startTime = Date.now();
    
    try {
      // Pre-processing logic
      console.log(\`[${name}] Starting middleware for \${context.event}:\${context.toolName}\`);
      
      // Add your pre-processing logic here
      await preProcess(context);

      // Execute next middleware or handler
      const result = await next(context);

      // Post-processing logic
      await postProcess(context, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Error handling
      console.error(\`[\${name}] Middleware error:\`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Middleware error',
        metadata: {
          duration: Date.now() - startTime,
          middleware: '${name}'
        }
      };
    }
  };
}

/**
 * Pre-processing logic
 */
async function preProcess(context) {
  // Add your pre-processing logic here
  // Examples:
  // - Rate limiting
  // - Authentication checks
  // - Context enrichment
  // - Logging preparation
}

/**
 * Post-processing logic
 */
async function postProcess(context, result, duration) {
  // Add your post-processing logic here
  // Examples:
  // - Metrics collection
  // - Audit logging
  // - Result transformation
  // - Cleanup tasks
  
  console.log(\`[${name}] Completed in \${duration}ms - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
}

module.exports = { ${this.camelCase(name)}Middleware };
`;
  }

  /**
   * Get test template
   */
  private getTestTemplate(name: string, useTypeScript: boolean): string {
    if (useTypeScript) {
      return `import { test, expect, describe, beforeEach } from 'bun:test';
import { 
  createMockContext,
  createMockContextFor,
  TestUtils,
  mockEnv
} from '@claude-code/hooks-testing';
import { handle${this.pascalCase(name)} } from '../${name}.ts';

describe('${name} hook tests', () => {
  beforeEach(() => {
    // Clean up mock environment before each test
    mockEnv.restore();
  });

  test('should handle valid input successfully', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'echo "test"');
    
    // Act
    const result = await handle${this.pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain('${name}');
  });

  test('should handle errors gracefully', async () => {
    // Arrange - Create a context that might cause an error
    mockEnv.setup({
      sessionId: '', // Invalid session ID
      toolName: 'Bash',
      command: 'echo test'
    });
    
    // Act
    const result = await handle${this.pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  test('should complete within reasonable time', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'ls');
    
    // Act & Assert
    await TestUtils.waitFor(async () => {
      const result = await handle${this.pascalCase(name)}();
      expect(result.success).toBe(true);
      return result;
    }, 5000); // 5 second timeout
  });

  test('should handle different tool types', async () => {
    // Test with Write tool
    const writeContext = createMockContextFor.write('PreToolUse', 'test.txt', 'content');
    mockEnv.setup({
      sessionId: 'test-session',
      toolName: 'Write',
      toolInput: { file_path: 'test.txt', content: 'content' }
    });

    const writeResult = await handle${this.pascalCase(name)}();
    expect(writeResult.success).toBe(true);

    // Test with Edit tool
    const editContext = createMockContextFor.edit('PreToolUse', 'test.txt', 'old', 'new');
    mockEnv.setup({
      sessionId: 'test-session',
      toolName: 'Edit',
      toolInput: { file_path: 'test.txt', old_string: 'old', new_string: 'new' }
    });

    const editResult = await handle${this.pascalCase(name)}();
    expect(editResult.success).toBe(true);
  });

  // Add more specific tests based on your hook's functionality
  // Examples:
  // - Security validation tests
  // - Edge case handling
  // - Performance tests
  // - Integration tests
});
`;
    }
    return `const { test, expect, describe, beforeEach } = require('bun:test');
const { 
  createMockContext,
  createMockContextFor,
  TestUtils,
  mockEnv
} = require('@claude-code/hooks-testing');
const { handle${this.pascalCase(name)} } = require('../${name}.js');

describe('${name} hook tests', () => {
  beforeEach(() => {
    // Clean up mock environment before each test
    mockEnv.restore();
  });

  test('should handle valid input successfully', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'echo "test"');
    
    // Act
    const result = await handle${this.pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain('${name}');
  });

  test('should handle errors gracefully', async () => {
    // Arrange - Create a context that might cause an error
    mockEnv.setup({
      sessionId: '', // Invalid session ID
      toolName: 'Bash',
      command: 'echo test'
    });
    
    // Act
    const result = await handle${this.pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  test('should complete within reasonable time', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'ls');
    
    // Act & Assert
    await TestUtils.waitFor(async () => {
      const result = await handle${this.pascalCase(name)}();
      expect(result.success).toBe(true);
      return result;
    }, 5000); // 5 second timeout
  });

  // Add more specific tests based on your hook's functionality
});
`;
  }

  /**
   * Convert to PascalCase
   */
  private pascalCase(str: string): string {
    return str
      .split(WORD_SPLIT_REGEX)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert to camelCase
   */
  private camelCase(str: string): string {
    const pascalCased = this.pascalCase(str);
    return pascalCased.charAt(0).toLowerCase() + pascalCased.slice(1);
  }
}
