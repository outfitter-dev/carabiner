/**
 * Tests for Bash Command Validator Hook
 */

import { describe, expect, test } from 'bun:test';
import type {
  DirectoryPath,
  SessionId,
  TranscriptPath,
} from '@carabiner/types';
import {
  type CreateContextOptions,
  createToolHookContext,
} from '@carabiner/types';
import {
  bashCommandValidatorHook,
  VALIDATION_RULES,
  validateCommand,
} from '../bash-command-validator';

// Helper function to create test context options
const createTestContextOptions = (): CreateContextOptions => ({
  sessionId: 'test-session' as SessionId,
  transcriptPath: '/tmp/test-transcript.json' as TranscriptPath,
  cwd: '/test/directory' as DirectoryPath,
  matcher: 'test-matcher',
  environment: {},
});

describe('Bash Command Validator', () => {
  describe('validateCommand', () => {
    test('should detect grep usage without pipe', () => {
      const issues = validateCommand('grep "pattern" file.txt');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('ripgrep');
    });

    test('should allow grep with pipe', () => {
      const issues = validateCommand('cat file | grep pattern');
      // cat | grep is detected by a different rule
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('rg pattern file');
    });

    test('should detect find -name usage', () => {
      const issues = validateCommand('find . -name "*.js"');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('rg --files');
    });

    test('should detect cat | grep pattern', () => {
      const issues = validateCommand('cat file.txt | grep error');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('rg pattern file');
    });

    test('should detect ls | grep pattern', () => {
      const issues = validateCommand('ls -la | grep test');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('ls pattern*');
    });

    test('should detect ps aux | grep pattern', () => {
      const issues = validateCommand('ps aux | grep node');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('pgrep');
    });

    test('should return empty array for valid commands', () => {
      const issues = validateCommand('rg "pattern" file.txt');
      expect(issues).toHaveLength(0);
    });

    test('should detect multiple issues', () => {
      const issues = validateCommand(
        'grep pattern file && find . -name "*.txt"'
      );
      expect(issues).toHaveLength(2);
    });
  });

  describe('bashCommandValidatorHook', () => {
    test('should continue for non-Bash tools', async () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Edit',
        { file_path: 'test.txt' },
        createTestContextOptions()
      );

      const result = await bashCommandValidatorHook(context);
      expect(result.success).toBe(true);
      expect(result.block).toBeUndefined();
    });

    test('should continue for Bash without command', async () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Bash',
        {},
        createTestContextOptions()
      );

      const result = await bashCommandValidatorHook(context);
      expect(result.success).toBe(true);
      expect(result.block).toBeUndefined();
    });

    test('should block inefficient grep command', async () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'grep "error" logs.txt' },
        createTestContextOptions()
      );

      const result = await bashCommandValidatorHook(context);
      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
      expect(result.message).toContain('ripgrep');
    });

    test('should continue for efficient commands', async () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'rg "pattern" file.txt' },
        createTestContextOptions()
      );

      const result = await bashCommandValidatorHook(context);
      expect(result.success).toBe(true);
      expect(result.block).toBeUndefined();
    });

    test('should include validation errors in modified input', async () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'grep "test" file.txt' },
        createTestContextOptions()
      );

      const result = await bashCommandValidatorHook(context);
      expect(result.success).toBe(false);
      expect(result.data?.modifiedInput?._validation_errors).toBeDefined();
      expect(result.data?.modifiedInput._validation_errors).toHaveLength(1);
    });
  });

  describe('VALIDATION_RULES', () => {
    test('should have correct number of rules', () => {
      expect(VALIDATION_RULES.length).toBeGreaterThanOrEqual(5);
    });

    test('each rule should have pattern and message', () => {
      for (const [pattern, message] of VALIDATION_RULES) {
        expect(pattern).toBeInstanceOf(RegExp);
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      }
    });
  });
});
