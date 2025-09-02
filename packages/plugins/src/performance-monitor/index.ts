/**
 * @file performance-monitor/index.ts
 * @description Performance monitoring plugin - tracks execution time and resource usage
 *
 * This plugin monitors Claude Code operation performance including:
 * - Execution time tracking
 * - Memory usage monitoring
 * - Operation frequency analysis
 * - Performance alerting and reporting
 */

import { PerformanceObserver, performance } from "node:perf_hooks";
import type { HookPlugin, PluginResult } from "@carabiner/registry";
import type { HookContext } from "@carabiner/types";
import { z } from "zod";

/**
 * Performance metric interface
 */
type PerformanceMetric = {
	operation: string;
	startTime: number;
	endTime: number;
	duration: number;
	memoryUsage: NodeJS.MemoryUsage;
	success: boolean;
	toolName?: string;
	filePath?: string;
};

/**
 * Performance statistics
 */
type PerformanceStats = {
	totalOperations: number;
	totalDuration: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	successRate: number;
	memoryTrend: "increasing" | "decreasing" | "stable";
	operationCounts: Record<string, number>;
	toolUsage: Record<string, number>;
};

/**
 * Performance alert interface
 */
type PerformanceAlert = {
	type: "slow_operation" | "memory_usage" | "error_rate" | "frequency";
	severity: "warning" | "critical";
	message: string;
	metric: PerformanceMetric;
	threshold: number;
	value: number;
};

/**
 * Performance monitor plugin configuration schema
 */
const PerformanceMonitorConfigSchema = z
	.object({
		/** Whether to track execution time */
		trackExecutionTime: z.boolean().default(true),

		/** Whether to track memory usage */
		trackMemoryUsage: z.boolean().default(true),

		/** Whether to track operation frequency */
		trackOperationFrequency: z.boolean().default(true),

		/** Maximum number of metrics to store in memory */
		maxMetrics: z.number().min(10).max(10_000).default(1000),

		/** Slow operation threshold in milliseconds */
		slowOperationThreshold: z.number().min(100).default(5000),

		/** High memory usage threshold in bytes */
		highMemoryThreshold: z
			.number()
			.min(1024 * 1024)
			.default(100 * 1024 * 1024), // 100MB

		/** Error rate threshold (0-1) */
		errorRateThreshold: z.number().min(0).max(1).default(0.1), // 10%

		/** High frequency threshold (operations per minute) */
		frequencyThreshold: z.number().min(1).default(60),

		/** Whether to log performance alerts */
		logAlerts: z.boolean().default(true),

		/** Whether to log performance stats periodically */
		logStats: z.boolean().default(false),

		/** Stats logging interval in milliseconds */
		statsInterval: z.number().min(10_000).default(300_000), // 5 minutes

		/** Tools to monitor (empty = all tools) */
		monitorTools: z.array(z.string()).default([]),

		/** Operations to exclude from monitoring */
		excludeOperations: z.array(z.string()).default([]),

		/** Whether to enable detailed profiling */
		enableProfiling: z.boolean().default(false),

		/** Performance history retention in milliseconds */
		retentionTime: z.number().min(60_000).default(3_600_000), // 1 hour
	})
	.default({});

type PerformanceMonitorConfig = z.infer<typeof PerformanceMonitorConfigSchema>;

// Correlate Pre/Post by tool; use a stack per tool to handle concurrent invocations
const preOpStartByTool = new Map<
	string,
	{ startTime: number; startMemory: NodeJS.MemoryUsage }[]
>();

function getCorrelationKey(operation: string): string {
	// operation is e.g. "PreToolUse_Bash" or "PostToolUse_Bash"
	const idx = operation.indexOf("_");
	return idx > -1 ? operation.slice(idx + 1) : operation;
}

/**
 * Global performance metrics store
 */
class MetricsStore {
	private metrics: PerformanceMetric[] = [];
	private alerts: PerformanceAlert[] = [];
	private observer?: PerformanceObserver;

