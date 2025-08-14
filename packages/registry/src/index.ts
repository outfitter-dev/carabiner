/**
 * @outfitter/registry - Plugin registry system for Claude Code hooks
 *
 * This package enables composition of small, focused hooks through a plugin architecture.
 * It provides plugin registration, discovery, priority ordering, configuration management,
 * and event-based execution.
 *
 * Key Features:
 * - Plugin registration and management
 * - Event-based plugin execution with priority ordering
 * - Configuration-driven plugin composition
 * - Plugin discovery and loading from files
 * - Hot reload support for development
 * - Performance monitoring and metrics
 * - Plugin lifecycle management (init, shutdown, health checks)
 * - Conditional plugin execution with filters
 *
 * @example Basic Usage
 * ```typescript
 * import { PluginRegistry, PluginLoader } from '@outfitter/registry';
 * import { gitSafetyPlugin } from './plugins/git-safety';
 *
 * // Create registry
 * const registry = new PluginRegistry();
 *
 * // Register plugins
 * registry.register(gitSafetyPlugin);
 *
 * // Execute plugins for context
 * const results = await registry.execute(context);
 * ```
 *
 * @example With Configuration
 * ```typescript
 * import { PluginRegistry, ConfigLoader } from '@outfitter/registry';
 *
 * // Load configuration
 * const configLoader = new ConfigLoader();
 * const { config } = await configLoader.load('./hooks.config.ts');
 *
 * // Create registry from config
 * const registry = PluginRegistry.fromConfig(config);
 *
 * // Execute plugins
 * const results = await registry.execute(context);
 * ```
 *
 * @example With Plugin Discovery
 * ```typescript
 * import { PluginRegistry, PluginLoader } from '@outfitter/registry';
 *
 * // Auto-discover plugins
 * const loader = new PluginLoader({
 *   searchPaths: ['./plugins', './node_modules/@company/hooks-*']
 * });
 *
 * const { plugins } = await loader.loadPlugins();
 *
 * // Register discovered plugins
 * const registry = new PluginRegistry();
 * plugins.forEach(plugin => registry.register(plugin));
 * ```
 */

// Configuration system
export type {
  ConfigChangeEvent,
  ConfigChangeListener,
  ConfigLoaderOptions,
  ConfigLoadResult,
  EnvironmentConfig,
  HookConfig,
  HookConfigLoader,
  HookConfigSettings,
} from './config';
export {
  ConfigLoader,
  createDefaultConfig,
  validateHookConfig,
  validatePluginConfig,
} from './config';
// Plugin loader and discovery
export type {
  HotReloadEvent,
  HotReloadListener,
  LoaderOptions,
  PluginLoadResult,
} from './loader';
export { PluginLoader } from './loader';
// Plugin interface and types
export type {
  HookPlugin,
  PluginCondition,
  PluginConfig,
  PluginDiscovery,
  PluginExecutionContext,
  PluginExecutionOptions,
  PluginFactory,
  PluginMetadata,
  PluginModule,
  PluginResult,
} from './plugin';
export {
  createPluginResult,
  isHookPlugin,
  isPluginResult,
  PluginConfigurationError,
  PluginExecutionError,
  PluginValidationError,
} from './plugin';
// Plugin registry
export type {
  RegistryEvent,
  RegistryEventListener,
  RegistryOptions,
  RegistryStats,
} from './registry';
export { PluginRegistry } from './registry';

const PLUGIN_FILENAME_REGEX = /\.(plugin|hook)\.(js|ts|mjs)$/;

import type { ConfigChangeEvent } from './config';
// Import classes and types for internal use in createPluginSystem
import { ConfigLoader } from './config';
import type { HotReloadEvent } from './loader';
import { PluginLoader } from './loader';
import type { PluginConfig } from './plugin';
import { PluginRegistry } from './registry';

/**
 * Package version
 */
