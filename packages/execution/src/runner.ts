/**
 * @outfitter/execution - Simple runner utilities for hook execution
 *
 * Provides high-level convenience functions for common hook execution patterns.
 * The runner abstracts away protocol setup and executor configuration,
 * making it easy to create hooks with minimal boilerplate.
 */

import { createProtocol } from '@outfitter/protocol';
import type { HookHandler, HookResult } from '@outfitter/types';

import { type ExecutionOptions, HookExecutor } from './executor';
import { globalMetrics } from './metrics';

/**
 * Runner configuration options
 */
export interface RunnerOptions extends ExecutionOptions {
  /** Protocol type to use (default: 'stdin') */
  readonly protocol?: 'stdin' | 'test';

  /** Test input data (required when protocol is 'test') */
  readonly testInput?: unknown;

  /** Test protocol options */
  readonly testOptions?: {
    readonly environment?: Record<string, string>;
    readonly cwd?: string;
  };
}

/**
 * Simple hook runner that handles common execution patterns
 *
 * This is the easiest way to create and run hooks with minimal setup.
 * It automatically configures the appropriate protocol and executor
 * based on the environment and provided options.
 */
export class HookRunner {
  private readonly options: RunnerOptions;

  constructor(options: RunnerOptions = {}) {
    this.options = {
      protocol: 'stdin',
      ...options,
    };
  }

  /**
   * Run a hook handler with the configured options
   *
   * @param handler - Hook handler function to execute
   * @returns Promise that resolves when execution completes
   */
  async run(handler: HookHandler): Promise<never | undefined> {
    const protocol = this.createProtocol();

    // Extract only ExecutionOptions from RunnerOptions
    const {
      protocol: _protocol,
      testInput: _testInput,
      testOptions: _testOptions,
      ...rawExecutionOptions
    } = this.options;

    // Remove undefined values to prevent overriding defaults
    const executionOptions = Object.fromEntries(
      Object.entries(rawExecutionOptions).filter(
        ([_, value]) => value !== undefined
      )
    ) as ExecutionOptions;

    const executor = new HookExecutor(protocol, executionOptions);
    return await executor.execute(handler);
  }

  /**
   * Create the appropriate protocol based on configuration
   */
  private createProtocol() {
    switch (this.options.protocol) {
      case 'test':
        if (this.options.testInput === undefined) {
          throw new Error('testInput is required when using test protocol');
        }
        return createProtocol('test', {
          input: this.options.testInput,
          options: this.options.testOptions,
        });
      default:
        return createProtocol('stdin');
    }
  }
}

/**
 * Create and run a hook with stdin protocol (most common usage)
 *
 * This is the primary entry point for most Claude Code hooks.
 * It handles all the boilerplate of setting up stdin protocol
 * and executor configuration.
 *
 * @param handler - Hook handler function
 * @param options - Optional execution configuration
 * @returns Promise that resolves when execution completes
 *
 * @example
 * ```typescript
 * import { runHook } from '@outfitter/execution';
 *
 * await runHook(async (context) => {
 *   if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
 *     const command = context.toolInput.command;
 *
 *     if (command.includes('rm -rf')) {
 *       return {
 *         success: false,
 *         block: true,
 *         message: 'Dangerous command blocked'
 *       };
 *     }
 *   }
 *
 *   return { success: true };
 * });
 * ```
 */
export async function runHook(
  handler: HookHandler,
  options: ExecutionOptions = {}
): Promise<never | undefined> {
  const runner = new HookRunner({ ...options, protocol: 'stdin' });
  return await runner.run(handler);
}

/**
 * Create and run a hook with test protocol for development and testing
 *
 * This function simplifies testing hooks by providing a mock input
 * and capturing the output without involving stdin/stdout.
 *
 * @param handler - Hook handler function
 * @param testInput - Mock input data
 * @param options - Optional execution configuration
 * @returns Promise that resolves when execution completes
 *
 * @example
 * ```typescript
 * import { runTestHook } from '@outfitter/execution';
 *
 * const result = await runTestHook(
 *   async (context) => ({ success: true, message: 'Test passed' }),
 *   {
 *     hook_event_name: 'PreToolUse',
 *     tool_name: 'Bash',
 *     tool_input: { command: 'ls -la' },
 *     session_id: 'test-123',
 *     cwd: '/tmp',
 *   },
 *   { exitProcess: false }
 * );
 * ```
 */
export async function runTestHook(
  handler: HookHandler,
  testInput: unknown,
  options: Omit<ExecutionOptions, 'exitProcess'> = {}
): Promise<void> {
  const runner = new HookRunner({
    ...options,
    protocol: 'test',
    testInput,
    exitProcess: false, // Never exit in test mode
  });

  await runner.run(handler);
}

/**
 * Create a runner function that can be used as a direct export from hook modules
 *
 * This creates a closure over the handler function, making it easy to export
 * a ready-to-run hook from a module.
 *
 * @param handler - Hook handler function
 * @param options - Optional execution configuration
 * @returns Function that executes the hook when called
 *
 * @example
 * ```typescript
 * // my-hook.ts
 * import { createRunner } from '@outfitter/execution';
 *
 * async function myHookHandler(context: HookContext): Promise<HookResult> {
 *   // Hook logic here
 *   return { success: true };
 * }
 *
 * export default createRunner(myHookHandler);
 *
 * // Usage:
 * // bun run my-hook.ts
 * ```
 */
