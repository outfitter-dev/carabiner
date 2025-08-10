/**
 * Registry tests for hook registration and execution
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { HookRegistry } from '../registry';
import { HookResults } from '../runtime';
import type { HookContext, HookHandler, HookRegistryEntry } from '../types';

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('Hook Registration', () => {
    test('should register a single hook', () => {
      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('test'),
        priority: 0,
        enabled: true,
      };

      registry.register(hook);
      const hooks = registry.getHooks('PreToolUse');

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toEqual(hook);
    });

    test('should register multiple hooks', () => {
      const hooks: HookRegistryEntry[] = [
        {
          event: 'PreToolUse',
          handler: async () => HookResults.success('hook1'),
          priority: 0,
          enabled: true,
        },
        {
          event: 'PostToolUse',
          handler: async () => HookResults.success('hook2'),
          priority: 0,
          enabled: true,
        },
      ];

      registry.registerAll(hooks);

      expect(registry.getHooks('PreToolUse')).toHaveLength(1);
      expect(registry.getHooks('PostToolUse')).toHaveLength(1);
    });

    test('should order hooks by priority', () => {
      const hook1: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('hook1'),
        priority: 10,
        enabled: true,
      };

      const hook2: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('hook2'),
        priority: 20,
        enabled: true,
      };

      const hook3: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('hook3'),
        priority: 15,
        enabled: true,
      };

      registry.register(hook1);
      registry.register(hook2);
      registry.register(hook3);

      const hooks = registry.getHooks('PreToolUse');

      expect(hooks[0].priority).toBe(20);
      expect(hooks[1].priority).toBe(15);
      expect(hooks[2].priority).toBe(10);
    });

    test('should handle tool-specific hooks', () => {
      const universalHook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('universal'),
        priority: 0,
        enabled: true,
      };

      const bashHook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('bash'),
        priority: 0,
        enabled: true,
        tool: 'Bash',
      };

      registry.register(universalHook);
      registry.register(bashHook);

      const allHooks = registry.getHooks('PreToolUse');
      const bashHooks = registry.getHooks('PreToolUse', 'Bash');

      expect(allHooks).toHaveLength(1); // Only universal hook
      expect(bashHooks).toHaveLength(2); // Universal + Bash-specific
    });
  });

  describe('Hook Unregistration', () => {
    test('should unregister a hook', () => {
      const handler: HookHandler = async () => HookResults.success('test');

      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler,
        priority: 0,
        enabled: true,
      };

      registry.register(hook);
      expect(registry.getHooks('PreToolUse')).toHaveLength(1);

      registry.unregister('PreToolUse', handler);
      expect(registry.getHooks('PreToolUse')).toHaveLength(0);
    });

    test('should clear all hooks for an event', () => {
      const hooks: HookRegistryEntry[] = [
        {
          event: 'PreToolUse',
          handler: async () => HookResults.success('hook1'),
          priority: 0,
          enabled: true,
        },
        {
          event: 'PreToolUse',
          handler: async () => HookResults.success('hook2'),
          priority: 0,
          enabled: true,
        },
      ];

      registry.registerAll(hooks);
      expect(registry.getHooks('PreToolUse')).toHaveLength(2);

      registry.clear('PreToolUse');
      expect(registry.getHooks('PreToolUse')).toHaveLength(0);
    });

    test('should clear all hooks', () => {
      const hooks: HookRegistryEntry[] = [
        {
          event: 'PreToolUse',
          handler: async () => HookResults.success('hook1'),
          priority: 0,
          enabled: true,
        },
        {
          event: 'PostToolUse',
          handler: async () => HookResults.success('hook2'),
          priority: 0,
          enabled: true,
        },
      ];

      registry.registerAll(hooks);
      expect(registry.getHooks('PreToolUse')).toHaveLength(1);
      expect(registry.getHooks('PostToolUse')).toHaveLength(1);

      registry.clear();
      expect(registry.getHooks('PreToolUse')).toHaveLength(0);
      expect(registry.getHooks('PostToolUse')).toHaveLength(0);
    });
  });

  describe('Hook Execution', () => {
    test('should execute enabled hooks', async () => {
      let executed = false;

      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          executed = true;
          return HookResults.success('executed');
        },
        priority: 0,
        enabled: true,
      };

      registry.register(hook);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      const results = await registry.execute(context);

      expect(executed).toBe(true);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    test('should not execute disabled hooks', async () => {
      let executed = false;

      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          executed = true;
          return HookResults.success('executed');
        },
        priority: 0,
        enabled: false,
      };

      registry.register(hook);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      const results = await registry.execute(context);

      expect(executed).toBe(false);
      expect(results).toHaveLength(0);
    });

    test('should execute hooks in priority order', async () => {
      const executionOrder: number[] = [];

      const hook1: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          executionOrder.push(1);
          return HookResults.success('hook1');
        },
        priority: 10,
        enabled: true,
      };

      const hook2: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          executionOrder.push(2);
          return HookResults.success('hook2');
        },
        priority: 20,
        enabled: true,
      };

      registry.register(hook1);
      registry.register(hook2);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      await registry.execute(context);

      expect(executionOrder).toEqual([2, 1]); // Higher priority executes first
    });

    test('should handle hook errors gracefully', async () => {
      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          throw new Error('Hook error');
        },
        priority: 0,
        enabled: true,
      };

      registry.register(hook);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Hook error');
    });
  });

  describe('Statistics', () => {
    test('should track execution stats', async () => {
      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('test'),
        priority: 0,
        enabled: true,
      };

      registry.register(hook);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      await registry.execute(context);
      const stats = registry.getStats('PreToolUse');

      expect(stats).toHaveLength(1);
      expect(stats[0].totalExecutions).toBe(1);
      expect(stats[0].successfulExecutions).toBe(1);
      expect(stats[0].failedExecutions).toBe(0);
    });

    test('should reset stats', async () => {
      const hook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => HookResults.success('test'),
        priority: 0,
        enabled: true,
      };

      registry.register(hook);

      const context: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      await registry.execute(context);
      const initialStats = registry.getStats('PreToolUse');
      expect(initialStats).toHaveLength(1);
      expect(initialStats[0].totalExecutions).toBe(1);

      // Registry doesn't have resetStats, just clear
      registry.clear();
      const clearedStats = registry.getStats();

      // After clearing, getStats should return empty array
      expect(clearedStats).toHaveLength(0);
    });
  });

  describe('Tool-specific execution', () => {
    test('should execute only relevant tool-specific hooks', async () => {
      const results: string[] = [];

      const universalHook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          results.push('universal');
          return HookResults.success('universal');
        },
        priority: 0,
        enabled: true,
      };

      const bashHook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          results.push('bash');
          return HookResults.success('bash');
        },
        priority: 0,
        enabled: true,
        tool: 'Bash',
      };

      const writeHook: HookRegistryEntry = {
        event: 'PreToolUse',
        handler: async () => {
          results.push('write');
          return HookResults.success('write');
        },
        priority: 0,
        enabled: true,
        tool: 'Write',
      };

      registry.register(universalHook);
      registry.register(bashHook);
      registry.register(writeHook);

      const bashContext: HookContext = {
        event: 'PreToolUse',
        toolName: 'Bash',
        sessionId: 'test',
        transcriptPath: '/test',
        cwd: '/test',
        toolInput: { command: 'test' },
        environment: {},
        rawInput: {} as any,
      };

      await registry.execute(bashContext);

      expect(results).toContain('universal');
      expect(results).toContain('bash');
      expect(results).not.toContain('write');
    });
  });
});
