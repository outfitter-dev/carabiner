/**
 * @file git-safety/index.ts
 * @description Git safety plugin - prevents dangerous git operations
 *
 * This plugin blocks potentially dangerous git commands like force pushes,
 * hard resets, and other destructive operations. It provides configurable
 * patterns and allow lists for fine-tuned control.
 */

import type { HookPlugin, PluginResult } from '@outfitter/registry';
import type { HookContext } from '@outfitter/types';
import { isBashHookContext } from '@outfitter/types';
import { z } from 'zod';

/**
 * Git safety plugin configuration schema
 */
const GitSafetyConfigSchema = z
  .object({
    /** Patterns to block (supports regex) */
    blockPatterns: z
      .array(z.string())
      .default([
        'push.*--force',
        'push.*-f(?:\\s|$)',
        'reset.*--hard',
        'clean.*(-f.*-d|-fd)',
        'branch.*-D',
        'tag.*-d',
        'reflog.*--delete',
        'gc.*--aggressive.*--prune=now',
      ]),

    /** Commands to always allow (overrides block patterns) */
    allowList: z
      .array(z.string())
      .default([
        'git status',
        'git log',
        'git diff',
        'git branch$',
        'git branch -[alv]',
        'git branch --list',
        'git checkout',
        'git add',
        'git commit',
        'git pull',
        'git fetch',
        'git merge$',
        'git merge --abort',
        'git merge --continue',
        'git rebase',
        'git stash',
        'git clone',
        'git init',
        'git config',
        'git remote',
        'git tag$',
        'git tag -l',
        'git tag --list',
        'git show',
        'git rev-parse',
      ]),

    /** Whether to block force operations */
    blockForce: z.boolean().default(true),

    /** Whether to allow operations in specific directories */
    trustedDirectories: z.array(z.string()).default([]),

    /** Whether to log blocked commands */
    logBlocked: z.boolean().default(true),

    /** Whether to warn about potentially dangerous commands */
    warnOnly: z.boolean().default(false),

    /** Custom rules to add */
    customRules: z
      .array(
        z.object({
          name: z.string(),
          pattern: z.string(),
          message: z.string(),
          severity: z.enum(['block', 'warn']),
        })
      )
      .default([]),

    /** Repository path patterns to exclude from checking */
    excludeRepos: z.array(z.string()).default([]),

    /** Repository path patterns to include (if set, only these repos are checked) */
    includeRepos: z.array(z.string()).default([]),
  })
  .default({});

/**
 * Check if command matches any pattern
 */
function matchesPattern(command: string, patterns: string[]): string | null {
  const gitCommand = command.trim();

  // Only check git commands (case insensitive)
  if (!gitCommand.toLowerCase().startsWith('git ')) {
    return null;
  }

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(gitCommand)) {
        return pattern;
      }
    } catch (_error) {}
  }

  return null;
}

/**
 * Check if command is in allow list
 */
function isAllowed(command: string, allowList: string[]): boolean {
  const gitCommand = command.trim().toLowerCase();

  return allowList.some((allowed) => {
    try {
      // Match allowed patterns exactly - the allowlist should contain full patterns
      const regex = new RegExp(`^${allowed.toLowerCase()}`, 'i');
      return regex.test(gitCommand);
    } catch (_error) {
      return false;
    }
  });
}

/**
 * Check if directory is trusted
 */
function isTrustedDirectory(
  cwd: string,
  trustedDirectories: string[]
): boolean {
  return trustedDirectories.some((trusted) => {
    try {
      // Normalize paths for comparison
      const normalizedCwd = cwd.toLowerCase();
      const normalizedTrusted = trusted.toLowerCase();

      return (
        normalizedCwd.includes(normalizedTrusted) ||
        normalizedCwd.startsWith(normalizedTrusted)
      );
    } catch (_error) {
      return false;
    }
  });
}

/**
 * Check repository exclusions
 */
function checkRepoExclusions(
  cwd: string,
  excludeRepos: string[],
  pluginName: string,
  pluginVersion: string
): PluginResult | null {
  if (excludeRepos.length === 0) {
    return null;
  }

  for (const excludePattern of excludeRepos) {
    try {
      const regex = new RegExp(excludePattern);
      if (regex.test(cwd)) {
        return {
          success: true,
          pluginName,
          pluginVersion,
          metadata: {
            skipped: true,
            reason: 'Repository excluded',
          },
        };
      }
    } catch (_error) {}
  }
  return null;
}

/**
 * Check repository inclusions
 */
function checkRepoInclusions(
  cwd: string,
  includeRepos: string[],
  pluginName: string,
  pluginVersion: string
): PluginResult | null {
  if (includeRepos.length === 0) {
    return null;
  }

  let shouldInclude = false;
  for (const includePattern of includeRepos) {
    try {
      const regex = new RegExp(includePattern);
      if (regex.test(cwd)) {
        shouldInclude = true;
        break;
      }
    } catch (_error) {}
  }

  if (!shouldInclude) {
    return {
      success: true,
      pluginName,
      pluginVersion,
      metadata: {
        skipped: true,
        reason: 'Repository not in include list',
      },
    };
  }
  return null;
}

/**
 * Check custom rules
 */
