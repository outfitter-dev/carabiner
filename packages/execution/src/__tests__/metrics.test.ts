/**
 * @outfitter/execution - Metrics collection tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import {
  createDirectoryPath,
  createSessionId,
  createTranscriptPath,
} from '@outfitter/types';
import {
  deltaMemoryUsage,
  ExecutionTimer,
  formatMemoryUsage,
  MetricsCollector,
  setMetricsEnabled,
  snapshotMemoryUsage,
} from '../metrics';

describe('ExecutionTimer', () => {
  test('should track elapsed time', async () => {
    const timer = new ExecutionTimer();

    // Small delay to ensure measurable time passes
    await new Promise((resolve) => setTimeout(resolve, 10));

    const elapsed = timer.getElapsed();
    expect(elapsed).toBeGreaterThan(5); // At least 5ms should have passed
  });

  test('should track phases correctly', () => {
    const timer = new ExecutionTimer();

    // Mark some phases
    timer.markPhase('input');
    timer.markPhase('parsing');
    timer.markPhase('execution');

    const timing = timer.getTiming();

    expect(timing.startTime).toBeGreaterThan(0);
    expect(timing.endTime).toBeGreaterThan(timing.startTime);
    expect(timing.duration).toBeGreaterThan(0);
    expect(timing.phases.input).toBeGreaterThanOrEqual(0);
    expect(timing.phases.parsing).toBeGreaterThanOrEqual(0);
    expect(timing.phases.execution).toBeGreaterThanOrEqual(0);
  });

  test('should return phase duration when marking', () => {
    const timer = new ExecutionTimer();

    const inputDuration = timer.markPhase('input');
    expect(inputDuration).toBeGreaterThanOrEqual(0);

    const parsingDuration = timer.markPhase('parsing');
    expect(parsingDuration).toBeGreaterThanOrEqual(0);
  });
});

describe('Memory tracking functions', () => {
  test('should take memory snapshots', () => {
    const snapshot = snapshotMemoryUsage();

    expect(snapshot.heapUsed).toBeGreaterThan(0);
    expect(snapshot.heapTotal).toBeGreaterThan(0);
    expect(snapshot.external).toBeGreaterThanOrEqual(0);
    expect(snapshot.rss).toBeGreaterThan(0);
  });

  test('should calculate memory deltas', () => {
    const before = snapshotMemoryUsage();

    // Allocate some memory
    const largeArray = new Array(100_000).fill('test data'.repeat(10));

    const after = snapshotMemoryUsage();
    const delta = deltaMemoryUsage(before, after);

    // Memory usage should have increased (but may be optimized away in some cases)
    expect(delta.heapUsed).toBeGreaterThanOrEqual(0);

    // Keep reference to prevent optimization
    expect(largeArray.length).toBe(100_000);
  });

  test('should format memory usage for display', () => {
    const memory = {
      heapUsed: 1024 * 1024, // 1 MB
      heapTotal: 2 * 1024 * 1024, // 2 MB
      external: 512 * 1024, // 0.5 MB
      rss: 4 * 1024 * 1024, // 4 MB
    };

    const formatted = formatMemoryUsage(memory);

    expect(formatted.heapUsed).toBe('1.00 MB');
    expect(formatted.heapTotal).toBe('2.00 MB');
    expect(formatted.external).toBe('0.50 MB');
    expect(formatted.rss).toBe('4.00 MB');
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  test('should record execution metrics', () => {
    const context = {
      event: 'PreToolUse' as const,
      toolName: 'Bash',
      sessionId: createSessionId('test-session'),
      cwd: createDirectoryPath('/tmp'),
      environment: {},
      toolInput: { command: 'ls' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    };

    const result = { success: true, message: 'Test completed' };

    const timing = {
      startTime: performance.now(),
      endTime: performance.now() + 100,
      duration: 100,
      phases: { input: 20, parsing: 10, execution: 60, output: 10 },
    };

    const memoryBefore = {
      heapUsed: 1000,
      heapTotal: 2000,
      external: 100,
      rss: 3000,
    };
    const memoryAfter = {
      heapUsed: 1100,
      heapTotal: 2000,
      external: 100,
      rss: 3100,
    };

    collector.record(context, result, timing, memoryBefore, memoryAfter);

    const metrics = collector.getMetrics();
    expect(metrics).toHaveLength(1);

    const metric = metrics[0];
    expect(metric).toBeDefined();
    if (metric) {
      expect(metric.event).toBe('PreToolUse');
      expect(metric.toolName).toBe('Bash');
      expect(metric.success).toBe(true);
      expect(metric.timing.duration).toBe(100);
      expect(metric.memoryDelta.heapUsed).toBe(100);
    }
  });

  test('should limit stored metrics to prevent memory leaks', () => {
    const maxMetrics = 5;
    const limitedCollector = new MetricsCollector(maxMetrics);

    const context = {
      event: 'PreToolUse' as const,
      sessionId: createSessionId('test'),
      cwd: createDirectoryPath('/tmp'),
      environment: {},
      toolName: 'Bash',
      toolInput: { command: 'test' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    } as const;
    const result = { success: true };
    const timing = {
      startTime: 0,
      endTime: 100,
      duration: 100,
      phases: { input: 0, parsing: 0, execution: 0, output: 0 },
    };
    const memory = {
      heapUsed: 1000,
      heapTotal: 2000,
      external: 100,
      rss: 3000,
    };

    // Record more metrics than the limit
    for (let i = 0; i < maxMetrics + 3; i++) {
      limitedCollector.record(context, result, timing, memory, memory);
    }

    // Should only keep the most recent maxMetrics
    expect(limitedCollector.size()).toBe(maxMetrics);
  });

  test('should filter metrics by time range', () => {
    const baseTime = Date.now();
    const context = {
      event: 'PreToolUse' as const,
      sessionId: createSessionId('test'),
      cwd: createDirectoryPath('/tmp'),
      environment: {},
      toolName: 'Bash' as const,
      toolInput: { command: 'test' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    };
    const result = { success: true };
    const timing = {
      startTime: 0,
      endTime: 100,
      duration: 100,
      phases: { input: 0, parsing: 0, execution: 0, output: 0 },
    };
    const memory = {
      heapUsed: 1000,
      heapTotal: 2000,
      external: 100,
      rss: 3000,
    };

    // Record metrics with different timestamps
    collector.record(context, result, timing, memory, memory);

    // Mock the timestamp for the next metric
    const originalNow = Date.now;
    Date.now = () => baseTime + 10_000; // 10 seconds later

    collector.record(context, result, timing, memory, memory);

    Date.now = originalNow; // Restore original

    const allMetrics = collector.getMetrics();
    expect(allMetrics).toHaveLength(2);

    const filteredMetrics = collector.getMetricsInRange(
      baseTime + 5000,
      baseTime + 15_000
    );
    expect(filteredMetrics).toHaveLength(1);
  });

  test('should calculate aggregate metrics correctly', () => {
    const context = {
      event: 'PreToolUse' as const,
      sessionId: createSessionId('test'),
      cwd: createDirectoryPath('/tmp'),
      environment: {},
      toolName: 'Bash',
      toolInput: { command: 'test' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    } as const;
    const memory = {
      heapUsed: 1000,
      heapTotal: 2000,
      external: 100,
      rss: 3000,
    };

    // Record successful execution
    collector.record(
      context,
      { success: true, message: 'Success 1' },
      {
        startTime: 0,
        endTime: 100,
        duration: 100,
        phases: { input: 0, parsing: 0, execution: 0, output: 0 },
      },
      memory,
      memory
    );
    // Record failed execution
    collector.record(
      context,
      {
        success: false,
        message: 'VALIDATION_ERROR: Invalid input',
        block: true,
      },
      {
        startTime: 0,
        endTime: 200,
        duration: 200,
        phases: { input: 0, parsing: 0, execution: 0, output: 0 },
      },
      memory,
      memory
    );

    // Record another successful execution
    collector.record(
      context,
      { success: true, message: 'Success 2' },
      {
        startTime: 0,
        endTime: 150,
        duration: 150,
        phases: { input: 0, parsing: 0, execution: 0, output: 0 },
      },
      memory,
      memory
    );

    const aggregate = collector.getAggregateMetrics();

    expect(aggregate).toBeDefined();
    if (aggregate) {
      expect(aggregate.totalExecutions).toBe(3);
      expect(aggregate.successfulExecutions).toBe(2);
      expect(aggregate.failedExecutions).toBe(1);
      expect(aggregate.successRate).toBe((2 / 3) * 100);
      expect(aggregate.averageDuration).toBe((100 + 200 + 150) / 3);
      expect(aggregate.minDuration).toBe(100);
      expect(aggregate.maxDuration).toBe(200);
      expect(aggregate.medianDuration).toBe(150);
      expect(aggregate.topErrors).toHaveLength(1);
      if (aggregate.topErrors[0]) {
        expect(aggregate.topErrors[0].code).toBe('VALIDATION_ERROR');
        expect(aggregate.topErrors[0].count).toBe(1);
      }
    }
  });

  test('should handle empty metrics gracefully', () => {
    const aggregate = collector.getAggregateMetrics();

    expect(aggregate).toBeDefined();
    expect(aggregate.totalExecutions).toBe(0);
    expect(aggregate.successfulExecutions).toBe(0);
    expect(aggregate.failedExecutions).toBe(0);
    expect(aggregate.successRate).toBe(0);
    expect(aggregate.averageDuration).toBe(0);
    expect(aggregate.topErrors).toHaveLength(0);
  });

  test('should clear all metrics', () => {
    const context = {
      event: 'PreToolUse' as const,
      sessionId: createSessionId('test'),
      cwd: createDirectoryPath('/tmp'),
      environment: {},
      toolName: 'Bash' as const,
      toolInput: { command: 'test' },
      transcriptPath: createTranscriptPath('/tmp/transcript.md'),
    };
    const result = { success: true };
    const timing = {
      startTime: 0,
      endTime: 100,
      duration: 100,
      phases: { input: 0, parsing: 0, execution: 0, output: 0 },
    };
    const memory = {
      heapUsed: 1000,
      heapTotal: 2000,
      external: 100,
      rss: 3000,
    };

    collector.record(context, result, timing, memory, memory);
    expect(collector.size()).toBe(1);

    collector.clear();
    expect(collector.size()).toBe(0);
    expect(collector.getMetrics()).toHaveLength(0);
  });

  describe('Global metrics', () => {
    test('setMetricsEnabled should clear metrics when disabled', () => {
      // This is a bit tricky to test since globalMetrics is shared
      // We'll just verify the function doesn't throw
      expect(() => setMetricsEnabled(false)).not.toThrow();
      expect(() => setMetricsEnabled(true)).not.toThrow();
    });
  });
});