	constructor(private readonly config: PerformanceMonitorConfig) {
		if (config.enableProfiling) {
			this.setupPerformanceObserver();
		}
	}

	private setupPerformanceObserver(): void {
		this.observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.name.startsWith("claude-hook-")) {
				}
			}
		});

		this.observer.observe({ entryTypes: ["measure"] });
	}

	addMetric(metric: PerformanceMetric): void {
		this.metrics.push(metric);

		// Trim metrics to max size
		if (this.metrics.length > this.config.maxMetrics) {
			this.metrics = this.metrics.slice(-this.config.maxMetrics);
		}

		// Clean old metrics
		const cutoff = Date.now() - this.config.retentionTime;
		this.metrics = this.metrics.filter((m) => m.endTime > cutoff);

		// Check for performance alerts
		this.checkAlerts(metric);
	}

	private checkAlerts(metric: PerformanceMetric): void {
		const alerts: PerformanceAlert[] = [];

		this.checkSlowOperationAlert(metric, alerts);
		this.checkMemoryUsageAlert(metric, alerts);
		this.checkErrorRateAlert(metric, alerts);
		this.checkFrequencyAlert(metric, alerts);

		this.processAlerts(alerts);
	}

	private checkSlowOperationAlert(
		metric: PerformanceMetric,
		alerts: PerformanceAlert[],
	): void {
		if (
			!this.config.trackExecutionTime ||
			metric.duration <= this.config.slowOperationThreshold
		) {
			return;
		}

		alerts.push({
			type: "slow_operation",
			severity:
				metric.duration > this.config.slowOperationThreshold * 2
					? "critical"
					: "warning",
			message: `Slow operation detected: ${metric.operation} took ${metric.duration.toFixed(2)}ms`,
			metric,
			threshold: this.config.slowOperationThreshold,
			value: metric.duration,
		});
	}

	private checkMemoryUsageAlert(
		metric: PerformanceMetric,
		alerts: PerformanceAlert[],
	): void {
		if (
			!this.config.trackMemoryUsage ||
			metric.memoryUsage.heapUsed <= this.config.highMemoryThreshold
		) {
			return;
		}

		alerts.push({
			type: "memory_usage",
			severity:
				metric.memoryUsage.heapUsed > this.config.highMemoryThreshold * 1.5
					? "critical"
					: "warning",
			message: `High memory usage: ${Math.round(metric.memoryUsage.heapUsed / 1024 / 1024)}MB`,
			metric,
			threshold: this.config.highMemoryThreshold,
			value: metric.memoryUsage.heapUsed,
		});
	}

	private checkErrorRateAlert(
		metric: PerformanceMetric,
		alerts: PerformanceAlert[],
	): void {
		const recentMetrics = this.metrics.slice(-50);
		if (recentMetrics.length < 10) {
			return;
		}

		const errorRate =
			recentMetrics.filter((m) => !m.success).length / recentMetrics.length;
		if (errorRate <= this.config.errorRateThreshold) {
			return;
		}

		alerts.push({
			type: "error_rate",
			severity:
				errorRate > this.config.errorRateThreshold * 2 ? "critical" : "warning",
			message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
			metric,
			threshold: this.config.errorRateThreshold,
			value: errorRate,
		});
	}

	private checkFrequencyAlert(
		metric: PerformanceMetric,
		alerts: PerformanceAlert[],
	): void {
		if (!this.config.trackOperationFrequency) {
			return;
		}

		const oneMinuteAgo = Date.now() - 60_000;
		const recentOps = this.metrics.filter(
			(m) => m.endTime > oneMinuteAgo && m.operation === metric.operation,
		);

		if (recentOps.length <= this.config.frequencyThreshold) {
			return;
		}

		alerts.push({
			type: "frequency",
			severity: "warning",
			message: `High operation frequency: ${recentOps.length} ${metric.operation} operations in the last minute`,
			metric,
			threshold: this.config.frequencyThreshold,
			value: recentOps.length,
		});
	}

	private processAlerts(alerts: PerformanceAlert[]): void {
		for (const alert of alerts) {
			this.alerts.push(alert);

			if (this.config.logAlerts) {
				const logFunction =
					alert.severity === "critical" ? console.error : console.warn;
				logFunction(
					`[PerformanceMonitor] ${alert.severity.toUpperCase()}: ${alert.message}`,
				);
			}
		}

		// Trim alerts
		if (this.alerts.length > 100) {
			this.alerts = this.alerts.slice(-100);
		}
	}

	getStats(): PerformanceStats {
		if (this.metrics.length === 0) {
			return {
				totalOperations: 0,
				totalDuration: 0,
				averageDuration: 0,
				minDuration: 0,
				maxDuration: 0,
				successRate: 1,
				memoryTrend: "stable",
				operationCounts: {},
				toolUsage: {},
			};
		}

		const durations = this.metrics.map((m) => m.duration);
		const totalDuration = durations.reduce((sum, d) => sum + d, 0);
		const successCount = this.metrics.filter((m) => m.success).length;

		// Calculate memory trend
		const recent = this.metrics.slice(-10);
		const older = this.metrics.slice(-20, -10);
		let memoryTrend: "increasing" | "decreasing" | "stable" = "stable";

		if (recent.length >= 5 && older.length >= 5) {
			const recentAvgMemory =
				recent.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
				recent.length;
			const olderAvgMemory =
				older.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
				older.length;
			const change = (recentAvgMemory - olderAvgMemory) / olderAvgMemory;

			if (change > 0.1) {
				memoryTrend = "increasing";
			} else if (change < -0.1) {
				memoryTrend = "decreasing";
			}
		}

		// Count operations and tools
		const operationCounts: Record<string, number> = {};
		const toolUsage: Record<string, number> = {};

		for (const metric of this.metrics) {
			operationCounts[metric.operation] =
				(operationCounts[metric.operation] || 0) + 1;
			if (metric.toolName) {
				toolUsage[metric.toolName] = (toolUsage[metric.toolName] || 0) + 1;
			}
		}

		return {
			totalOperations: this.metrics.length,
			totalDuration,
			averageDuration: totalDuration / this.metrics.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			successRate: successCount / this.metrics.length,
			memoryTrend,
			operationCounts,
			toolUsage,
		};
	}

	getAlerts(since?: number): PerformanceAlert[] {
		if (!since) {
			return [...this.alerts];
		}
		return this.alerts.filter((a) => a.metric.endTime > since);
	}

	cleanup(): void {
		this.observer?.disconnect();
		this.metrics = [];
		this.alerts = [];
	}
}

