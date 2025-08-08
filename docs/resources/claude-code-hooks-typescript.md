# Claude Code Hooks: TypeScript Implementation Guide

This guide provides detailed instructions and examples for implementing Claude Code hooks using TypeScript and Bun, following the project's conventions.

## Table of Contents

1. [Project Setup](#project-setup)
2. [Hook Development Environment](#hook-development-environment)
3. [TypeScript Hook Templates](#typescript-hook-templates)
4. [Advanced Implementation Patterns](#advanced-implementation-patterns)
5. [Testing and Debugging](#testing-and-debugging)
6. [Project Integration](#project-integration)

## Project Setup

### Directory Structure

Create a dedicated hooks directory in your project:

```
project-root/
├── hooks/
│   ├── lib/
│   │   ├── types.ts
│   │   ├── context.ts
│   │   └── validators.ts
│   ├── pre-tool-use.ts
│   ├── post-tool-use.ts
│   ├── session-start.ts
│   └── user-prompt-submit.ts
├── .claude/
│   └── settings.json
└── package.json
```

### TypeScript Configuration

Ensure your `tsconfig.json` supports hook development:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["bun-types"]
  },
  "include": ["hooks/**/*"]
}
```

### Package Dependencies

Add necessary dependencies for hook development:

```json
{
  "devDependencies": {
    "@types/bun": "latest",
    "@biomejs/biome": "latest"
  }
}
```

## Hook Development Environment

### Base Types and Interfaces

Create `hooks/lib/types.ts`:

```typescript
// Hook event types
export type HookEvent = 
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'Stop'
  | 'SubagentStop';

// Tool names from Claude Code
export type ToolName =
  | 'Bash'
  | 'Edit'
  | 'Write'
  | 'Read'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'Task'
  | 'WebFetch'
  | 'Search'
  | 'Git'
  | 'Make'
  | string; // Tool set evolves - allow for additional tools

// Environment variables provided by Claude Code (v0.4.x)
export interface HookEnvironment {
  CLAUDE_SESSION_ID?: string;
  CLAUDE_TOOL_NAME?: string;        // Empty in SessionStart
  CLAUDE_WORKSPACE_PATH?: string;
  TOOL_INPUT?: string;              // JSON string of tool parameters
  TOOL_OUTPUT?: string;             // Only in PostToolUse, ≤32kB, not in detached hooks
  USER_PROMPT?: string;             // Only in UserPromptSubmit
}

// Parsed tool input types
export interface BashToolInput {
  command: string;
  description?: string;
  timeout?: number;
}

export interface WriteToolInput {
  file_path: string;
  content: string;
}

export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface ReadToolInput {
  file_path: string;
  limit?: number;
  offset?: number;
}

export type ToolInput = 
  | BashToolInput
  | WriteToolInput
  | EditToolInput
  | ReadToolInput
  | Record<string, unknown>;

// Hook context
export interface HookContext {
  event: HookEvent;
  sessionId: string;
  toolName: ToolName;
  workspacePath: string;
  toolInput: ToolInput;
  toolOutput?: string;
  userPrompt?: string;
  environment: HookEnvironment;
}

// Hook result
export interface HookResult {
  success: boolean;
  message?: string;
  block?: boolean; // For PreToolUse hooks
  data?: Record<string, unknown>;
}
```

### Context Parser

Create `hooks/lib/context.ts`:

```typescript
import type { HookContext, HookEvent, ToolInput, HookEnvironment } from './types.ts';

export function parseHookEnvironment(): HookEnvironment {
  return {
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    CLAUDE_TOOL_NAME: process.env.CLAUDE_TOOL_NAME,
    CLAUDE_WORKSPACE_PATH: process.env.CLAUDE_WORKSPACE_PATH,
    TOOL_INPUT: process.env.TOOL_INPUT,
    TOOL_OUTPUT: process.env.TOOL_OUTPUT,
    USER_PROMPT: process.env.USER_PROMPT,
  };
}

export function parseToolInput(inputStr?: string): ToolInput {
  if (!inputStr) return {};
  
  try {
    return JSON.parse(inputStr) as ToolInput;
  } catch (error) {
    console.error('Failed to parse TOOL_INPUT:', error);
    return {};
  }
}

export function createHookContext(event: HookEvent): HookContext {
  const env = parseHookEnvironment();
  
  return {
    event,
    sessionId: env.CLAUDE_SESSION_ID || '',
    toolName: env.CLAUDE_TOOL_NAME || '',
    workspacePath: env.CLAUDE_WORKSPACE_PATH || process.cwd(),
    toolInput: parseToolInput(env.TOOL_INPUT),
    toolOutput: env.TOOL_OUTPUT,
    userPrompt: env.USER_PROMPT,
    environment: env,
  };
}

// Type guards for tool inputs
export function isBashToolInput(input: ToolInput): input is BashToolInput {
  return typeof input === 'object' && input !== null && 'command' in input;
}

export function isWriteToolInput(input: ToolInput): input is WriteToolInput {
  return typeof input === 'object' && input !== null && 
         'file_path' in input && 'content' in input;
}

export function isEditToolInput(input: ToolInput): input is EditToolInput {
  return typeof input === 'object' && input !== null && 
         'file_path' in input && 'old_string' in input && 'new_string' in input;
}

export function isReadToolInput(input: ToolInput): input is ReadToolInput {
  return typeof input === 'object' && input !== null && 'file_path' in input;
}
```

### Validation Utilities

Create `hooks/lib/validators.ts`:

```typescript
import { existsSync, statSync } from 'fs';
import { resolve, extname } from 'path';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Command validation
export function validateBashCommand(command: string): void {
  // Dangerous patterns to block
  const dangerousPatterns = [
    /rm\s+-rf\s+(\/|\$HOME|\~)/,  // Dangerous rm commands
    /sudo\s+(rm|dd|mkfs)/,        // Dangerous sudo commands
    />\s*\/dev\/(sda|sdb|hda)/,   // Direct disk writes
    /chmod\s+777/,                // Overly permissive permissions
    /curl.*\|\s*(sh|bash)/,       // Pipe curl to shell
    /wget.*\|\s*(sh|bash)/,       // Pipe wget to shell
  ];

  const blocked = dangerousPatterns.find(pattern => pattern.test(command));
  if (blocked) {
    throw new ValidationError(`Blocked dangerous command pattern: ${blocked.source}`);
  }

  // Additional checks for production environment
  if (process.env.NODE_ENV === 'production') {
    const productionBlocked = [
      /npm\s+publish/,
      /git\s+push.*origin.*main/,
      /docker\s+push/,
    ];

    const prodBlocked = productionBlocked.find(pattern => pattern.test(command));
    if (prodBlocked) {
      throw new ValidationError(`Blocked production command: ${prodBlocked.source}`);
    }
  }
}

// File path validation
export function validateFilePath(filePath: string, workspacePath: string): void {
  const resolved = resolve(workspacePath, filePath);
  
  // Ensure file is within workspace
  if (!resolved.startsWith(workspacePath)) {
    throw new ValidationError(`File path outside workspace: ${filePath}`);
  }

  // Block sensitive files
  const sensitivePatterns = [
    /\.env\.production$/,
    /\.secrets$/,
    /private.*key$/,
    /\.p12$/,
    /\.pem$/,
  ];

  const sensitive = sensitivePatterns.find(pattern => pattern.test(filePath));
  if (sensitive) {
    throw new ValidationError(`Cannot modify sensitive file: ${filePath}`);
  }
}

// File content validation
export function validateFileContent(content: string, filePath: string): void {
  const ext = extname(filePath);
  
  // Check for secrets in content
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,
    /password\s*[:=]\s*["']?[^\s"']{8,}["']?/i,
    /secret\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,
    /token\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,
  ];

  const foundSecret = secretPatterns.find(pattern => pattern.test(content));
  if (foundSecret) {
    throw new ValidationError('Content contains potential secrets');
  }

  // TypeScript/JavaScript specific validations
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    // Check for dangerous JavaScript patterns
    if (content.includes('eval(') || content.includes('Function(')) {
      throw new ValidationError('Code contains potentially dangerous eval/Function calls');
    }
  }
}
```

## TypeScript Hook Templates

### PreToolUse Hook Template

Create `hooks/pre-tool-use.ts`:

```typescript
#!/usr/bin/env bun

import { createHookContext, isBashToolInput, isWriteToolInput } from './lib/context.ts';
import { validateBashCommand, validateFilePath, ValidationError } from './lib/validators.ts';
import type { HookResult } from './lib/types.ts';

async function handlePreToolUse(): Promise<HookResult> {
  const context = createHookContext('PreToolUse');
  
  console.log(`PreToolUse hook triggered for: ${context.toolName}`);

  try {
    switch (context.toolName) {
      case 'Bash':
        return await handleBashPreHook(context);
      
      case 'Write':
      case 'Edit':
        return await handleFilePreHook(context);
      
      default:
        return { success: true, message: `No validation needed for ${context.toolName}` };
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        block: true,
        message: error.message,
      };
    }
    
    console.error('Unexpected error in PreToolUse hook:', error);
    return {
      success: false,
      block: true,
      message: 'Hook execution failed',
    };
  }
}

async function handleBashPreHook(context: HookContext): Promise<HookResult> {
  if (!isBashToolInput(context.toolInput)) {
    return { success: false, block: true, message: 'Invalid Bash tool input' };
  }

  validateBashCommand(context.toolInput.command);
  
  return {
    success: true,
    message: `Bash command validated: ${context.toolInput.command.slice(0, 50)}...`,
  };
}

async function handleFilePreHook(context: HookContext): Promise<HookResult> {
  if (!isWriteToolInput(context.toolInput)) {
    return { success: false, block: true, message: 'Invalid file operation input' };
  }

  validateFilePath(context.toolInput.file_path, context.workspacePath);
  
  return {
    success: true,
    message: `File operation validated: ${context.toolInput.file_path}`,
  };
}

// Main execution
async function main(): Promise<void> {
  const result = await handlePreToolUse();
  
  if (!result.success) {
    console.error(`Hook failed: ${result.message}`);
    process.exit(result.block ? 1 : 0);
  }
  
  console.log(`Hook succeeded: ${result.message || 'OK'}`);
  process.exit(0);
}

// Execute if run directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Hook execution failed:', error);
    process.exit(1);
  });
}

