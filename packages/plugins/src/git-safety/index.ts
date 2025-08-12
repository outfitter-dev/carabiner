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
        'git show',
        'git reflog',
        'git stash list',
        'git config',
        'git remote',
        'git tag',
      ]),

    /** Custom validation rules */
    customRules: z
      .array(
        z.object({
          name: z.string(),
          pattern: z.string(),
          message: z.string(),
          severity: z.enum(['block', 'warn']).default('block'),
        })
      )
      .default([]),

    /** Whether to allow force operations with confirmation */
    allowWithConfirmation: z.boolean().default(true),

    /** Confirmation prompt message */
    confirmationMessage: z
      .string()
      .default('This is a potentially dangerous git operation. Are you sure?'),

    /** Whether to log blocked operations */
    logBlocked: z.boolean().default(true),

    /** Exclude certain repositories by path pattern */
    excludeRepos: z.array(z.string()).default([]),

    /** Include only certain repositories by path pattern */
    includeRepos: z.array(z.string()).default([]),
  })
  .default({});

type GitSafetyConfig = z.infer<typeof GitSafetyConfigSchema>;

/**
 * Extract git command from bash command string
 */
function extractGitCommand(command: string): string | null {
  // Remove leading/trailing whitespace and extract git command
  const trimmed = command.trim();

  // Check if it's a git command
  if (!trimmed.startsWith('git ')) {
    return null;
  }

  return trimmed;
}

/**
 * Check if command matches any pattern in the list
 */
function matchesPatterns(
  command: string,
  patterns: string[]
): { matched: boolean; pattern?: string } {
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(command)) {
        return { matched: true, pattern };
      }
    } catch (_error) {
      // Invalid regex - treat as literal string match
      if (command.toLowerCase().includes(pattern.toLowerCase())) {
        return { matched: true, pattern };
      }
    }
  }

  return { matched: false };
}

/**
 * Check if repository path should be excluded/included
 */
function isRepositoryInScope(cwd: string, config: GitSafetyConfig): boolean {
  // If include patterns are specified, path must match one
  if (config.includeRepos.length > 0) {
    const includeMatch = matchesPatterns(cwd, config.includeRepos);
    if (!includeMatch.matched) {
      return false;
    }
  }

  // If exclude patterns are specified, path must not match any
  if (config.excludeRepos.length > 0) {
    const excludeMatch = matchesPatterns(cwd, config.excludeRepos);
    if (excludeMatch.matched) {
      return false;
    }
  }

  return true;
}

/**
 * Create a warning result for dangerous operations
 */