function checkCustomRules(
  command: string,
  customRules: Array<{
    name: string;
    pattern: string;
    message: string;
    severity: 'block' | 'warn';
  }>,
  pluginName: string,
  pluginVersion: string
): PluginResult | null {
  for (const rule of customRules) {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(command)) {
        if (rule.severity === 'warn') {
          return {
            success: true,
            pluginName,
            pluginVersion,
            message: rule.message,
            metadata: {
              safe: false,
              blocked: false,
              warning: true,
              matchedRule: rule.name,
            },
          };
        }
        return {
          success: false,
          block: true,
          pluginName,
          pluginVersion,
          message: rule.message,
          metadata: {
            safe: false,
            blocked: true,
            matchedRule: rule.name,
          },
        };
      }
    } catch (_error) {}
  }
  return null;
}

/**
 * Git Safety Plugin
 *
 * Prevents execution of dangerous git commands that could cause data loss
 * or unwanted changes. Configurable patterns and allow lists provide
 * fine-grained control over what operations are permitted.
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "git-safety": {
 *     "blockForce": true,
 *     "warnOnly": false
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "git-safety": {
 *     "blockPatterns": [
 *       "push.*--force",
 *       "reset.*--hard",
 *       "clean.*-f.*-d"
 *     ],
 *     "allowList": [
 *       "git status",
 *       "git log",
 *       "git diff"
 *     ],
 *     "trustedDirectories": ["/safe/project/path"],
 *     "warnOnly": false
 *   }
 * }
 * ```
 */
export const gitSafetyPlugin: HookPlugin = {
  name: 'git-safety',
  version: '1.0.0',
  description: 'Prevents dangerous git operations',
  author: 'Outfitter Team',

  events: ['PreToolUse'],
  tools: ['Bash'],
  priority: 90, // High priority to intercept dangerous commands

  configSchema: GitSafetyConfigSchema as z.ZodType<Record<string, unknown>>,
  defaultConfig: {},

  async apply(
    context: HookContext,
    config: Record<string, unknown> = {}
  ): Promise<PluginResult> {
    // Only handle PreToolUse for Bash commands
    if (context.event !== 'PreToolUse' || !('toolName' in context)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    if (!isBashHookContext(context)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Parse configuration
    const safetyConfig = GitSafetyConfigSchema.parse(config);
    const command = context.toolInput.command;

    // Check repository exclusions/inclusions
    const excludeResult = checkRepoExclusions(
      context.cwd,
      safetyConfig.excludeRepos,
      this.name,
      this.version
    );
    if (excludeResult) {
      return excludeResult;
    }

    const includeResult = checkRepoInclusions(
      context.cwd,
      safetyConfig.includeRepos,
      this.name,
      this.version
    );
    if (includeResult) {
      return includeResult;
    }

    // Skip non-git commands
    if (!command.trim().toLowerCase().startsWith('git ')) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: {
          safe: true,
          reason: 'Non-git command',
        },
      };
    }

    // Check allow list first
    if (isAllowed(command, safetyConfig.allowList)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: {
          safe: true,
          allowed: true,
          scanned: true,
          command,
          reason: 'Command in allow list',
        },
      };
    }

    // Check trusted directories
    if (
      safetyConfig.trustedDirectories.length > 0 &&
      isTrustedDirectory(context.cwd, safetyConfig.trustedDirectories)
    ) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: {
          safe: true,
          reason: 'Trusted directory',
        },
      };
    }

    // Check custom rules first (they take priority over built-in patterns)
    const customRuleResult = checkCustomRules(
      command,
      safetyConfig.customRules,
      this.name,
      this.version
    );
    if (customRuleResult) {
      return customRuleResult;
    }

    // Check for dangerous patterns
    const matchedPattern = matchesPattern(command, safetyConfig.blockPatterns);
    if (matchedPattern) {
      const message = `🚫 Git command blocked: ${command} - dangerous pattern detected`;
      const reason = `Command matches dangerous pattern: ${matchedPattern}`;

      if (safetyConfig.logBlocked) {
      }

      if (safetyConfig.warnOnly) {
        return {
          success: true,
          pluginName: this.name,
          pluginVersion: this.version,
          message: `⚠️ Warning: ${message}`,
          metadata: {
            safe: false,
            blocked: false,
            warned: true,
            reason,
            matchedPattern,
          },
        };
      }

      return {
        success: false,
        block: true,
        pluginName: this.name,
        pluginVersion: this.version,
        message,
        metadata: {
          safe: false,
          blocked: true,
          reason,
          matchedPattern,
        },
      };
    }

    // Command is safe
    return {
      success: true,
      pluginName: this.name,
      pluginVersion: this.version,
      metadata: {
        safe: true,
        allowed: true,
        scanned: true,
        command,
        reason: 'No dangerous patterns matched',
      },
    };
  },

  /**
   * Initialize plugin
   */
  async init(): Promise<void> {},

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return true;
  },

  metadata: {
    name: 'git-safety',
    version: '1.0.0',
    description: 'Prevents dangerous git operations',
    author: 'Outfitter Team',
    keywords: ['git', 'safety', 'security', 'version-control'],
    license: 'MIT',
  },
};

export default gitSafetyPlugin;