// Global metrics store
let globalMetricsStore: MetricsStore | undefined;

/**
 * Check if monitoring should be skipped
 */
function shouldSkipMonitoring(
	config: PerformanceMonitorConfig,
	toolName: string | undefined,
	operation: string,
): { skip: boolean; reason?: string } | null {
	// Check if tool should be monitored
	if (
		config.monitorTools.length > 0 &&
		toolName &&
		!config.monitorTools.includes(toolName)
	) {
		return { skip: true, reason: "Tool not monitored" };
	}

	// Check if operation should be excluded
	if (config.excludeOperations.includes(operation)) {
		return { skip: true, reason: "Operation excluded" };
	}

	return null;
}

/**
 * Create skipped monitoring result
 */
function createSkippedMonitoringResult(
	pluginName: string,
	pluginVersion: string,
	reason: string,
): PluginResult {
	return {
		success: true,
		pluginName,
		pluginVersion,
		metadata: { skipped: true, reason },
	};
}

/**
 * Create default monitoring result
 */
function createDefaultMonitoringResult(
	pluginName: string,
	pluginVersion: string,
): PluginResult {
	return {
		success: true,
		pluginName,
		pluginVersion,
	};
}

/**
 * Handle PreToolUse monitoring
 */
function handlePreToolUseMonitoring(
	operation: string,
	config: PerformanceMonitorConfig,
	pluginName: string,
	pluginVersion: string,
): PluginResult {
	const startTime = Date.now();
	const startMemory = process.memoryUsage();

	if (config.enableProfiling) {
		performance.mark(`claude-hook-${operation}-start`);
	}

	// Track start for correlation with PostToolUse
	const key = getCorrelationKey(operation);
	const existing = preOpStartByTool.get(key) || [];
	existing.push({ startTime, startMemory });
	preOpStartByTool.set(key, existing);

	return {
		success: true,
		pluginName,
		pluginVersion,
		metadata: {
			monitoring: true,
			startTime,
			startMemory,
			operation,
		},
	};
}

