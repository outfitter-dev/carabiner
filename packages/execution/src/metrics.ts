/**
 * @outfitter/execution - Execution metrics collection and analysis
 *
 * Provides performance monitoring, execution tracking, and operational insights
 * for the hook execution engine. Metrics are lightweight and designed to have
 * minimal impact on execution performance.
 */

import type { HookContext, HookEvent, HookResult } from "@carabiner/types";

/**
 * Execution timing information
 */
export type ExecutionTiming = {
	/** When execution started (high-resolution timestamp) */
	readonly startTime: number;
	/** When execution completed (high-resolution timestamp) */
	readonly endTime: number;
	/** Total execution duration in milliseconds */
	readonly duration: number;
	/** Duration broken down by phase */
	readonly phases: {
		readonly input: number;
		readonly parsing: number;
		readonly execution: number;
		readonly output: number;
	};
};

/**
 * Memory usage snapshot
 */
export type MemoryUsage = {
	/** Heap used in bytes */
	readonly heapUsed: number;
	/** Heap total in bytes */
	readonly heapTotal: number;
	/** External memory in bytes */
	readonly external: number;
	/** RSS (Resident Set Size) in bytes */
	readonly rss: number;
};

/**
 * Execution metrics for a single hook run
 */
export type ExecutionMetrics = {
	/** Unique execution ID */
	readonly id: string;
	/** Hook event that was executed */
	readonly event: HookEvent;
	/** Tool name (if applicable) */
	readonly toolName?: string;
	/** Whether execution was successful */
	readonly success: boolean;
	/** Error code if execution failed */
	readonly errorCode?: string;
	/** Execution timing information */
	readonly timing: ExecutionTiming;
	/** Memory usage before execution */
	readonly memoryBefore: MemoryUsage;
	/** Memory usage after execution */
	readonly memoryAfter: MemoryUsage;
	/** Memory delta (after - before) */
	readonly memoryDelta: MemoryUsage;
	/** Timestamp when metrics were collected */
	readonly timestamp: number;
	/** Additional context data */
	readonly context?: Record<string, unknown>;
};

/**
 * Aggregate metrics across multiple executions
 */
export type AggregateMetrics = {
	/** Total number of executions */
	readonly totalExecutions: number;
	/** Number of successful executions */
	readonly successfulExecutions: number;
	/** Number of failed executions */
	readonly failedExecutions: number;
	/** Success rate as percentage */
	readonly successRate: number;
	/** Average execution duration */
	readonly averageDuration: number;
	/** Median execution duration */
	readonly medianDuration: number;
	/** 95th percentile duration */
	readonly p95Duration: number;
	/** 99th percentile duration */
	readonly p99Duration: number;
	/** Minimum duration */
	readonly minDuration: number;
	/** Maximum duration */
	readonly maxDuration: number;
	/** Most common error codes */
	readonly topErrors: Array<{ code: string; count: number }>;
	/** Breakdown by hook event */
	readonly eventBreakdown: Record<HookEvent, number>;
	/** Average memory usage */
	readonly averageMemoryUsage: MemoryUsage;
	/** Time range of collected metrics */
	readonly timeRange: {
		readonly start: number;
		readonly end: number;
	};
};

/**
 * High-precision timer for measuring execution phases
 */
export class ExecutionTimer {
	private readonly startTime: number;
	private readonly phases: Map<string, number> = new Map();
	private lastPhaseTime: number;

	constructor() {
		this.startTime = performance.now();
		this.lastPhaseTime = this.startTime;
	}

	/**
	 * Mark the end of a phase and start of the next
	 *
	 * @param phase - Name of the phase that just completed
	 * @returns Duration of the completed phase
	 */
	markPhase(phase: string): number {
		const now = performance.now();
		const duration = now - this.lastPhaseTime;
		this.phases.set(phase, duration);
		this.lastPhaseTime = now;
		return duration;
	}

	/**
	 * Get the total elapsed time since timer creation
	 *
	 * @returns Total duration in milliseconds
	 */
	getElapsed(): number {
		return performance.now() - this.startTime;
	}

	/**
	 * Get timing information for all recorded phases
	 *
	 * @returns Complete timing breakdown
	 */
	getTiming(): ExecutionTiming {
		const endTime = performance.now();
		const duration = endTime - this.startTime;

		return {
			startTime: this.startTime,
			endTime,
			duration,
			phases: {
				input: this.phases.get("input") || 0,
				parsing: this.phases.get("parsing") || 0,
				execution: this.phases.get("execution") || 0,
				output: this.phases.get("output") || 0,
			},
		};
	}
}