export const VERSION = '1.0.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@outfitter/registry',
  version: VERSION,
  description: 'Plugin registry system for Claude Code hooks',
  repository: 'https://github.com/outfitter-dev/carabiner',
} as const;

/**
 * Utility function to create a complete plugin system from configuration
 *
 * @example
 * ```typescript
 * const system = await createPluginSystem('./hooks.config.ts');
 *
 * // Execute plugins
 * const results = await system.registry.execute(context);
 *
 * // Hot reload support
 * if (system.loader) {
 *   system.loader.onHotReload(async (event) => {
 *     if (event.type === 'changed' && event.plugin) {
 *       system.registry.unregister(event.plugin.name);
 *       system.registry.register(event.plugin);
 *     }
 *   });
 * }
 * ```
 */
export async function createPluginSystem(
  configPath?: string,
  options: {
    autoLoad?: boolean;
    enableHotReload?: boolean;
    environment?: string;
  } = {}
) {
  const { autoLoad = true, enableHotReload = false, environment } = options;

  const configLoaderInstance = new ConfigLoader({
    enableHotReload,
    environment,
  });
  const { config } = await configLoaderInstance.load(configPath);

  const registryInstance = createRegistryFromSettings(config);

  const loaderInstance = autoLoad
    ? await setupLoaderAndRegister(registryInstance, config, enableHotReload)
    : undefined;

  if (enableHotReload) {
    setupConfigHotReload(configLoaderInstance);
  }

  await registryInstance.initialize();

  return {
    registry: registryInstance,
    loader: loaderInstance,
    configLoader: configLoaderInstance,
    config,
    async cleanup() {
      await registryInstance.shutdown();
      if (loaderInstance) {
        await loaderInstance.cleanup();
      }
      await configLoaderInstance.cleanup();
    },
  };
}

import type { HookConfig } from './config';

function createRegistryFromSettings(config: HookConfig) {
  return new PluginRegistry({
    defaultTimeout: config.settings.defaultTimeout,
    collectMetrics: config.settings.collectMetrics,
    continueOnFailure: config.settings.continueOnFailure,
    maxConcurrency: config.settings.maxConcurrency,
    enableHotReload: config.settings.enableHotReload,
    logLevel: config.settings.logLevel,
  });
}

async function setupLoaderAndRegister(
  registryInstance: PluginRegistry,
  config: HookConfig,
  enableHotReload: boolean
) {
  const loaderInstance = new PluginLoader({
    searchPaths: config.loader.searchPaths,
    includePatterns: config.loader.includePatterns,
    excludePatterns: config.loader.excludePatterns,
    recursive: config.loader.recursive,
    maxDepth: config.loader.maxDepth,
    enableCache: config.loader.enableCache,
    validateOnLoad: config.loader.validateOnLoad,
    enableHotReload,
  });

  const { plugins } = await loaderInstance.loadPlugins();

  for (const plugin of plugins) {
    const pluginConfig = config.plugins.find(
      (p: PluginConfig) => p.name === plugin.name
    );
    registryInstance.register(plugin, pluginConfig);
  }

  if (enableHotReload) {
    loaderInstance.onHotReload((event: HotReloadEvent) => {
      if (event.type === 'changed' || event.type === 'added') {
        if (event.plugin) {
          registryInstance.unregister(event.plugin.name);
          const pluginConfig = config.plugins.find(
            (p: PluginConfig) => p.name === event.plugin?.name
          );
          registryInstance.register(event.plugin, pluginConfig);
        }
      } else if (event.type === 'removed') {
        const pluginName =
          event.path.split('/').pop()?.replace(PLUGIN_FILENAME_REGEX, '') ||
          'unknown';
        registryInstance.unregister(pluginName);
      }
    });
    loaderInstance.startWatching();
  }

  return loaderInstance;
}

function setupConfigHotReload(configLoaderInstance: ConfigLoader) {
  configLoaderInstance.onChange((_event: ConfigChangeEvent) => {
    // Configuration hot reload hook reserved for future implementation
  });
}
