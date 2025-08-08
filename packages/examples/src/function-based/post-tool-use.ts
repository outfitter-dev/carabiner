#!/usr/bin/env bun

/**
 * Function-based API example for PostToolUse hook
 * Demonstrates post-processing, logging, and file formatting
 * Updated to use the new stdin-based Claude Code hooks runtime
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { HookContext, HookResult } from '@/hooks-core';
import {
  HookResults,
  isBashToolInput,
  isEditToolInput,
  isWriteToolInput,
  runClaudeHook,
} from '@/hooks-core';

/**
 * Main hook handler for post-tool processing
 * Now receives context from stdin JSON input including tool response
 */
async function handlePostToolUse(
  context: HookContext<'PostToolUse'>
): Promise<HookResult> {
  // Access tool response from new context structure
  if (context.toolResponse) {
  }

  const startTime = Date.now();

  try {
    // Route to specific tool handlers
    const result = await routeToToolHandler(context);

    // Log the execution
    await logToolExecution(context, result, Date.now() - startTime);

    return result;
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Post-processing failed'
    );
  }
}

/**
 * Route to appropriate tool handler
 */
async function routeToToolHandler(
  context: HookContext<'PostToolUse'>
): Promise<HookResult> {
  switch (context.toolName) {
    case 'Bash':
      return await handleBashPostProcessing(
        context as HookContext<'PostToolUse', 'Bash'>
      );
    case 'Write':
      return await handleWritePostProcessing(
        context as HookContext<'PostToolUse', 'Write'>
      );
    case 'Edit':
      return await handleEditPostProcessing(
        context as HookContext<'PostToolUse', 'Edit'>
      );
    case 'Read':
      return await handleReadPostProcessing(context);
    default:
      return await handleGenericPostProcessing(context);
  }
}

/**
 * Handle Bash tool post-processing
 */
async function handleBashPostProcessing(
  context: HookContext<'PostToolUse', 'Bash'>
): Promise<HookResult> {
  if (!isBashToolInput(context.toolInput)) {
    return HookResults.success(
      'Bash post-processing completed (no input to process)'
    );
  }

  const { command } = context.toolInput;
  const output = context.toolResponse;

  const actions: string[] = [];

  // Analyze command output
  if (output) {
    const outputString =
      typeof output === 'string' ? output : JSON.stringify(output);
    await analyzeBashOutput(command, outputString, context.cwd, actions);
  }

  // Handle specific command types
  await handleSpecificCommands(command, context.cwd, actions);

  const message =
    actions.length > 0
      ? `Bash post-processing completed: ${actions.join(', ')}`
      : 'Bash post-processing completed';

  return HookResults.success(message, {
    command: command.slice(0, 100),
    actionsPerformed: actions,
    outputSize: output?.length || 0,
  });
}

/**
 * Handle Write tool post-processing
 */
async function handleWritePostProcessing(
  context: HookContext<'PostToolUse', 'Write'>
): Promise<HookResult> {
  if (!isWriteToolInput(context.toolInput)) {
    return HookResults.success(
      'Write post-processing completed (no input to process)'
    );
  }

  const { file_path, content } = context.toolInput;

  const actions: string[] = [];

  // Check if file was actually created
  if (!existsSync(file_path)) {
    return HookResults.failure(`File was not created: ${file_path}`);
  }

  // Format the file if it's a supported type
  const _formatted = await formatFile(file_path, context.cwd, actions);

  // Run type checking if it's a TypeScript file
  if (['.ts', '.tsx'].includes(extname(file_path))) {
    await runTypeCheck(file_path, actions);
  }

  // Run linting if it's a code file
  if (isCodeFile(file_path)) {
    await runLinter(file_path, actions);
  }

  // Update file statistics
  const fileStats = await getFileStats(file_path);

  const message =
    actions.length > 0
      ? `Write post-processing completed: ${actions.join(', ')}`
      : 'Write post-processing completed';

  return HookResults.success(message, {
    filePath: file_path,
    fileSize: fileStats.size,
    actionsPerformed: actions,
  });
}

/**
 * Handle Edit tool post-processing
 */
async function handleEditPostProcessing(
  context: HookContext<'PostToolUse', 'Edit'>
): Promise<HookResult> {
  if (!isEditToolInput(context.toolInput)) {
    return HookResults.success(
      'Edit post-processing completed (no input to process)'
    );
  }

  const { file_path } = context.toolInput;

  const actions: string[] = [];

  // Format the edited file
  await formatFile(file_path, context.cwd, actions);

  // Run validation on edited file
  if (isCodeFile(file_path)) {
    await validateEditedFile(file_path, actions);
  }

  // Check for syntax errors
  if (extname(file_path) === '.json') {
    await validateJsonSyntax(file_path, actions);
  }

  const message =
    actions.length > 0
      ? `Edit post-processing completed: ${actions.join(', ')}`
      : 'Edit post-processing completed';

  return HookResults.success(message, {
    filePath: file_path,
    actionsPerformed: actions,
  });
}

/**
 * Handle Read tool post-processing
 */
