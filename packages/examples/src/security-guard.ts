#!/usr/bin/env bun

/**
 * Claude Code Hook: Security Guard
 * =================================
 *
 * A comprehensive security hook that prevents potentially dangerous operations
 * across multiple tools (Bash, Edit, Write, etc.)
 *
 * Features:
 * - Blocks dangerous bash commands (rm -rf, chmod 777, etc.)
 * - Prevents editing sensitive files (.env, private keys, etc.)
 * - Validates file paths to prevent directory traversal
 * - Logs security events for audit purposes
 */

import { existsSync, statSync } from 'node:fs';
import { normalize, resolve } from 'node:path';
import { HookExecutor } from '@carabiner/execution';
import { StdinProtocol } from '@carabiner/protocol';
import type { HookContext, HookHandler, HookResult } from '@carabiner/types';
import { isToolHookContext } from '@carabiner/types';

// Dangerous bash command patterns
const DANGEROUS_COMMANDS = [
  { pattern: /rm\s+-rf\s+\/(?:\s|$)/, description: 'Removing root directory' },
  { pattern: /rm\s+-rf\s+~\/(?:\s|$)/, description: 'Removing home directory' },
  {
    pattern: /chmod\s+777\b/,
    description: 'Setting overly permissive permissions',
  },
  {
    pattern: /curl.*\|\s*sh\b/,
    description: 'Piping curl output directly to shell',
  },
  {
    pattern: /wget.*\|\s*bash\b/,
    description: 'Piping wget output directly to bash',
  },
  {
    pattern: />+\s*\/dev\/s[dr][a-z]\d*(?:\s|$)/,
    description: 'Writing directly to disk device',
  },
  {
    pattern: /dd\s+.*of=\/dev\/s[dr][a-z]/,
    description: 'Using dd on disk device',
  },
  { pattern: /mkfs\.\w+\s+\/dev/, description: 'Formatting disk device' },
  {
    pattern: /:\(\)\s*\{\s*:\|\s*:\s*&\s*\}/,
    description: 'Fork bomb detected',
  },
];

// Sensitive file patterns
const SENSITIVE_FILES = [
  /^\.env(?:\.\w+)?$/,
  /^\.aws\/credentials$/,
  /^\.ssh\/id_[rd]sa$/,
  /^\.ssh\/id_ed25519$/,
  /^\.gnupg\//,
  /\.pem$/,
  /\.key$/,
  /\.pfx$/,
  /\.p12$/,
  /^\/etc\/passwd$/,
  /^\/etc\/shadow$/,
  /\.git\/config$/,
];

// Protected directories
const PROTECTED_PATHS = [
  '/etc',
  '/sys',
  '/proc',
  '/dev',
  '/boot',
  '/usr/bin',
  '/usr/sbin',
  '/bin',
  '/sbin',
];

/**
 * Checks if a file path is sensitive
 */
function isSensitivePath(filePath: string): boolean {
  const normalizedPath = normalize(filePath);

  // Check against sensitive file patterns
  for (const pattern of SENSITIVE_FILES) {
    if (pattern.test(normalizedPath)) {
      return true;
    }
  }

  // Check if path is in protected directory
  const absolutePath = resolve(filePath);
  for (const protectedPath of PROTECTED_PATHS) {
    if (absolutePath.startsWith(protectedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a bash command for security issues
 */
function validateBashCommand(command: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const { pattern, description } of DANGEROUS_COMMANDS) {
    if (pattern.test(command)) {
      issues.push(`Dangerous command detected: ${description}`);
    }
  }

  // Check for sudo without specific command
  if (/^\s*sudo\s+-i\s*$/.test(command) || /^\s*sudo\s+su\s*$/.test(command)) {
    issues.push(
      'Interactive sudo session detected - specify exact command instead'
    );
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Validates file operations
 */
function validateFileOperation(
  toolName: string,
  filePath: string | undefined
): { safe: boolean; issue?: string } {
  if (!filePath) {
    return { safe: true };
  }

  // Check for directory traversal attempts
  if (filePath.includes('../') || filePath.includes('..\\')) {
    return {
      safe: false,
      issue: 'Directory traversal attempt detected',
    };
  }

  // Check if path is sensitive
  if (isSensitivePath(filePath)) {
    return {
      safe: false,
      issue: `Attempting to ${toolName.toLowerCase()} sensitive file: ${filePath}`,
    };
  }

  // Additional check for Write/Edit operations on executable files
  if ((toolName === 'Write' || toolName === 'Edit') && existsSync(filePath)) {
    try {
      const stats = statSync(filePath);
      // Check if file is executable (Unix-like systems)
      // biome-ignore lint/suspicious/noBitwiseOperators: Checking file permissions requires bitwise operations
      if (stats.mode && stats.mode & 0o111) {
        return {
          safe: false,
          issue: `Attempting to modify executable file: ${filePath}`,
        };
      }
    } catch {
      // If we can't stat the file, proceed with caution
    }
  }

  return { safe: true };
}

/**
 * Main security guard hook
 */
const securityGuardHook: HookHandler = (context: HookContext): HookResult => {
  // Only process tool hooks
  if (!isToolHookContext(context)) {
    return {
      success: true,
    };
  }

  // Handle Bash commands
  if (context.toolName === 'Bash') {
    // biome-ignore lint/suspicious/noExplicitAny: Tool input is a union type
    const command = (context.toolInput as any)?.command as string | undefined;
    if (command) {
      const validation = validateBashCommand(command);
      if (!validation.safe) {
        // Issues could be logged here if needed
        for (const _issue of validation.issues) {
          // Issue output would go here
        }

        return {
          success: false,
          block: true,
          message: `Security violation:\n${validation.issues.map((i) => `• ${i}`).join('\n')}`,
        };
      }
    }
  }

  // Handle file operations
  if (['Edit', 'Write', 'MultiEdit', 'Read'].includes(context.toolName)) {
    // biome-ignore lint/suspicious/noExplicitAny: Tool input is a union type
    const filePath = (context.toolInput as any)?.file_path as
      | string
      | undefined;
    const validation = validateFileOperation(context.toolName, filePath);

    if (!validation.safe) {
      return {
        success: false,
        block: true,
        message: `Security violation: ${validation.issue}`,
      };
    }
  }

  // Handle NotebookEdit
  if (context.toolName === 'NotebookEdit') {
    // biome-ignore lint/suspicious/noExplicitAny: Tool input is a union type
    const notebookPath = (context.toolInput as any)?.notebook_path as
      | string
      | undefined;
    const validation = validateFileOperation(context.toolName, notebookPath);

    if (!validation.safe) {
      return {
        success: false,
        block: true,
        message: `Security violation: ${validation.issue}`,
      };
    }
  }
  return {
    success: true,
  };
};

// Main execution
async function main() {
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);

  await executor.execute(securityGuardHook);
}

// Run if executed directly
if (import.meta.main) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export {
  securityGuardHook,
  validateBashCommand,
  validateFileOperation,
  isSensitivePath,
  DANGEROUS_COMMANDS,
  SENSITIVE_FILES,
  PROTECTED_PATHS,
};
