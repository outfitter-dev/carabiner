/**
 * @outfitter/execution - Result types for predictable error handling
 *
 * Implements the Result pattern for type-safe error handling without exceptions.
 * This approach makes error states explicit in the type system and improves
 * error handling predictability throughout the execution engine.
 */

import type { HookResult } from '@outfitter/types';

/**
 * Success result containing a value
 */
export interface SuccessResult<T> {
  readonly success: true;
  readonly value: T;
}

/**
 * Failure result containing an error
 */
export interface FailureResult<E = Error> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type - either success with value or failure with error
 */
export type Result<T, E = Error> = SuccessResult<T> | FailureResult<E>;

/**
 * Create a success result
 *
 * @param value - The successful value
 * @returns Success result containing the value
 */
export function success<T>(value: T): SuccessResult<T> {
  return {
    success: true,
    value,
  } as const;
}

/**
 * Create a failure result
 *
 * @param error - The error that occurred
 * @returns Failure result containing the error
 */
export function failure<E = Error>(error: E): FailureResult<E> {
  return {
    success: false,
    error,
  } as const;
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T, E>(
  result: Result<T, E>
): result is SuccessResult<T> {
  return result.success === true;
}

/**
 * Type guard to check if result is a failure
 */
export function isFailure<T, E>(
  result: Result<T, E>
): result is FailureResult<E> {
  return result.success === false;
}

/**
 * Map over a successful result, leaving failures unchanged
 *
 * @param result - Result to map over
 * @param fn - Function to apply to successful value
 * @returns New result with mapped value or original failure
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.value));
  }
  return result;
}

/**
 * Chain operations that may fail, propagating failures automatically
 *
 * @param result - Result to chain from
 * @param fn - Function that may fail
 * @returns New result or propagated failure
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Execute a function that may throw, converting it to a Result
 *
 * @param fn - Function that may throw
 * @returns Result with value or captured error
 */
export function tryResult<T>(fn: () => T): Result<T, Error> {
  try {
    return success(fn());
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Execute an async function that may throw, converting it to a Result
 *
 * @param fn - Async function that may throw
 * @returns Promise of Result with value or captured error
 */
export async function tryAsyncResult<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return success(value);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Unwrap a result, throwing the error if it's a failure
 * Use this only when you're certain the result is successful
 * or when you want to convert back to exception-based error handling
 *
 * @param result - Result to unwrap
 * @returns The successful value
 * @throws The error if result is a failure
 */
export function unwrapResult<T, E extends Error>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Get the value from a result or return a default
 *
 * @param result - Result to extract value from
 * @param defaultValue - Value to return if result is a failure
 * @returns The successful value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Convert a HookResult to a Result type for consistent error handling
 *
 * @param hookResult - Hook result to convert
 * @returns Result representing the hook outcome
 */
export function fromHookResult(
  hookResult: HookResult
): Result<HookResult, Error> {
  if (hookResult.success) {
    return success(hookResult);
  }
  return failure(new Error(hookResult.message || 'Hook execution failed'));
}

/**
 * Convert a Result back to a HookResult
 *
 * @param result - Result to convert
 * @returns HookResult representing the outcome
 */
export function toHookResult<T>(result: Result<T, Error>): HookResult {
  if (isSuccess(result)) {
    return {
      success: true,
      message: 'Execution completed successfully',
    };
  }

  return {
    success: false,
    message: result.error.message,
    block: true, // By default, execution failures should block
  };
}

/**
 * Execution-specific error types
 */
export class ExecutionError extends Error {
  override name = 'ExecutionError';
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.context = context;
  }
}

export class TimeoutError extends ExecutionError {
  override name = 'TimeoutError';

  constructor(timeout: number, context?: Record<string, unknown>) {
    super(
      `Execution timed out after ${timeout}ms`,
      'EXECUTION_TIMEOUT',
      context
    );
  }
}

export class ValidationError extends ExecutionError {
  override name = 'ValidationError';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

/**
 * Type guards for execution errors
 */
export function isExecutionError(error: unknown): error is ExecutionError {
  return error instanceof ExecutionError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
