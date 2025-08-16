/**
 * @outfitter/execution - Simple, predictable hook execution engine
 *
 * Provides a clean execution model that removes complex middleware chains
 * and focuses on reliability, observability, and developer experience.
 * The executor manages the complete hook lifecycle with proper error
 * boundaries and comprehensive metrics collection.
 */

import {
  executionLogger,
  type HookExecutionContext,
  type PerformanceMetrics,
} from '@outfitter/hooks-core';
import type { HookProtocol } from '@outfitter/protocol';
import type { HookContext, HookHandler, HookResult } from '@outfitter/types';

// Local structural type to avoid name clashes with runtime exports
type ExecutorLogger = ReturnType<typeof executionLogger.child>;

import {
  ExecutionTimer,
  globalMetrics,
  type MemoryUsage,
  type MetricsCollector,
  snapshotMemoryUsage,
} from './metrics';
import {
  ExecutionError,
  failure,
  isSuccess,
  type Result,
  success,
  TimeoutError,
  toHookResult,
  tryAsyncResult,
  ValidationError,
} from './result';

/**
 * Configuration options for hook execution
 */
export type ExecutionOptions = {
  /** Maximum execution time in milliseconds (default: 30000) */
  readonly timeout?: number;

  /** Whether to collect detailed metrics (default: true) */
  readonly collectMetrics?: boolean;

  /** Whether to validate hook results (default: true) */
  readonly validateResults?: boolean;

  /** Custom metrics collector (uses global if not provided) */
  readonly metricsCollector?: MetricsCollector;

  /** Additional context to include in metrics */
  readonly additionalContext?: Record<string, unknown>;

  /** Exit process on completion (default: true for CLI usage) */
  readonly exitProcess?: boolean;

  /** Success exit code (default: 0) */
  readonly successExitCode?: number;

  /** Failure exit code (default: 1) */
  readonly failureExitCode?: number;
};

/**
 * Default execution options optimized for typical hook usage
 */
const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  timeout: 30_000, // 30 seconds
  collectMetrics: true,
  validateResults: true,
  metricsCollector: globalMetrics,
  additionalContext: {},
  exitProcess: true,
  successExitCode: 0,
  failureExitCode: 1,
} as const;

/**
 * Simple, predictable hook execution engine
 *
 * The HookExecutor manages the complete hook lifecycle:
 * 1. Input reading and parsing
 * 2. Context validation
 * 3. Handler execution with timeout
 * 4. Result validation and output
 * 5. Metrics collection
 * 6. Process lifecycle management
 *
 * Error handling is explicit and predictable using the Result pattern,
 * with proper error boundaries to prevent failures from crashing the process.
 */
export class HookExecutor {
  private readonly protocol: HookProtocol;
  private readonly options: Required<ExecutionOptions>;
  private readonly logger: ExecutorLogger;

  constructor(protocol: HookProtocol, options: ExecutionOptions = {}) {
    this.protocol = protocol;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = executionLogger.child({
      component: 'executor',
      timeout: this.options.timeout,
      collectMetrics: this.options.collectMetrics,
    });
  }

