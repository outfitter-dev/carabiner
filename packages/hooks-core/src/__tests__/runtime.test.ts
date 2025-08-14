/**
 * Runtime tests for hook execution and context management
 */

import { describe, expect, test } from 'bun:test';
import {
  createBashContext,
  createFileContext,
  createHookContext,
  HookResults,
  outputHookResult,
  safeHookExecution,
} from '../runtime';
import type { HookContext, HookHandler } from '../types';

describe('Runtime - Context Creation', () => {
  test('should create Bash context correctly', () => {
    const context = createBashContext('PreToolUse', 'echo test');

    expect(context.event).toBe('PreToolUse');
    expect(context.toolName).toBe('Bash');
    expect(context.sessionId).toBe('test-session');
    expect(context.toolInput).toEqual({ command: 'echo test' });
  });

  test('should create File context for Write operation', () => {
    const context = createFileContext('PostToolUse', 'Write', 'test.ts');

    expect(context.event).toBe('PostToolUse');
    expect(context.toolName).toBe('Write');
    expect(context.toolInput.file_path).toBe('test.ts');
  });

  test('should create File context for Edit operation', () => {
    const context = createFileContext('PreToolUse', 'Edit', 'test.ts');

    expect(context.event).toBe('PreToolUse');
    expect(context.toolName).toBe('Edit');
    expect(context.toolInput.file_path).toBe('test.ts');
  });

  test('should create File context for Read operation', () => {
    const context = createFileContext('PreToolUse', 'Read', 'test.ts');

    expect(context.event).toBe('PreToolUse');
    expect(context.toolName).toBe('Read');
    expect(context.toolInput.file_path).toBe('test.ts');
  });
});

describe('Runtime - Hook Execution (success & error)', () => {
  test('should execute successful hook', async () => {
    const handler: HookHandler = (_context) => {
      return HookResults.success('Hook executed', { test: true });
    };

    const context: HookContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      sessionId: 'test',
      transcriptPath: '/test',
      cwd: '/test',
      toolInput: { command: 'test' },
      environment: {},
      rawInput: {
        session_id: 'test',
        transcript_path: '/test',
        cwd: '/test',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'test' },
      },
    };

    const result = await safeHookExecution(handler, context);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Hook executed');
    expect(result.data).toEqual({ test: true });
  });

  test('should handle hook errors properly', async () => {
    const handler: HookHandler = () => {
      throw new Error('Test error');
    };

    const context: HookContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      sessionId: 'test',
      transcriptPath: '/test',
      cwd: '/test',
      toolInput: { command: 'test' },
      environment: {},
      rawInput: {
        session_id: 'test',
        transcript_path: '/test',
        cwd: '/test',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'test' },
      },
    };

    const result = await safeHookExecution(handler, context);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Test error');
  });
});

describe('Runtime - Hook Execution (control flow)', () => {
  test('should handle blocking results for PreToolUse', async () => {
    const handler: HookHandler = () => {
      return HookResults.block('Operation blocked');
    };

    const context: HookContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      sessionId: 'test',
      transcriptPath: '/test',
      cwd: '/test',
      toolInput: { command: 'rm -rf /' },
      environment: {},
      rawInput: {
        session_id: 'test',
        transcript_path: '/test',
        cwd: '/test',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
      },
    };

    const result = await safeHookExecution(handler, context);

    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
    expect(result.message).toBe('Operation blocked');
  });

  test('should handle skip results', async () => {
    const handler: HookHandler = () => {
      return HookResults.skip('Hook skipped');
    };

    const context: HookContext = {
      event: 'SessionStart',
      sessionId: 'test',
      transcriptPath: '/test',
      cwd: '/test',
      toolInput: {},
      environment: {},
      rawInput: {
        session_id: 'test',
        transcript_path: '/test',
        cwd: '/test',
        hook_event_name: 'SessionStart',
        message: 'Session started',
      },
    };

    const result = await safeHookExecution(handler, context);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Hook skipped');
  });
});

