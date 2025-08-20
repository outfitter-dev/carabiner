/**
 * @file loader.ts
 * @description Plugin loading and discovery system for dynamic plugin management.
 * Supports file system discovery, module loading, and hot reload functionality.
 */

import { readdir, stat, watch } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  HookPlugin,
  PluginDiscovery,
  PluginFactory,
  PluginModule,
} from './plugin';
import { isHookPlugin, PluginValidationError } from './plugin';

/**
 * Plugin loader configuration
 */
export type LoaderOptions = {
  /** Directories to search for plugins */
  searchPaths: string[];
  /** File patterns to include (e.g., ['*.plugin.js', '*.plugin.ts']) */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Whether to search subdirectories recursively */
  recursive: boolean;
  /** Maximum search depth (if recursive) */
  maxDepth: number;
  /** Whether to enable hot reload */
  enableHotReload: boolean;
  /** Hot reload debounce time (ms) */
  hotReloadDebounce: number;
  /** Cache loaded plugins */
  enableCache: boolean;
  /** Validate plugins on load */
  validateOnLoad: boolean;
  /** Allow ES module loading */
  allowESModules: boolean;
  /** Allow CommonJS module loading */
  allowCommonJS: boolean;
};

/**
 * Plugin load result
 */
export type PluginLoadResult = {
  /** Successfully loaded plugins */
  plugins: HookPlugin[];
  /** Failed plugin discoveries */
  errors: Array<{
    path: string;
    error: Error;
  }>;
  /** Total files scanned */
  scanned: number;
  /** Load duration (ms) */
  duration: number;
};

/**
 * Hot reload event
 */
export type HotReloadEvent = {
  type: 'added' | 'changed' | 'removed';
  path: string;
  plugin?: HookPlugin;
  error?: Error;
};

/**
 * Hot reload listener
 */
export type HotReloadListener = (event: HotReloadEvent) => void | Promise<void>;

/**
 * Plugin loader class for dynamic plugin discovery and loading
 *
 * Features:
 * - File system plugin discovery
 * - ES Module and CommonJS support
 * - Hot reload for development
 * - Plugin validation and error handling
 * - Caching for performance
 * - Recursive directory scanning
 *
 * @example Basic Usage
 * ```typescript
 * const loader = new PluginLoader({
 *   searchPaths: ['./plugins', './node_modules/@company/plugins'],
 *   includePatterns: ['*.plugin.js', '*.plugin.ts'],
 *   recursive: true
 * });
 *
 * const result = await loader.loadPlugins();
 * console.log(`Loaded ${result.plugins.length} plugins`);
 * ```
 *
 * @example With Hot Reload
 * ```typescript
 * const loader = new PluginLoader({
 *   enableHotReload: true
 * });
 *
 * loader.onHotReload(async (event) => {
 *   if (event.type === 'changed' && event.plugin) {
 *     registry.unregister(event.plugin.name);
 *     registry.register(event.plugin);
 *   }
 * });
 *
 * await loader.startWatching();
 * ```
 */
export class PluginLoader {
  private readonly options: LoaderOptions;
  private readonly cache = new Map<
    string,
    { plugin: HookPlugin; lastModified: number }
  >();
  private readonly watchers = new Map<string, AbortController>();
  private readonly hotReloadListeners: HotReloadListener[] = [];
  private readonly loadedPaths = new Set<string>();

  constructor(options: Partial<LoaderOptions> = {}) {
    this.options = {
      searchPaths: ['./plugins'],
      includePatterns: ['*.plugin.js', '*.plugin.ts', '*.plugin.mjs'],
      excludePatterns: ['*.test.*', '*.spec.*', '**/node_modules/**'],
      recursive: true,
      maxDepth: 5,
      enableHotReload: false,
      hotReloadDebounce: 300,
      enableCache: true,
      validateOnLoad: true,
      allowESModules: true,
      allowCommonJS: true,
      ...options,
    };
  }

  // === Plugin Discovery ===

  /**
   * Discover plugins in the configured search paths
   */
  async discoverPlugins(): Promise<PluginDiscovery[]> {
    const discoveries: PluginDiscovery[] = [];

    for (const searchPath of this.options.searchPaths) {
      try {
        const pathDiscoveries = await this.discoverInPath(resolve(searchPath));
        discoveries.push(...pathDiscoveries);
      } catch (_error) {}
    }

    return discoveries;
  }