/**
 * Take a snapshot of current memory usage
 *
 * @returns Current memory usage information
 */
export function snapshotMemoryUsage(): MemoryUsage {
	const memUsage = process.memoryUsage();
	return {
		heapUsed: memUsage.heapUsed,
		heapTotal: memUsage.heapTotal,
		external: memUsage.external,
		rss: memUsage.rss,
	};
}

/**
 * Calculate memory delta between two snapshots
 *
 * @param before - Memory usage before operation
 * @param after - Memory usage after operation
 * @returns Memory usage difference
 */
export function deltaMemoryUsage(
	before: MemoryUsage,
	after: MemoryUsage,
): MemoryUsage {
	return {
		heapUsed: after.heapUsed - before.heapUsed,
		heapTotal: after.heapTotal - before.heapTotal,
		external: after.external - before.external,
		rss: after.rss - before.rss,
	};
}

/**
 * Format memory usage for human-readable display
 *
 * @param memory - Memory usage to format
 * @returns Formatted memory information
 */
export function formatMemoryUsage(memory: MemoryUsage): Record<string, string> {
	const formatBytes = (bytes: number): string => {
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(2)} MB`;
	};

	return {
		heapUsed: formatBytes(memory.heapUsed),
		heapTotal: formatBytes(memory.heapTotal),
		external: formatBytes(memory.external),
		rss: formatBytes(memory.rss),
	};
}

/**
 * Metrics collector for tracking execution performance
 */
export class MetricsCollector {
	private metrics: ExecutionMetrics[] = [];
	private readonly maxMetrics: number;
	private enabled = true;

	constructor(maxMetrics = 1000) {
		this.maxMetrics = maxMetrics;
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/**
	 * Record execution metrics
	 *
	 * @param context - Hook execution context
	 * @param result - Hook execution result
	 * @param timing - Execution timing information
	 * @param memoryBefore - Memory usage before execution
	 * @param memoryAfter - Memory usage after execution
	 * @param additionalContext - Additional context data
	 */
	record(
		context: HookContext,
		result: HookResult,
		timing: ExecutionTiming,
		memoryBefore: MemoryUsage,
		memoryAfter: MemoryUsage,
		additionalContext?: Record<string, unknown>,
	): void {
		if (!this.enabled) {
			return;
		}
		const metrics: ExecutionMetrics = {
			id: this.generateId(),
			event: context.event,
			toolName: "toolName" in context ? context.toolName : undefined,
			success: result.success,
			errorCode: result.success
				? undefined
				: this.extractErrorCode(result.message),
			timing,
			memoryBefore,
			memoryAfter,
			memoryDelta: deltaMemoryUsage(memoryBefore, memoryAfter),
			timestamp: Date.now(),
			context: additionalContext,
		};

		this.metrics.push(metrics);

		// Keep only the most recent metrics to prevent memory leaks
		if (this.metrics.length > this.maxMetrics) {
			this.metrics = this.metrics.slice(-this.maxMetrics);
		}
	}

	/**
	 * Get all collected metrics
	 *
	 * @returns Array of execution metrics
	 */
	getMetrics(): readonly ExecutionMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Get metrics for a specific time range
	 *
	 * @param startTime - Start of time range (timestamp)
	 * @param endTime - End of time range (timestamp)
	 * @returns Filtered metrics within time range
	 */
	getMetricsInRange(startTime: number, endTime: number): ExecutionMetrics[] {
		return this.metrics.filter(
			(metric) => metric.timestamp >= startTime && metric.timestamp <= endTime,
		);
	}

	/**
	 * Calculate aggregate metrics
	 *
	 * @param timeRange - Optional time range to calculate over
	 * @returns Aggregate metrics
	 */
	getAggregateMetrics(timeRange?: {
		start: number;
		end: number;
	}): AggregateMetrics {
		const metricsToAnalyze = timeRange
			? this.getMetricsInRange(timeRange.start, timeRange.end)
			: this.metrics;

		if (metricsToAnalyze.length === 0) {
			return this.createEmptyAggregateMetrics(timeRange);
		}

		const durations = metricsToAnalyze
			.map((m) => m.timing.duration)
			.sort((a, b) => a - b);
		const successful = metricsToAnalyze.filter((m) => m.success);
		const failed = metricsToAnalyze.filter((m) => !m.success);

		// Calculate percentiles
		const p95Index = Math.ceil(durations.length * 0.95) - 1;
		const p99Index = Math.ceil(durations.length * 0.99) - 1;
		const medianIndex = Math.ceil(durations.length * 0.5) - 1;

		// Count error codes
		const errorCounts = new Map<string, number>();
		for (const metric of failed) {
			if (metric.errorCode) {
				const count = errorCounts.get(metric.errorCode) || 0;
				errorCounts.set(metric.errorCode, count + 1);
			}
		}

		// Count events
		const eventCounts: Partial<Record<HookEvent, number>> = {};
		for (const metric of metricsToAnalyze) {
			const count = eventCounts[metric.event] || 0;
			eventCounts[metric.event] = count + 1;
		}

		return {
			totalExecutions: metricsToAnalyze.length,
			successfulExecutions: successful.length,
			failedExecutions: failed.length,
			successRate: (successful.length / metricsToAnalyze.length) * 100,
			averageDuration:
				durations.reduce((sum, d) => sum + d, 0) / durations.length,
			medianDuration: durations[medianIndex] || 0,
			p95Duration: durations[p95Index] || 0,
			p99Duration: durations[p99Index] || 0,
			minDuration: durations[0] || 0,
			maxDuration: durations.at(-1) || 0,
			topErrors: Array.from(errorCounts.entries())
				.map(([code, count]) => ({ code, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10),
			eventBreakdown: eventCounts as Record<HookEvent, number>,
			averageMemoryUsage: this.calculateAverageMemoryUsage(metricsToAnalyze),
			timeRange: timeRange || {
				start: Math.min(...metricsToAnalyze.map((m) => m.timestamp)),
				end: Math.max(...metricsToAnalyze.map((m) => m.timestamp)),
			},
		};
	}

	/**
	 * Clear all collected metrics
	 */
	clear(): void {
		this.metrics = [];
	}

	/**
	 * Get the number of collected metrics
	 *
	 * @returns Number of metrics in collection
	 */
	size(): number {
		return this.metrics.length;
	}

	private generateId(): string {
		return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
	}

	private extractErrorCode(message?: string): string | undefined {
		if (!message) {
			return;
		}

		// Extract common error patterns
		const patterns = [
			/\b([A-Z_]+_ERROR)\b/,
			/\b(TIMEOUT|VALIDATION|PROTOCOL|EXECUTION)\b/,
			/Error:\s*([A-Za-z]+)/,
		];

		for (const pattern of patterns) {
			const match = message.match(pattern);
			if (match?.[1]) {
				return match[1].toUpperCase();
			}
		}

		return "UNKNOWN_ERROR";
	}

	private calculateAverageMemoryUsage(
		metrics: ExecutionMetrics[],
	): MemoryUsage {
		const totals = metrics.reduce(
			(acc, metric) => ({
				heapUsed: acc.heapUsed + metric.memoryAfter.heapUsed,
				heapTotal: acc.heapTotal + metric.memoryAfter.heapTotal,
				external: acc.external + metric.memoryAfter.external,
				rss: acc.rss + metric.memoryAfter.rss,
			}),
			{ heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
		);

		const count = metrics.length;
		return {
			heapUsed: totals.heapUsed / count,
			heapTotal: totals.heapTotal / count,
			external: totals.external / count,
			rss: totals.rss / count,
		};
	}

	private createEmptyAggregateMetrics(timeRange?: {
		start: number;
		end: number;
	}): AggregateMetrics {
		return {
			totalExecutions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			successRate: 0,
			averageDuration: 0,
			medianDuration: 0,
			p95Duration: 0,
			p99Duration: 0,
			minDuration: 0,
			maxDuration: 0,
			topErrors: [],
			eventBreakdown: {} as Record<HookEvent, number>,
			averageMemoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
			timeRange: timeRange || { start: 0, end: 0 },
		};
	}
}

/**
 * Global metrics collector instance
 * Can be disabled for production deployments where metrics aren't needed
 */
export const globalMetrics = new MetricsCollector();

/**
 * Enable or disable global metrics collection
 *
 * @param enabled - Whether to enable metrics collection
 */
export function setMetricsEnabled(enabled: boolean): void {
	globalMetrics.setEnabled(enabled);
	if (!enabled) {
		globalMetrics.clear();
	}
}
