/**
 * @outfitter/execution - Simplified execution engine for Claude Code hooks
 *
 * This package provides a clean, predictable execution model that removes
 * complex middleware chains and focuses on reliability, observability,
 * and developer experience.
 *
 * Key Features:
 * - Simple execution model with clear error boundaries
 * - Result pattern for predictable error handling
 * - Comprehensive metrics collection
 * - Timeout support and graceful shutdown
 * - Memory usage tracking
 * - Protocol abstraction support
 *
 * @example Basic Usage
 * ```typescript
 * import { runHook } from '@carabiner/execution';
 *
 * await runHook(async (context) => {
 *   if (context.event === 'PreToolUse') {
 *     // Validate tool usage
 *     return { success: true };
 *   }
 *   return { success: true };
 * });
 * ```
 *
 * @example Testing
 * ```typescript
 * import { runTestHook } from '@carabiner/execution';
 *
 * await runTestHook(
 *   myHandler,
 *   mockInputData,
 *   { timeout: 5000, collectMetrics: true }
 * );
 * ```
 */

// Core execution engine
export {
  createDevelopmentExecutor,
  createProductionExecutor,
  type ExecutionOptions,
  executeHook,
  HookExecutor,
} from './executor';
// Metrics and performance monitoring
export {
  type AggregateMetrics,
  deltaMemoryUsage,
  type ExecutionMetrics,
  ExecutionTimer,
  type ExecutionTiming,
  formatMemoryUsage,
  globalMetrics,
  type MemoryUsage,
  MetricsCollector,
  setMetricsEnabled,
  snapshotMemoryUsage,
} from './metrics';

// Result pattern for error handling
export {
  chainResult,
  ExecutionError,
  type FailureResult,
  failure,
  fromHookResult,
  isExecutionError,
  isFailure,
  isSuccess,
  isTimeoutError,
  isValidationError,
  mapResult,
  type Result,
  type SuccessResult,
  success,
  TimeoutError,
  toHookResult,
  tryAsyncResult,
  tryResult,
  unwrapOr,
  unwrapResult,
  ValidationError,
} from './result';
// Simple runner utilities
export {
  clearExecutionMetrics,
  createRunner,
  createTestRunner,
  getExecutionMetrics,
  getExecutionStats,
  getLastExecution,
  HookRunner,
  hasRecentFailures,
  type RunnerOptions,
  runHook,
  runTestHook,
  runTestHooks,
} from './runner';

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@carabiner/execution',
  version: VERSION,
  description: 'Simplified execution engine for Claude Code hooks',
  repository: 'https://github.com/outfitter-dev/grapple',
} as const;
