/**
 * @outfitter/execution - Result pattern tests
 */

import { describe, expect, test } from 'bun:test';
import {
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
} from '../result';

describe('Result Pattern', () => {
  describe('success and failure constructors', () => {
    test('should create success result', () => {
      const result = success('test value');
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('test value');
    });

    test('should create failure result', () => {
      const error = new Error('test error');
      const result = failure(error);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('type guards', () => {
    test('isSuccess should identify success results', () => {
      const successResult = success('value');
      const failureResult = failure(new Error('error'));
      
      expect(isSuccess(successResult)).toBe(true);
      expect(isSuccess(failureResult)).toBe(false);
    });

    test('isFailure should identify failure results', () => {
      const successResult = success('value');
      const failureResult = failure(new Error('error'));
      
      expect(isFailure(successResult)).toBe(false);
      expect(isFailure(failureResult)).toBe(true);
    });
  });

  describe('mapResult', () => {
    test('should transform successful values', () => {
      const result = success(5);
      const mapped = mapResult(result, x => x * 2);
      
      expect(isSuccess(mapped)).toBe(true);
      if (isSuccess(mapped)) {
        expect(mapped.value).toBe(10);
      }
    });

    test('should leave failures unchanged', () => {
      const error = new Error('test error');
      const result = failure(error);
      const mapped = mapResult(result, x => x * 2);
      
      expect(isFailure(mapped)).toBe(true);
      if (isFailure(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });
  });

  describe('chainResult', () => {
    test('should chain successful operations', () => {
      const result = success(5);
      const chained = chainResult(result, x => success(x * 2));
      
      expect(isSuccess(chained)).toBe(true);
      if (isSuccess(chained)) {
        expect(chained.value).toBe(10);
      }
    });

    test('should propagate failures from first operation', () => {
      const error = new Error('first error');
      const result = failure(error);
      const chained = chainResult(result, x => success(x * 2));
      
      expect(isFailure(chained)).toBe(true);
      if (isFailure(chained)) {
        expect(chained.error).toBe(error);
      }
    });

    test('should propagate failures from second operation', () => {
      const result = success(5);
      const error = new Error('second error');
      const chained = chainResult(result, _ => failure(error));
      
      expect(isFailure(chained)).toBe(true);
      if (isFailure(chained)) {
        expect(chained.error).toBe(error);
      }
    });
  });

  describe('tryResult', () => {
    test('should capture successful synchronous operations', () => {
      const result = tryResult(() => 5 + 5);
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value).toBe(10);
      }
    });

    test('should capture thrown errors', () => {
      const result = tryResult(() => {
        throw new Error('test error');
      });
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('test error');
      }
    });

    test('should handle non-Error throws', () => {
      const result = tryResult(() => {
        throw 'string error';
      });
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('string error');
      }
    });
  });

  describe('tryAsyncResult', () => {
    test('should capture successful async operations', async () => {
      const result = await tryAsyncResult(async () => {
        return Promise.resolve(42);
      });
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value).toBe(42);
      }
    });

    test('should capture async errors', async () => {
      const result = await tryAsyncResult(async () => {
        throw new Error('async error');
      });
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('async error');
      }
    });

    test('should capture promise rejections', async () => {
      const result = await tryAsyncResult(async () => {
        return Promise.reject(new Error('rejection error'));
      });
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('rejection error');
      }
    });
  });

  describe('unwrapResult', () => {
    test('should return value from success', () => {
      const result = success('test value');
      const value = unwrapResult(result);
      
      expect(value).toBe('test value');
    });

    test('should throw error from failure', () => {
      const error = new Error('test error');
      const result = failure(error);
      
      expect(() => unwrapResult(result)).toThrow('test error');
    });
  });

  describe('unwrapOr', () => {
    test('should return value from success', () => {
      const result = success('actual value');
      const value = unwrapOr(result, 'default value');
      
      expect(value).toBe('actual value');
    });

    test('should return default from failure', () => {
      const result = failure(new Error('test error'));
      const value = unwrapOr(result, 'default value');
      
      expect(value).toBe('default value');
    });
  });

  describe('Hook result conversions', () => {
    test('fromHookResult should convert successful hook result', () => {
      const hookResult = { success: true, message: 'All good' };
      const result = fromHookResult(hookResult);
      
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value).toEqual(hookResult);
      }
    });

    test('fromHookResult should convert failed hook result', () => {
      const hookResult = { success: false, message: 'Something went wrong', block: true };
      const result = fromHookResult(hookResult);
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    test('fromHookResult should handle missing error message', () => {
      const hookResult = { success: false, block: true };
      const result = fromHookResult(hookResult);
      
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.message).toBe('Hook execution failed');
      }
    });

    test('toHookResult should convert successful result', () => {
      const result = success('test data');
      const hookResult = toHookResult(result);
      
      expect(hookResult.success).toBe(true);
      expect(hookResult.message).toBe('Execution completed successfully');
    });

    test('toHookResult should convert failed result', () => {
      const error = new Error('execution failed');
      const result = failure(error);
      const hookResult = toHookResult(result);
      
      expect(hookResult.success).toBe(false);
      expect(hookResult.message).toBe('execution failed');
      expect(hookResult.block).toBe(true);
    });
  });
});

describe('Execution Errors', () => {
  describe('ExecutionError', () => {
    test('should create execution error with code and context', () => {
      const context = { toolName: 'Bash', command: 'ls' };
      const error = new ExecutionError('Test error', 'TEST_ERROR', context);
      
      expect(error.name).toBe('ExecutionError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual(context);
    });

    test('should be identifiable by type guard', () => {
      const error = new ExecutionError('Test error', 'TEST_ERROR');
      
      expect(isExecutionError(error)).toBe(true);
      expect(isExecutionError(new Error('regular error'))).toBe(false);
    });
  });

  describe('TimeoutError', () => {
    test('should create timeout error with timeout value', () => {
      const context = { event: 'PreToolUse' };
      const error = new TimeoutError(5000, context);
      
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Execution timed out after 5000ms');
      expect(error.code).toBe('EXECUTION_TIMEOUT');
      expect(error.context).toEqual(context);
    });

    test('should be identifiable by type guard', () => {
      const error = new TimeoutError(1000);
      
      expect(isTimeoutError(error)).toBe(true);
      expect(isExecutionError(error)).toBe(true); // Also an ExecutionError
      expect(isTimeoutError(new Error('regular error'))).toBe(false);
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with context', () => {
      const context = { field: 'success', value: undefined };
      const error = new ValidationError('Missing required field', context);
      
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Missing required field');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toEqual(context);
    });

    test('should be identifiable by type guard', () => {
      const error = new ValidationError('Test validation error');
      
      expect(isValidationError(error)).toBe(true);
      expect(isExecutionError(error)).toBe(true); // Also an ExecutionError
      expect(isValidationError(new Error('regular error'))).toBe(false);
    });
  });
});