export { handlePreToolUse };
```

### PostToolUse Hook Template

Create `hooks/post-tool-use.ts`:

```typescript
#!/usr/bin/env bun

import { createHookContext, isWriteToolInput, isEditToolInput } from './lib/context.ts';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { extname } from 'path';
import type { HookResult, HookContext } from './lib/types.ts';

async function handlePostToolUse(): Promise<HookResult> {
  const context = createHookContext('PostToolUse');
  
  console.log(`PostToolUse hook triggered for: ${context.toolName}`);

  try {
    switch (context.toolName) {
      case 'Write':
      case 'Edit':
        return await handleFilePostHook(context);
      
      case 'Bash':
        return await handleBashPostHook(context);
      
      default:
        return { success: true, message: `No post-processing for ${context.toolName}` };
    }
  } catch (error) {
    console.error('Error in PostToolUse hook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleFilePostHook(context: HookContext): Promise<HookResult> {
  if (!isWriteToolInput(context.toolInput) && !isEditToolInput(context.toolInput)) {
    return { success: false, message: 'Invalid file tool input' };
  }

  const filePath = context.toolInput.file_path;
  if (!existsSync(filePath)) {
    return { success: false, message: `File not found: ${filePath}` };
  }

  const ext = extname(filePath);
  const actions: string[] = [];

  // Format TypeScript/JavaScript files
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    await formatFile(filePath);
    actions.push('formatted');
  }

  // Run type check for TypeScript files
  if (['.ts', '.tsx'].includes(ext)) {
    await runTypeCheck(filePath);
    actions.push('type-checked');
  }

  // Lint files if applicable
  if (['.ts', '.tsx', '.js', '.jsx', '.json'].includes(ext)) {
    await lintFile(filePath);
    actions.push('linted');
  }

  return {
    success: true,
    message: `File processed: ${actions.join(', ')} - ${filePath}`,
    data: { actions, filePath },
  };
}

async function handleBashPostHook(context: HookContext): Promise<HookResult> {
  // Log the command execution for audit trail
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Bash command completed: ${context.toolInput.command}`);
  
  return {
    success: true,
    message: 'Bash command logged',
  };
}

// Utility functions for file processing
async function formatFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const format = spawn('bunx', ['@biomejs/biome', 'format', '--write', filePath], {
      stdio: 'pipe',
    });

    format.on('close', (code) => {
      if (code === 0) {
        console.log(`Formatted: ${filePath}`);
        resolve();
      } else {
        reject(new Error(`Format failed with code ${code}`));
      }
    });

    format.on('error', reject);
  });
}

async function runTypeCheck(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tsc = spawn('bunx', ['tsc', '--noEmit', filePath], {
      stdio: 'pipe',
    });

    tsc.on('close', (code) => {
      if (code === 0) {
        console.log(`Type check passed: ${filePath}`);
        resolve();
      } else {
        console.warn(`Type check issues in: ${filePath}`);
        resolve(); // Don't fail the hook for type errors
      }
    });

    tsc.on('error', reject);
  });
}

async function lintFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const lint = spawn('bunx', ['@biomejs/biome', 'lint', filePath], {
      stdio: 'pipe',
    });

    lint.on('close', (code) => {
      if (code === 0) {
        console.log(`Lint passed: ${filePath}`);
      } else {
        console.warn(`Lint issues in: ${filePath}`);
      }
      resolve(); // Don't fail hook for lint issues
    });

    lint.on('error', reject);
  });
}

// Main execution
async function main(): Promise<void> {
  const result = await handlePostToolUse();
  
  if (!result.success) {
    console.error(`Hook failed: ${result.message}`);
    process.exit(1);
  }
  
  console.log(`Hook completed: ${result.message || 'OK'}`);
  process.exit(0);
}

// Execute if run directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Hook execution failed:', error);
    process.exit(1);
  });
}

export { handlePostToolUse };
```

### Session Start Hook

Create `hooks/session-start.ts`:

```typescript
#!/usr/bin/env bun

import { createHookContext } from './lib/context.ts';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { HookResult } from './lib/types.ts';

async function handleSessionStart(): Promise<HookResult> {
  const context = createHookContext('SessionStart');
  
  console.log(`Session started: ${context.sessionId}`);
  console.log(`Workspace: ${context.workspacePath}`);

  try {
    // Load project context
    await loadProjectContext(context.workspacePath);
    
    // Display project information
    await displayProjectInfo(context.workspacePath);
    
    return {
      success: true,
      message: 'Session initialized successfully',
    };
  } catch (error) {
    console.error('Error in SessionStart hook:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function loadProjectContext(workspacePath: string): Promise<void> {
  const contextFiles = [
    'CLAUDE.md',
    'README.md',
    '.claude/context.md',
    'docs/CONTRIBUTING.md',
  ];

  for (const file of contextFiles) {
    const filePath = join(workspacePath, file);
    if (existsSync(filePath)) {
      console.log(`📄 Loaded context from: ${file}`);
    }
  }
}

async function displayProjectInfo(workspacePath: string): Promise<void> {
  // Check package.json
  const packageJsonPath = join(workspacePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      console.log(`📦 Project: ${packageJson.name || 'Unknown'} v${packageJson.version || '0.0.0'}`);
      
      if (packageJson.description) {
        console.log(`📝 Description: ${packageJson.description}`);
      }
      
      // Show available scripts
      if (packageJson.scripts) {
        const scripts = Object.keys(packageJson.scripts);
        console.log(`🔧 Available scripts: ${scripts.join(', ')}`);
      }
    } catch (error) {
      console.warn('Could not parse package.json');
    }
  }

  // Check for common framework files
  const frameworkFiles = [
    { file: 'next.config.js', framework: 'Next.js' },
    { file: 'vite.config.ts', framework: 'Vite' },
    { file: 'turbo.json', framework: 'Turbo' },
    { file: 'biome.json', framework: 'Biome' },
  ];

  const detectedFrameworks = frameworkFiles
    .filter(({ file }) => existsSync(join(workspacePath, file)))
    .map(({ framework }) => framework);

  if (detectedFrameworks.length > 0) {
    console.log(`🚀 Detected: ${detectedFrameworks.join(', ')}`);
  }

  // Git information
  const gitPath = join(workspacePath, '.git');
  if (existsSync(gitPath)) {
    console.log('📋 Git repository detected');
  }
}

// Main execution
async function main(): Promise<void> {
  const result = await handleSessionStart();
  
  if (!result.success) {
    console.error(`Hook failed: ${result.message}`);
    process.exit(1);
  }
  
  console.log(`Hook completed: ${result.message || 'OK'}`);
  process.exit(0);
}

// Execute if run directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Hook execution failed:', error);
    process.exit(1);
  });
}

export { handleSessionStart };
```

## Advanced Implementation Patterns

### Hook Composition and Chaining

```typescript
// hooks/lib/hook-chain.ts
import type { HookResult, HookContext } from './types.ts';

export type HookHandler = (context: HookContext) => Promise<HookResult>;

export class HookChain {
  private handlers: HookHandler[] = [];

  add(handler: HookHandler): this {
    this.handlers.push(handler);
    return this;
  }

  async execute(context: HookContext): Promise<HookResult> {
    for (const handler of this.handlers) {
      const result = await handler(context);
      
      if (!result.success && result.block) {
        return result; // Stop chain on blocking failure
      }
      
      if (!result.success) {
        console.warn(`Non-blocking hook failure: ${result.message}`);
      }
    }

    return { success: true, message: 'Hook chain completed' };
  }
}

// Example usage in a hook
const chain = new HookChain()
  .add(validateSecurity)
  .add(checkPermissions)
  .add(logActivity);

const result = await chain.execute(context);
```

### Configuration-Driven Hooks

```typescript
// hooks/lib/config.ts
export interface HookConfig {
  enabled: boolean;
  rules: {
    blockPatterns?: string[];
    allowPatterns?: string[];
    fileExtensions?: string[];
  };
  actions: {
    format?: boolean;
    lint?: boolean;
    typeCheck?: boolean;
  };
}

export function loadHookConfig(workspacePath: string): HookConfig {
  const configPath = join(workspacePath, '.claude', 'hooks.json');
  
  const defaultConfig: HookConfig = {
    enabled: true,
    rules: {
      blockPatterns: ['rm -rf', 'sudo rm'],
      allowPatterns: [],
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    actions: {
      format: true,
      lint: true,
      typeCheck: true,
    },
  };

  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.warn('Invalid hook configuration, using defaults');
    return defaultConfig;
  }
}
```

## Testing and Debugging

### Hook Test Framework

Create `hooks/test/hook-test.ts`:

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { handlePreToolUse } from '../pre-tool-use.ts';

describe('PreToolUse Hook', () => {
  beforeEach(() => {
    // Set up test environment
    process.env.CLAUDE_SESSION_ID = 'test-session';
    process.env.CLAUDE_WORKSPACE_PATH = process.cwd();
  });

  test('should validate safe bash commands', async () => {
    process.env.CLAUDE_TOOL_NAME = 'Bash';
    process.env.TOOL_INPUT = JSON.stringify({ command: 'ls -la' });

    const result = await handlePreToolUse();
    expect(result.success).toBe(true);
  });

  test('should block dangerous bash commands', async () => {
    process.env.CLAUDE_TOOL_NAME = 'Bash';
    process.env.TOOL_INPUT = JSON.stringify({ command: 'rm -rf /' });

    const result = await handlePreToolUse();
    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
  });

  test('should validate file operations', async () => {
    process.env.CLAUDE_TOOL_NAME = 'Write';
    process.env.TOOL_INPUT = JSON.stringify({
      file_path: 'test.ts',
      content: 'console.log("hello");'
    });

    const result = await handlePreToolUse();
    expect(result.success).toBe(true);
  });
});
```

### Debug Hook Utility

Create `hooks/debug-hook.ts`:

```typescript
#!/usr/bin/env bun

import { createHookContext } from './lib/context.ts';

// Debug utility to inspect hook environment
function debugHook(): void {
  console.log('=== HOOK DEBUG INFO ===');
  
  // Environment variables
  console.log('Environment Variables:');
  Object.entries(process.env)
    .filter(([key]) => key.startsWith('CLAUDE_') || key === 'TOOL_INPUT' || key === 'TOOL_OUTPUT')
    .forEach(([key, value]) => {
      console.log(`  ${key}=${value}`);
    });

  // Parsed context
  console.log('\nParsed Context:');
  const context = createHookContext('PreToolUse');
  console.log(JSON.stringify(context, null, 2));

  console.log('=== END DEBUG INFO ===');
}

if (import.meta.main) {
  debugHook();
}
```

## Project Integration

### Claude Code Settings Configuration

Create or update `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run hooks/pre-tool-use.ts",
        "timeout": 5000
      },
      "Write": {
        "command": "bun run hooks/pre-tool-use.ts",
        "timeout": 3000
      },
      "Edit": {
        "command": "bun run hooks/pre-tool-use.ts",
        "timeout": 3000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run hooks/post-tool-use.ts",
        "timeout": 30000
      },
      "Edit": {
        "command": "bun run hooks/post-tool-use.ts",
        "timeout": 30000
      }
    },
    "SessionStart": {
      "command": "bun run hooks/session-start.ts",
      "timeout": 10000
    }
  }
}
```

### Package.json Scripts

Add hook-related scripts to your `package.json`:

```json
{
  "scripts": {
    "hooks:test": "bun test hooks/test/",
    "hooks:debug": "bun run hooks/debug-hook.ts",
    "hooks:lint": "bunx @biomejs/biome lint hooks/",
    "hooks:format": "bunx @biomejs/biome format --write hooks/"
  }
}
```

### Turbo Pipeline Integration

If using Turbo, add hook tasks to `turbo.json`:

```json
{
  "pipeline": {
    "hooks:test": {
      "outputs": []
    },
    "hooks:lint": {
      "outputs": []
    }
  }
}
```

This comprehensive TypeScript implementation guide provides everything needed to create sophisticated, type-safe Claude Code hooks following the project's conventions and best practices.