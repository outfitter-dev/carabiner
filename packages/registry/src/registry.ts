/**
 * @file registry.ts
 * @description Plugin registry for managing and executing Claude Code hook plugins.
 * Provides plugin registration, discovery, priority ordering, and event-based execution.
 */

import type { HookContext, HookResult } from "@carabiner/types";
// import { ExecutionTimer, MemoryTracker } from '@carabiner/execution';
import type {
	HookPlugin,
	PluginCondition,
	PluginConfig,
	PluginExecutionContext,
	PluginExecutionOptions,
	PluginResult,
} from "./plugin";
import {
	createPluginResult,
	isHookPlugin,
	PluginConfigurationError,
	PluginExecutionError,
	PluginValidationError,
} from "./plugin";

/**
 * Registry statistics and metrics
 */
export type RegistryStats = {
	/** Total number of registered plugins */
	totalPlugins: number;
	/** Number of enabled plugins */
	enabledPlugins: number;
	/** Number of disabled plugins */
	disabledPlugins: number;
	/** Total executions across all plugins */
	totalExecutions: number;
	/** Total execution time (ms) */
	totalExecutionTime: number;
	/** Average execution time per plugin */
	averageExecutionTime: number;
	/** Success rate (0-1) */
	successRate: number;
	/** Last execution timestamp */
	lastExecution?: Date;
	/** Plugin execution counts by name */
	executionCounts: Record<string, number>;
	/** Plugin error counts by name */
	errorCounts: Record<string, number>;
};

/**
 * Registry configuration options
 */
export type RegistryOptions = {
	/** Default plugin execution timeout (ms) */
	defaultTimeout: number;
	/** Whether to collect execution metrics */
	collectMetrics: boolean;
	/** Whether to continue execution on plugin failure */
	continueOnFailure: boolean;
	/** Maximum concurrent plugin executions */
	maxConcurrency: number;
	/** Enable hot reload in development */
	enableHotReload: boolean;
	/** Log level for registry operations */
	logLevel: "debug" | "info" | "warn" | "error" | "silent";
};

/**
 * Plugin registry event
 */
export type RegistryEvent = {
	type:
		| "plugin-registered"
		| "plugin-unregistered"
		| "plugin-executed"
		| "plugin-failed"
		| "registry-cleared";
	plugin?: HookPlugin;
	error?: Error;
	result?: PluginResult;
	timestamp: Date;
	context?: HookContext;
};

/**
 * Registry event listener
 */
export type RegistryEventListener = (
	event: RegistryEvent,
) => void | Promise<void>;

/**
 * Main plugin registry class
 *
 * Manages plugin registration, configuration, and execution with support for:
 * - Priority-based ordering
 * - Event filtering
 * - Configuration validation
 * - Performance monitoring
 * - Error handling and recovery
 * - Plugin lifecycle management
 *
 * @example Basic Usage
 * ```typescript
 * const registry = new PluginRegistry();
 *
 * registry.register(gitSafetyPlugin);
 * registry.register(fileBackupPlugin);
 *
 * const results = await registry.execute(context);
 * ```
 *
 * @example With Configuration
 * ```typescript
 * const registry = new PluginRegistry({
 *   defaultTimeout: 5000,
 *   continueOnFailure: true,
 *   collectMetrics: true
 * });
 *
 * const results = await registry.executeWithOptions(context, {
 *   timeout: 10000,
 *   continueOnFailure: false
 * });
 * ```
 */
export class PluginRegistry {
	private readonly plugins = new Map<string, HookPlugin>();
	private readonly configs = new Map<string, PluginConfig>();
	private readonly stats: RegistryStats;
	private readonly eventListeners: RegistryEventListener[] = [];
	private readonly options: RegistryOptions;
	private initialized = false;

	constructor(options: Partial<RegistryOptions> = {}) {
		this.options = {
			defaultTimeout: 5000,
			collectMetrics: true,
			continueOnFailure: false,
			maxConcurrency: 10,
			enableHotReload: false,
			logLevel: "info",
			...options,
		};

		this.stats = {
			totalPlugins: 0,
			enabledPlugins: 0,
			disabledPlugins: 0,
			totalExecutions: 0,
			totalExecutionTime: 0,
			averageExecutionTime: 0,
			successRate: 1,
			executionCounts: {},
			errorCounts: {},
		};
	}

	// === Plugin Registration ===

