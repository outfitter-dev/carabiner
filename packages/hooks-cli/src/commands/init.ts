/**
 * Initialize command - Sets up Claude Code hooks in a project
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '@outfitter/hooks-config';
import { BaseCommand, type CliConfig } from '../cli';

export class InitCommand extends BaseCommand {
  name = 'init';
  description = 'Initialize Claude Code hooks in your project';
  usage = 'init [options]';
  options = {
    '--typescript, -t': 'Generate TypeScript hooks (default)',
    '--javascript, -j': 'Generate JavaScript hooks',
    '--template': 'Template to use (basic, advanced, security)',
    '--force, -f': 'Overwrite existing files',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values } = this.parseArgs(args, {
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

    const useTypeScript = !this.getBooleanValue(values.javascript);
    const template = this.getStringValue(values.template, 'basic');
    const force = this.getBooleanValue(values.force);

    try {
      await this.createDirectoryStructure(config.workspacePath, force);
      await this.createConfiguration(config.workspacePath, force);
      await this.createHookFiles(
        config.workspacePath,
        useTypeScript,
        template,
        force
      );
      await this.createPackageScripts(config.workspacePath, force);
      await this.createGitignore(config.workspacePath, force);
    } catch (error) {
      throw new Error(
        `Initialization failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Create directory structure
   */
  private async createDirectoryStructure(
    workspacePath: string,
    _force: boolean
  ): Promise<void> {
    const directories = ['.claude', 'hooks', 'hooks/lib', 'hooks/test'];

    // Create directories in parallel
    const dirCreationPromises = directories.map(async (dir) => {
      const dirPath = join(workspacePath, dir);
      if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
      }
    });

    await Promise.all(dirCreationPromises);
  }

  /**
   * Create configuration files
   */
  private async createConfiguration(
    workspacePath: string,
    force: boolean
  ): Promise<void> {
    // Create hooks configuration
    const configPath = join(workspacePath, '.claude', 'hooks.json');
    if (!existsSync(configPath) || force) {
      await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }

    // Create Claude settings
    const settingsPath = join(workspacePath, '.claude', 'settings.json');
    if (!existsSync(settingsPath) || force) {
      const settings = {
        hooks: {
          PreToolUse: {
            Bash: {
              command: 'bun run hooks/pre-tool-use.ts',
              timeout: 5000,
            },
            Write: {
              command: 'bun run hooks/pre-tool-use.ts',
              timeout: 3000,
            },
            Edit: {
              command: 'bun run hooks/pre-tool-use.ts',
              timeout: 3000,
            },
          },
          PostToolUse: {
            Write: {
              command: 'bun run hooks/post-tool-use.ts',
              timeout: 30_000,
            },
            Edit: {
              command: 'bun run hooks/post-tool-use.ts',
              timeout: 30_000,
            },
          },
          SessionStart: {
            command: 'bun run hooks/session-start.ts',
            timeout: 10_000,
          },
        },
      };

      await writeFile(settingsPath, JSON.stringify(settings, null, 2));
    }
  }

  /**
   * Create hook files
   */
  private async createHookFiles(
    workspacePath: string,
    useTypeScript: boolean,
    template: string,
    force: boolean
  ): Promise<void> {
    const extension = useTypeScript ? 'ts' : 'js';
    const hooksDir = join(workspacePath, 'hooks');

    // Create lib files
    await this.createLibFiles(hooksDir, extension, force);

    // Create hook files based on template
    switch (template) {
      case 'basic':
        await this.createBasicHooks(hooksDir, extension, force);
        break;
      case 'advanced':
        await this.createAdvancedHooks(hooksDir, extension, force);
        break;
      case 'security':
        await this.createSecurityHooks(hooksDir, extension, force);
        break;
      default:
        throw new Error(`Unknown template: ${template}`);
    }

    // Create test files
    await this.createTestFiles(hooksDir, extension, force);
  }

  /**
   * Create library files
   */
  private async createLibFiles(
    hooksDir: string,
    extension: string,
    force: boolean
  ): Promise<void> {
    const libDir = join(hooksDir, 'lib');

    // Create types file
    const typesContent = (useTypeScript: boolean) =>
      useTypeScript
        ? `
export * from '@outfitter/hooks-core';
export * from '@outfitter/hooks-validators';
export * from '@outfitter/hooks-config';

// Custom types for your hooks
export interface CustomHookData {
  timestamp: string;
  user?: string;
  metadata?: Record<string, unknown>;
}
`
        : `
// Custom types and utilities for your hooks
module.exports = {
  // Add your custom utilities here
};
`;

    const typesPath = join(libDir, `types.${extension}`);
    if (!existsSync(typesPath) || force) {
      await writeFile(typesPath, typesContent(extension === 'ts'));
    }

    // Create utils file
    const utilsContent =
      extension === 'ts'
        ? `
import type { HookContext, HookResult } from './types.ts';

/**
 * Common utilities for hooks
 */
export const HookUtils = {
  /**
   * Create timestamp
   */
  timestamp(): string {
    return new Date().toISOString();
  },

  /**
   * Log hook execution
   */
  logExecution(context: HookContext, result: HookResult): void {
    const timestamp = this.timestamp();
    console.log(\`[\${timestamp}] \${context.event}:\${context.toolName} - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
  },

  /**
   * Check if running in CI
   */
  isCI(): boolean {
    return Boolean(Bun.env.CI);
  },

  /**
   * Get current user
   */
  getCurrentUser(): string {
    return Bun.env.USER || Bun.env.USERNAME || 'unknown';
  }
};
`
        : `
/**
 * Common utilities for hooks
 */
const HookUtils = {
  /**
   * Create timestamp
   */
  timestamp() {
    return new Date().toISOString();
  },

  /**
   * Log hook execution
   */
  logExecution(context, result) {
    const timestamp = this.timestamp();
    console.log(\`[\${timestamp}] \${context.event}:\${context.toolName} - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
  },

  /**
   * Check if running in CI
   */
  isCI() {
    return Boolean(process.env.CI);
  },

  /**
   * Get current user
   */
  getCurrentUser() {
    return process.env.USER || process.env.USERNAME || 'unknown';
  }
};

module.exports = { HookUtils };
`;

    const utilsPath = join(libDir, `utils.${extension}`);
    if (!existsSync(utilsPath) || force) {
      await writeFile(utilsPath, utilsContent);
    }
  }

  /**
   * Create basic hook files
   */
  private async createBasicHooks(
    hooksDir: string,
    extension: string,
    force: boolean
  ): Promise<void> {
    const hooks = [
      {
        name: 'pre-tool-use',
        content: this.getBasicPreToolUseHook(extension === 'ts'),
      },
      {
        name: 'post-tool-use',
        content: this.getBasicPostToolUseHook(extension === 'ts'),
      },
      {
        name: 'session-start',
        content: this.getBasicSessionStartHook(extension === 'ts'),
      },
    ];

    // Write hook files in parallel
    const hookWritePromises = hooks.map(async (hook) => {
      const filePath = join(hooksDir, `${hook.name}.${extension}`);
      if (!existsSync(filePath) || force) {
        await writeFile(filePath, hook.content);
      }
    });

    await Promise.all(hookWritePromises);
  }

  /**
   * Create advanced hook files
   */
  private async createAdvancedHooks(
    hooksDir: string,
    extension: string,
    force: boolean
  ): Promise<void> {
    // Implementation for advanced hooks with more features
    await this.createBasicHooks(hooksDir, extension, force);

    // Add advanced features file
    const advancedContent =
      extension === 'ts'
        ? `
import { HookBuilder, middleware } from '@outfitter/hooks-core';
import { SecurityValidators } from '@outfitter/hooks-validators';

// Example of advanced hook composition
export const advancedPreToolUse = HookBuilder
  .forPreToolUse()
  .withMiddleware(middleware.logging())
  .withMiddleware(middleware.timing())
  .withHandler(async (context) => {
    // Advanced validation logic
    SecurityValidators.strict(context);
    
    return { success: true, message: 'Advanced validation passed' };
  })
  .build();
`
        : `
// Advanced hook composition example
// Requires @outfitter/hooks-core and @outfitter/hooks-validators
`;

    const advancedPath = join(hooksDir, `advanced.${extension}`);
    if (!existsSync(advancedPath) || force) {
      await writeFile(advancedPath, advancedContent);
    }
  }

  /**
   * Create security-focused hook files
   */
  private async createSecurityHooks(
    hooksDir: string,
    extension: string,
    force: boolean
  ): Promise<void> {
    await this.createBasicHooks(hooksDir, extension, force);

    const securityContent =
      extension === 'ts'
        ? `
import { SecurityValidators, validateHookSecurity } from '@outfitter/hooks-validators';
import type { HookContext, HookResult } from '@outfitter/hooks-core';

/**
 * Security-focused hook handler
 */
export async function securityHookHandler(context: HookContext): Promise<HookResult> {
  try {
    // Apply strict security validation
    validateHookSecurity(context, {
      env: 'production',
      strictMode: true
    });

    return { 
      success: true, 
      message: 'Security validation passed',
      data: { 
        securityLevel: 'strict',
        validatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      block: true,
      message: \`Security validation failed: \${error instanceof Error ? error.message : 'Unknown error'}\`
    };
  }
}
`
        : `
// Security-focused hook handlers
// Requires @outfitter/hooks-validators
`;

    const securityPath = join(hooksDir, `security.${extension}`);
    if (!existsSync(securityPath) || force) {
      await writeFile(securityPath, securityContent);
    }
  }

  /**
   * Create test files
   */
  private async createTestFiles(
    hooksDir: string,
    extension: string,
    force: boolean
  ): Promise<void> {
    const testDir = join(hooksDir, 'test');

    const testContent =
      extension === 'ts'
        ? `
import { test, expect } from 'bun:test';
import { createMockContextFor, TestUtils } from '@outfitter/hooks-testing';
import { handlePreToolUse } from '../pre-tool-use.ts';

test('PreToolUse hook should validate safe commands', async () => {
  const context = createMockContextFor.bash('PreToolUse', 'echo "Hello World"');
  const result = await handlePreToolUse(context);
  
  expect(result.success).toBe(true);
  expect(result.block).toBeUndefined();
});

test('PreToolUse hook should block dangerous commands', async () => {
  const context = createMockContextFor.bash('PreToolUse', 'rm -rf /');
  const result = await handlePreToolUse(context);
  
  expect(result.success).toBe(false);
  expect(result.block).toBe(true);
});
`
        : `
// Test file for hooks
// Requires @outfitter/hooks-testing and bun:test
const { test, expect } = require('bun:test');
// Add your tests here
`;

    const testPath = join(testDir, `hooks.test.${extension}`);
    if (!existsSync(testPath) || force) {
      await writeFile(testPath, testContent);
    }
  }

  /**
   * Create or update package.json scripts
   */
  private async createPackageScripts(
    workspacePath: string,
    force: boolean
  ): Promise<void> {
    const packagePath = join(workspacePath, 'package.json');

    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(
        await readFileContent(packagePath, 'utf-8')
      );

      const scripts = packageJson.scripts || {};
      const newScripts = {
        'hooks:test': 'bun test hooks/test/',
        'hooks:validate': 'claude-hooks validate',
        'hooks:debug': 'bun run hooks/debug.ts',
      };

      let hasChanges = false;
      for (const [key, value] of Object.entries(newScripts)) {
        if (!scripts[key] || force) {
          scripts[key] = value;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        packageJson.scripts = scripts;
        await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      }
    }
  }

  /**
   * Create or update .gitignore
   */
  private async createGitignore(
    workspacePath: string,
    force: boolean
  ): Promise<void> {
    const gitignorePath = join(workspacePath, '.gitignore');
    const hookEntries = [
      '',
      '# Claude Code Hooks',
      '.claude/logs/',
      'hooks/temp/',
      'hooks/*.log',
    ].join('\n');

    if (existsSync(gitignorePath)) {
      const content = await readFileContent(gitignorePath, 'utf-8');
      if (!content.includes('# Claude Code Hooks') || force) {
        await writeFile(gitignorePath, `${content}\n${hookEntries}`);
      }
    } else {
      await writeFile(gitignorePath, hookEntries);
    }
  }

  /**
   * Get basic PreToolUse hook template
   */
  private getBasicPreToolUseHook(isTypeScript: boolean): string {
    if (isTypeScript) {
      return `#!/usr/bin/env bun

import { createHookContext, exitWithResult, HookResults } from '@outfitter/hooks-core';
import { validateHookSecurity } from '@outfitter/hooks-validators';
import type { HookResult } from '@outfitter/hooks-core';

/**
 * PreToolUse hook - validates tool usage before execution
 */
async function handlePreToolUse(): Promise<HookResult> {
  const context = createHookContext('PreToolUse');
  
  console.log(\`PreToolUse hook triggered for: \${context.toolName}\`);

  try {
    // Basic security validation
    validateHookSecurity(context, {
      env: Bun.env.NODE_ENV as any || 'development'
    });

    return HookResults.success(\`Validation passed for \${context.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Validation failed'
    );
  }
}

// Main execution
if (import.meta.main) {
  handlePreToolUse()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

export { handlePreToolUse };
`;
    }
    return `#!/usr/bin/env bun

const { createHookContext, exitWithResult, HookResults } = require('@outfitter/hooks-core');
const { validateHookSecurity } = require('@outfitter/hooks-validators');

/**
 * PreToolUse hook - validates tool usage before execution
 */
async function handlePreToolUse() {
  const context = createHookContext('PreToolUse');
  
  console.log(\`PreToolUse hook triggered for: \${context.toolName}\`);

  try {
    // Basic security validation
    validateHookSecurity(context, {
      env: process.env.NODE_ENV || 'development'
    });

    return HookResults.success(\`Validation passed for \${context.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Validation failed'
    );
  }
}

// Main execution
if (require.main === module) {
  handlePreToolUse()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

module.exports = { handlePreToolUse };
`;
  }

  /**
   * Get basic PostToolUse hook template
   */
  private getBasicPostToolUseHook(isTypeScript: boolean): string {
    if (isTypeScript) {
      return `#!/usr/bin/env bun

import { createHookContext, exitWithResult, HookResults } from '@outfitter/hooks-core';
import type { HookResult } from '@outfitter/hooks-core';

/**
 * PostToolUse hook - performs actions after tool execution
 */
async function handlePostToolUse(): Promise<HookResult> {
  const context = createHookContext('PostToolUse');
  
  console.log(\`PostToolUse hook triggered for: \${context.toolName}\`);

  // Log the tool execution
  const timestamp = new Date().toISOString();
  console.log(\`[\${timestamp}] Tool \${context.toolName} executed\`);

  return HookResults.success('Post-tool processing completed');
}

// Main execution
if (import.meta.main) {
  handlePostToolUse()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

export { handlePostToolUse };
`;
    }
    return `#!/usr/bin/env bun

const { createHookContext, exitWithResult, HookResults } = require('@outfitter/hooks-core');

/**
 * PostToolUse hook - performs actions after tool execution
 */
async function handlePostToolUse() {
  const context = createHookContext('PostToolUse');
  
  console.log(\`PostToolUse hook triggered for: \${context.toolName}\`);

  // Log the tool execution
  const timestamp = new Date().toISOString();
  console.log(\`[\${timestamp}] Tool \${context.toolName} executed\`);

  return HookResults.success('Post-tool processing completed');
}

// Main execution
if (require.main === module) {
  handlePostToolUse()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

module.exports = { handlePostToolUse };
`;
  }

  /**
   * Get basic SessionStart hook template
   */
  private getBasicSessionStartHook(isTypeScript: boolean): string {
    if (isTypeScript) {
      return `#!/usr/bin/env bun

import { createHookContext, exitWithResult, HookResults } from '@outfitter/hooks-core';
import type { HookResult } from '@outfitter/hooks-core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SessionStart hook - runs when a new Claude session starts
 */
async function handleSessionStart(): Promise<HookResult> {
  const context = createHookContext('SessionStart');
  
  console.log(\`🚀 Claude session started: \${context.sessionId}\`);
  console.log(\`📁 Workspace: \${context.workspacePath}\`);

  // Display project information
  await displayProjectInfo(context.workspacePath);

  return HookResults.success('Session initialized successfully');
}

/**
 * Display basic project information
 */
async function displayProjectInfo(workspacePath: string): Promise<void> {
  const packagePath = join(workspacePath, 'package.json');
  
  if (existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(await Bun.file(packagePath).text());
      console.log(\`📦 Project: \${packageJson.name || 'Unknown'} v\${packageJson.version || '0.0.0'}\`);
      
      if (packageJson.description) {
        console.log(\`📝 Description: \${packageJson.description}\`);
      }
    } catch (error) {
      console.warn('Could not read package.json');
    }
  }
}

// Main execution
if (import.meta.main) {
  handleSessionStart()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

export { handleSessionStart };
`;
    }
    return `#!/usr/bin/env bun

const { createHookContext, exitWithResult, HookResults } = require('@outfitter/hooks-core');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * SessionStart hook - runs when a new Claude session starts
 */
async function handleSessionStart() {
  const context = createHookContext('SessionStart');
  
  console.log(\`🚀 Claude session started: \${context.sessionId}\`);
  console.log(\`📁 Workspace: \${context.workspacePath}\`);

  // Display project information
  await displayProjectInfo(context.workspacePath);

  return HookResults.success('Session initialized successfully');
}

/**
 * Display basic project information
 */
async function displayProjectInfo(workspacePath) {
  const packagePath = join(workspacePath, 'package.json');
  
  if (existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      console.log(\`📦 Project: \${packageJson.name || 'Unknown'} v\${packageJson.version || '0.0.0'}\`);
      
      if (packageJson.description) {
        console.log(\`📝 Description: \${packageJson.description}\`);
      }
    } catch (error) {
      console.warn('Could not read package.json');
    }
  }
}

// Main execution
if (require.main === module) {
  handleSessionStart()
    .then(exitWithResult)
    .catch((error) => {
      console.error('Hook execution failed:', error);
      process.exit(1);
    });
}

module.exports = { handleSessionStart };
`;
  }
}

// Helper function to read files
async function readFileContent(
  path: string,
  encoding: string
): Promise<string> {
  const { readFile: fsReadFile } = await import('node:fs/promises');
  return fsReadFile(path, encoding as BufferEncoding);
}