  /**
   * Execute a hook handler with full lifecycle management
   *
   * This is the main entry point for hook execution. It handles the complete
   * execution lifecycle with proper error boundaries, timeouts, and metrics.
   *
   * @param handler - Hook handler function to execute
   * @returns Promise that resolves when execution completes (never returns if exitProcess=true)
   */
  async execute(handler: HookHandler): Promise<never | undefined> {
    const timer = new ExecutionTimer();
    const memoryBefore = snapshotMemoryUsage();
    let context: HookContext | null = null;
    let result: HookResult;
    let executionContext: HookExecutionContext | null = null;

    this.logger.debug('Starting hook execution', {
      timeout: this.options.timeout,
      collectMetrics: this.options.collectMetrics,
    });

    try {
      // Phase 1: Input reading
      const inputResult = await this.readInput();
      timer.markPhase('input');

      if (!isSuccess(inputResult)) {
        result = toHookResult(inputResult);
        await this.handleFailure(result, timer, memoryBefore, null, null);
        return this.exit(this.options.failureExitCode);
      }

      // Phase 2: Context parsing and validation
      const contextResult = await this.parseContext(inputResult.value);
      timer.markPhase('parsing');

      if (!isSuccess(contextResult)) {
        result = toHookResult(contextResult);
        await this.handleFailure(result, timer, memoryBefore, null, null);
        return this.exit(this.options.failureExitCode);
      }

      context = contextResult.value;

      // Create execution context for logging
      executionContext = this.createExecutionContext(context);
      this.logger.startExecution(executionContext);

      // Phase 3: Handler execution with timeout
      const executionResult = await this.executeHandler(handler, context);
      timer.markPhase('execution');

      if (!isSuccess(executionResult)) {
        result = toHookResult(executionResult);
        await this.handleFailure(
          result,
          timer,
          memoryBefore,
          context,
          executionContext
        );
        return this.exit(this.options.failureExitCode);
      }

      // Phase 4: Result validation and output
      result = executionResult.value;

      if (this.options.validateResults) {
        const validationResult = this.validateResult(result);
        if (!isSuccess(validationResult)) {
          result = toHookResult(validationResult);
          await this.handleFailure(
            result,
            timer,
            memoryBefore,
            context,
            executionContext
          );
          return this.exit(this.options.failureExitCode);
        }
      }

      const outputResult = await this.writeOutput(result);
      timer.markPhase('output');

      if (!isSuccess(outputResult)) {
        const errorResult = toHookResult(outputResult);
        await this.handleFailure(
          errorResult,
          timer,
          memoryBefore,
          context,
          executionContext
        );
        return this.exit(this.options.failureExitCode);
      }

      // Success: collect metrics and exit
      this.handleSuccess(
        result,
        timer,
        memoryBefore,
        context,
        executionContext
      );
      return this.exit(this.options.successExitCode);
    } catch (error) {
      // Catch-all for any unhandled errors
      const errorResult: HookResult = {
        success: false,
        message: `Unhandled execution error: ${error instanceof Error ? error.message : String(error)}`,
        block: true,
      };

      if (executionContext && error instanceof Error) {
        const metrics = this.createPerformanceMetrics(
          timer,
          memoryBefore,
          snapshotMemoryUsage()
        );
        this.logger.failExecution(executionContext, error, metrics);
      }

      await this.handleFailure(
        errorResult,
        timer,
        memoryBefore,
        context,
        executionContext
      );
      return this.exit(this.options.failureExitCode);
    }
  }

