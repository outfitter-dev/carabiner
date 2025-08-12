/**
 * @outfitter/execution - Integration tests demonstrating the execution engine
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { HookContext, HookHandler } from '@outfitter/types';
import {
  createDirectoryPath,
  createSessionId,
  createTranscriptPath,
} from '@outfitter/types';
import {
  ExecutionTimer,
  MetricsCollector,
  snapshotMemoryUsage,
} from '../metrics';
import { failure, isSuccess, success } from '../result';

describe('Execution Engine Integration', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
  });

  test('should demonstrate complete execution flow with metrics', async () => {
    // Create a mock context (normally comes from protocol parsing)
    const mockContext: HookContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      sessionId: createSessionId('integration-test-123'),
      cwd: createDirectoryPath('/tmp'),
      environment: { PATH: '/usr/bin' },
      toolInput: { command: 'echo "Hello World"' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    } as HookContext;

    // Create a handler that validates bash commands
    const securityHandler: HookHandler = async (context) => {
      if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
        const command = (context as any).toolInput.command;

        // Block dangerous commands
        const dangerousPatterns = ['rm -rf', 'sudo', '> /dev/null'];
        for (const pattern of dangerousPatterns) {
          if (command.includes(pattern)) {
            return {
              success: false,
              block: true,
              message: `Dangerous command blocked: ${pattern}`,
            };
          }
        }
      }

      return { success: true, message: 'Command approved' };
    };

    // Simulate execution timing and metrics collection
    const timer = new ExecutionTimer();
    const memoryBefore = snapshotMemoryUsage();

    timer.markPhase('input');
    // Simulate parsing delay
    await new Promise((resolve) => setTimeout(resolve, 1));
    timer.markPhase('parsing');
    // Execute the handler
    const result = await securityHandler(mockContext);

    timer.markPhase('execution');
    // Simulate output delay
    await new Promise((resolve) => setTimeout(resolve, 1));

    timer.markPhase('output');
    const memoryAfter = snapshotMemoryUsage();

    // Record metrics
    metricsCollector.record(
      mockContext,
      result,
      timer.getTiming(),
      memoryBefore,
      memoryAfter,
      { test: 'integration' }
    );

    // Verify execution results
    expect(result.success).toBe(true);
    expect(result.message).toBe('Command approved');

    // Verify metrics were collected
    const metrics = metricsCollector.getMetrics();
    expect(metrics).toHaveLength(1);

    const metric = metrics[0];
    expect(metric).toBeDefined();
    if (metric) {
      expect(metric.event).toBe('PreToolUse');
      expect(metric.success).toBe(true);
      expect(metric.timing.duration).toBeGreaterThan(0);
      expect(metric.timing.phases.input).toBeGreaterThanOrEqual(0);
      expect(metric.timing.phases.execution).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle execution errors gracefully', async () => {
    const mockContext: HookContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      sessionId: createSessionId('error-test'),
      cwd: '/tmp',
      environment: {},
      toolInput: { command: 'rm -rf /' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    } as HookContext;

    const securityHandler: HookHandler = async (context) => {
      if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
        const command = (context as any).toolInput.command;

        if (command.includes('rm -rf /')) {
          return {
            success: false,
            block: true,
            message: 'SECURITY_ERROR: Dangerous command blocked',
          };
        }
      }

      return { success: true };
    };

    const timer = new ExecutionTimer();
    const memoryBefore = snapshotMemoryUsage();

    const result = await securityHandler(mockContext);

    const memoryAfter = snapshotMemoryUsage();

    metricsCollector.record(
      mockContext,
      result,
      timer.getTiming(),
      memoryBefore,
      memoryAfter
    );

    // Verify the dangerous command was blocked
    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
    expect(result.message).toContain('SECURITY_ERROR');

    // Verify metrics show the failure
    const aggregate = metricsCollector.getAggregateMetrics();
    expect(aggregate).toBeDefined();
    if (aggregate) {
      expect(aggregate.failedExecutions).toBe(1);
      expect(aggregate.successRate).toBe(0);
      expect(aggregate.topErrors[0]).toBeDefined();
      if (aggregate.topErrors[0]) {
        expect(aggregate.topErrors[0].code).toBe('SECURITY_ERROR');
      }
    }
  });

  test('should handle Result type operations', async () => {
    // Simulate operations that may succeed or fail
    const parseConfig = (input: string) => {
      try {
        const config = JSON.parse(input);
        return success(config);
      } catch (error) {
        return failure(error as Error);
      }
    };

    const validateConfig = (config: any) => {
      if (!config.timeout || config.timeout < 0) {
        return failure(new Error('Invalid timeout configuration'));
      }
      return success(config);
    };

    // Test successful chain
    const validInput = '{"timeout": 5000, "enabled": true}';
    const parseResult = parseConfig(validInput);

    expect(isSuccess(parseResult)).toBe(true);

    if (isSuccess(parseResult)) {
      const validateResult = validateConfig(parseResult.value);
      expect(isSuccess(validateResult)).toBe(true);
    }

    // Test failure chain
    const invalidInput = '{"timeout": -1}';
    const invalidParseResult = parseConfig(invalidInput);

    expect(isSuccess(invalidParseResult)).toBe(true); // JSON is valid

    if (isSuccess(invalidParseResult)) {
      const invalidValidateResult = validateConfig(invalidParseResult.value);
      expect(isSuccess(invalidValidateResult)).toBe(false);
    }
  });

  test('should demonstrate performance monitoring', async () => {
    const contexts = [
      { event: 'PreToolUse', tool: 'Bash', fast: true },
      { event: 'PreToolUse', tool: 'Write', fast: false },
      { event: 'PostToolUse', tool: 'Bash', fast: true },
    ];

    // Simulate multiple executions with different performance characteristics
    for (let i = 0; i < contexts.length; i++) {
      const contextItem = contexts[i];
      if (!contextItem) {
        continue;
      }

      const context = {
        event: contextItem.event,
        toolName: contextItem.tool,
        sessionId: createSessionId(`perf-test-${i}`),
        cwd: '/tmp',
        environment: {},
        toolInput: { command: 'test' },
        transcriptPath: createTranscriptPath('/tmp/transcript.md'),
      } as HookContext;

      const handler: HookHandler = async () => {
        // Simulate work
        const delay = contextItem.fast ? 1 : 10;
        await new Promise((resolve) => setTimeout(resolve, delay));

        return { success: true, message: `${contextItem.tool} completed` };
      };

      const memoryBefore = snapshotMemoryUsage();
      const timer = new ExecutionTimer();

      const result = await handler(context);

      const memoryAfter = snapshotMemoryUsage();

      metricsCollector.record(
        context,
        result,
        timer.getTiming(),
        memoryBefore,
        memoryAfter
      );
    }

    // Analyze performance metrics
    const stats = metricsCollector.getAggregateMetrics();

    expect(stats).toBeDefined();
    if (stats) {
      expect(stats.totalExecutions).toBe(3);
      expect(stats.successfulExecutions).toBe(3);
      expect(stats.successRate).toBe(100);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.minDuration).toBeGreaterThanOrEqual(0);
      expect(stats.maxDuration).toBeGreaterThanOrEqual(stats.minDuration);
      expect(stats.eventBreakdown).toBeDefined();
      if (stats.eventBreakdown) {
        expect(stats.eventBreakdown.PreToolUse).toBe(2);
        expect(stats.eventBreakdown.PostToolUse).toBe(1);
      }
    }
  });

  test('should handle concurrent executions', async () => {
    const handlers = [
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { success: true, message: 'Handler 1' };
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 3));
        return { success: true, message: 'Handler 2' };
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 7));
        return { success: false, message: 'Handler 3 failed' };
      },
    ];

    const promises = handlers.map(async (handler, index) => {
      const context = {
        event: 'PreToolUse',
        sessionId: createSessionId(`concurrent-${index}`),
        cwd: '/tmp',
        environment: {},
        toolName: 'Bash',
        toolInput: { command: 'test' },
        transcriptPath: createTranscriptPath('/tmp/transcript.md'),
      } as HookContext;

      const timer = new ExecutionTimer();
      const memoryBefore = snapshotMemoryUsage();

      const result = await handler();

      const memoryAfter = snapshotMemoryUsage();

      metricsCollector.record(
        context,
        result,
        timer.getTiming(),
        memoryBefore,
        memoryAfter
      );

      return result;
    });

    const results = await Promise.all(promises);

    // Verify all handlers completed
    expect(results).toHaveLength(3);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(true);
    expect(results[2]?.success).toBe(false);

    // Verify metrics captured all executions
    const stats = metricsCollector.getAggregateMetrics();
    expect(stats).toBeDefined();
    if (stats) {
      expect(stats.totalExecutions).toBe(3);
      expect(stats.successfulExecutions).toBe(2);
      expect(stats.failedExecutions).toBe(1);
    }
  });
});