/**
 * Extract file path from context
 */
function extractFilePathFromContext(context: HookContext): string | undefined {
	const toolContext = context as HookContext & {
		toolInput: Record<string, unknown>;
	};
	return toolContext.toolInput?.file_path as string | undefined;
}

/**
 * Create performance metric
 */
function createPerformanceMetric(
	operation: string,
	startTime: number,
	endTime: number,
	duration: number,
	memoryUsage: NodeJS.MemoryUsage,
	success: boolean,
	toolName: string | undefined,
	filePath: string | undefined,
): PerformanceMetric {
	return {
		operation,
		startTime,
		endTime,
		duration,
		memoryUsage,
		success,
		toolName,
		filePath,
	};
}

/**
 * Handle PostToolUse monitoring
 */
function handlePostToolUseMonitoring(
	context: HookContext,
	operation: string,
	toolName: string | undefined,
	config: PerformanceMonitorConfig,
	pluginName: string,
	pluginVersion: string,
): PluginResult {
	const endTime = Date.now();
	const endMemory = process.memoryUsage();

	// Correlate with PreToolUse start (stack per tool to handle concurrency)
	const key = getCorrelationKey(operation);
	const starts = preOpStartByTool.get(key);
	const startEntry = starts?.pop();
	if (starts && starts.length === 0) {
		preOpStartByTool.delete(key);
	}
	const startTime = startEntry?.startTime ?? endTime - 1000; // Fallback if unmatched
	const duration = endTime - startTime;

	if (config.enableProfiling) {
		performance.mark(`claude-hook-${operation}-end`);
		performance.measure(
			`claude-hook-${operation}`,
			`claude-hook-${operation}-start`,
			`claude-hook-${operation}-end`,
		);
		performance.clearMarks(`claude-hook-${operation}-start`);
		performance.clearMarks(`claude-hook-${operation}-end`);
		performance.clearMeasures(`claude-hook-${operation}`);
	}

	const filePath = extractFilePathFromContext(context);
	// Check success based on toolResponse for PostToolUse contexts
	const isPostToolUseContext = (
		ctx: HookContext,
	): ctx is HookContext & { toolResponse: Record<string, unknown> } => {
		return "toolResponse" in ctx && ctx.toolResponse != null;
	};
	const success = isPostToolUseContext(context)
		? Boolean((context.toolResponse as any)?.success)
		: true;

	const metric = createPerformanceMetric(
		operation,
		startTime,
		endTime,
		duration,
		endMemory,
		success,
		toolName,
		filePath,
	);

	globalMetricsStore?.addMetric(metric);

	// Create result with performance info
	const result: PluginResult = {
		success: true,
		pluginName,
		pluginVersion,
		metadata: {
			metric: {
				operation,
				duration: Math.round(duration * 100) / 100, // Round to 2 decimals
				memoryUsed: Math.round((endMemory.heapUsed / 1024 / 1024) * 100) / 100, // MB
				success,
			},
		},
	};

	// Add warning if operation was slow
	if (config.trackExecutionTime && duration > config.slowOperationThreshold) {
		return {
			...result,
			message: `⚠️  Slow operation: ${operation} took ${Math.round(duration)}ms`,
		};
	}

	return result;
}