  /**
   * Execute handler with timeout support
   *
   * @param handler - Handler function to execute
   * @param context - Validated hook context
   * @returns Promise resolving to execution result
   */
  private async executeHandler(
    handler: HookHandler,
    context: HookContext
  ): Promise<Result<HookResult, Error>> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(this.options.timeout, {
            event: context.event,
            toolName: 'toolName' in context ? context.toolName : undefined,
          })
        );
      }, this.options.timeout);
    });

    // Race handler execution against timeout
    try {
      const result = await Promise.race([
        this.runHandler(handler, context),
        timeoutPromise,
      ]);

      return success(result);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Run the actual handler function with error boundary
   *
   * @param handler - Handler function
   * @param context - Hook context
   * @returns Promise resolving to hook result
   */
  private async runHandler(
    handler: HookHandler,
    context: HookContext
  ): Promise<HookResult> {
    try {
      const result = await handler(context);
      return this.normalizeResult(result, context);
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Handler execution failed',
        block: context.event === 'PreToolUse', // Block pre-tool-use by default on errors
      };
    }
  }

  /**
   * Normalize handler result to ensure it conforms to HookResult interface
   *
   * @param result - Raw result from handler
   * @param context - Hook context for additional validation
   * @returns Normalized hook result
   */
  private normalizeResult(result: unknown, context: HookContext): HookResult {
    // Handle null/undefined results
    if (result === null || result === undefined) {
      return {
        success: true,
        message: 'Handler completed successfully',
      };
    }

    // Handle primitive boolean results
    if (typeof result === 'boolean') {
      return {
        success: result,
        message: result
          ? 'Handler completed successfully'
          : 'Handler returned false',
        block: !result && context.event === 'PreToolUse',
      };
    }

    // Handle string results
    if (typeof result === 'string') {
      return {
        success: true,
        message: result,
      };
    }

    // Handle object results
    if (typeof result === 'object' && result !== null) {
      const obj = result as Partial<HookResult>;

      return {
        success: obj.success ?? true,
        message: obj.message || 'Handler completed successfully',
        block:
          obj.block ??
          (obj.success === false && context.event === 'PreToolUse'),
        data: obj.data,
      };
    }

    // Fallback for other types
    return {
      success: true,
      message: String(result),
    };
  }

  /**
   * Read input from protocol with error handling
   */
  private async readInput(): Promise<Result<unknown, Error>> {
    return tryAsyncResult(async () => {
      return await this.protocol.readInput();
    });
  }

  /**
   * Parse context from raw input with error handling
   */
  private async parseContext(
    input: unknown
  ): Promise<Result<HookContext, Error>> {
    return tryAsyncResult(async () => {
      return await this.protocol.parseContext(input);
    });
  }

  /**
   * Write output through protocol with error handling
   */
  private async writeOutput(result: HookResult): Promise<Result<void, Error>> {
    return tryAsyncResult(async () => {
      await this.protocol.writeOutput(result);
    });
  }

  /**
   * Write error through protocol with error handling
   */
  private async writeError(error: Error): Promise<Result<void, Error>> {
    return tryAsyncResult(async () => {
      await this.protocol.writeError(error);
    });
  }

  /**
   * Validate hook result format and content
   *
   * @param result - Hook result to validate
   * @returns Validation result
   */
  private validateResult(result: HookResult): Result<HookResult, Error> {
    try {
      // Check required fields
      if (typeof result.success !== 'boolean') {
        return failure(
          new ValidationError('Result must have boolean success field')
        );
      }

      // Validate message field
      if (result.message !== undefined && typeof result.message !== 'string') {
        return failure(
          new ValidationError('Result message must be string if present')
        );
      }

      // Validate block field
      if (result.block !== undefined && typeof result.block !== 'boolean') {
        return failure(
          new ValidationError('Result block must be boolean if present')
        );
      }

      // Additional semantic validation
      if (!(result.success || result.message)) {
        return failure(
          new ValidationError('Failed results should include an error message')
        );
      }

      return success(result);
    } catch (error) {
      return failure(
        error instanceof Error ? error : new Error('Validation failed')
      );
    }
  }

  /**
   * Create execution context for logging
   */
  private createExecutionContext(context: HookContext): HookExecutionContext {
    return {
      event: context.event,
      toolName: 'toolName' in context ? context.toolName : undefined,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      sessionId: Bun.env.CLAUDE_SESSION_ID,
      projectDir: Bun.env.CLAUDE_PROJECT_DIR,
      userId: Bun.env.CLAUDE_USER_ID,
    };
  }

  /**
   * Create performance metrics for logging
   */
  private createPerformanceMetrics(
    timer: ExecutionTimer,
    memoryBefore: MemoryUsage,
    memoryAfter: MemoryUsage
  ): PerformanceMetrics {
    const timing = timer.getTiming();
    return {
      duration: timing.duration,
      memoryBefore: memoryBefore.heapUsed,
      memoryAfter: memoryAfter.heapUsed,
      memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
      cpuUsage: process.cpuUsage
        ? process.cpuUsage().user / 1_000_000
        : undefined,
    };
  }

  /**
   * Handle successful execution
   */
  private handleSuccess(
    result: HookResult,
    timer: ExecutionTimer,
    memoryBefore: MemoryUsage,
    context: HookContext,
    executionContext: HookExecutionContext | null
  ): void {
    if (this.options.collectMetrics) {
      const timing = timer.getTiming();
      const memoryAfter = snapshotMemoryUsage();

      this.options.metricsCollector.record(
        context,
        result,
        timing,
        memoryBefore,
        memoryAfter,
        this.options.additionalContext
      );
    }

    // Log successful execution
    if (executionContext) {
      const memoryAfter = snapshotMemoryUsage();
      const metrics = this.createPerformanceMetrics(
        timer,
        memoryBefore,
        memoryAfter
      );
      this.logger.completeExecution(
        executionContext,
        result.success,
        metrics,
        result
      );
    }
  }

  /**
   * Handle execution failure
   */
  private async handleFailure(
    result: HookResult,
    timer: ExecutionTimer,
    memoryBefore: MemoryUsage,
    context: HookContext | null,
    executionContext: HookExecutionContext | null
  ): Promise<void> {
    // Try to write error to protocol
    if (result.message) {
      const error = new ExecutionError(result.message, 'EXECUTION_FAILED');
      await this.writeError(error);
    }

    // Collect metrics if context is available
    if (this.options.collectMetrics && context) {
      const timing = timer.getTiming();
      const memoryAfter = snapshotMemoryUsage();

      this.options.metricsCollector.record(
        context,
        result,
        timing,
        memoryBefore,
        memoryAfter,
        this.options.additionalContext
      );
    }

    // Log execution failure
    if (executionContext) {
      const memoryAfter = snapshotMemoryUsage();
      const metrics = this.createPerformanceMetrics(
        timer,
        memoryBefore,
        memoryAfter
      );
      const error = new ExecutionError(
        result.message || 'Hook execution failed',
        'EXECUTION_FAILED'
      );
      this.logger.failExecution(executionContext, error, metrics);
    } else {
      // Log generic failure if no execution context
      this.logger.error('Hook execution failed without context', {
        message: result.message,
        success: result.success,
        block: result.block,
      });
    }
  }

  /**
   * Exit the process or return void based on configuration
   */
  private exit(code: number): never | undefined {
    if (this.options.exitProcess) {
      process.exit(code) as never;
    }
    return;
  }
}

