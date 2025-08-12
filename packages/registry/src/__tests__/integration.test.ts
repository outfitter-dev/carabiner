/**
 * @file integration.test.ts
 * @description Integration tests for the complete plugin system
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HookContext } from '@outfitter/types';
import type { HookConfig, HookPlugin } from '../index';
import { ConfigLoader, createPluginSystem, PluginRegistry } from '../index';

// Mock plugins for testing
const createTestPlugin = (
  name: string,
  behavior: 'success' | 'fail' | 'block' = 'success'
): HookPlugin => ({
  name,
  version: '1.0.0',
  events: ['PreToolUse'],
  priority: 50,

  apply: async (_context: HookContext) => {
    switch (behavior) {
      case 'fail':
        return {
          success: false,
          pluginName: name,
          pluginVersion: '1.0.0',
          message: `${name} failed`,
        };
      case 'block':
        return {
          success: false,
          block: true,
          pluginName: name,
          pluginVersion: '1.0.0',
          message: `${name} blocked operation`,
        };
      default:
        return {
          success: true,
          pluginName: name,
          pluginVersion: '1.0.0',
          message: `${name} executed successfully`,
        };
    }
  },
});

const createMockContext = (): HookContext =>
  ({
    event: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'echo "test"' },
    sessionId: 'test-session' as any,
    transcriptPath: '/tmp/transcript' as any,
    cwd: '/test' as any,
    environment: {},
  }) as any;

describe('Plugin System Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join('/tmp', `plugin-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await unlink(tempDir);
    } catch {
      // Directory might not exist or already cleaned up
    }
  });

  describe('Registry and Plugin Interaction', () => {
    test('should execute multiple plugins in priority order', async () => {
      const registry = new PluginRegistry();

      const highPriorityPlugin = createTestPlugin('high-priority');
      const lowPriorityPlugin = createTestPlugin('low-priority');

      registry.register(highPriorityPlugin, { priority: 100 });
      registry.register(lowPriorityPlugin, { priority: 10 });

      const context = createMockContext();
      const results = await registry.execute(context);

      expect(results).toHaveLength(2);
      expect(results[0].pluginName).toBe('high-priority');
      expect(results[1].pluginName).toBe('low-priority');

      await registry.shutdown();
    });

    test('should stop execution on blocking plugin', async () => {
      const registry = new PluginRegistry();

      const blockingPlugin = createTestPlugin('blocking', 'block');
      const normalPlugin = createTestPlugin('normal');

      registry.register(blockingPlugin, { priority: 100 });
      registry.register(normalPlugin, { priority: 50 });

      const context = createMockContext();
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].pluginName).toBe('blocking');
      expect(results[0].success).toBe(false);
      expect(results[0].block).toBe(true);

      await registry.shutdown();
    });

    test('should continue on failure when configured', async () => {
      const registry = new PluginRegistry({ continueOnFailure: true });

      const failingPlugin = createTestPlugin('failing', 'fail');
      const normalPlugin = createTestPlugin('normal');

      registry.register(failingPlugin, { priority: 100 });
      registry.register(normalPlugin, { priority: 50 });

      const context = createMockContext();
      const results = await registry.execute(context);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);

      await registry.shutdown();
    });

    test('should track performance metrics', async () => {
      const registry = new PluginRegistry({ collectMetrics: true });

      const plugin = createTestPlugin('test-plugin');
      registry.register(plugin);

      const context = createMockContext();
      await registry.execute(context);

      const stats = registry.getStats();
      expect(stats.totalExecutions).toBeGreaterThan(0);

      await registry.shutdown();
    });
  });

  describe('Configuration System', () => {
    test('should load JSON configuration', async () => {
      const configPath = join(tempDir, 'test-config.json');
      const config: HookConfig = {
        plugins: [{ name: 'test-plugin', enabled: true, priority: 100 }],
        rules: {
          'test-plugin': { customSetting: 'value' },
        },
        settings: {
          defaultTimeout: 10_000,
          collectMetrics: true,
          continueOnFailure: false,
          enableHotReload: false,
          logLevel: 'info',
          maxConcurrency: 5,
        },
        loader: {
          searchPaths: ['./plugins'],
          includePatterns: ['*.plugin.js'],
          excludePatterns: ['*.test.*'],
          recursive: true,
          maxDepth: 3,
          enableCache: true,
          validateOnLoad: true,
        },
      };

      await writeFile(configPath, JSON.stringify(config, null, 2));

      const loader = new ConfigLoader({ baseDir: tempDir });
      const result = await loader.load(configPath);

      expect(result.config.plugins).toHaveLength(1);
      expect(result.config.plugins[0].name).toBe('test-plugin');
      expect(result.config.settings.defaultTimeout).toBe(10_000);
      expect(result.source).toBe(configPath);

      await loader.cleanup();
    });

    test('should load TypeScript configuration', async () => {
      const configPath = join(tempDir, 'hooks.config.ts');
      const configContent = `
export default {
  plugins: [
    { name: 'typescript-plugin', enabled: true, priority: 80 }
  ],
  rules: {
    'typescript-plugin': { 
      setting1: 'value1',
      setting2: true 
    }
  },
  settings: {
    defaultTimeout: 8000,
    logLevel: 'debug' as const
  }
};
`;

      await writeFile(configPath, configContent);

      const loader = new ConfigLoader({ baseDir: tempDir });
      const result = await loader.load(configPath);

      expect(result.config.plugins[0].name).toBe('typescript-plugin');
      expect(result.config.rules['typescript-plugin'].setting1).toBe('value1');
      expect(result.config.settings.defaultTimeout).toBe(8000);

      await loader.cleanup();
    });

    test('should apply environment-specific overrides', async () => {
      const configPath = join(tempDir, 'env-config.json');
      const config = {
        plugins: [{ name: 'base-plugin', enabled: true, priority: 50 }],
        settings: {
          defaultTimeout: 5000,
          logLevel: 'info',
        },
        environments: {
          test: {
            settings: {
              defaultTimeout: 1000,
              logLevel: 'debug',
            },
          },
        },
      };

      await writeFile(configPath, JSON.stringify(config, null, 2));

      const loader = new ConfigLoader({
        baseDir: tempDir,
        environment: 'test',
      });
      const result = await loader.load(configPath);

      expect(result.config.settings.defaultTimeout).toBe(1000);
      expect(result.config.settings.logLevel).toBe('debug');
      expect(result.environment).toBe('test');

      await loader.cleanup();
    });

    test('should validate configuration schema', async () => {
      const configPath = join(tempDir, 'invalid-config.json');
      const invalidConfig = {
        plugins: [
          {
            // Missing required 'name' field
            enabled: true,
          },
        ],
      };

      await writeFile(configPath, JSON.stringify(invalidConfig));

      const loader = new ConfigLoader({ baseDir: tempDir });

      await expect(loader.load(configPath)).rejects.toThrow(
        'Configuration validation failed'
      );

      await loader.cleanup();
    });
  });

  describe('Complete Plugin System', () => {
    test('should create complete plugin system from configuration', async () => {
      const configPath = join(tempDir, 'complete-config.ts');
      const configContent = `
export default {
  plugins: [
    { name: 'test-plugin-1', enabled: true, priority: 100 },
    { name: 'test-plugin-2', enabled: false, priority: 50 }
  ],
  settings: {
    defaultTimeout: 3000,
    collectMetrics: true,
    continueOnFailure: true,
    logLevel: 'warn' as const
  },
  loader: {
    searchPaths: ['${tempDir}/plugins'],
    includePatterns: ['*.plugin.js'],
    validateOnLoad: true
  }
};
`;

      await writeFile(configPath, configContent);

      // Create plugins directory with test plugins
      const pluginsDir = join(tempDir, 'plugins');
      await mkdir(pluginsDir, { recursive: true });

      const pluginContent = `
export default {
  name: 'test-plugin-1',
  version: '1.0.0',
  events: ['PreToolUse'],
  apply: async (context) => ({
    success: true,
    pluginName: 'test-plugin-1',
    pluginVersion: '1.0.0',
    message: 'Test plugin executed'
  })
};
`;

      await writeFile(
        join(pluginsDir, 'test-plugin-1.plugin.js'),
        pluginContent
      );

      const system = await createPluginSystem(configPath, {
        autoLoad: true,
        enableHotReload: false,
      });

      expect(system.registry).toBeDefined();
      expect(system.configLoader).toBeDefined();
      expect(system.config).toBeDefined();

      // Test plugin execution
      const context = createMockContext();
      const results = await system.registry.execute(context);

      expect(results.length).toBeGreaterThan(0);

      await system.cleanup();
    });

    test('should handle plugin system errors gracefully', async () => {
      const configPath = join(tempDir, 'error-config.json');
      const config = {
        plugins: [],
        loader: {
          searchPaths: ['/non/existent/path'],
        },
      };

      await writeFile(configPath, JSON.stringify(config));

      // Should not throw even if plugins can't be loaded
      const system = await createPluginSystem(configPath, {
        autoLoad: true,
      });

      expect(system.registry).toBeDefined();

      await system.cleanup();
    });
  });

  describe('Plugin Event System', () => {
    test('should emit and handle registry events', async () => {
      const registry = new PluginRegistry();
      const events: any[] = [];

      registry.addEventListener(async (event) => {
        events.push(event);
      });

      const plugin = createTestPlugin('event-test');
      registry.register(plugin);

      const context = createMockContext();
      await registry.execute(context);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'plugin-registered')).toBe(true);
      expect(events.some((e) => e.type === 'plugin-executed')).toBe(true);

      await registry.shutdown();
    });
  });

  describe('Error Recovery', () => {
    test('should handle plugin execution errors', async () => {
      const registry = new PluginRegistry();

      const errorPlugin: HookPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        events: ['PreToolUse'],
        apply: async () => {
          throw new Error('Plugin crashed');
        },
      };

      registry.register(errorPlugin);

      const context = createMockContext();
      const results = await registry.execute(context);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Plugin execution failed');

      await registry.shutdown();
    });

    test('should handle configuration loading errors', async () => {
      const loader = new ConfigLoader({ baseDir: tempDir });

      await expect(loader.load('/non/existent/config.json')).rejects.toThrow(
        'File not found'
      );

      await loader.cleanup();
    });
  });

  describe('Performance and Resource Management', () => {
    test('should manage plugin lifecycle correctly', async () => {
      let initCalled = false;
      let shutdownCalled = false;

      const lifecyclePlugin: HookPlugin = {
        name: 'lifecycle-test',
        version: '1.0.0',
        events: ['PreToolUse'],

        apply: async () => ({
          success: true,
          pluginName: 'lifecycle-test',
          pluginVersion: '1.0.0',
        }),

        init: async () => {
          initCalled = true;
        },

        shutdown: async () => {
          shutdownCalled = true;
        },
      };

      const registry = new PluginRegistry();
      registry.register(lifecyclePlugin);

      await registry.initialize();
      expect(initCalled).toBe(true);

      await registry.shutdown();
      expect(shutdownCalled).toBe(true);
    });

    test('should handle concurrent plugin execution', async () => {
      const registry = new PluginRegistry({ maxConcurrency: 2 });

      const plugins = Array.from({ length: 5 }, (_, i) =>
        createTestPlugin(`concurrent-${i}`)
      );

      plugins.forEach((plugin) => registry.register(plugin));

      const context = createMockContext();
      const results = await registry.execute(context);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);

      await registry.shutdown();
    });
  });
});
