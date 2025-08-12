/**
 * @file git-safety/index.ts
 * @description Git safety plugin - prevents dangerous git operations
 *
 * This plugin blocks potentially dangerous git commands like force pushes,
 * hard resets, and other destructive operations. It provides configurable
 * patterns and allow lists for fine-tuned control.
 */

import type { HookContext } from '@outfitter/types';
import { z } from 'zod';
import type { HookPlugin, PluginResult } from '../../../registry/src';

interface BashHookContext extends HookContext {
  readonly toolName: 'Bash';
  readonly toolInput: {
    readonly command: string;
    readonly description?: string;
    readonly timeout?: number;
  };
  readonly cwd: string;
}

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
        'clean.*-f.*-d',
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
        'git branch',
        'git checkout',
        'git add',
        'git commit',
        'git pull',
        'git fetch',
        'git merge',
        'git rebase',
        'git stash',
        'git clone',
        'git init',
        'git config',
        'git remote',
        'git tag',
        'git show',
        'git rev-parse',
      ]),

    /** Whether to block force operations */
    blockForce: z.boolean().default(true),

    /** Whether to allow operations in specific directories */
    trustedDirectories: z
      .array(z.string())
      .default([]),

    /** Whether to log blocked commands */
    logBlocked: z.boolean().default(true),

    /** Whether to warn about potentially dangerous commands */
    warnOnly: z.boolean().default(false),
  })
  .default({});

type GitSafetyConfig = z.infer<typeof GitSafetyConfigSchema>;

/**
 * Check if command matches any pattern
 */
function matchesPattern(command: string, patterns: string[]): string | null {
  const gitCommand = command.trim();

  // Only check git commands
  if (!gitCommand.startsWith('git ')) {
    return null;
  }

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(gitCommand)) {
        return pattern;
      }
    } catch (error) {
      console.warn(`[GitSafety] Invalid regex pattern: ${pattern}`, error);
    }
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
      const regex = new RegExp(`^${allowed.toLowerCase()}`, 'i');
      return regex.test(gitCommand);
    } catch (error) {
      console.warn(`[GitSafety] Invalid allow pattern: ${allowed}`, error);
      return false;
    }
  });
}

/**
 * Check if directory is trusted
 */
function isTrustedDirectory(cwd: string, trustedDirectories: string[]): boolean {
  return trustedDirectories.some((trusted) => {
    try {
      // Normalize paths for comparison
      const normalizedCwd = cwd.toLowerCase();
      const normalizedTrusted = trusted.toLowerCase();

      return normalizedCwd.includes(normalizedTrusted) ||
        normalizedCwd.startsWith(normalizedTrusted);
    } catch (error) {
      console.warn(`[GitSafety] Error checking trusted directory: ${trusted}`, error);
      return false;
    }
  });
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

  configSchema: GitSafetyConfigSchema,
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

    const bashContext = context as BashHookContext;
    if (bashContext.toolName !== 'Bash') {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Parse configuration
    const safetyConfig = GitSafetyConfigSchema.parse(config);
    const command = bashContext.toolInput.command;

    // Skip non-git commands
    if (!command.trim().startsWith('git ')) {
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
          reason: 'Command in allow list',
        },
      };
    }

    // Check trusted directories
    if (
      safetyConfig.trustedDirectories.length > 0 &&
      isTrustedDirectory(bashContext.cwd, safetyConfig.trustedDirectories)
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

    // Check for dangerous patterns
    const matchedPattern = matchesPattern(command, safetyConfig.blockPatterns);
    if (matchedPattern) {
      const message = `🚫 Git command blocked: ${command}`;
      const reason = `Command matches dangerous pattern: ${matchedPattern}`;

      if (safetyConfig.logBlocked) {
        console.warn(`[GitSafety] Blocked: ${command} - ${reason}`);
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
        reason: 'No dangerous patterns matched',
      },
    };
  },

  /**
   * Initialize plugin
   */
  async init(): Promise<void> {
    console.log('[GitSafety] Git safety plugin initialized');
  },

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