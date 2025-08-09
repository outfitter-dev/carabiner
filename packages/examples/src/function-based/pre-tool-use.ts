#!/usr/bin/env bun

/**
 * Function-based API example for PreToolUse hook
 * Demonstrates the straightforward function approach for hook implementation
 * Uses the new stdin-based Claude Code hooks runtime (JSON input via stdin)
 */

import type { HookContext, HookResult } from '@/hooks-core';
import {
  HookResults,
  isBashToolInput,
  isEditToolInput,
  isWriteToolInput,
  runClaudeHook,
} from '@/hooks-core';
import { ValidationError, validateHookSecurity } from '@/hooks-validators';

/**
 * Main hook handler using function-based approach
 * Now receives context from stdin JSON input
 */
async function handlePreToolUse(
  context: HookContext<'PreToolUse'>
): Promise<HookResult> {
  try {
    // Route to specific tool handlers
    switch (context.toolName) {
      case 'Bash':
        return await handleBashValidation(
          context as HookContext<'PreToolUse', 'Bash'>
        );
      case 'Write':
        return await handleWriteValidation(
          context as HookContext<'PreToolUse', 'Write'>
        );
      case 'Edit':
        return await handleEditValidation(
          context as HookContext<'PreToolUse', 'Edit'>
        );
      default:
        return await handleGenericValidation(context);
    }
  } catch (error) {
    return HookResults.block(
      error instanceof ValidationError
        ? error.message
        : 'Security validation failed'
    );
  }
}

/**
 * Handle Bash tool validation
 */
async function handleBashValidation(
  context: HookContext<'PreToolUse', 'Bash'>
): Promise<HookResult> {
  if (!isBashToolInput(context.toolInput)) {
    return HookResults.block('Invalid Bash tool input');
  }

  const { command, timeout } = context.toolInput;

  // Apply security validation
  validateHookSecurity(context, {
    env:
      (Bun.env.NODE_ENV as 'production' | 'development' | 'test') ||
      'development',
    strictMode: false,
  });

  // Custom validation logic
  const validationResult = await validateBashCommand(command, context.cwd);
  if (!validationResult.allowed) {
    return HookResults.block(validationResult.reason ?? 'Validation failed');
  }

  // Check timeout
  if (timeout && timeout > 300_000) {
    // 5 minutes
    return HookResults.failure(
      'Command timeout too long (max 5 minutes)',
      false,
      {
        requestedTimeout: timeout,
        maxAllowed: 300_000,
      }
    );
  }
  return HookResults.success('Bash validation passed', {
    command: command.slice(0, 100),
    estimatedDuration: estimateCommandDuration(command),
  });
}

/**
 * Handle Write tool validation
 */
async function handleWriteValidation(
  context: HookContext<'PreToolUse', 'Write'>
): Promise<HookResult> {
  if (!isWriteToolInput(context.toolInput)) {
    return HookResults.block('Invalid Write tool input');
  }

  const { file_path, content } = context.toolInput;

  // Apply security validation
  validateHookSecurity(context, {
    env:
      (Bun.env.NODE_ENV as 'production' | 'development' | 'test') ||
      'development',
  });

  // Custom validation for write operations
  const validation = await validateFileWrite(file_path, content, context.cwd);
  if (!validation.allowed) {
    return HookResults.block(validation.reason ?? 'File validation failed');
  }

  // Check file size
  const contentSize = new TextEncoder().encode(content).length;
  if (contentSize > 1_048_576) {
    // 1MB
    return HookResults.failure('File content too large (max 1MB)', false, {
      size: contentSize,
      maxSize: 1_048_576,
    });
  }
  return HookResults.success('Write validation passed', {
    filePath: file_path,
    contentSize,
  });
}

/**
 * Handle Edit tool validation
 */