function createWarningResult(
  plugin: HookPlugin,
  command: string,
  reason: string,
  config: GitSafetyConfig
): PluginResult {
  const message = `⚠️  Dangerous git operation detected: ${reason}`;

  if (config.logBlocked) {
    console.warn(`[GitSafety] Blocked: ${command} - ${reason}`);
  }

  return {
    success: false,
    block: true,
    message,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    metadata: {
      blockedCommand: command,
      reason,
      severity: 'high',
      category: 'git-safety',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Git Safety Plugin
 *
 * Prevents dangerous git operations by analyzing bash commands for risky patterns.
 * Provides configurable blocking rules with allow lists and custom validation.
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "git-safety": {
 *     "blockPatterns": ["push.*--force", "reset.*--hard"],
 *     "allowList": ["git status", "git diff"],
 *     "logBlocked": true
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "git-safety": {
 *     "blockPatterns": ["push.*--force"],
 *     "customRules": [
 *       {
 *         "name": "No main branch force push",
 *         "pattern": "push.*origin.*main.*--force",
 *         "message": "Force pushing to main branch is not allowed",
 *         "severity": "block"
 *       }
 *     ],
 *     "excludeRepos": ["/tmp/.*", ".*test.*"],
 *     "allowWithConfirmation": true
 *   }
 * }
 * ```
 */
export const gitSafetyPlugin: HookPlugin = {
  name: 'git-safety',
  version: '1.0.0',
  description:
    'Prevents dangerous git operations like force pushes and hard resets',
  author: 'Outfitter Team',

  events: ['PreToolUse'],
  tools: ['Bash'],
  priority: 90, // High priority to block before other plugins

  configSchema: GitSafetyConfigSchema,
  defaultConfig: {},

  apply(
    context: HookContext,
    config: Record<string, unknown> = {}
  ): PluginResult {
    // Only handle Bash tool usage
    if (
      context.event !== 'PreToolUse' ||
      !('toolName' in context) ||
      context.toolName !== 'Bash'
    ) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Parse and validate configuration
    const safetyConfig = GitSafetyConfigSchema.parse(config);

    // Type guard and get command and current working directory
    if (context.toolName !== 'Bash' || !('toolInput' in context)) {
      return { success: true, message: 'Not applicable to this tool' };
    }

    const bashContext = context as BashHookContext;
    const command = bashContext.toolInput.command;
    const cwd = bashContext.cwd || process.cwd();

    if (!command) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Check if repository is in scope
    if (!isRepositoryInScope(cwd, safetyConfig)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: {
          skipped: true,
          reason: 'Repository not in scope',
        },
      };
    }

    // Extract git command
    const gitCommand = extractGitCommand(command);
    if (!gitCommand) {
      // Not a git command
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Check allow list first (takes precedence)
    const allowMatch = matchesPatterns(gitCommand, safetyConfig.allowList);
    if (allowMatch.matched) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
        metadata: {
          allowed: true,
          allowPattern: allowMatch.pattern,
        },
      };
    }

    // Check custom rules
    for (const rule of safetyConfig.customRules) {
      const ruleMatch = matchesPatterns(gitCommand, [rule.pattern]);
      if (ruleMatch.matched) {
        if (rule.severity === 'warn') {
          console.warn(`[GitSafety] Warning: ${rule.message}`);
          return {
            success: true,
            pluginName: this.name,
            pluginVersion: this.version,
            message: `⚠️  ${rule.message}`,
            metadata: {
              warning: true,
              ruleName: rule.name,
              severity: 'warn',
            },
          };
        }
        return createWarningResult(
          this,
          gitCommand,
          rule.message,
          safetyConfig
        );
      }
    }

    // Check block patterns
    const blockMatch = matchesPatterns(gitCommand, safetyConfig.blockPatterns);
    if (blockMatch.matched) {
      const reason = `Command matches dangerous pattern: ${blockMatch.pattern}`;
      return createWarningResult(this, gitCommand, reason, safetyConfig);
    }

    // Command is safe
    return {
      success: true,
      pluginName: this.name,
      pluginVersion: this.version,
      metadata: {
        scanned: true,
        command: gitCommand,
        safe: true,
      },
    };
  },

  /**
   * Initialize plugin - validate git is available
   */
  async init(): Promise<void> {
    try {
      // Check if git is available
      const { spawn } = await import('node:child_process');
      const child = spawn('git', ['--version'], { stdio: 'ignore' });

      await new Promise<void>((resolve, reject) => {
        child.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Git not available (exit code: ${code})`));
          }
        });
        child.on('error', reject);
      });

      console.log('[GitSafety] Plugin initialized successfully');
    } catch (error) {
      console.warn(
        '[GitSafety] Git not available - plugin may not work correctly:',
        error
      );
    }
  },

  /**
   * Health check - ensure git is still available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { spawn } = await import('node:child_process');
      const child = spawn('git', ['--version'], { stdio: 'ignore' });

      return new Promise<boolean>((resolve) => {
        child.on('exit', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  },

  metadata: {
    name: 'git-safety',
    version: '1.0.0',
    description:
      'Prevents dangerous git operations like force pushes and hard resets',
    author: 'Outfitter Team',
    keywords: ['git', 'safety', 'security', 'version-control'],
    license: 'MIT',
  },
};

export default gitSafetyPlugin;
