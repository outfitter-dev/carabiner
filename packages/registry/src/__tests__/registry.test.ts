/**
 * @file registry.test.ts
 * @description Tests for plugin registry functionality
 */

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { PluginRegistry } from '../registry';
import type { HookPlugin, PluginConfig } from '../plugin';
import type { HookContext } from '@outfitter/types';

// Mock plugins for testing
const createMockPlugin = (
  name: string,
  events: string[] = ['PreToolUse'],
  options: Partial<HookPlugin> = {}
): HookPlugin => ({
  name,
  version: '1.0.0',
  events,
  apply: async (context: HookContext) => ({
    success: true,
    pluginName: name,
    pluginVersion: '1.0.0',
    message: `${name} executed`
  }),
  ...options
});

const createMockContext = (event: string = 'PreToolUse', toolName?: string): HookContext => {
  const base = {
    event,
    sessionId: 'test-session-123' as any,
    transcriptPath: '/tmp/transcript' as any,
    cwd: '/test/cwd' as any,
    environment: {}
  };

  if (toolName) {
    return {
      ...base,
      toolName,
      toolInput: { command: 'test command' }
    } as any;
  }

  return base as any;
};

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('Plugin Registration', () => {
    test('should register a valid plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      
      expect(() => registry.register(plugin)).not.toThrow();
      expect(registry.hasPlugin('test-plugin')).toBe(true);
      expect(registry.getPlugin('test-plugin')).toBe(plugin);
    });

    test('should register plugin with custom configuration', () => {
      const plugin = createMockPlugin('test-plugin');
      const config: Partial<PluginConfig> = {
        priority: 100,
        enabled: false,
        config: { customSetting: 'value' }
      };

      registry.register(plugin, config);

      const pluginConfig = registry.getPluginConfig('test-plugin');
      expect(pluginConfig?.priority).toBe(100);
      expect(pluginConfig?.enabled).toBe(false);
      expect(pluginConfig?.config?.customSetting).toBe('value');
    });

    test('should throw error for duplicate plugin registration', () => {
      const plugin1 = createMockPlugin('duplicate-plugin');
      const plugin2 = createMockPlugin('duplicate-plugin');

      registry.register(plugin1);
      
      expect(() => registry.register(plugin2)).toThrow('Plugin already registered');
    });

    test('should validate plugin structure', () => {
      const invalidPlugin = {
        name: 'invalid-plugin',
        version: '1.0.0',
        // Missing events and apply function
      };

      expect(() => registry.register(invalidPlugin as any)).toThrow();
    });

    test('should validate plugin name format', () => {
      const invalidPlugin = createMockPlugin('Invalid_Plugin_Name');
      
      expect(() => registry.register(invalidPlugin)).toThrow('Plugin name must be kebab-case');
    });

    test('should validate plugin version format', () => {
      const invalidPlugin = createMockPlugin('test-plugin');
      invalidPlugin.version = 'invalid-version';
      
      expect(() => registry.register(invalidPlugin)).toThrow('Plugin version must be semver format');
    });

    test('should validate plugin has events', () => {
      const invalidPlugin = createMockPlugin('test-plugin', []);
      
      expect(() => registry.register(invalidPlugin)).toThrow('Plugin must handle at least one event');
    });
  });

  describe('Plugin Unregistration', () => {
    test('should unregister existing plugin', () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      expect(registry.unregister('test-plugin')).toBe(true);
      expect(registry.hasPlugin('test-plugin')).toBe(false);
    });

    test('should return false for non-existent plugin', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('Plugin Discovery', () => {
    test('should get all registered plugins', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');

      registry.register(plugin1);
      registry.register(plugin2);

      const plugins = registry.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });

    test('should get plugin by name', () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      expect(registry.getPlugin('test-plugin')).toBe(plugin);
      expect(registry.getPlugin('non-existent')).toBeUndefined();
    });

    test('should check plugin existence', () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      expect(registry.hasPlugin('test-plugin')).toBe(true);
      expect(registry.hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('Plugin Execution', () => {
    test('should execute applicable plugins', async () => {
      const plugin1 = createMockPlugin('plugin-1', ['PreToolUse']);
      const plugin2 = createMockPlugin('plugin-2', ['PostToolUse']);
      const plugin3 = createMockPlugin('plugin-3', ['PreToolUse']);

      registry.register(plugin1);
      registry.register(plugin2);
      registry.register(plugin3);

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context);

      expect(results).toHaveLength(2); // Only PreToolUse plugins should execute
      expect(results[0].pluginName).toMatch(/plugin-(1|3)/);
      expect(results[1].pluginName).toMatch(/plugin-(1|3)/);
    });

    test('should execute plugins in priority order', async () => {
      const highPriorityPlugin = createMockPlugin('high-priority');
      const lowPriorityPlugin = createMockPlugin('low-priority');

      registry.register(highPriorityPlugin, { priority: 100 });
      registry.register(lowPriorityPlugin, { priority: 10 });

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context);

      expect(results).toHaveLength(2);
      expect(results[0].pluginName).toBe('high-priority');
      expect(results[1].pluginName).toBe('low-priority');
    });

    test('should skip disabled plugins', async () => {
      const enabledPlugin = createMockPlugin('enabled');
      const disabledPlugin = createMockPlugin('disabled');

      registry.register(enabledPlugin, { enabled: true });
      registry.register(disabledPlugin, { enabled: false });

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].pluginName).toBe('enabled');
    });

    test('should filter by tool name', async () => {
      const bashPlugin = createMockPlugin('bash-plugin', ['PreToolUse']);
      const writePlugin = createMockPlugin('write-plugin', ['PreToolUse']);

      registry.register(bashPlugin, { tools: ['Bash'] });
      registry.register(writePlugin, { tools: ['Write'] });

      const context = createMockContext('PreToolUse', 'Bash');
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].pluginName).toBe('bash-plugin');
    });

    test('should stop on blocking failure', async () => {
      const blockingPlugin = createMockPlugin('blocking', ['PreToolUse'], {
        apply: async () => ({
          success: false,
          block: true,
          pluginName: 'blocking',
          pluginVersion: '1.0.0',
          message: 'Blocked'
        })
      });
      const normalPlugin = createMockPlugin('normal', ['PreToolUse']);

      registry.register(blockingPlugin, { priority: 100 });
      registry.register(normalPlugin, { priority: 50 });

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].pluginName).toBe('blocking');
      expect(results[0].success).toBe(false);
      expect(results[0].block).toBe(true);
    });

    test('should continue on failure when configured', async () => {
      const failingPlugin = createMockPlugin('failing', ['PreToolUse'], {
        apply: async () => ({
          success: false,
          pluginName: 'failing',
          pluginVersion: '1.0.0',
          message: 'Failed'
        })
      });
      const normalPlugin = createMockPlugin('normal', ['PreToolUse']);

      registry.register(failingPlugin, { priority: 100 });
      registry.register(normalPlugin, { priority: 50 });

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context, { continueOnFailure: true });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    test('should handle plugin execution errors', async () => {
      const errorPlugin = createMockPlugin('error', ['PreToolUse'], {
        apply: async () => {
          throw new Error('Plugin error');
        }
      });

      registry.register(errorPlugin);

      const context = createMockContext('PreToolUse');
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Plugin execution failed');
    });
  });

  describe('Plugin Configuration', () => {
    test('should update plugin configuration', () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin, { priority: 50 });

      const updated = registry.updatePluginConfig('test-plugin', { priority: 100, enabled: false });
      
      expect(updated).toBe(true);
      
      const config = registry.getPluginConfig('test-plugin');
      expect(config?.priority).toBe(100);
      expect(config?.enabled).toBe(false);
    });

    test('should return false for non-existent plugin config update', () => {
      const updated = registry.updatePluginConfig('non-existent', { priority: 100 });
      expect(updated).toBe(false);
    });

    test('should get plugin configuration', () => {
      const plugin = createMockPlugin('test-plugin');
      const customConfig = { priority: 75, enabled: true };
      
      registry.register(plugin, customConfig);

      const config = registry.getPluginConfig('test-plugin');
      expect(config?.priority).toBe(75);
      expect(config?.enabled).toBe(true);
    });
  });

  describe('Plugin Lifecycle', () => {
    test('should initialize plugins', async () => {
      const plugin = createMockPlugin('test-plugin', ['PreToolUse'], {
        init: async () => {
          // Initialization logic
        }
      });

      const initSpy = spyOn(plugin, 'init');
      registry.register(plugin);
      
      await registry.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });

    test('should shutdown plugins', async () => {
      const plugin = createMockPlugin('test-plugin', ['PreToolUse'], {
        shutdown: async () => {
          // Shutdown logic
        }
      });

      const shutdownSpy = spyOn(plugin, 'shutdown');
      registry.register(plugin);
      await registry.initialize();
      
      await registry.shutdown();
      
      expect(shutdownSpy).toHaveBeenCalled();
    });

    test('should run health checks', async () => {
      const healthyPlugin = createMockPlugin('healthy', ['PreToolUse'], {
        healthCheck: async () => true
      });
      const unhealthyPlugin = createMockPlugin('unhealthy', ['PreToolUse'], {
        healthCheck: async () => false
      });

      registry.register(healthyPlugin);
      registry.register(unhealthyPlugin);

      const health = await registry.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.unhealthy).toBe(false);
    });
  });

  describe('Registry Statistics', () => {
    test('should track plugin statistics', () => {
      const plugin1 = createMockPlugin('plugin-1');
      const plugin2 = createMockPlugin('plugin-2');

      registry.register(plugin1, { enabled: true });
      registry.register(plugin2, { enabled: false });

      const stats = registry.getStats();

      expect(stats.totalPlugins).toBe(2);
      expect(stats.enabledPlugins).toBe(1);
      expect(stats.disabledPlugins).toBe(1);
    });

    test('should update execution statistics', async () => {
      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      const context = createMockContext('PreToolUse');
      await registry.execute(context);

      const stats = registry.getStats();
      expect(stats.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    test('should emit plugin registration events', () => {
      const eventListener = mock(() => {});
      registry.addEventListener(eventListener);

      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin-registered',
          plugin
        })
      );
    });

    test('should emit plugin execution events', async () => {
      const eventListener = mock(() => {});
      registry.addEventListener(eventListener);

      const plugin = createMockPlugin('test-plugin');
      registry.register(plugin);

      const context = createMockContext('PreToolUse');
      await registry.execute(context);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin-executed'
        })
      );
    });
  });

  describe('Registry Options', () => {
    test('should respect registry options', () => {
      const registryWithOptions = new PluginRegistry({
        defaultTimeout: 10000,
        collectMetrics: false,
        continueOnFailure: true
      });

      expect(registryWithOptions).toBeDefined();
    });
  });
});