async function handleEditValidation(
  context: HookContext<'PreToolUse', 'Edit'>
): Promise<HookResult> {
  if (!isEditToolInput(context.toolInput)) {
    return HookResults.block('Invalid Edit tool input');
  }

  const { file_path, old_string, new_string, replace_all } = context.toolInput;

  // Apply security validation
  validateHookSecurity(context, {
    env:
      (Bun.env.NODE_ENV as 'production' | 'development' | 'test') ||
      'development',
  });

  // Custom validation for edit operations
  const validation = await validateFileEdit(
    file_path,
    old_string,
    new_string,
    context.cwd
  );
  if (!validation.allowed) {
    return HookResults.block(validation.reason ?? 'Edit validation failed');
  }

  // Warn about large replacements
  // if (old_string.length > 10_000 || new_string.length > 10_000) {
  //   console.warn('Large replacement detected');
  // }
  return HookResults.success('Edit validation passed', {
    filePath: file_path,
    replaceAll: replace_all,
    replacementSize: new_string.length - old_string.length,
  });
}

/**
 * Handle generic tool validation
 */
async function handleGenericValidation(
  context: HookContext
): Promise<HookResult> {
  // Apply basic security validation
  try {
    validateHookSecurity(context, {
      env: 'development', // More permissive for unknown tools
    });
  } catch (_error) {}

  return HookResults.success(
    `Generic validation passed for ${context.toolName}`
  );
}

/**
 * Custom validation functions
 */

async function validateBashCommand(
  command: string,
  _cwd: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Example: Block commands that could modify git history
  const dangerousGitPatterns = [
    /git\s+rebase.*-i/,
    /git\s+reset.*--hard/,
    /git\s+push.*--force/,
    /git\s+filter-branch/,
  ];

  for (const pattern of dangerousGitPatterns) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: `Potentially dangerous git operation blocked: ${pattern.source}`,
      };
    }
  }

  // Example: Require confirmation for package installs
  const packageInstallPatterns = [
    /npm\s+install(?!\s+--dry-run)/,
    /yarn\s+add/,
    /bun\s+add/,
    /pnpm\s+add/,
  ];

  for (const pattern of packageInstallPatterns) {
    if (pattern.test(command) && !command.includes('--dry-run')) {
      return {
        allowed: false,
        reason: 'Package install requires --dry-run flag',
      };
    }
  }

  return { allowed: true };
}

async function validateFileWrite(
  filePath: string,
  _content: string,
  _cwd: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Example: Block writes to node_modules
  if (filePath.includes('node_modules/')) {
    return {
      allowed: false,
      reason: 'Cannot write to node_modules directory',
    };
  }

  // Example: Block writes to git directory
  if (filePath.includes('.git/') && !filePath.includes('.gitignore')) {
    return {
      allowed: false,
      reason: 'Cannot write to .git directory',
    };
  }

  // Example: Warn about overwriting package.json
  // if (filePath.endsWith('package.json')) {
  //   console.warn('Modifying package.json');
  // }

  return { allowed: true };
}

async function validateFileEdit(
  filePath: string,
  _oldString: string,
  newString: string,
  _cwd: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Example: Block edits to lock files
  if (filePath.endsWith('.lock') || filePath.endsWith('-lock.json')) {
    return {
      allowed: false,
      reason: 'Cannot edit package lock files',
    };
  }

  // Example: Validate JSON changes
  if (filePath.endsWith('.json')) {
    try {
      // Try to parse as JSON to ensure valid syntax
      JSON.parse(newString);
    } catch {
      return {
        allowed: false,
        reason: 'New content is not valid JSON',
      };
    }
  }

  return { allowed: true };
}

/**
 * Utility functions
 */

function estimateCommandDuration(command: string): number {
  // Simple heuristic for command duration
  if (command.includes('npm install') || command.includes('yarn install')) {
    return 30_000; // 30 seconds
  }
  if (command.includes('git clone')) {
    return 15_000; // 15 seconds
  }
  if (command.startsWith('ls') || command.startsWith('echo')) {
    return 100; // Very fast
  }
  return 5000; // Default 5 seconds
}

// Main execution - now uses the new stdin-based runtime
if (import.meta.main) {
  // The new runtime automatically reads JSON from stdin,
  // creates context, and calls our handler
  runClaudeHook(handlePreToolUse as any, {
    outputMode: 'exit-code', // Use traditional exit codes
    logLevel: 'info',
  });
}

export { handlePreToolUse };
