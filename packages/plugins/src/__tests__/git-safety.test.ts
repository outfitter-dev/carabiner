/**
 * @file git-safety.test.ts
 * @description Tests for git safety plugin
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { gitSafetyPlugin } from '../git-safety/index';
import type { HookContext } from '@outfitter/types';

const createBashContext = (command: string): HookContext => ({
  event: 'PreToolUse',
  toolName: 'Bash',
  toolInput: { command },
  sessionId: 'test-session' as any,
  transcriptPath: '/tmp/transcript' as any,
  cwd: '/test/repo' as any,
  environment: {}
} as any);

const createNonBashContext = (): HookContext => ({
  event: 'PreToolUse',
  toolName: 'Write',
  toolInput: { file_path: '/test/file.txt', content: 'test' },
  sessionId: 'test-session' as any,
  transcriptPath: '/tmp/transcript' as any,
  cwd: '/test/repo' as any,
  environment: {}
} as any);

describe('Git Safety Plugin', () => {
  describe('Basic Functionality', () => {
    test('should have correct plugin metadata', () => {
      expect(gitSafetyPlugin.name).toBe('git-safety');
      expect(gitSafetyPlugin.version).toBe('1.0.0');
      expect(gitSafetyPlugin.events).toContain('PreToolUse');
      expect(gitSafetyPlugin.tools).toContain('Bash');
      expect(gitSafetyPlugin.priority).toBe(90);
    });

    test('should ignore non-Bash tools', () => {
      const context = createNonBashContext();
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(true);
      expect(result.pluginName).toBe('git-safety');
    });

    test('should ignore non-PreToolUse events', () => {
      const context = createBashContext('git status');
      context.event = 'PostToolUse';
      
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(true);
    });

    test('should ignore non-git commands', () => {
      const context = createBashContext('ls -la');
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(true);
      expect(result.metadata?.safe).toBe(true);
    });
  });

  describe('Safe Git Commands', () => {
    test('should allow safe git commands', () => {
      const safeCommands = [
        'git status',
        'git log',
        'git diff',
        'git branch',
        'git show',
        'git reflog'
      ];

      for (const command of safeCommands) {
        const context = createBashContext(command);
        const result = gitSafetyPlugin.apply(context);

        expect(result.success).toBe(true);
        expect(result.metadata?.allowed).toBe(true);
      }
    });

    test('should allow git commands with arguments', () => {
      const context = createBashContext('git log --oneline --graph');
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Dangerous Git Commands', () => {
    test('should block force push', () => {
      const commands = [
        'git push --force',
        'git push -f',
        'git push origin main --force',
        'git push --force-with-lease'
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = gitSafetyPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
        expect(result.message).toContain('dangerous pattern');
      }
    });

    test('should block hard reset', () => {
      const commands = [
        'git reset --hard',
        'git reset --hard HEAD~5',
        'git reset --hard origin/main'
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = gitSafetyPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
      }
    });

    test('should block dangerous clean commands', () => {
      const commands = [
        'git clean -f -d',
        'git clean -fd',
        'git clean -f -d .',
        'git clean --force -d'
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = gitSafetyPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
      }
    });

    test('should block force branch deletion', () => {
      const commands = [
        'git branch -D feature-branch',
        'git branch --delete --force main'
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = gitSafetyPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
      }
    });
  });

  describe('Configuration', () => {
    test('should respect custom block patterns', () => {
      const config = {
        blockPatterns: ['custom-dangerous-command'],
        allowList: []
      };

      const context = createBashContext('git custom-dangerous-command');
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should respect custom allow list', () => {
      const config = {
        blockPatterns: ['push.*--force'],
        allowList: ['git push --force origin feature']
      };

      const context = createBashContext('git push --force origin feature');
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.metadata?.allowed).toBe(true);
    });

    test('should use custom rules', () => {
      const config = {
        customRules: [{
          name: 'No main branch force push',
          pattern: 'push.*origin.*main.*--force',
          message: 'Force pushing to main branch is not allowed',
          severity: 'block' as const
        }]
      };

      const context = createBashContext('git push origin main --force');
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
      expect(result.message).toContain('Force pushing to main branch is not allowed');
    });

    test('should handle warning severity in custom rules', () => {
      const config = {
        customRules: [{
          name: 'Warning rule',
          pattern: 'merge.*--no-ff',
          message: 'Consider using fast-forward merge',
          severity: 'warn' as const
        }]
      };

      const context = createBashContext('git merge --no-ff feature');
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Consider using fast-forward merge');
      expect(result.metadata?.warning).toBe(true);
    });

    test('should exclude repositories based on path patterns', () => {
      const config = {
        excludeRepos: ['/tmp/.*', '.*test.*']
      };

      const context = createBashContext('git push --force');
      context.cwd = '/tmp/test-repo' as any;
      
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.metadata?.skipped).toBe(true);
    });

    test('should include only specified repositories', () => {
      const config = {
        includeRepos: ['/important/.*']
      };

      // Should skip repo not in include list
      const context1 = createBashContext('git push --force');
      context1.cwd = '/unimportant/repo' as any;
      
      const result1 = gitSafetyPlugin.apply(context1, config);
      expect(result1.success).toBe(true);
      expect(result1.metadata?.skipped).toBe(true);

      // Should process repo in include list
      const context2 = createBashContext('git push --force');
      context2.cwd = '/important/repo' as any;
      
      const result2 = gitSafetyPlugin.apply(context2, config);
      expect(result2.success).toBe(false);
      expect(result2.block).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty command', () => {
      const context = createBashContext('');
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(true);
    });

    test('should handle commands with multiple spaces', () => {
      const context = createBashContext('git    push    --force');
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should handle case insensitive patterns', () => {
      const context = createBashContext('GIT PUSH --FORCE');
      const result = gitSafetyPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should handle git aliases and shortcuts', () => {
      const context = createBashContext('git pf'); // Assuming pf is alias for push --force
      const config = {
        customRules: [{
          name: 'Block git aliases',
          pattern: '\\bpf\\b',
          message: 'Dangerous git alias detected',
          severity: 'block' as const
        }]
      };
      
      const result = gitSafetyPlugin.apply(context, config);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should provide detailed metadata', () => {
      const context = createBashContext('git status');
      const result = gitSafetyPlugin.apply(context);

      expect(result.metadata?.scanned).toBe(true);
      expect(result.metadata?.command).toBe('git status');
      expect(result.metadata?.safe).toBe(true);
    });
  });

  describe('Plugin Lifecycle', () => {
    test('should have init method', () => {
      expect(typeof gitSafetyPlugin.init).toBe('function');
    });

    test('should have healthCheck method', () => {
      expect(typeof gitSafetyPlugin.healthCheck).toBe('function');
    });

    test('should have proper metadata', () => {
      expect(gitSafetyPlugin.metadata).toBeDefined();
      expect(gitSafetyPlugin.metadata?.name).toBe('git-safety');
      expect(gitSafetyPlugin.metadata?.keywords).toContain('git');
      expect(gitSafetyPlugin.metadata?.keywords).toContain('safety');
    });
  });
});