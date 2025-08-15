/**
 * Execution utilities for hook processing
 * Decomposes the complex executeHook function into composable parts
 */

import { runtimeLogger } from './logger';
import type {
  HookContext,
  HookExecutionOptions,
  HookHandler,
  HookResult,
} from './types';
import { HookError, HookTimeoutError } from './types';

/**
 * Execution metadata for tracking hook performance and debugging
 */
export type ExecutionMetadata = {
  readonly duration: number;
  readonly timestamp: string;
  readonly hookVersion: string;
};

/**
 * Create timeout promise for hook execution
 */
function createTimeoutPromise(
  timeout: number,
  context: HookContext
): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new HookTimeoutError(timeout, context)), timeout);
  });
}

/**
 * Execute handler with timeout protection
 */
async function executeWithTimeout(
  handler: HookHandler,
  context: HookContext,
  timeout: number
): Promise<HookResult> {
  const timeoutPromise = createTimeoutPromise(timeout, context);
  const handlerPromise = Promise.resolve(handler(context));

  return Promise.race([handlerPromise, timeoutPromise]);
}

/**
 * Add execution metadata to hook result
 */
function addExecutionMetadata(
  result: HookResult,
  startTime: number
): HookResult {
  const duration = Date.now() - startTime;
  const metadata: ExecutionMetadata = {
    duration,
    timestamp: new Date().toISOString(),
    hookVersion: '0.2.0',
  };

  return {
    ...result,
    metadata: {
      ...result.metadata,
      ...metadata,
    },
  };
}

/**
 * Handle hook execution errors with proper logging and error transformation
 */
function handleExecutionError(
  error: unknown,
  context: HookContext,
  startTime: number,
  throwOnError: boolean
): HookResult | never {
  const duration = Date.now() - startTime;

  // Log the error appropriately
  if (error instanceof HookTimeoutError) {
    runtimeLogger.error(
      { timeout: error.message, context },
      `Hook execution timed out: ${error.message}`
    );
  } else {
    runtimeLogger.error(
      { error, context },
      `Hook execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Re-throw if configured to do so
  if (throwOnError) {
    if (error instanceof HookError) {
      throw error;
    }
    throw new HookError(
      error instanceof Error ? error.message : 'Unknown error',
      context,
      error instanceof Error ? error : undefined
    );
  }

  // Return failure result with metadata
  const metadata: ExecutionMetadata = {
    duration,
    timestamp: new Date().toISOString(),
    hookVersion: '0.2.0',
  };

  return {
    success: false,
    message: error instanceof Error ? error.message : 'Unknown error',
    block: context.event === 'PreToolUse', // Block on PreToolUse failures by default
    metadata,
  };
}

/**
 * Execute hook with comprehensive error handling and timeout protection
 * This replaces the complex executeHook function with a composable approach
 */
export async function executeHookSafely(
  handler: HookHandler,
  context: HookContext,
  options: HookExecutionOptions = {}
): Promise<HookResult> {
  const startTime = Date.now();
  const { timeout = 30_000, throwOnError = false } = options;

  try {
    // Execute with timeout protection
    const result = await executeWithTimeout(handler, context, timeout);

    // Add execution metadata
    return addExecutionMetadata(result, startTime);
  } catch (error) {
    // Handle errors with proper logging and transformation
    return handleExecutionError(error, context, startTime, throwOnError);
  }
}

/**
 * Validation utilities for hook execution
 */
export const executionValidation = {
  /**
   * Validate hook execution options
   */
  validateOptions(options: HookExecutionOptions): void {
    if (options.timeout !== undefined && options.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }
    if (options.timeout !== undefined && options.timeout > 300_000) {
      throw new Error('Timeout cannot exceed 300,000ms (5 minutes)');
    }
  },

  /**
   * Validate hook context before execution
   */
  validateContext(context: HookContext): void {
    if (!context.event) {
      throw new HookError('Invalid hook context: missing event', context);
    }
    if (!context.sessionId) {
      throw new HookError('Invalid hook context: missing session ID', context);
    }
    if (!context.cwd) {
      throw new HookError(
        'Invalid hook context: missing current working directory',
        context
      );
    }
  },
} as const;

/**
 * Performance monitoring utilities
 */
export const performanceMonitoring = {
  /**
   * Create performance tracker for hook execution
   */
  createTracker(_context: HookContext) {
    const startTime = Date.now();
    const markers: Array<{ name: string; timestamp: number }> = [];

    return {
      mark(name: string): void {
        markers.push({ name, timestamp: Date.now() });
      },

      finish(): ExecutionMetadata & { markers: typeof markers } {
        const endTime = Date.now();
        return {
          duration: endTime - startTime,
          timestamp: new Date(startTime).toISOString(),
          hookVersion: '0.2.0',
          markers,
        };
      },
    };
  },

  /**
   * Log performance metrics for analysis
   */
  logMetrics(metadata: ExecutionMetadata, context: HookContext): void {
    if (metadata.duration > 10_000) {
      runtimeLogger.warn(
        { metadata, context },
        `Slow hook execution: ${metadata.duration}ms`
      );
    } else {
      runtimeLogger.debug(
        { metadata, context },
        `Hook execution completed in ${metadata.duration}ms`
      );
    }
  },
} as const;

/**
 * Timeout configuration utilities
 */
export const timeoutConfiguration = {
  /**
   * Get default timeout for hook event type
   */
  getDefaultTimeout(event: string): number {
    switch (event) {
      case 'PreToolUse':
        return 15_000; // PreToolUse hooks should be fast
      case 'PostToolUse':
        return 30_000; // PostToolUse can do more work
      case 'UserPromptSubmit':
        return 10_000; // Prompt processing should be quick
      case 'SessionStart':
        return 60_000; // Session setup can take time
      default:
        return 30_000; // Reasonable default
    }
  },

  /**
   * Validate and normalize timeout value
   */
  normalizeTimeout(timeout: number | undefined, event: string): number {
    if (timeout === undefined) {
      return this.getDefaultTimeout(event);
    }

    const minTimeout = 1000;
    const maxTimeout = 300_000;

    if (timeout < minTimeout) {
      return minTimeout;
    }
    if (timeout > maxTimeout) {
      return maxTimeout;
    }

    return timeout;
  },
} as const;
