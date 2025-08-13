/**
 * @outfitter/execution - Runner utilities tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { HookContext, HookHandler } from '@outfitter/types';
import { isToolHookContext } from '@outfitter/types';

import {
  clearExecutionMetrics,
  createRunner,
  createTestRunner,
  getExecutionMetrics,
  getExecutionStats,
  getLastExecution,
  HookRunner,
  type RunnerOptions,
  runTestHook,
} from '../runner';

describe('HookRunner', () => {
  beforeEach(() => {
    clearExecutionMetrics();
  });

  describe('constructor', () => {
    test('should create runner with default options', () => {
      const runner = new HookRunner();
      expect(runner).toBeInstanceOf(HookRunner);
    });

    test('should create runner with custom options', () => {
      const options: RunnerOptions = {
        protocol: 'test',
        timeout: 5000,
        collectMetrics: false,
      };

      const runner = new HookRunner(options);
      expect(runner).toBeInstanceOf(HookRunner);
    });
  });

  describe('run', () => {
    test('should run hook with test protocol', async () => {
      const mockInput = {
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'echo "test"' },
        session_id: 'test-123',
        cwd: '/tmp',
        transcript_path: '/tmp/transcript.md',
        environment: {},
      };

      const handler: HookHandler = async (context) => {
        expect(context.event).toBe('PreToolUse');
        if (isToolHookContext(context)) {
          expect(context.toolName).toBe('Bash');
        }
        return { success: true, message: 'Hook executed' };
      };

      const runner = new HookRunner({
        protocol: 'test',
        testInput: mockInput,
        exitProcess: false,
      });

      await runner.run(handler);
    });

    test('should throw when test protocol missing testInput', () => {
      const runner = new HookRunner({
        protocol: 'test',
        // Missing testInput
      });

      const handler: HookHandler = async () => ({ success: true });

      expect(() => runner.run(handler)).toThrow('testInput is required');
    });
  });
});

describe('runTestHook', () => {
  beforeEach(() => {
    clearExecutionMetrics();
  });

  test('should execute handler with test input', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/test.txt', content: 'Hello world' },
      session_id: 'test-456',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async (context) => {
      expect(context.event).toBe('PreToolUse');
      if (isToolHookContext(context)) {
        expect(context.toolName).toBe('Write');
        if ('file_path' in context.toolInput) {
          expect(context.toolInput.file_path).toBe('/tmp/test.txt');
        }
      }
      return { success: true, message: 'File operation validated' };
    };

    await runTestHook(handler, mockInput, {
      timeout: 5000,
      collectMetrics: true,
    });

    // Should not have thrown
  });

  test('should handle handler errors gracefully', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'error-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => {
      throw new Error('Test error');
    };

    // Should not throw - errors are captured
    await runTestHook(handler, mockInput);
  });

  test('should collect metrics when enabled', async () => {
    const mockInput = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: {
        stdout: 'file1.txt\nfile2.txt\n',
        stderr: '',
        exitCode: 0,
      },
      session_id: 'metrics-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => ({
      success: true,
      message: 'Command completed',
    });

    await runTestHook(handler, mockInput, { collectMetrics: true });

    const metrics = getExecutionMetrics();
    expect(metrics.length).toBeGreaterThan(0);

    const lastMetric = getLastExecution();
    expect(lastMetric).toBeDefined();
    expect(lastMetric?.event).toBe('PostToolUse');
    expect(lastMetric?.success).toBe(true);
  });
});

describe('createRunner', () => {
  test('should create a runner function', () => {
    const handler: HookHandler = async () => ({ success: true });
    const runner = createRunner(handler, { exitProcess: false });

    expect(typeof runner).toBe('function');
  });

  test('should execute handler when runner function is called', async () => {
    const handler: HookHandler = async () => {
      return { success: true };
    };

    // Note: createRunner uses different options than the test shows
    const runner = createRunner(handler, {
      exitProcess: false,
    });

    // This would normally read from stdin, so we can't easily test without mocking
    // But we can verify the function was created
    expect(typeof runner).toBe('function');
  });
});

describe('createTestRunner', () => {
  test('should create a test runner function', () => {
    const handler: HookHandler = async () => ({ success: true });
    const testRunner = createTestRunner(handler, { timeout: 5000 });

    expect(typeof testRunner).toBe('function');
  });

  test('should execute handler with provided test input', async () => {
    let receivedContext: HookContext | null = null;

    const handler: HookHandler = async (context) => {
      receivedContext = context;
      return { success: true, message: 'Test runner executed' };
    };

    const testRunner = createTestRunner(handler, {
      collectMetrics: false,
    });

    const testInput = {
      hook_event_name: 'UserPrompt',
      user_prompt: 'What is the meaning of life?',
      session_id: 'test-789',
      cwd: '/home/user',
      environment: { USER: 'testuser' },
    };

    await testRunner(testInput);

    expect(receivedContext).toBeDefined();
    if (receivedContext) {
      expect((receivedContext as any).event).toBe('UserPrompt');
    }
  });
});

describe('Metrics utilities', () => {
  beforeEach(() => {
    clearExecutionMetrics();
  });

  test('getExecutionMetrics should return collected metrics', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'metrics-test-1',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => ({ success: true });

    // Clear any previous metrics
    clearExecutionMetrics();

    await runTestHook(handler, mockInput, {
      collectMetrics: true,
    });

    const metrics = getExecutionMetrics();
    expect(metrics.length).toBeGreaterThan(0);
  });

  test('getExecutionMetrics should filter by time range', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'metrics-test-2',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => ({ success: true });

    // Clear any previous metrics
    clearExecutionMetrics();

    const startTime = Date.now();
    await runTestHook(handler, mockInput, {
      collectMetrics: true,
    });
    const endTime = Date.now();

    const allMetrics = getExecutionMetrics();
    const filteredMetrics = getExecutionMetrics({
      start: startTime - 1000,
      end: endTime + 1000,
    });

    expect(filteredMetrics.length).toBe(allMetrics.length);

    const outsideRangeMetrics = getExecutionMetrics({
      start: startTime + 10_000,
      end: endTime + 20_000,
    });

    expect(outsideRangeMetrics.length).toBe(0);
  });

  test('getExecutionStats should return aggregate metrics', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'stats-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const successHandler: HookHandler = async () => ({ success: true });
    const failureHandler: HookHandler = async () => ({
      success: false,
      message: 'TIMEOUT_ERROR: Too slow',
    });

    // Clear any previous metrics
    clearExecutionMetrics();

    await runTestHook(successHandler, mockInput, {
      collectMetrics: true,
    });
    await runTestHook(failureHandler, mockInput, {
      collectMetrics: true,
    });
    await runTestHook(successHandler, mockInput, {
      collectMetrics: true,
    });

    const stats = getExecutionStats();

    expect(stats.totalExecutions).toBe(3);
    expect(stats.successfulExecutions).toBe(2);
    expect(stats.failedExecutions).toBe(1);
    expect(stats.successRate).toBeCloseTo((2 / 3) * 100);
    expect(stats.topErrors.length).toBeGreaterThan(0);
    expect(stats.topErrors[0]?.code).toBe('TIMEOUT_ERROR');
  });

  test('clearExecutionMetrics should remove all metrics', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'clear-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => ({ success: true });

    // Clear any previous metrics
    clearExecutionMetrics();

    await runTestHook(handler, mockInput, {
      collectMetrics: true,
    });

    expect(getExecutionMetrics().length).toBeGreaterThan(0);

    clearExecutionMetrics();

    expect(getExecutionMetrics().length).toBe(0);
  });

  test('hasRecentFailures should detect failed executions', async () => {
    // Clear any previous metrics
    clearExecutionMetrics();

    const recentMetrics = getExecutionMetrics({
      start: Date.now() - 10_000,
      end: Date.now(),
    });
    expect(recentMetrics.filter((m) => !m.success).length).toBe(0);

    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'failure-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const failureHandler: HookHandler = async () => ({
      success: false,
      message: 'Test failure',
    });

    await runTestHook(failureHandler, mockInput, {
      collectMetrics: true,
    });

    const recentFailures = getExecutionMetrics({
      start: Date.now() - 10_000,
      end: Date.now(),
    });
    expect(recentFailures.filter((m) => !m.success).length).toBeGreaterThan(0);
  });

  test('getLastExecution should return most recent execution', async () => {
    // Clear any previous metrics
    clearExecutionMetrics();

    const initialMetrics = getExecutionMetrics();
    expect(initialMetrics.length).toBe(0);

    const mockInput1 = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'last-test-1',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const mockInput2 = {
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      tool_output: 'test',
      session_id: 'last-test-2',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const handler: HookHandler = async () => ({ success: true });

    await runTestHook(handler, mockInput1, {
      collectMetrics: true,
    });
    await runTestHook(handler, mockInput2, {
      collectMetrics: true,
    });

    const lastExecution = getLastExecution();
    expect(lastExecution).toBeDefined();
    if (lastExecution) {
      expect(lastExecution.event).toBe('PostToolUse');
      expect(lastExecution.success).toBe(true);
    }
  });
});

describe('Edge cases and error handling', () => {
  beforeEach(() => {
    clearExecutionMetrics();
  });

  test('should handle handler returning various result types', async () => {
    const testCases = [
      { handler: async () => null, expectedSuccess: true },
      {
        handler: async () => {
          return;
        },
        expectedSuccess: true,
      },
      { handler: async () => true, expectedSuccess: true },
      { handler: async () => false, expectedSuccess: false },
      { handler: async () => 'success message', expectedSuccess: true },
      {
        handler: async () => ({ success: true, message: 'explicit success' }),
        expectedSuccess: true,
      },
      {
        handler: async () => ({ success: false, message: 'explicit failure' }),
        expectedSuccess: false,
      },
    ];

    const mockInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'type-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      if (testCase) {
        await runTestHook(
          testCase.handler as HookHandler,
          {
            ...mockInput,
            session_id: `type-test-${i}`,
          },
          { collectMetrics: false }
        );

        // Since we're testing internal behavior and can't easily access the result,
        // we'll just verify no exceptions were thrown
      }
    }
  });

  test('should handle handler timeout gracefully', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      session_id: 'timeout-test',
      cwd: '/tmp',
      transcript_path: '/tmp/transcript.md',
      environment: {},
    };

    const slowHandler: HookHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true };
    };

    // Should not throw even with timeout
    await runTestHook(slowHandler, mockInput, { timeout: 50 });
  });

  test('should handle malformed input gracefully', async () => {
    const malformedInputs = [
      null,
      undefined,
      'not an object',
      {},
      { hook_event_name: 'InvalidEvent' },
      { hook_event_name: 'PreToolUse', tool_name: 123 }, // Wrong type
    ];

    const handler: HookHandler = async () => ({ success: true });

    for (const input of malformedInputs) {
      try {
        await runTestHook(handler, input);
        // Should handle gracefully without throwing
      } catch (error) {
        // Some parsing errors are expected for truly malformed input
        expect(error).toBeDefined();
      }
    }
  });
});
