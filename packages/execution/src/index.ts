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
 * import { runHook } from '@outfitter/execution';
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
 * import { runTestHook } from '@outfitter/execution';
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
  HookExecutor,
  executeHook,
  createDevelopmentExecutor,
  createProductionExecutor,
  type ExecutionOptions,
} from './executor';

// Simple runner utilities
export {
  HookRunner,
  runHook,
  runTestHook,
  runTestHooks,
  createRunner,
  createTestRunner,
  getExecutionMetrics,
  getExecutionStats,
  clearExecutionMetrics,
  hasRecentFailures,
  getLastExecution,
  type RunnerOptions,
} from './runner';

// Result pattern for error handling
export {
  success,
  failure,
  isSuccess,
  isFailure,
  mapResult,
  chainResult,
  tryResult,
  tryAsyncResult,
  unwrapResult,
  unwrapOr,
  fromHookResult,
  toHookResult,
  ExecutionError,
  TimeoutError,
  ValidationError,
  isExecutionError,
  isTimeoutError,
  isValidationError,
  type Result,
  type SuccessResult,
  type FailureResult,
} from './result';

// Metrics and performance monitoring
export {
  ExecutionTimer,
  MemoryTracker,
  MetricsCollector,
  globalMetrics,
  setMetricsEnabled,
  type ExecutionTiming,
  type MemoryUsage,
  type ExecutionMetrics,
  type AggregateMetrics,
} from './metrics';

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: '@outfitter/execution',
  version: VERSION,
  description: 'Simplified execution engine for Claude Code hooks',
  repository: 'https://github.com/outfitter-dev/grapple',
} as const;