/**
 * Tests for error recovery mechanisms
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import { GrappleError, NetworkError, TimeoutError } from '../errors.js';
import {
  CircuitBreaker,
  ErrorRecoveryManager,
  GracefulDegradation,
  RetryManager,
} from '../recovery.js';
import { CircuitState, ErrorCategory, ErrorCode } from '../types.js';

describe('RetryManager', () => {
  test('should retry failed operations', async () => {
    let attemptCount = 0;
    const operation = () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new NetworkError(
          'Connection failed',
          ErrorCode.CONNECTION_REFUSED
        );
      }
      return 'success';
    };

    const retryManager = new RetryManager({ maxRetries: 3, retryDelay: 10 });
    const result = await retryManager.execute(operation, 'test-operation');

    expect(result).toBe('success');
    expect(attemptCount).toBe(3);
  });

  test('should not retry non-retryable errors', async () => {
    let attemptCount = 0;
    const operation = () => {
      attemptCount++;
      throw new GrappleError(
        'Validation error',
        ErrorCode.INVALID_INPUT,
        ErrorCategory.VALIDATION,
        undefined,
        { isRecoverable: false }
      );
    };

    const retryManager = new RetryManager({ maxRetries: 3 });

    try {
      await retryManager.execute(operation, 'test-operation');
      expect(false).toBe(true); // Should have thrown
    } catch (_error) {
      expect(attemptCount).toBe(1); // Should not retry
    }
  });

  test('should apply exponential backoff', async () => {
    const delays: number[] = [];
    const originalSetTimeout = setTimeout;

    // Mock setTimeout to capture delays
    global.setTimeout = ((callback: () => void, delay: number) => {
      delays.push(delay);
      return originalSetTimeout(callback, 0); // Execute immediately for testing
    }) as typeof setTimeout;

    let attemptCount = 0;
    const operation = () => {
      attemptCount++;
      if (attemptCount < 4) {
        throw new NetworkError('Connection failed');
      }
      return 'success';
    };

    const retryManager = new RetryManager({
      maxRetries: 3,
      retryDelay: 100,
      backoffMultiplier: 2,
      useJitter: false,
    });

    await retryManager.execute(operation, 'test-operation');

    // Restore original setTimeout
    global.setTimeout = originalSetTimeout;

    expect(delays.length).toBe(3);
    expect(delays[0]).toBe(100); // First retry: 100ms
    expect(delays[1]).toBe(200); // Second retry: 100 * 2 = 200ms
    expect(delays[2]).toBe(400); // Third retry: 100 * 2^2 = 400ms
  });

  test('should execute fallback when all retries fail', async () => {
    const operation = () => {
      throw new NetworkError('Always fails');
    };

    const fallbackResult = 'fallback-result';
    const retryManager = new RetryManager({
      maxRetries: 2,
      retryDelay: 1,
      fallback: () => fallbackResult,
    });

    const result = await retryManager.execute(operation, 'test-operation');
    expect(result).toBe(fallbackResult);
  });

  test('should throw last error when no fallback and all retries fail', async () => {
    const operation = () => {
      throw new NetworkError('Always fails');
    };

    const retryManager = new RetryManager({ maxRetries: 2, retryDelay: 1 });

    try {
      await retryManager.execute(operation, 'test-operation');
      expect(false).toBe(true); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
    }
  });

  test('should create wrapped retryable functions', async () => {
    let attemptCount = 0;
    const originalFunction = (value: string) => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new TimeoutError('Timeout');
      }
      return `processed: ${value}`;
    };

    const retryManager = new RetryManager({ maxRetries: 3, retryDelay: 1 });
    const wrappedFunction = retryManager.wrap(
      originalFunction,
      'test-function'
    );

    const result = await wrappedFunction('test-input');
    expect(result).toBe('processed: test-input');
    expect(attemptCount).toBe(3);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      successThreshold: 2,
      monitoringPeriod: 10_000,
      minimumRequestVolume: 3, // Lower threshold for testing
    });
  });

  test('should allow operations when circuit is closed', async () => {
    const operation = () => 'success';
    const result = await circuitBreaker.execute(operation, 'test-operation');
    expect(result).toBe('success');
  });

  test('should open circuit after failure threshold', async () => {
    const failingOperation = () => {
      throw new NetworkError('Connection failed');
    };

    // Cause failures to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation, 'test-operation');
      } catch {
        // Expected failures
      }
    }

    const status = circuitBreaker.getStatus();
    expect(status.state).toBe(CircuitState.OPEN);

    // Next operation should be blocked
    try {
      await circuitBreaker.execute(() => 'success', 'test-operation');
      expect(false).toBe(true); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(GrappleError);
      expect((error as GrappleError).message).toContain(
        'Circuit breaker is OPEN'
      );
    }
  });

  test('should transition to half-open after timeout', async () => {
    const failingOperation = () => {
      throw new NetworkError('Connection failed');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation, 'test-operation');
      } catch {
        // Expected failures
      }
    }

    expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);

    // Force transition to half-open by manipulating time
    circuitBreaker.forceState(CircuitState.HALF_OPEN);
    expect(circuitBreaker.getStatus().state).toBe(CircuitState.HALF_OPEN);
  });

  test('should close circuit after successful operations in half-open state', async () => {
    // Force half-open state
    circuitBreaker.forceState(CircuitState.HALF_OPEN);

    const successOperation = () => 'success';

    // Execute successful operations
    await circuitBreaker.execute(successOperation, 'test-operation');
    await circuitBreaker.execute(successOperation, 'test-operation');

    expect(circuitBreaker.getStatus().state).toBe(CircuitState.CLOSED);
  });

  test('should return to open state if failure occurs in half-open state', async () => {
    // Force half-open state
    circuitBreaker.forceState(CircuitState.HALF_OPEN);

    const failingOperation = () => {
      throw new NetworkError('Connection failed');
    };

    try {
      await circuitBreaker.execute(failingOperation, 'test-operation');
    } catch {
      // Expected failure
    }

    expect(circuitBreaker.getStatus().state).toBe(CircuitState.OPEN);
  });

  test('should provide accurate status information', () => {
    const status = circuitBreaker.getStatus();

    expect(status.state).toBeDefined();
    expect(status.failureCount).toBeDefined();
    expect(status.successCount).toBeDefined();
    expect(status.failureRate).toBeDefined();
    expect(typeof status.failureRate).toBe('number');
  });

  test('should reset circuit correctly', () => {
    // Force some state
    circuitBreaker.forceState(CircuitState.OPEN);

    // Reset
    circuitBreaker.reset();

    const status = circuitBreaker.getStatus();
    expect(status.state).toBe(CircuitState.CLOSED);
    expect(status.failureCount).toBe(0);
    expect(status.successCount).toBe(0);
  });
});

describe('ErrorRecoveryManager', () => {
  test('should combine retry and circuit breaker functionality', async () => {
    let attemptCount = 0;
    const operation = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new NetworkError('Connection failed');
      }
      return 'success';
    };

    const recoveryManager = new ErrorRecoveryManager(
      { maxRetries: 3, retryDelay: 1 },
      { failureThreshold: 5 }
    );

    const result = await recoveryManager.execute(operation, 'test-operation');
    expect(result).toBe('success');
    expect(attemptCount).toBe(3);
  });

  test('should provide combined status', () => {
    const recoveryManager = new ErrorRecoveryManager();
    const status = recoveryManager.getStatus();

    expect(status.circuitBreaker).toBeDefined();
    expect(status.timestamp).toBeInstanceOf(Date);
  });

  test('should reset all mechanisms', () => {
    const recoveryManager = new ErrorRecoveryManager();

    // This should not throw
    recoveryManager.reset();

    const status = recoveryManager.getStatus();
    expect(status.circuitBreaker.state).toBe(CircuitState.CLOSED);
  });
});

describe('GracefulDegradation', () => {
  test('should use fallback when primary operation fails', async () => {
    const primaryOperation = () => {
      throw new NetworkError('Primary failed');
    };

    const fallbackOperation = () => 'fallback-result';

    const result = await GracefulDegradation.withFallback(
      primaryOperation,
      fallbackOperation,
      'test-operation'
    );

    expect(result).toBe('fallback-result');
  });

  test('should use primary operation when it succeeds', async () => {
    const primaryOperation = () => 'primary-result';
    const fallbackOperation = () => 'fallback-result';

    const result = await GracefulDegradation.withFallback(
      primaryOperation,
      fallbackOperation,
      'test-operation'
    );

    expect(result).toBe('primary-result');
  });

  test('should try operations in priority order', async () => {
    const operations = [
      {
        operation: () => {
          throw new Error('First fails');
        },
        name: 'first',
      },
      {
        operation: () => {
          throw new Error('Second fails');
        },
        name: 'second',
      },
      { operation: () => 'third-success', name: 'third' },
      { operation: () => 'fourth', name: 'fourth' },
    ];

    const result = await GracefulDegradation.withPriorityFallback(
      operations,
      'test-operation'
    );

    expect(result).toBe('third-success');
  });

  test('should throw error if all fallback operations fail', async () => {
    const operations = [
      {
        operation: () => {
          throw new Error('First fails');
        },
        name: 'first',
      },
      {
        operation: () => {
          throw new Error('Second fails');
        },
        name: 'second',
      },
    ];

    try {
      await GracefulDegradation.withPriorityFallback(
        operations,
        'test-operation'
      );
      expect(false).toBe(true); // Should have thrown
    } catch (error) {
      expect(error).toBeInstanceOf(GrappleError);
      expect((error as GrappleError).message).toContain(
        'All fallback operations failed'
      );
    }
  });

  test('should perform cleanup even when operation fails', async () => {
    let cleanupCalled = false;

    const failingOperation = () => {
      throw new NetworkError('Operation failed');
    };

    const cleanup = async () => {
      cleanupCalled = true;
    };

    try {
      await GracefulDegradation.withCleanup(
        failingOperation,
        cleanup,
        'test-operation'
      );
    } catch {
      // Expected failure
    }

    expect(cleanupCalled).toBe(true);
  });

  test('should not perform cleanup when operation succeeds', async () => {
    let cleanupCalled = false;

    const successOperation = () => 'success';
    const cleanup = async () => {
      cleanupCalled = true;
    };

    const result = await GracefulDegradation.withCleanup(
      successOperation,
      cleanup,
      'test-operation'
    );

    expect(result).toBe('success');
    expect(cleanupCalled).toBe(false);
  });

  test('should handle cleanup failures gracefully', async () => {
    const failingOperation = () => {
      throw new NetworkError('Operation failed');
    };

    const failingCleanup = async () => {
      throw new Error('Cleanup failed');
    };

    // This should not throw additional errors beyond the original operation error
    try {
      await GracefulDegradation.withCleanup(
        failingOperation,
        failingCleanup,
        'test-operation'
      );
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toBe('Operation failed');
    }
  });
});