/**
 * Convenience function to create and execute a hook with minimal setup
 *
 * @param protocol - Protocol instance for I/O
 * @param handler - Hook handler function
 * @param options - Execution options
 * @returns Promise that completes when execution finishes
 */
export async function executeHook(
  protocol: HookProtocol,
  handler: HookHandler,
  options?: ExecutionOptions
): Promise<never | undefined> {
  const executor = new HookExecutor(protocol, options);
  return await executor.execute(handler);
}

/**
 * Create an executor with common development defaults
 * - Shorter timeout (10 seconds)
 * - Don't exit process
 * - Enable detailed metrics
 *
 * @param protocol - Protocol instance
 * @param options - Additional options to override defaults
 * @returns Configured executor for development use
 */
export function createDevelopmentExecutor(
  protocol: HookProtocol,
  options: ExecutionOptions = {}
): HookExecutor {
  const developmentOptions: ExecutionOptions = {
    timeout: 10_000,
    exitProcess: false,
    collectMetrics: true,
    validateResults: true,
    ...options,
  };

  return new HookExecutor(protocol, developmentOptions);
}

/**
 * Create an executor with production defaults
 * - Standard timeout (30 seconds)
 * - Exit process on completion
 * - Minimal metrics (for performance)
 *
 * @param protocol - Protocol instance
 * @param options - Additional options to override defaults
 * @returns Configured executor for production use
 */
export function createProductionExecutor(
  protocol: HookProtocol,
  options: ExecutionOptions = {}
): HookExecutor {
  const productionOptions: ExecutionOptions = {
    timeout: 30_000,
    exitProcess: true,
    collectMetrics: false, // Disable for performance in production
    validateResults: false, // Trust the handler in production
    ...options,
  };

  return new HookExecutor(protocol, productionOptions);
}
