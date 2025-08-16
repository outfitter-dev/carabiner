/**
 * Error Recovery Mechanisms
 *
 * Comprehensive error recovery strategies including retry logic,
 * circuit breakers, and fallback mechanisms
 */

import { GrappleError } from './errors.js';
import type {
  CircuitBreakerConfig,
  CircuitState,
  IGrappleError,
  RecoveryStrategy,
} from './types.js';
import {
  ErrorCategory,
  ErrorSeverity,
  CircuitState as State,
} from './types.js';

/**
 * Default recovery strategy configuration
 */
const DEFAULT_RECOVERY_STRATEGY: RecoveryStrategy = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  maxRetryDelay: 30_000,
  useJitter: true,
  retryCondition: (error: IGrappleError) => error.isRetryable(),
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000, // 1 minute
  monitoringPeriod: 300_000, // 5 minutes
  expectedFailureRate: 0.5,
  minimumRequestVolume: 10,
};

/**
 * Add jitter to delay to prevent thundering herd
 */
function addJitter(delay: number, factor = 0.1): number {
  const jitter = delay * factor * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator with exponential backoff
 */
export class RetryManager {
  private strategy: RecoveryStrategy;

  constructor(strategy: Partial<RecoveryStrategy> = {}) {
    this.strategy = { ...DEFAULT_RECOVERY_STRATEGY, ...strategy };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    operation: () => Promise<T> | T,
    operationName?: string
  ): Promise<T> {
    let lastError: IGrappleError | undefined;
    let attempt = 0;

    while (attempt <= this.strategy.maxRetries) {
      try {
        const result = await Promise.resolve(operation());

        // Log successful retry if not first attempt
        if (attempt > 0) {
          console.info(
            `Operation '${operationName}' succeeded after ${attempt} retries`
          );
        }

        return result;
      } catch (error) {
        const grappleError =
          error instanceof GrappleError
            ? error
            : new GrappleError(
                error instanceof Error ? error.message : String(error),
                9001, // INTERNAL_ERROR
                ErrorCategory.RUNTIME,
                ErrorSeverity.ERROR,
                {
                  cause: error instanceof Error ? error : undefined,
                  operation: operationName,
                }
              );

        lastError = grappleError;
        attempt++;

        // Check if we should retry
        if (
          attempt > this.strategy.maxRetries ||
          !this.strategy.retryCondition?.(grappleError)
        ) {
          break;
        }

        // Calculate delay with exponential backoff
        const baseDelay =
          this.strategy.retryDelay *
          this.strategy.backoffMultiplier ** (attempt - 1);
        const clampedDelay = Math.min(baseDelay, this.strategy.maxRetryDelay);
        const finalDelay = this.strategy.useJitter
          ? addJitter(clampedDelay)
          : clampedDelay;

        console.warn(
          `Operation '${operationName}' failed (attempt ${attempt}/${this.strategy.maxRetries}). ` +
            `Retrying in ${finalDelay}ms. Error: ${grappleError.toLogMessage()}`
        );

        await sleep(finalDelay);
      }
    }

    // All retries exhausted, execute fallback if available
    if (this.strategy.fallback) {
      try {
        console.info(`Executing fallback for operation '${operationName}'`);
        return this.strategy.fallback() as T;
      } catch (fallbackError) {
        console.error(
          `Fallback also failed for operation '${operationName}': ${fallbackError}`
        );
      }
    }

    // No fallback or fallback failed, throw the last error
    throw lastError;
  }

  /**
   * Create a retryable function wrapper
   */
  wrap<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn> | TReturn,
    operationName?: string
  ): (...args: TArgs) => Promise<TReturn> {
    return (...args: TArgs) => this.execute(() => fn(...args), operationName);
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = State.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failures: number[] = [];
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(
    operation: () => Promise<T> | T,
    operationName?: string
  ): Promise<T> {
    // Check circuit state before execution
    this.updateStateBeforeExecution();

    if (this.state === State.OPEN) {
      throw new GrappleError(
        `Circuit breaker is OPEN for operation '${operationName}'. Too many failures detected.`,
        1900, // OPERATION_TIMEOUT - closest semantic match
        ErrorCategory.RUNTIME,
        ErrorSeverity.WARNING,
        {
          operation: operationName,
          technicalDetails: {
            circuitState: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
          },
        }
      );
    }

    try {
      const result = await Promise.resolve(operation());
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current circuit status
   */
  getStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    failureRate: number;
  } {
    const now = Date.now();
    const recentFailures = this.failures.filter(
      (time) => now - time < this.config.monitoringPeriod
    );

    const totalRequests = recentFailures.length + this.successCount;
    const failureRate =
      totalRequests > 0 ? recentFailures.length / totalRequests : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureRate,
    };
  }

  /**
   * Force circuit state (for testing)
   */
  forceState(state: CircuitState): void {
    this.state = state;
    if (state === State.CLOSED) {
      this.reset();
    }
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = State.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.failures.length = 0;
  }

  /**
   * Update circuit state before execution
   */
  private updateStateBeforeExecution(): void {
    const now = Date.now();

    if (
      this.state === State.OPEN &&
      now - this.lastFailureTime >= this.config.timeout
    ) {
      this.state = State.HALF_OPEN;
      this.successCount = 0;
      console.info('Circuit breaker transitioning to HALF_OPEN state');
    }

    // Clean up old failure records
    const cutoff = now - this.config.monitoringPeriod;
    const recentFailures = this.failures.filter((time) => time > cutoff);
    this.failures.length = 0;
    this.failures.push(...recentFailures);
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;

    if (
      this.state === State.HALF_OPEN &&
      this.successCount >= this.config.successThreshold
    ) {
      this.state = State.CLOSED;
      this.failureCount = 0;
      console.info(
        'Circuit breaker transitioning to CLOSED state after successful recovery'
      );
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    const now = Date.now();
    this.failureCount++;
    this.lastFailureTime = now;
    this.failures.push(now);

    // Check if we should open the circuit
    if (this.state === State.CLOSED && this.shouldOpenCircuit()) {
      this.state = State.OPEN;
      console.warn(
        'Circuit breaker transitioning to OPEN state due to high failure rate'
      );
    } else if (this.state === State.HALF_OPEN) {
      this.state = State.OPEN;
      console.warn(
        'Circuit breaker returning to OPEN state after failed recovery attempt'
      );
    }
  }

  /**
   * Determine if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    const now = Date.now();
    const recentFailures = this.failures.filter(
      (time) => now - time < this.config.monitoringPeriod
    );

    // Need minimum request volume
    const totalRequests = recentFailures.length + this.successCount;
    if (totalRequests < this.config.minimumRequestVolume) {
      return false;
    }

    // Check failure threshold
    if (recentFailures.length >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate
    const failureRate = recentFailures.length / totalRequests;
    return failureRate >= this.config.expectedFailureRate;
  }
}

/**
 * Comprehensive error recovery orchestrator
 */
export class ErrorRecoveryManager {
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;

  constructor(
    retryConfig: Partial<RecoveryStrategy> = {},
    circuitConfig: Partial<CircuitBreakerConfig> = {}
  ) {
    this.retryManager = new RetryManager(retryConfig);
    this.circuitBreaker = new CircuitBreaker(circuitConfig);
  }

  /**
   * Execute operation with full recovery mechanisms
   */
  async execute<T>(
    operation: () => Promise<T> | T,
    operationName?: string
  ): Promise<T> {
    return this.circuitBreaker.execute(
      () => this.retryManager.execute(operation, operationName),
      operationName
    );
  }

  /**
   * Get recovery manager status
   */
  getStatus() {
    return {
      circuitBreaker: this.circuitBreaker.getStatus(),
      timestamp: new Date(),
    };
  }

  /**
   * Reset all recovery mechanisms
   */
  reset(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Graceful degradation utilities
 */
export class GracefulDegradation {
  /**
   * Execute operation with fallback
   */
  static async withFallback<T>(
    primary: () => Promise<T> | T,
    fallback: () => Promise<T> | T,
    operationName?: string
  ): Promise<T> {
    try {
      return await Promise.resolve(primary());
    } catch (error) {
      console.warn(
        `Primary operation '${operationName}' failed, using fallback: ${error}`
      );
      return await Promise.resolve(fallback());
    }
  }

  /**
   * Execute multiple operations in priority order
   */
  static async withPriorityFallback<T>(
    operations: Array<{ operation: () => Promise<T> | T; name: string }>,
    operationName?: string
  ): Promise<T> {
    const errors: Error[] = [];

    for (const { operation, name } of operations) {
      try {
        const result = await Promise.resolve(operation());
        if (errors.length > 0) {
          console.info(
            `Operation '${operationName}' succeeded using fallback '${name}'`
          );
        }
        return result;
      } catch (error) {
        console.warn(
          `Fallback '${name}' failed for operation '${operationName}': ${error}`
        );
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // All operations failed
    throw new GrappleError(
      `All fallback operations failed for '${operationName}'`,
      9001, // INTERNAL_ERROR
      ErrorCategory.RUNTIME,
      ErrorSeverity.ERROR,
      {
        operation: operationName,
        technicalDetails: {
          failedOperations: operations.map((op) => op.name),
          errors: errors.map((e) => e.message),
        },
      }
    );
  }

  /**
   * Execute operation with resource cleanup
   */
  static async withCleanup<T>(
    operation: () => Promise<T> | T,
    cleanup: () => Promise<void> | void,
    operationName?: string
  ): Promise<T> {
    try {
      return await Promise.resolve(operation());
    } catch (error) {
      console.warn(
        `Operation '${operationName}' failed, performing cleanup: ${error}`
      );
      try {
        await Promise.resolve(cleanup());
      } catch (cleanupError) {
        console.error(
          `Cleanup failed for operation '${operationName}': ${cleanupError}`
        );
      }
      throw error;
    }
  }
}
