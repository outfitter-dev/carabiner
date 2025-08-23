/**
 * Error Management Utilities
 *
 * Helper functions for common error handling patterns
 */

import { fromError, CarabinerError, TimeoutError } from './errors.js';
import { reportError } from './reporting.js';
import {
  type ErrorCategory,
  ErrorCode,
  ErrorSeverity,
  type HealthStatus,
  type ICarabinerError,
} from './types.js';

/**
 * Create a standardized error with consistent formatting
 */
export function createStandardError(
  message: string,
  code: ErrorCode,
  category: ErrorCategory,
  options: {
    severity?: ErrorSeverity;
    cause?: Error;
    operation?: string;
    userMessage?: string;
    metadata?: Record<string, unknown>;
  } = {}
): CarabinerError {
  return new CarabinerError({
    message,
    code,
    category,
    severity: options.severity || ErrorSeverity.ERROR,
    cause: options.cause,
    operation: options.operation,
    userMessage: options.userMessage,
    metadata: options.metadata,
  });
}

/**
 * Wrap a function with comprehensive error handling
 */
export function wrapWithErrorHandling<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: {
    operation?: string;
    reportErrors?: boolean;
    transformError?: (error: Error) => ICarabinerError;
    onError?: (error: ICarabinerError) => void;
  } = {}
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await fn(...args);
    } catch (error) {
      let carabinerError: ICarabinerError;

      if (options.transformError) {
        carabinerError = options.transformError(
          error instanceof Error ? error : new Error(String(error))
        );
      } else {
        carabinerError = fromError(
          error instanceof Error ? error : new Error(String(error)),
          options.operation
        );
      }

      // Report error if enabled
      if (options.reportErrors !== false) {
        await reportError(carabinerError).catch((_reportError) => {
          // Silently ignore reporting errors
        });
      }

      // Call custom error handler
      if (options.onError) {
        try {
          options.onError(carabinerError);
        } catch (_handlerError) {
          // Silently ignore handler errors
        }
      }

      throw carabinerError;
    }
  };
}

/**
 * Safe async wrapper that never throws
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  options: {
    operation?: string;
    reportErrors?: boolean;
    onError?: (error: ICarabinerError) => void;
  } = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const carabinerError = fromError(
      error instanceof Error ? error : new Error(String(error)),
      options.operation
    );

    // Report error if enabled
    if (options.reportErrors !== false) {
      await reportError(carabinerError).catch((_reportError) => {
        // Error reporting failed - continue gracefully
      });
    }

    // Call custom error handler
    if (options.onError) {
      try {
        options.onError(carabinerError);
      } catch (_handlerError) {
        // Custom error handler failed - continue gracefully
      }
    }

    return defaultValue;
  }
}

/**
 * Add timeout to any async operation
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          ErrorCode.OPERATION_TIMEOUT,
          { operation: operationName }
        )
      );
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Create a health checker function
 */
export function createHealthChecker(
  checks: Array<{
    name: string;
    check: () => Promise<boolean> | boolean;
    timeout?: number;
  }>,
  options: {
    timeout?: number;
    parallel?: boolean;
  } = {}
): () => Promise<HealthStatus> {
  const defaultTimeout = options.timeout || 5000;

  return async (): Promise<HealthStatus> => {
    const components: HealthStatus['components'] = {};
    const checkPromises: Promise<void>[] = [];

    const executeCheck = async (checkConfig: (typeof checks)[0]) => {
      const checkTimeout = checkConfig.timeout || defaultTimeout;

      try {
        const result = await withTimeout(
          async () => await checkConfig.check(),
          checkTimeout,
          checkConfig.name
        );

        components[checkConfig.name] = {
          healthy: result,
          lastCheck: new Date(),
          error: result ? undefined : 'Health check returned false',
        };
      } catch (error) {
        components[checkConfig.name] = {
          healthy: false,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    if (options.parallel !== false) {
      // Run checks in parallel
      for (const checkConfig of checks) {
        checkPromises.push(executeCheck(checkConfig));
      }
      await Promise.all(checkPromises);
    } else {
      // Run checks sequentially
      for (const checkConfig of checks) {
        await executeCheck(checkConfig);
      }
    }

    const overallHealthy = Object.values(components).every((c) => c.healthy);

    return {
      healthy: overallHealthy,
      components,
      message: overallHealthy
        ? 'All health checks passed'
        : 'Some health checks failed',
      timestamp: new Date(),
    };
  };
}

/**
 * Debounce function execution
 */
export function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void | Promise<void>,
  waitMs: number
): (...args: TArgs) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args: TArgs): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

/**
 * Throttle function execution
 */
export function throttle<TArgs extends unknown[]>(
  func: (...args: TArgs) => void | Promise<void>,
  limitMs: number
): (...args: TArgs) => void {
  let lastExecution = 0;

  return (...args: TArgs): void => {
    const now = Date.now();

    if (now - lastExecution >= limitMs) {
      lastExecution = now;
      func(...args);
    }
  };
}

/**
 * Memoize function results with TTL
 */
export function memoizeWithTTL<TArgs extends unknown[], TReturn>(
  func: (...args: TArgs) => Promise<TReturn>,
  ttlMs = 300_000, // 5 minutes default
  maxCacheSize = 100
): (...args: TArgs) => Promise<TReturn> {
  const cache = new Map<string, { value: TReturn; timestamp: number }>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    // Return cached value if valid
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }

    // Execute function and cache result
    const result = await func(...args);

    // Maintain cache size limit
    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, { value: result, timestamp: now });
    return result;
  };
}

/**
 * Create a rate limiter
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number
): (identifier: string) => boolean {
  const requests = new Map<string, number[]>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this identifier
    const userRequests = requests.get(identifier) || [];

    // Filter out old requests
    const recentRequests = userRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if limit exceeded
    if (recentRequests.length >= maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    requests.set(identifier, recentRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.1) {
      // 10% chance to cleanup
      for (const [id, timestamps] of requests.entries()) {
        const recent = timestamps.filter((ts) => ts > windowStart);
        if (recent.length === 0) {
          requests.delete(id);
        } else {
          requests.set(id, recent);
        }
      }
    }

    return true;
  };
}

/**
 * Validate object against schema with detailed error messages
 */
export function validateSchema<T>(
  object: unknown,
  validator: (obj: unknown) => obj is T,
  context?: string
): T {
  if (!validator(object)) {
    throw createStandardError(
      `Schema validation failed${context ? ` for ${context}` : ''}`,
      1201, // SCHEMA_VALIDATION_FAILED
      'validation' as ErrorCategory,
      {
        severity: ErrorSeverity.WARNING,
        operation: context,
        metadata: { object },
      }
    );
  }
  return object;
}

/**
 * Deep clone object safely
 */
export function deepClone<T>(object: T): T {
  if (object === null || typeof object !== 'object') {
    return object;
  }

  if (object instanceof Date) {
    return new Date(object.getTime()) as unknown as T;
  }

  if (Array.isArray(object)) {
    return object.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof object === 'object') {
    const cloned = {} as T;
    for (const key in object) {
      if (Object.hasOwn(object, key)) {
        cloned[key] = deepClone(object[key]);
      }
    }
    return cloned;
  }

  return object;
}

/**
 * Check if error is retryable based on its properties
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof CarabinerError) {
    return error.isRetryable();
  }

  // Check Node.js error codes
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ENETUNREACH',
      'ECONNABORTED',
    ];
    return retryableCodes.includes(code);
  }

  return false;
}

/**
 * Extract error message safely from any value
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }

    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  return 'Error details unavailable: No message could be extracted from the error object';
}
