/**
 * @outfitter/execution - Hook executor tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { createProtocol, type TestProtocol } from '@outfitter/protocol';
import type { HookHandler } from '@outfitter/types';
import { isToolHookContext } from '@outfitter/types';
import { HookExecutor } from '../executor';
import { MetricsCollector } from '../metrics';

describe('HookExecutor', () => {
  let mockProtocol: TestProtocol;

  beforeEach(() => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/tmp',
      environment: { PATH: '/usr/bin' },
    };
    mockProtocol = createProtocol('test', { input: mockInput }) as TestProtocol;
  });

  test('should execute hook handler', async () => {
    const handler: HookHandler = (context) => {
      expect(context.event).toBe('PreToolUse');
      if (isToolHookContext(context)) {
        expect(context.toolName).toBe('Bash');
      }
      return { success: true, message: 'Hook executed successfully' };
    };

    const executor = new HookExecutor(mockProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(mockProtocol.output).toBeDefined();
    expect(mockProtocol.output?.success).toBe(true);
  });

  test('should collect metrics', async () => {
    const metricsCollector = new MetricsCollector();
    const handler: HookHandler = async () => ({ success: true });

    const executor = new HookExecutor(mockProtocol, {
      exitProcess: false,
      collectMetrics: true,
      metricsCollector,
    });

    await executor.execute(handler);

    const metrics = metricsCollector.getMetrics();
    expect(metrics).toHaveLength(1);

    const metric = metrics[0];
    if (metric) {
      expect(metric.event).toBe('PreToolUse');
      expect(metric.toolName).toBe('Bash');
      expect(metric.success).toBe(true);
      expect(metric.timing.duration).toBeGreaterThan(0);
    }
  });
});
