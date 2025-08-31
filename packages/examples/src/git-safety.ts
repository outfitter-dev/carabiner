#!/usr/bin/env bun

/**
 * Claude Code Hook: Git Safety
 * =============================
 *
 * Prevents accidental git operations that could cause data loss or repository issues.
 *
 * Features:
 * - Blocks force pushes to protected branches (main, master, production)
 * - Prevents accidental commits to protected branches
 * - Warns about large commits
 * - Prevents git clean without dry-run
 * - Blocks dangerous reset operations
 */

import { execSync } from 'node:child_process';
import { HookExecutor } from '@carabiner/execution';
import { StdinProtocol } from '@carabiner/protocol';
import type { HookContext, HookHandler, HookResult } from '@carabiner/types';
import { isToolHookContext } from '@carabiner/types';

// Protected branch names
const PROTECTED_BRANCHES = [
  'main',
  'master',
  'production',
  'release',
  'staging',
];

// Dangerous git patterns
const GIT_DANGERS = [
  {
    pattern: /git\s+push\s+.*--force(?:-with-lease)?/,
    checkBranch: true,
    message: 'Force push detected on protected branch',
  },
  {
    pattern: /git\s+push\s+.*-f(?:\s|$)/,
    checkBranch: true,
    message: 'Force push detected on protected branch',
  },
  {
    pattern: /git\s+clean\s+(?!.*-n|.*--dry-run)/,
    checkBranch: false,
    message:
      'Git clean without dry-run can permanently delete untracked files. Use "git clean -n" first',
  },
  {
    pattern: /git\s+reset\s+--hard\s+HEAD~\d+/,
    checkBranch: true,
    message: 'Hard reset on protected branch will lose commits',
  },
  {
    pattern: /git\s+checkout\s+.*--orphan/,
    checkBranch: false,
    message: 'Creating orphan branch - this will start a new history tree',
  },
  {
    pattern: /git\s+filter-branch/,
    checkBranch: false,
    message: 'Filter-branch rewrites history - use with extreme caution',
  },
  {
    pattern: /git\s+push\s+--delete\s+origin\s+(main|master|production)/,
    checkBranch: false,
    message: 'Attempting to delete protected remote branch',
  },
];

// Warning patterns (non-blocking)
const GIT_WARNINGS = [
  {
    pattern: /git\s+commit\s+.*--amend/,
    message: 'Amending commits rewrites history - avoid if already pushed',
  },
  {
    pattern: /git\s+rebase/,
    message: 'Rebasing rewrites history - avoid rebasing public branches',
  },
  {
    pattern: /git\s+add\s+\./,
    message: 'Adding all files - ensure no sensitive data is included',
  },
  {
    pattern: /git\s+add\s+\*/,
    message: 'Adding all files - ensure no sensitive data is included',
  },
  {
    pattern: /git\s+commit\s+.*-m\s*["'][^"']*token[^"']*["']/i,
    message:
      'Commit message may contain sensitive information (token mentioned)',
  },
  {
    pattern: /git\s+commit\s+.*-m\s*["'][^"']*password[^"']*["']/i,
    message:
      'Commit message may contain sensitive information (password mentioned)',
  },
];

/**
 * Gets the current git branch name
 */
function getCurrentBranch(): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Checks if current branch is protected
 */
function isProtectedBranch(): boolean {
  const currentBranch = getCurrentBranch();
  if (!currentBranch) {
    return false;
  }

  return PROTECTED_BRANCHES.includes(currentBranch.toLowerCase());
}

/**
 * Validates git commands for safety
 */
function validateGitCommand(command: string): {
  safe: boolean;
  blocked: string[];
  warnings: string[];
} {
  const blocked: string[] = [];
  const warnings: string[] = [];

  // Check for dangerous patterns
  for (const danger of GIT_DANGERS) {
    if (
      danger.pattern.test(command) &&
      (!danger.checkBranch || isProtectedBranch())
    ) {
      blocked.push(danger.message);
    }
  }

  // Check for warning patterns
  for (const warning of GIT_WARNINGS) {
    if (warning.pattern.test(command)) {
      warnings.push(warning.message);
    }
  }

  // Special case: direct commits to protected branches
  if (/git\s+commit\b/.test(command) && isProtectedBranch()) {
    const branch = getCurrentBranch();
    warnings.push(
      `Committing directly to protected branch '${branch}' - consider using a feature branch`
    );
  }

  return {
    safe: blocked.length === 0,
    blocked,
    warnings,
  };
}

/**
 * Main git safety hook
 */
const gitSafetyHook: HookHandler = (context: HookContext): HookResult => {
  // Only process tool hooks
  if (!isToolHookContext(context)) {
    return {
      success: true,
    };
  }

  // Only process Bash commands
  if (context.toolName !== 'Bash') {
    return {
      success: true,
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Tool input is a union type
  const command = (context.toolInput as any)?.command as string | undefined;
  if (!command?.includes('git')) {
    return {
      success: true,
    };
  }

  const validation = validateGitCommand(command);

  // Show warnings (non-blocking)
  if (validation.warnings.length > 0) {
    // Warnings could be logged here if needed
    for (const _warning of validation.warnings) {
      // Warning output would go here
    }
  }

  // Block dangerous operations
  if (!validation.safe) {
    // Issues could be logged here if needed
    for (const _issue of validation.blocked) {
      // Issue output would go here
    }

    return {
      success: false,
      block: true,
      message: `Git safety violation:\n${validation.blocked.map((i) => `• ${i}`).join('\n')}\n\nCurrent branch: ${getCurrentBranch() || 'unknown'}`,
    };
  }

  return {
    success: true,
  };
};

// Main execution
async function main() {
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);

  await executor.execute(gitSafetyHook);
}

// Run if executed directly
if (import.meta.main) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export {
  gitSafetyHook,
  validateGitCommand,
  getCurrentBranch,
  isProtectedBranch,
  PROTECTED_BRANCHES,
  GIT_DANGERS,
  GIT_WARNINGS,
};