  /**
   * Discover plugins in a specific directory
   */
  private async discoverInPath(
    path: string,
    depth = 0
  ): Promise<PluginDiscovery[]> {
    if (depth > this.options.maxDepth) {
      return [];
    }

    const discoveries: PluginDiscovery[] = [];

    try {
      const entries = await readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(path, entry.name);

        if (entry.isDirectory() && this.options.recursive) {
          // Skip excluded directories
          if (this.shouldExclude(fullPath)) {
            continue;
          }

          const subDiscoveries = await this.discoverInPath(fullPath, depth + 1);
          discoveries.push(...subDiscoveries);
        } else if (
          entry.isFile() &&
          this.shouldInclude(fullPath) &&
          !this.shouldExclude(fullPath)
        ) {
          // File matches include patterns and not excluded
          const stats = await stat(fullPath);
          discoveries.push({
            path: fullPath,
            name: this.extractPluginName(fullPath),
            lastModified: stats.mtime,
          });
        }
      }
    } catch (_error) {}

    return discoveries;
  }

  // === Plugin Loading ===

  /**
   * Load all discovered plugins
   */
  async loadPlugins(): Promise<PluginLoadResult> {
    const startTime = Date.now();
    const discoveries = await this.discoverPlugins();
    const plugins: HookPlugin[] = [];
    const errors: PluginLoadResult['errors'] = [];

    for (const discovery of discoveries) {
      try {
        const plugin = await this.loadPlugin(discovery.path);
        if (plugin) {
          plugins.push(plugin);
        }
      } catch (error) {
        errors.push({
          path: discovery.path,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return {
      plugins,
      errors,
      scanned: discoveries.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Load a plugin from a file path
   */
  async loadPlugin(filePath: string): Promise<HookPlugin | null> {
    const absolutePath = resolve(filePath);

    // Check cache first
    if (this.options.enableCache && this.cache.has(absolutePath)) {
      const cached = this.cache.get(absolutePath)!;
      const stats = await stat(absolutePath);

      if (stats.mtime.getTime() <= cached.lastModified) {
        return cached.plugin;
      }
    }

    try {
      const plugin = await this.loadPluginModule(absolutePath);

      if (!plugin) {
        return null;
      }

      // Validate plugin if required
      if (this.options.validateOnLoad) {
        this.validatePlugin(plugin, absolutePath);
      }

      // Cache the plugin
      if (this.options.enableCache) {
        const stats = await stat(absolutePath);
        this.cache.set(absolutePath, {
          plugin,
          lastModified: stats.mtime.getTime(),
        });
      }

      this.loadedPaths.add(absolutePath);
      return plugin;
    } catch (error) {
      throw new Error(
        `Failed to load plugin from ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Load plugin from module file
   */
  private async loadPluginModule(filePath: string): Promise<HookPlugin | null> {
    const ext = extname(filePath);
    const isESModule =
      ext === '.mjs' || (ext === '.js' && this.isESModuleEnvironment());
    const isTypeScript = ext === '.ts';

    // Clear module from require cache if CommonJS
    if (!(isESModule || isTypeScript)) {
      delete require.cache[require.resolve(filePath)];
    }

    let module: PluginModule;

    try {
      if (isESModule || isTypeScript) {
        if (!this.options.allowESModules) {
          throw new Error('ES modules are not allowed');
        }

        // Use dynamic import for ES modules
        const fileUrl = pathToFileURL(filePath).href;
        module = await import(`${fileUrl}?t=${Date.now()}`);
      } else {
        if (!this.options.allowCommonJS) {
          throw new Error('CommonJS modules are not allowed');
        }

        // Use require for CommonJS
        module = require(filePath);
      }
    } catch (error) {
      throw new Error(
        `Failed to load module: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return this.extractPluginFromModule(module, filePath);
  }

  /**
   * Extract plugin from loaded module
   */
  private extractPluginFromModule(
    module: PluginModule,
    filePath: string
  ): HookPlugin | null {
    // Try default export first
    if (module.default) {
      const plugin = this.resolvePlugin(module.default, filePath);
      if (plugin) {
        return plugin;
      }
    }

    // Try named export 'plugin'
    if (module.plugin) {
      const plugin = this.resolvePlugin(module.plugin, filePath);
      if (plugin) {
        return plugin;
      }
    }

    // Try other named exports that look like plugins
    for (const [key, value] of Object.entries(module)) {
      if (
        key !== 'default' &&
        key !== 'plugin' &&
        key.toLowerCase().includes('plugin')
      ) {
        const plugin = this.resolvePlugin(value, filePath);
        if (plugin) {
          return plugin;
        }
      }
    }

    return null;
  }

  /**
   * Resolve plugin from export (could be plugin object or factory function)
   */
  private resolvePlugin(
    exportValue: unknown,
    _filePath: string
  ): HookPlugin | null {
    if (isHookPlugin(exportValue)) {
      return exportValue;
    }

    if (typeof exportValue === 'function') {
      try {
        // Try calling as plugin factory
        const factory = exportValue as PluginFactory;
        const result = factory();

        if (result instanceof Promise) {
          throw new Error(
            'Async plugin factories not supported in synchronous context'
          );
        }

        if (isHookPlugin(result)) {
          return result;
        }
      } catch (_error) {}
    }

    return null;
  }

  // === Hot Reload ===

  /**
   * Start watching for file changes
   */
  async startWatching(): Promise<void> {
    if (!this.options.enableHotReload) {
      throw new Error('Hot reload is not enabled');
    }

    for (const searchPath of this.options.searchPaths) {
      try {
        await this.watchPath(resolve(searchPath));
      } catch (_error) {}
    }
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching(): Promise<void> {
    for (const controller of this.watchers.values()) {
      controller.abort();
    }
    this.watchers.clear();
  }

  /**
   * Add hot reload event listener
   */
  onHotReload(listener: HotReloadListener): void {
    this.hotReloadListeners.push(listener);
  }

  /**
   * Remove hot reload event listener
   */
  offHotReload(listener: HotReloadListener): boolean {
    const index = this.hotReloadListeners.indexOf(listener);
    if (index >= 0) {
      this.hotReloadListeners.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Watch a directory for changes
   */
  private async watchPath(path: string): Promise<void> {
    const controller = new AbortController();
    this.watchers.set(path, controller);

    try {
      const watcher = watch(path, {
        recursive: this.options.recursive,
        signal: controller.signal,
      });

      const debouncedHandler = this.debounce(
        (eventType: string, filePath: string) => {
          this.handleFileChange(eventType, filePath).catch((_error) => {});
        },
        this.options.hotReloadDebounce
      );

      for await (const event of watcher) {
        if (event.filename && this.shouldInclude(join(path, event.filename))) {
          debouncedHandler(event.eventType, join(path, event.filename));
        }
      }
    } catch (_error) {
      if (!controller.signal.aborted) {
      }
    }
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(
    eventType: string,
    filePath: string
  ): Promise<void> {
    try {
      if (eventType === 'change' || eventType === 'rename') {
        // Check if file still exists
        try {
          await stat(filePath);

          // File exists - load or reload plugin
          const plugin = await this.loadPlugin(filePath);
          if (plugin) {
            await this.emitHotReloadEvent({
              type: this.loadedPaths.has(filePath) ? 'changed' : 'added',
              path: filePath,
              plugin,
            });
          }
        } catch (_error) {
          // File was deleted
          if (this.loadedPaths.has(filePath)) {
            this.loadedPaths.delete(filePath);
            this.cache.delete(filePath);

            await this.emitHotReloadEvent({
              type: 'removed',
              path: filePath,
            });
          }
        }
      }
    } catch (error) {
      await this.emitHotReloadEvent({
        type: 'changed',
        path: filePath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async emitHotReloadEvent(event: HotReloadEvent): Promise<void> {
    const promises = this.hotReloadListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (_error) {}
    });

    await Promise.all(promises);
  }

  // === Utilities ===

  private shouldInclude(filePath: string): boolean {
    if (this.options.includePatterns.length === 0) {
      return true;
    }

    return this.options.includePatterns.some((pattern) => {
      const regex = this.globToRegex(pattern);
      return regex.test(basename(filePath));
    });
  }

  private shouldExclude(filePath: string): boolean {
    return this.options.excludePatterns.some((pattern) => {
      const regex = this.globToRegex(pattern);
      return regex.test(filePath);
    });
  }

  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${escaped}$`, 'i');
  }

  private extractPluginName(filePath: string): string {
    const filename = basename(filePath);
    return filename.replace(/\.(plugin|hook)\.(js|ts|mjs)$/, '');
  }

  private validatePlugin(plugin: HookPlugin, filePath: string): void {
    if (!isHookPlugin(plugin)) {
      throw new PluginValidationError(
        'unknown',
        'structure',
        `Invalid plugin structure in ${filePath}`
      );
    }
  }

  private isESModuleEnvironment(): boolean {
    // Check package.json type field or file extension
    try {
      const pkg = require(join(process.cwd(), 'package.json'));
      return pkg.type === 'module';
    } catch {
      return false;
    }
  }

  private debounce<Args extends unknown[]>(
    func: (...args: Args) => void,
    wait: number
  ): (...args: Args) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // === Cache Management ===

  /**
   * Clear the plugin cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadedPaths.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    paths: string[];
    memoryUsage: number;
  } {
    const paths = Array.from(this.cache.keys());
    const memoryUsage = JSON.stringify(Array.from(this.cache.values())).length;

    return {
      size: this.cache.size,
      paths,
      memoryUsage,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stopWatching();
    this.clearCache();
    this.hotReloadListeners.length = 0;
  }
}