describe('Runtime - createHookContext', () => {
  test('should create context from raw input', () => {
    const rawInput = {
      session_id: 'test-123',
      transcript_path: '/transcript',
      cwd: '/workspace',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    };

    const context = createHookContext(rawInput);

    expect(context.event).toBe('PreToolUse');
    expect(context.toolName).toBe('Bash');
    expect(context.sessionId).toBe('test-123');
    expect(context.cwd).toBe('/workspace');
    expect(context.toolInput).toEqual({ command: 'ls -la' });
  });

  test('should handle SessionStart event', () => {
    const rawInput = {
      session_id: 'test-123',
      transcript_path: '/transcript',
      cwd: '/workspace',
      hook_event_name: 'SessionStart',
      message: 'Session started',
    };

    const context = createHookContext(rawInput);

    expect(context.event).toBe('SessionStart');
    expect(context.toolName).toBeUndefined();
    expect(context.sessionId).toBe('test-123');
  });

  test('should handle UserPromptSubmit event', () => {
    const rawInput = {
      session_id: 'test-123',
      transcript_path: '/transcript',
      cwd: '/workspace',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Test prompt', // Changed from user_prompt to prompt
    };

    const context = createHookContext(rawInput);

    expect(context.event).toBe('UserPromptSubmit');
    expect(context.userPrompt).toBe('Test prompt');
  });
});

describe('Runtime - HookResults Utility', () => {
  test('should create success result', () => {
    const result = HookResults.success('Success message', { data: 'test' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Success message');
    expect(result.data).toEqual({ data: 'test' });
    expect(result.block).toBeUndefined();
  });

  test('should create failure result', () => {
    const result = HookResults.failure('Failure message');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Failure message');
    expect(result.block).toBe(false); // Default is false, not undefined
  });

  test('should create block result', () => {
    const result = HookResults.block('Blocked message');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Blocked message');
    expect(result.block).toBe(true);
  });

  test('should create skip result', () => {
    const result = HookResults.skip('Skip message');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Skip message');
    // skip is not a property in the result, it's just a success with a message
  });

  test('should create warn result', () => {
    const result = HookResults.warn('Warning message', { level: 'warning' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Warning message');
    expect(result.data).toEqual({ level: 'warning' });
  });
});

describe('Runtime - Output Handling (exit-code mode)', () => {
  test('should be testable with custom exit handler', () => {
    const result = HookResults.success('Test message');
    let exitCode: number | undefined;

    const mockExitHandler = (code: number): never => {
      exitCode = code;
      throw new Error(`Mock exit with code ${code}`);
    };

    expect(() => {
      outputHookResult(result, 'exit-code', mockExitHandler);
    }).toThrow('Mock exit with code 0');

    expect(exitCode).toBe(0);
  });

  test('should handle blocking errors with exit code 2', () => {
    const result = HookResults.block('Blocked operation');
    let exitCode: number | undefined;

    const mockExitHandler = (code: number): never => {
      exitCode = code;
      throw new Error(`Mock exit with code ${code}`);
    };

    expect(() => {
      outputHookResult(result, 'exit-code', mockExitHandler);
    }).toThrow('Mock exit with code 2');

    expect(exitCode).toBe(2);
  });

  test('should handle non-blocking errors with exit code 1', () => {
    const result = HookResults.failure('Non-blocking error');
    let exitCode: number | undefined;

    const mockExitHandler = (code: number): never => {
      exitCode = code;
      throw new Error(`Mock exit with code ${code}`);
    };

    expect(() => {
      outputHookResult(result, 'exit-code', mockExitHandler);
    }).toThrow('Mock exit with code 1');

    expect(exitCode).toBe(1);
  });
});

describe('Runtime - Output Handling (json mode)', () => {
  test('should handle JSON mode with custom exit handler', () => {
    const result = HookResults.success('Test message');
    let exitCode: number | undefined;
    let consoleOutput: string | undefined;

    // Mock console.log to capture JSON output
    // biome-ignore lint/suspicious/noConsole: mocking console.log for test
    const originalLog = console.log;
    console.log = (message: string) => {
      consoleOutput = message;
    };

    const mockExitHandler = (code: number): never => {
      exitCode = code;
      throw new Error(`Mock exit with code ${code}`);
    };

    try {
      expect(() => {
        outputHookResult(result, 'json', mockExitHandler);
      }).toThrow('Mock exit with code 0'); // JSON mode always exits 0

      expect(exitCode).toBe(0);
      expect(consoleOutput).toBe(
        '{"action":"continue","message":"Test message"}'
      );
    } finally {
      // Restore console.log
      console.log = originalLog;
    }
  });
});
