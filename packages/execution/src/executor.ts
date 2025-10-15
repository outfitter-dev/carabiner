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
} from "@carabiner/hooks-core";
import type { HookProtocol } from "@carabiner/protocol";
import type { HookContext, HookHandler, HookResult } from "@carabiner/types";

// Local structural type to avoid name clashes with runtime exports
type ExecutorLogger = ReturnType<typeof executionLogger.child>;

import {
  ExecutionTimer,
  globalMetrics,
  type MemoryUsage,
  type MetricsCollector,
  snapshotMemoryUsage,
} from "./metrics";
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
} from "./result";

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
      component: "executor",
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

    this.logger.debug("Starting hook execution", {
      timeout: this.options.timeout,
      collectMetrics: this.options.collectMetrics,
    });

    try {
      // Phase 1: Input reading
      const inputResult = await this.readInput();
      timer.markPhase("input");

      if (!isSuccess(inputResult)) {
        result = toHookResult(inputResult);
        await this.handleFailure(result, timer, memoryBefore, null, null);
        return this.exit(this.options.failureExitCode);
      }

      // Phase 2: Context parsing and validation
      const contextResult = await this.parseContext(inputResult.value);
      timer.markPhase("parsing");

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
      timer.markPhase("execution");

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
      timer.markPhase("output");

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
        continue: false,
        stopReason: "error",
        systemMessage: `Unhandled execution error: ${error instanceof Error ? error.message : String(error)}`,
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
    // Create timeout promise with proper cleanup
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Wrap in try-finally to ensure cleanup in all cases
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new TimeoutError(this.options.timeout, {
              event: context.event,
              toolName: "toolName" in context ? context.toolName : undefined,
            })
          );
        }, this.options.timeout);
      });

      // Race handler execution against timeout
      const result = await Promise.race([
        this.runHandler(handler, context),
        timeoutPromise,
      ]);

      return success(result);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Always cleanup timeout, even if an error occurs before the race
      // This ensures no memory leaks or dangling timers
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
        continue: false,
        stopReason: context.event === "PreToolUse" ? "blocked" : "error",
        systemMessage:
          error instanceof Error ? error.message : "Handler execution failed",
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
        continue: true,
        systemMessage: "Handler completed successfully",
      };
    }

    // Handle primitive boolean results
    if (typeof result === "boolean") {
      return {
        continue: result,
        systemMessage: result
          ? "Handler completed successfully"
          : "Handler returned false",
        stopReason:
          !result && context.event === "PreToolUse" ? "blocked" : undefined,
      };
    }

    // Handle string results while preserving context for select events
    if (typeof result === "string") {
      const normalized: HookResult = {
        continue: true,
        systemMessage: result,
      };

      if (
        context.event === "SessionStart" ||
        context.event === "UserPromptSubmit"
      ) {
        normalized.additionalContext = result;
      }

      return normalized;
    }

    // Handle object results - support both legacy and Claude Code format
    if (typeof result === "object" && result !== null) {
      const obj = result as Record<string, any>;

      if (
        "continue" in obj ||
        "stopReason" in obj ||
        "hookSpecificOutput" in obj
      ) {
        if (obj.hookSpecificOutput?.permissionDecision) {
          const decision = obj.hookSpecificOutput.permissionDecision;
          const inferredContinue =
            decision === "allow" || decision === "approve";
          return {
            continue:
              obj.continue ??
              (decision === "deny" || decision === "ask"
                ? false
                : inferredContinue),
            stopReason:
              obj.stopReason ??
              (decision === "deny"
                ? "blocked"
                : decision === "ask"
                  ? "approval_required"
                  : undefined),
            hookSpecificOutput: obj.hookSpecificOutput,
            additionalContext: obj.additionalContext,
            systemMessage: obj.systemMessage,
            suppressOutput: obj.suppressOutput,
            metadata: obj.metadata,
          };
        }

        return obj as HookResult;
      }

      if ("success" in obj) {
        const successValue = obj.success ?? true;
        const messageValue = typeof obj.message === "string" ? obj.message : undefined;
        return {
          continue: successValue,
          stopReason: successValue ? undefined : messageValue,
          systemMessage:
            messageValue || (successValue ? "Handler completed successfully" : undefined),
          additionalContext: successValue ? messageValue : undefined,
        };
      }

      const stopReason =
        obj.stopReason ??
        (obj.continue === false && context.event === "PreToolUse"
          ? "blocked"
          : undefined);

      return {
        continue: obj.continue ?? true,
        systemMessage:
          typeof obj.systemMessage === "string"
            ? obj.systemMessage
            : typeof obj.message === "string"
              ? obj.message
              : "Handler completed successfully",
        stopReason,
        hookSpecificOutput: obj.hookSpecificOutput,
        suppressOutput: obj.suppressOutput,
        additionalContext:
          typeof obj.additionalContext === "string"
            ? obj.additionalContext
            : JSON.stringify(obj),
        metadata: obj.metadata,
      };
    }

    // Fallback for other types
    return {
      continue: true,
      systemMessage: String(result),
    };
  }

  /**
   * Read input from protocol with error handling
   */
  private readInput(): Promise<Result<unknown, Error>> {
    return tryAsyncResult(() => this.protocol.readInput());
  }

  /**
   * Parse context from raw input with error handling
   */
  private parseContext(input: unknown): Promise<Result<HookContext, Error>> {
    return tryAsyncResult(() => this.protocol.parseContext(input));
  }

  /**
   * Write output through protocol with error handling
   */
  private writeOutput(result: HookResult): Promise<Result<void, Error>> {
    return tryAsyncResult(() => this.protocol.writeOutput(result));
  }

  /**
   * Write error through protocol with error handling
   */
  private writeError(error: Error): Promise<Result<void, Error>> {
    return tryAsyncResult(() => this.protocol.writeError(error));
  }

  /**
   * Validate hook result format and content
   *
   * @param result - Hook result to validate
   * @returns Validation result
   */
  private validateResult(result: HookResult): Result<HookResult, Error> {
    try {
      if (
        result.success !== undefined &&
        typeof result.success !== "boolean"
      ) {
        return failure(
          new ValidationError("Result success must be boolean if present")
        );
      }

      if (
        result.message !== undefined &&
        typeof result.message !== "string"
      ) {
        return failure(
          new ValidationError("Result message must be string if present")
        );
      }

      if (result.block !== undefined && typeof result.block !== "boolean") {
        return failure(
          new ValidationError("Result block must be boolean if present")
        );
      }

      if (
        result.continue !== undefined &&
        typeof result.continue !== "boolean"
      ) {
        return failure(
          new ValidationError("Result continue must be boolean if present")
        );
      }

      if (
        result.stopReason !== undefined &&
        typeof result.stopReason !== "string"
      ) {
        return failure(
          new ValidationError("Result stopReason must be string if present")
        );
      }

      if (
        result.suppressOutput !== undefined &&
        typeof result.suppressOutput !== "boolean"
      ) {
        return failure(
          new ValidationError(
            "Result suppressOutput must be boolean if present"
          )
        );
      }

      if (
        result.systemMessage !== undefined &&
        typeof result.systemMessage !== "string"
      ) {
        return failure(
          new ValidationError("Result systemMessage must be string if present")
        );
      }

      if (
        result.hookSpecificOutput !== undefined &&
        (typeof result.hookSpecificOutput !== "object" ||
          result.hookSpecificOutput === null)
      ) {
        return failure(
          new ValidationError(
            "Result hookSpecificOutput must be an object if present"
          )
        );
      }

      if (
        result.additionalContext !== undefined &&
        typeof result.additionalContext !== "string"
      ) {
        return failure(
          new ValidationError(
            "Result additionalContext must be string if present"
          )
        );
      }

      if (
        result.metadata !== undefined &&
        typeof result.metadata !== "object"
      ) {
        return failure(
          new ValidationError("Result metadata must be object if present")
        );
      }

      const permissionDecision =
        result.hookSpecificOutput &&
        typeof result.hookSpecificOutput === "object"
          ? (
              result.hookSpecificOutput as {
                permissionDecision?: unknown;
              }
            ).permissionDecision
          : undefined;

      const isPermissionBasedBlock =
        permissionDecision === "deny" || permissionDecision === "ask";

      if (
        result.continue === false &&
        !result.systemMessage &&
        !result.suppressOutput &&
        !isPermissionBasedBlock
      ) {
        return failure(
          new ValidationError("Failed results should include a systemMessage")
        );
      }

      if (
        result.continue === false &&
        !result.stopReason &&
        !result.suppressOutput &&
        !isPermissionBasedBlock
      ) {
        return failure(
          new ValidationError(
            "When continue is false, provide stopReason or permissionDecision"
          )
        );
      }

      if (result.success === false && !result.message) {
        return failure(
          new ValidationError("Failed results should include an error message")
        );
      }

      return success(result);
    } catch (error) {
      return failure(
        error instanceof Error ? error : new Error("Validation failed")
      );
    }
  }

  /**
   * Create execution context for logging
   */
  private createExecutionContext(context: HookContext): HookExecutionContext {
    const env =
      (globalThis as { Bun?: { env: NodeJS.ProcessEnv } }).Bun?.env ??
      process.env;
    return {
      event: context.event,
      toolName: "toolName" in context ? context.toolName : undefined,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      sessionId: env.CLAUDE_SESSION_ID,
      projectDir: env.CLAUDE_PROJECT_DIR,
      userId: env.CLAUDE_USER_ID,
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
      // In Claude SDK v2, continue defaults to true if not specified
      const wasSuccessful = result.continue !== false;
      this.logger.completeExecution(
        executionContext,
        wasSuccessful,
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
    if (result.systemMessage) {
      const error = new ExecutionError(
        result.systemMessage,
        "EXECUTION_FAILED"
      );
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
        result.systemMessage || "Hook execution failed",
        "EXECUTION_FAILED"
      );
      this.logger.failExecution(executionContext, error, metrics);
    } else {
      // Log generic failure if no execution context
      this.logger.error("Hook execution failed without context", {
        systemMessage: result.systemMessage,
        continue: result.continue,
        stopReason: result.stopReason,
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