/**
 * Performance Monitor Plugin
 *
 * Monitors Claude Code operation performance including execution time,
 * memory usage, operation frequency, and generates alerts for performance issues.
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "performance-monitor": {
 *     "trackExecutionTime": true,
 *     "trackMemoryUsage": true,
 *     "slowOperationThreshold": 5000,
 *     "logAlerts": true
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "performance-monitor": {
 *     "trackExecutionTime": true,
 *     "trackMemoryUsage": true,
 *     "trackOperationFrequency": true,
 *     "maxMetrics": 2000,
 *     "slowOperationThreshold": 3000,
 *     "highMemoryThreshold": 134217728,
 *     "errorRateThreshold": 0.05,
 *     "frequencyThreshold": 100,
 *     "logStats": true,
 *     "statsInterval": 600000,
 *     "enableProfiling": true,
 *     "monitorTools": ["Bash", "Write", "Edit"]
 *   }
 * }
 * ```
 */
export const performanceMonitorPlugin: HookPlugin = {
	name: "performance-monitor",
	version: "1.0.0",
	description:
		"Monitors performance and resource usage of Claude Code operations",
	author: "Outfitter Team",

	events: ["PreToolUse", "PostToolUse"],
	priority: 10, // Low priority to avoid affecting other plugins

	configSchema: PerformanceMonitorConfigSchema as z.ZodType<
		Record<string, unknown>
	>,
	defaultConfig: {},

	apply(
		context: HookContext,
		config: Record<string, unknown> = {},
	): PluginResult {
		const monitorConfig = PerformanceMonitorConfigSchema.parse(config);

		// Initialize metrics store if not exists
		if (!globalMetricsStore) {
			globalMetricsStore = new MetricsStore(monitorConfig);
		}

		const toolName = "toolName" in context ? context.toolName : undefined;
		const operation = `${context.event}${toolName ? `_${toolName}` : ""}`;

		// Check if monitoring should be skipped
		const skipResult = shouldSkipMonitoring(monitorConfig, toolName, operation);
		if (skipResult) {
			return createSkippedMonitoringResult(
				this.name,
				this.version,
				skipResult.reason || "Monitoring skipped",
			);
		}

		// Handle based on event type
		if (context.event === "PreToolUse") {
			return handlePreToolUseMonitoring(
				operation,
				monitorConfig,
				this.name,
				this.version,
			);
		}

		if (context.event === "PostToolUse") {
			return handlePostToolUseMonitoring(
				context,
				operation,
				toolName,
				monitorConfig,
				this.name,
				this.version,
			);
		}

		return createDefaultMonitoringResult(this.name, this.version);
	},

	/**
	 * Initialize with stats logging if enabled
	 */
	async init(): Promise<void> {
		// Set up periodic stats logging if enabled
		// This would be better handled by the registry or a separate service
		// For now, just log that it's ready
	},

	/**
	 * Clean up performance observer and metrics
	 */
	async shutdown(): Promise<void> {
		if (globalMetricsStore) {
			// const stats = globalMetricsStore.getStats();

			globalMetricsStore.cleanup();
			globalMetricsStore = undefined;
		}
	},

	/**
	 * Health check - verify metrics are being collected
	 */
	async healthCheck(): Promise<boolean> {
		return globalMetricsStore !== undefined;
	},

	metadata: {
		name: "performance-monitor",
		version: "1.0.0",
		description:
			"Monitors performance and resource usage of Claude Code operations",
		author: "Outfitter Team",
		keywords: ["performance", "monitoring", "metrics", "profiling", "memory"],
		license: "MIT",
	},
};

/**
 * Get current performance statistics
 * @internal Exposed for testing and debugging
 */
export function getPerformanceStats(): PerformanceStats | undefined {
	return globalMetricsStore?.getStats();
}

/**
 * Get performance alerts since a specific time
 * @internal Exposed for testing and debugging
 */
export function getPerformanceAlerts(since?: number): PerformanceAlert[] {
	return globalMetricsStore?.getAlerts(since) || [];
}

export default performanceMonitorPlugin;