	/**
	 * Register a plugin with the registry
	 */
	register(plugin: HookPlugin, config?: Partial<PluginConfig>): void {
		this.validatePlugin(plugin);

		if (this.plugins.has(plugin.name)) {
			throw new PluginValidationError(
				plugin.name,
				"name",
				"Plugin already registered",
			);
		}

		// Create default config
		const pluginConfig: PluginConfig = {
			name: plugin.name,
			enabled: plugin.enabled ?? true,
			priority: plugin.priority ?? 0,
			events: plugin.events,
			tools: plugin.tools,
			config: { ...plugin.defaultConfig, ...config?.config },
			conditions: config?.conditions || [],
			...config,
		};

		// Validate plugin configuration
		if (plugin.configSchema && pluginConfig.config) {
			try {
				plugin.configSchema.parse(pluginConfig.config);
			} catch (error) {
				throw new PluginConfigurationError(
					plugin.name,
					`Invalid configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		this.plugins.set(plugin.name, plugin);
		this.configs.set(plugin.name, pluginConfig);

		this.updateStats();
		this.emitEvent({
			type: "plugin-registered",
			plugin,
			timestamp: new Date(),
		});

		if (this.options.logLevel !== "silent") {
		}
	}

	/**
	 * Unregister a plugin from the registry
	 */
	unregister(pluginName: string): boolean {
		const plugin = this.plugins.get(pluginName);
		if (!plugin) {
			return false;
		}

		this.plugins.delete(pluginName);
		this.configs.delete(pluginName);

		this.updateStats();
		this.emitEvent({
			type: "plugin-unregistered",
			plugin,
			timestamp: new Date(),
		});

		if (this.options.logLevel !== "silent") {
		}

		return true;
	}

	/**
	 * Clear all registered plugins
	 */
	clear(): void {
		// const count = this.plugins.size;
		this.plugins.clear();
		this.configs.clear();

		this.updateStats();
		this.emitEvent({ type: "registry-cleared", timestamp: new Date() });

		if (this.options.logLevel !== "silent") {
		}
	}

	// === Plugin Execution ===

	/**
	 * Execute plugins for a given context
	 */
	async execute(
		context: HookContext,
		options: Partial<PluginExecutionOptions> = {},
	): Promise<PluginResult[]> {
		const execOptions = this.buildExecutionOptions(options);
		const applicablePlugins = this.getApplicablePlugins(context);
		const results: PluginResult[] = [];

		this.logPluginExecution(applicablePlugins, context);

		for (let i = 0; i < applicablePlugins.length; i++) {
			const plugin = applicablePlugins[i];
			if (!plugin) {
				continue;
			}

			const config = this.configs.get(plugin.name);
			if (!config?.enabled) {
				continue;
			}

			const shouldContinue = await this.executePluginStep(
				plugin,
				context,
				config,
				execOptions,
				applicablePlugins,
				i,
				results,
			);

			if (!shouldContinue) {
				break;
			}
		}

		this.updateExecutionStats(results);
		return results;
	}

	/**
	 * Execute a single plugin with detailed context
	 */
	private async executePlugin(
		plugin: HookPlugin,
		context: HookContext,
		config: PluginConfig,
		options: PluginExecutionOptions,
		_execContext: PluginExecutionContext,
	): Promise<PluginResult> {
		const startTime = options.collectMetrics ? performance.now() : 0;
		const startMemory = options.collectMetrics ? process.memoryUsage() : null;

		try {
			// Execute plugin with timeout
			const executePromise = plugin.apply(context, config.config);

			let result: PluginResult;
			if (options.timeout && options.timeout > 0) {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(
						() => reject(new Error("Plugin execution timeout")),
						options.timeout,
					);
				});

				const pluginResult = await Promise.race([
					executePromise,
					timeoutPromise,
				]);
				result = this.normalizePluginResult(plugin, pluginResult);
			} else {
				const pluginResult = await executePromise;
				result = this.normalizePluginResult(plugin, pluginResult);
			}

			// Add execution metrics
			if (options.collectMetrics && startMemory) {
				const endTime = performance.now();
				const endMemory = process.memoryUsage();

				result.executionTime = endTime - startTime;
				result.memoryUsage = {
					heapUsed: endMemory.heapUsed,
					heapTotal: endMemory.heapTotal,
				};
			}

			return result;
		} catch (error) {
			throw new PluginExecutionError(
				plugin.name,
				`Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				error instanceof Error ? error : undefined,
			);
		}
	}

	/**
	 * Build execution options from partial options
	 */
	private buildExecutionOptions(
		options: Partial<PluginExecutionOptions>,
	): PluginExecutionOptions {
		return {
			timeout: this.options.defaultTimeout,
			collectMetrics: this.options.collectMetrics,
			continueOnFailure: this.options.continueOnFailure,
			...options,
		};
	}

	/**
	 * Log plugin execution if debug mode is enabled
	 */
	private logPluginExecution(
		_applicablePlugins: HookPlugin[],
		_context: HookContext,
	): void {
		if (this.options.logLevel === "debug") {
		}
	}

	/**
	 * Execute a single plugin step and handle results/errors
	 */
	private async executePluginStep(
		plugin: HookPlugin,
		context: HookContext,
		config: PluginConfig,
		execOptions: PluginExecutionOptions,
		applicablePlugins: HookPlugin[],
		index: number,
		results: PluginResult[],
	): Promise<boolean> {
		try {
			const result = await this.executePlugin(
				plugin,
				context,
				config,
				execOptions,
				{
					context,
					config: config.config,
					registry: this,
					plugins: applicablePlugins,
					index,
					previousResults: results,
				},
			);

			results.push(result);
			this.emitEvent({
				type: "plugin-executed",
				plugin,
				result,
				context,
				timestamp: new Date(),
			});

			return this.shouldContinueAfterSuccess(result, execOptions, plugin);
		} catch (error) {
			return this.handlePluginExecutionError(
				plugin,
				error as Error,
				context,
				execOptions,
				results,
			);
		}
	}

	/**
	 * Check if execution should continue after successful plugin execution
	 */
	private shouldContinueAfterSuccess(
		result: PluginResult,
		execOptions: PluginExecutionOptions,
		_plugin: HookPlugin,
	): boolean {
		if (
			!result.success &&
			result.block &&
			!(execOptions.continueOnFailure ?? false)
		) {
			if (this.options.logLevel !== "silent") {
			}
			return false;
		}
		return true;
	}

	/**
	 * Handle plugin execution error and return whether to continue
	 */
	private handlePluginExecutionError(
		plugin: HookPlugin,
		error: Error,
		context: HookContext,
		execOptions: PluginExecutionOptions,
		results: PluginResult[],
	): boolean {
		const errorResult = this.createErrorResult(plugin, error);
		results.push(errorResult);

		this.emitEvent({
			type: "plugin-failed",
			plugin,
			error,
			context,
			timestamp: new Date(),
		});

		return execOptions.continueOnFailure ?? false;
	}

	// === Plugin Discovery and Management ===

	/**
	 * Get plugins applicable to a given context
	 */
	private getApplicablePlugins(context: HookContext): HookPlugin[] {
		const applicable: Array<{ plugin: HookPlugin; priority: number }> = [];

		for (const [name, plugin] of this.plugins) {
			const config = this.configs.get(name);
			if (!config?.enabled) {
				continue;
			}

			if (this.isPluginApplicableToContext(plugin, config, context)) {
				applicable.push({ plugin, priority: config.priority });
			}
		}

		return this.sortPluginsByPriority(applicable);
	}

	/**
	 * Check if a plugin is applicable to the given context
	 */
	private isPluginApplicableToContext(
		plugin: HookPlugin,
		config: PluginConfig,
		context: HookContext,
	): boolean {
		if (!this.isEventApplicable(plugin, config, context)) {
			return false;
		}

		if (!this.isToolApplicable(config, context)) {
			return false;
		}

		if (!this.areConditionsSatisfied(config, context)) {
			return false;
		}

		return true;
	}

	/**
	 * Check if plugin handles the current event
	 */
	private isEventApplicable(
		plugin: HookPlugin,
		config: PluginConfig,
		context: HookContext,
	): boolean {
		const events = config.events || plugin.events;
		return events.length === 0 || events.includes(context.event);
	}

	/**
	 * Check if plugin is applicable to the current tool
	 */
	private isToolApplicable(
		config: PluginConfig,
		context: HookContext,
	): boolean {
		if (!config.tools || config.tools.length === 0) {
			return true;
		}

		const toolName = "toolName" in context ? context.toolName : null;
		return Boolean(toolName && config.tools.includes(toolName));
	}

	/**
	 * Check if all plugin conditions are satisfied
	 */
	private areConditionsSatisfied(
		config: PluginConfig,
		context: HookContext,
	): boolean {
		if (!config.conditions) {
			return true;
		}

		return this.checkConditions(context, config.conditions);
	}

	/**
	 * Sort plugins by priority (higher priority first)
	 */
	private sortPluginsByPriority(
		applicable: Array<{ plugin: HookPlugin; priority: number }>,
	): HookPlugin[] {
		return applicable
			.sort((a, b) => b.priority - a.priority)
			.map((item) => item.plugin);
	}

	/**
	 * Check if plugin conditions are satisfied
	 */
	private checkConditions(
		context: HookContext,
		conditions: PluginCondition[],
	): boolean {
		return conditions.every((condition) => {
			switch (condition.type) {
				case "env":
					return this.checkEnvironmentCondition(condition);
				case "context":
					return this.checkContextCondition(context, condition);
				case "tool":
					return this.checkToolCondition(context, condition);
				case "custom":
					return condition.condition ? condition.condition(context) : true;
				default:
					return true;
			}
		});
	}

	private checkEnvironmentCondition(condition: PluginCondition): boolean {
		if (!condition.field) {
			return true;
		}

		const envValue = process.env[condition.field];
		return this.compareValues(envValue, condition.operator, condition.value);
	}

	private checkContextCondition(
		context: HookContext,
		condition: PluginCondition,
	): boolean {
		if (!condition.field) {
			return true;
		}

		const contextValue = (context as unknown as Record<string, unknown>)[
			condition.field
		];
		return this.compareValues(
			contextValue,
			condition.operator,
			condition.value,
		);
	}

	private checkToolCondition(
		context: HookContext,
		condition: PluginCondition,
	): boolean {
		if (!("toolName" in context)) {
			return false;
		}

		const toolValue = condition.field
			? (context as unknown as Record<string, unknown>)[condition.field]
			: context.toolName;
		return this.compareValues(toolValue, condition.operator, condition.value);
	}

	private compareValues(
		actual: unknown,
		operator: PluginCondition["operator"],
		expected: unknown,
	): boolean {
		switch (operator) {
			case "equals":
				return actual === expected;
			case "not_equals":
				return actual !== expected;
			case "contains":
				return (
					typeof actual === "string" &&
					typeof expected === "string" &&
					actual.includes(expected)
				);
			case "not_contains":
				return (
					typeof actual === "string" &&
					typeof expected === "string" &&
					!actual.includes(expected)
				);
			case "matches":
				if (typeof actual === "string" && expected instanceof RegExp) {
					return expected.test(actual);
				}
				if (typeof actual === "string" && typeof expected === "string") {
					return new RegExp(expected).test(actual);
				}
				return false;
			case "custom":
				return false; // Custom conditions handled separately
			default:
				return true;
		}
	}

	// === Plugin Configuration ===

	/**
	 * Update plugin configuration
	 */
	updatePluginConfig(
		pluginName: string,
		config: Partial<PluginConfig>,
	): boolean {
		const existingConfig = this.configs.get(pluginName);
		if (!existingConfig) {
			return false;
		}

		const updatedConfig = { ...existingConfig, ...config };
		this.configs.set(pluginName, updatedConfig);

		this.updateStats();
		return true;
	}

	/**
	 * Get plugin configuration
	 */
	getPluginConfig(pluginName: string): PluginConfig | undefined {
		return this.configs.get(pluginName);
	}

	// === Plugin Lifecycle Management ===

	/**
	 * Initialize all registered plugins
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		const initPromises = Array.from(this.plugins.values()).map(
			async (plugin) => {
				if (plugin.init) {
					try {
						await plugin.init();
						if (this.options.logLevel === "debug") {
						}
					} catch (_error) {}
				}
			},
		);

		await Promise.all(initPromises);
		this.initialized = true;
	}

	/**
	 * Shutdown all registered plugins
	 */
	async shutdown(): Promise<void> {
		if (!this.initialized) {
			return;
		}

		const shutdownPromises = Array.from(this.plugins.values()).map(
			async (plugin) => {
				if (plugin.shutdown) {
					try {
						await plugin.shutdown();
						if (this.options.logLevel === "debug") {
						}
					} catch (_error) {}
				}
			},
		);

		await Promise.all(shutdownPromises);
		this.initialized = false;
	}

	/**
	 * Run health checks on all plugins
	 */
	async healthCheck(): Promise<Record<string, boolean>> {
		const results: Record<string, boolean> = {};

		const healthPromises = Array.from(this.plugins.entries()).map(
			async ([name, plugin]) => {
				if (plugin.healthCheck) {
					try {
						results[name] = await plugin.healthCheck();
					} catch (_error) {
						results[name] = false;
					}
				} else {
					results[name] = true; // No health check = healthy
				}
			},
		);

		await Promise.all(healthPromises);
		return results;
	}

	// === Registry Information ===

	/**
	 * Get all registered plugins
	 */
	getPlugins(): HookPlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Get a specific plugin by name
	 */
	getPlugin(name: string): HookPlugin | undefined {
		return this.plugins.get(name);
	}

	/**
	 * Check if a plugin is registered
	 */
	hasPlugin(name: string): boolean {
		return this.plugins.has(name);
	}

	/**
	 * Get registry statistics
	 */
	getStats(): RegistryStats {
		return { ...this.stats };
	}

	// === Event System ===

	/**
	 * Add an event listener
	 */
	addEventListener(listener: RegistryEventListener): void {
		this.eventListeners.push(listener);
	}

	/**
	 * Remove an event listener
	 */
	removeEventListener(listener: RegistryEventListener): boolean {
		const index = this.eventListeners.indexOf(listener);
		if (index >= 0) {
			this.eventListeners.splice(index, 1);
			return true;
		}
		return false;
	}

	private async emitEvent(event: RegistryEvent): Promise<void> {
		const promises = this.eventListeners.map(async (listener) => {
			try {
				await listener(event);
			} catch (_error) {
				if (this.options.logLevel !== "silent") {
				}
			}
		});

		await Promise.all(promises);
	}

	// === Private Utilities ===

	private validatePlugin(plugin: HookPlugin): void {
		if (!isHookPlugin(plugin)) {
			throw new PluginValidationError(
				"unknown",
				"structure",
				"Invalid plugin structure",
			);
		}

		if (!plugin.name.match(/^[a-z0-9-]+$/)) {
			throw new PluginValidationError(
				plugin.name,
				"name",
				"Plugin name must be kebab-case",
			);
		}

		if (!plugin.version.match(/^\d+\.\d+\.\d+/)) {
			throw new PluginValidationError(
				plugin.name,
				"version",
				"Plugin version must be semver format",
			);
		}

		if (plugin.events.length === 0) {
			throw new PluginValidationError(
				plugin.name,
				"events",
				"Plugin must handle at least one event",
			);
		}
	}

	private normalizePluginResult(
		plugin: HookPlugin,
		result: HookResult | PluginResult,
	): PluginResult {
		if ("pluginName" in result && "pluginVersion" in result) {
			return result as PluginResult;
		}

		return createPluginResult(plugin, result);
	}

	private createErrorResult(plugin: HookPlugin, error: Error): PluginResult {
		this.stats.errorCounts[plugin.name] =
			(this.stats.errorCounts[plugin.name] || 0) + 1;

		return {
			success: false,
			block: false,
			message: `Plugin execution failed: ${error.message}`,
			pluginName: plugin.name,
			pluginVersion: plugin.version,
			metadata: { error: error.name, stack: error.stack },
		};
	}

	private updateStats(): void {
		this.stats.totalPlugins = this.plugins.size;
		this.stats.enabledPlugins = Array.from(this.configs.values()).filter(
			(config) => config.enabled,
		).length;
		this.stats.disabledPlugins =
			this.stats.totalPlugins - this.stats.enabledPlugins;
	}

	private updateExecutionStats(results: PluginResult[]): void {
		this.stats.totalExecutions += results.length;
		this.stats.lastExecution = new Date();

		let totalTime = 0;
		let successCount = 0;

		for (const result of results) {
			// Update execution counts
			this.stats.executionCounts[result.pluginName] =
				(this.stats.executionCounts[result.pluginName] || 0) + 1;

			// Update timing
			if (result.executionTime) {
				totalTime += result.executionTime;
			}

			// Update success rate
			if (result.success) {
				successCount++;
			}
		}

		this.stats.totalExecutionTime += totalTime;
		this.stats.averageExecutionTime =
			this.stats.totalExecutionTime / this.stats.totalExecutions;
		this.stats.successRate = successCount / results.length;
	}
}