export function createRunner(
  handler: HookHandler,
  options: ExecutionOptions = {}
): () => Promise<never | undefined> {
  return async () => {
    return await runHook(handler, options);
  };
}

/**
 * Create a test runner function for easy testing in development
 *
 * Similar to createRunner but for test scenarios where you want
 * to provide mock input and avoid process.exit().
 *
 * @param handler - Hook handler function
 * @param options - Optional execution configuration
 * @returns Function that executes the hook with test input
 *
 * @example
 * ```typescript
 * import { createTestRunner } from '@outfitter/execution';
 *
 * const testRunner = createTestRunner(myHookHandler, {
 *   collectMetrics: true,
 *   timeout: 5000,
 * });
 *
 * await testRunner({
 *   hook_event_name: 'PreToolUse',
 *   tool_name: 'Bash',
 *   tool_input: { command: 'echo "hello"' },
 * });
 * ```
 */
export function createTestRunner(
  handler: HookHandler,
  options: Omit<ExecutionOptions, 'exitProcess'> = {}
): (testInput: unknown) => Promise<void> {
  return async (testInput: unknown) => {
    return await runTestHook(handler, testInput, options);
  };
}

/**
 * Run multiple hooks in sequence with the same input
 *
 * Useful for testing hook compositions or running multiple
 * hooks that should all process the same context.
 *
 * @param handlers - Array of hook handlers to run
 * @param testInput - Mock input data
 * @param options - Optional execution configuration
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * import { runTestHooks } from '@outfitter/execution';
 *
 * const results = await runTestHooks(
 *   [securityHook, validationHook, loggingHook],
 *   mockInputData,
 *   { collectMetrics: false }
 * );
 *
 * const allPassed = results.every(result => result.success);
 * ```
 */
export async function runTestHooks(
  handlers: HookHandler[],
  testInput: unknown,
  options: Omit<ExecutionOptions, 'exitProcess'> = {}
): Promise<{ handler: HookHandler; result: HookResult; error?: Error }[]> {
  const results: { handler: HookHandler; result: HookResult; error?: Error }[] =
    [];

  for (const handler of handlers) {
    try {
      // Create a test protocol for each handler
      const protocol = createProtocol('test', {
        input: testInput,
        options: options.additionalContext,
      });

      // Create executor instance - not used directly but needed for initialization
      new HookExecutor(protocol, {
        ...options,
        exitProcess: false,
      });

      // We need to capture the result somehow since executor doesn't return it
      // For now, we'll run the handler directly in test mode
      const context = await protocol.parseContext(testInput);
      const result = await handler(context);

      results.push({
        handler,
        result: normalizeTestResult(result),
      });
    } catch (error) {
      results.push({
        handler,
        result: {
          success: false,
          message:
            error instanceof Error ? error.message : 'Handler execution failed',
          block: true,
        },
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return results;
}

/**
 * Normalize test results to ensure they conform to HookResult
 */
function normalizeTestResult(result: unknown): HookResult {
  if (result === null || result === undefined) {
    return { success: true };
  }

  if (typeof result === 'boolean') {
    return {
      success: result,
      message: result ? 'Handler completed' : 'Handler returned false',
    };
  }

  if (typeof result === 'string') {
    return { success: true, message: result };
  }

  if (typeof result === 'object' && result !== null) {
    const obj = result as Partial<HookResult>;
    return {
      success: obj.success ?? true,
      message: obj.message,
      block: obj.block,
      data: obj.data,
    };
  }

  return { success: true, message: String(result) };
}

/**
 * Get execution metrics from the global collector
 *
 * Convenient function to access collected metrics for analysis
 * and debugging in development.
 *
 * @param timeRange - Optional time range to filter metrics
 * @returns Execution metrics
 */
export function getExecutionMetrics(timeRange?: {
  start: number;
  end: number;
}) {
  if (timeRange) {
    return globalMetrics.getMetricsInRange(timeRange.start, timeRange.end);
  }
  return globalMetrics.getMetrics();
}

/**
 * Get aggregate execution statistics
 *
 * @param timeRange - Optional time range to analyze
 * @returns Aggregate metrics
 */
export function getExecutionStats(timeRange?: { start: number; end: number }) {
  return globalMetrics.getAggregateMetrics(timeRange);
}

/**
 * Clear collected execution metrics
 *
 * Useful for cleaning up between tests or resetting
 * metrics collection.
 */
export function clearExecutionMetrics(): void {
  globalMetrics.clear();
}

/**
 * Check if any recent executions failed
 *
 * @param withinMs - Time window to check (default: 60000ms = 1 minute)
 * @returns True if any executions failed within the time window
 */
export function hasRecentFailures(withinMs = 60_000): boolean {
  const since = Date.now() - withinMs;
  const recentMetrics = globalMetrics.getMetricsInRange(since, Date.now());
  return recentMetrics.some((metric) => !metric.success);
}

/**
 * Get the most recent execution result
 *
 * @returns Most recent execution metrics or undefined if none
 */
export function getLastExecution() {
  const metrics = globalMetrics.getMetrics();
  return metrics.length > 0 ? metrics.at(-1) : undefined;
}