async function handleReadPostProcessing(
  context: HookContext
): Promise<HookResult> {
  // For read operations, we might want to log access or update cache
  const output = context.toolResponse;
  const outputSize = (() => {
    if (!output) {
      return 0;
    }
    const response = output as string | Record<string, unknown>;
    if (typeof response === 'string') {
      return response.length;
    }
    return JSON.stringify(response).length;
  })();

  if (outputSize > 100_000) {
  }

  return HookResults.success('Read post-processing completed', {
    outputSize,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle generic tool post-processing
 */
async function handleGenericPostProcessing(
  context: HookContext
): Promise<HookResult> {
  // Basic logging and cleanup
  const output = context.toolResponse;

  return HookResults.success(
    `Generic post-processing completed for ${context.toolName}`,
    {
      toolName: context.toolName,
      hasOutput: Boolean(output),
      outputSize: (() => {
        if (!output) {
          return 0;
        }
        const response = output as string | Record<string, unknown>;
        if (typeof response === 'string') {
          return response.length;
        }
        return JSON.stringify(response).length;
      })(),
    }
  );
}

/**
 * Utility functions
 */

async function analyzeBashOutput(
  command: string,
  output: string,
  _cwd: string,
  actions: string[]
): Promise<void> {
  // Check for error indicators in output
  const errorKeywords = [
    'error:',
    'Error:',
    'ERROR:',
    'failed',
    'Failed',
    'FAILED',
  ];
  const hasErrors = errorKeywords.some((keyword) => output.includes(keyword));

  if (hasErrors) {
    actions.push('error-detected');
  }

  // Handle package installation outputs
  if (
    (command.includes('npm install') ||
      command.includes('yarn add') ||
      command.includes('bun add')) &&
    output.includes('added')
  ) {
    actions.push('package-installed');

    // Could trigger package.json validation here
  }

  // Handle git operations
  if (command.startsWith('git') && output.includes('commit')) {
    actions.push('git-commit');
  }
}

async function handleSpecificCommands(
  command: string,
  cwd: string,
  actions: string[]
): Promise<void> {
  // Handle npm/yarn/bun install
  if (
    command.includes('install') &&
    (command.includes('npm') ||
      command.includes('yarn') ||
      command.includes('bun'))
  ) {
    // Check if package-lock.json or yarn.lock was created/updated
    const lockFiles = ['package-lock.json', 'yarn.lock', 'bun.lockb'];

    for (const lockFile of lockFiles) {
      const lockPath = join(cwd, lockFile);
      if (existsSync(lockPath)) {
        actions.push('lock-file-updated');
        break;
      }
    }
  }

  // Handle git operations
  if (command.startsWith('git ')) {
    actions.push('git-operation');

    // Could add git hooks or status checks here
  }
}

async function formatFile(
  filePath: string,
  cwd: string,
  actions: string[]
): Promise<boolean> {
  const ext = extname(filePath);

  // Skip formatting for certain file types
  if (['.lock', '.log', '.tmp'].includes(ext)) {
    return false;
  }

  try {
    if (
      [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
        '.css',
        '.scss',
        '.html',
      ].includes(ext)
    ) {
      // Use Biome for formatting
      await runCommand(
        'bunx',
        ['@biomejs/biome', 'format', '--write', filePath],
        cwd
      );
      actions.push('formatted');
      return true;
    }
  } catch (_error) {}

  return false;
}

async function runTypeCheck(
  filePath: string,
  actions: string[]
): Promise<void> {
  try {
    await runCommand('bunx', ['tsc', '--noEmit', filePath], process.cwd());
    actions.push('type-checked');
  } catch (_error) {
    // Don't fail the hook for type errors, just log them
    actions.push('type-check-warnings');
  }
}

async function runLinter(filePath: string, actions: string[]): Promise<void> {
  try {
    await runCommand(
      'bunx',
      ['@biomejs/biome', 'lint', filePath],
      process.cwd()
    );
    actions.push('linted');
  } catch (_error) {
    actions.push('lint-warnings');
  }
}

async function validateEditedFile(
  filePath: string,
  actions: string[]
): Promise<void> {
  // Basic validation - check if file is readable and has content
  try {
    const content = await readFile(filePath, 'utf-8');
    if (content.trim().length === 0) {
    } else {
      actions.push('validated');
    }
  } catch (_error) {}
}

async function validateJsonSyntax(
  filePath: string,
  actions: string[]
): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8');
    JSON.parse(content);
    actions.push('json-validated');
  } catch (_error) {
    // Could auto-fix common JSON issues here
  }
}

async function logToolExecution(
  context: HookContext,
  result: HookResult,
  processingTime: number
): Promise<void> {
  const _logEntry = {
    timestamp: new Date().toISOString(),
    sessionId: context.sessionId,
    event: context.event,
    toolName: context.toolName,
    success: result.success,
    processingTime,
    cwd: context.cwd,
    hasOutput: Boolean(context.toolResponse),
    outputSize: (() => {
      if (!context.toolResponse) {
        return 0;
      }
      const response = context.toolResponse as string | Record<string, unknown>;
      if (typeof response === 'string') {
        return response.length;
      }
      return JSON.stringify(response).length;
    })(),
  };
}

async function getFileStats(
  filePath: string
): Promise<{ size: number; modified: Date }> {
  try {
    const stats = await stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
    };
  } catch {
    return { size: 0, modified: new Date() };
  }
}

function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.vue',
    '.svelte',
    '.py',
    '.go',
    '.rs',
    '.java',
    '.cpp',
    '.c',
  ];
  return codeExtensions.includes(extname(filePath));
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    process.on('error', reject);
  });
}

// Main execution - now uses the new stdin-based runtime
if (import.meta.main) {
  // The new runtime automatically reads JSON from stdin,
  // creates context, and calls our handler
  runClaudeHook(handlePostToolUse as any, {
    outputMode: 'exit-code',
    logLevel: 'info',
  });
}

export { handlePostToolUse };
