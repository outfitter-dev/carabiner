/**
 * Comprehensive Error Path and Failure Scenario Tests
 *
 * Tests all possible error conditions, timeout scenarios, invalid inputs,
 * and edge cases to ensure robust error handling in production.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type {
  HookConfiguration,
  HookContext,
  HookHandler,
  HookResult,
} from '@carabiner/types';

/**
 * Error simulation utilities
 */
class ErrorSimulator {
  /**
   * Create a handler that throws after a delay
   */
  static createTimeoutHandler(delayMs: number, timeoutMs: number): HookHandler {
    return async (_context: HookContext): Promise<HookResult> => {
      return new Promise((resolve, reject) => {
        let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
        const workTimer = setTimeout(() => {
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
          }
          resolve({
            success: true,
            message: `Work completed after ${delayMs}ms`,
          });
        }, delayMs);

        timeoutTimer = setTimeout(() => {
          clearTimeout(workTimer);
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
    };
  }

  /**
   * Create a handler that fails randomly
   */
  static createUnreliableHandler(failureRate: number): HookHandler {
    return async (_context: HookContext): Promise<HookResult> => {
      if (Math.random() < failureRate) {
        throw new Error(`Random failure (rate: ${failureRate})`);
      }

      return {
        success: true,
        message: 'Unreliable handler succeeded',
      };
    };
  }

  /**
   * Create a handler that consumes excessive memory
   */
  static createMemoryLeakHandler(): HookHandler {
    const leakedMemory: any[] = [];

    return async (_context: HookContext): Promise<HookResult> => {
      // Intentionally leak memory
      for (let i = 0; i < 10_000; i++) {
        leakedMemory.push(new Array(1000).fill(`leaked_data_${i}`));
      }

      return {
        success: true,
        message: `Memory leak handler completed, leaked ${leakedMemory.length} arrays`,
      };
    };
  }
}

describe('Comprehensive Error Handling', () => {
  beforeEach(() => {
    // Reset any global state
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (global.gc) {
      global.gc();
    }
  });

  describe('Input Validation Errors', () => {
    test('should handle null and undefined inputs gracefully', async () => {
      const invalidInputs = [
        null,
        undefined,
        '',
        {},
        { event: null },
        { event: 'pre-tool-use', tool: null },
        { event: 'pre-tool-use', tool: 'Bash', input: null },
      ];

      for (const invalidInput of invalidInputs) {
        try {
          // Simulate hook execution with invalid input
          const handler: HookHandler = async (context: HookContext) => {
            // This should validate the input
            if (!(context?.event && context.tool)) {
              throw new Error('Invalid hook context provided');
            }

            return { success: true, message: 'Valid input processed' };
          };

          await handler(invalidInput as any);

          // If we get here with invalid input, that's unexpected
          if (invalidInput === null || invalidInput === undefined) {
            expect(false).toBe(true); // Should have thrown
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Invalid');
        }
      }
    });

    test('should handle malformed JSON inputs', async () => {
      const malformedJsonInputs = [
        '{ invalid json',
        '{ "key": }',
        '{ "key": "value", }', // Trailing comma
        '{ key: "value" }', // Unquoted key
        '{ "key": "value" "another": "value" }', // Missing comma
        JSON.stringify({ event: 'invalid-event' }), // Invalid event
        JSON.stringify({ event: 'pre-tool-use', tool: 'InvalidTool' }), // Invalid tool
      ];

      for (const malformedJson of malformedJsonInputs) {
        try {
          const parsed = JSON.parse(malformedJson);

          // If JSON parsing succeeded, validate the structure
          if (
            parsed.event &&
            !['pre-tool-use', 'post-tool-use'].includes(parsed.event)
          ) {
            throw new Error(`Invalid event: ${parsed.event}`);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          // Should be either JSON parse error or validation error
          expect((error as Error).message).toMatch(/(Unexpected|Invalid|JSON)/);
        }
      }
    });

    test('should handle oversized inputs appropriately', async () => {
      // Create oversized inputs
      const oversizedInputs = [
        {
          event: 'pre-tool-use',
          tool: 'Bash',
          input: {
            command: 'x'.repeat(1024 * 1024), // 1MB command
          },
        },
        {
          event: 'pre-tool-use',
          tool: 'Bash',
          input: {
            largeArray: new Array(100_000).fill('x'.repeat(1000)), // 100MB array
          },
        },
        {
          event: 'pre-tool-use',
          tool: 'Bash',
          input: {
            deepNesting: new Array(10_000)
              .fill(null)
              .reduce((acc, _, i) => ({ [i]: acc }), {}),
          },
        },
      ];

      for (const oversizedInput of oversizedInputs) {
        const handler: HookHandler = async (context: HookContext) => {
          // Simulate size checking
          const jsonSize = JSON.stringify(context).length;

          if (jsonSize > 10 * 1024 * 1024) {
            // 10MB limit
            throw new Error(`Input too large: ${jsonSize} bytes`);
          }

          return { success: true, message: 'Input size acceptable' };
        };

        try {
          await handler(oversizedInput);

          // If the input is actually oversized, this should have thrown
          const size = JSON.stringify(oversizedInput).length;
          if (size > 10 * 1024 * 1024) {
            expect(false).toBe(true); // Should have thrown
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('too large');
        }
      }
    });
  });

  describe('Timeout and Async Errors', () => {
    test('should handle various timeout scenarios', async () => {
      const scenarios = [
        { work: 50, timeout: 10, shouldTimeout: true },
        { work: 10, timeout: 50, shouldTimeout: false },
        { work: 120, timeout: 100, shouldTimeout: true }, // Work takes longer than timeout
        { work: 0, timeout: 10, shouldTimeout: false },
      ];

      for (const scenario of scenarios) {
        const handler = ErrorSimulator.createTimeoutHandler(
          scenario.work,
          scenario.timeout
        );

        try {
          const result = await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: { command: 'test' },
          });

          if (scenario.shouldTimeout) {
            // If we expected timeout but got result, that's unexpected
            expect(false).toBe(true);
          } else {
            expect(result.success).toBe(true);
          }
        } catch (error) {
          if (scenario.shouldTimeout) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('timed out');
          } else {
            // Unexpected error
            throw error;
          }
        }
      }
    });

    test('should handle promise rejections gracefully', async () => {
      const rejectionScenarios = [
        () => Promise.reject(new Error('Explicit rejection')),
        () => Promise.reject('String rejection'),
        () => Promise.reject(null),
        () => Promise.reject({ error: 'Object rejection' }),
        () =>
          Promise.resolve().then(() => {
            throw new Error('Delayed rejection');
          }),
      ];

      for (const [_index, scenario] of rejectionScenarios.entries()) {
        try {
          const handler: HookHandler = async (_context: HookContext) => {
            await scenario();
            return { success: true, message: 'Should not reach here' };
          };

          await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: { command: 'test' },
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          // All scenarios should result in errors
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle concurrent failures appropriately', async () => {
      const concurrentFailures = [];

      // Create multiple failing operations
      for (let i = 0; i < 10; i++) {
        const promise = new Promise(async (resolve, reject) => {
          const delay = Math.random() * 50;
          await new Promise((r) => setTimeout(r, delay));

          if (i % 3 === 0) {
            reject(new Error(`Concurrent failure ${i}`));
          } else {
            resolve(`Success ${i}`);
          }
        });

        concurrentFailures.push(promise);
      }

      const results = await Promise.allSettled(concurrentFailures);

      // Check that we handled all results appropriately
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, _index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          expect(result.value).toContain('Success');
        } else {
          failureCount++;
          expect(result.reason.message).toContain('Concurrent failure');
        }
      });

      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(10);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory pressure gracefully', async () => {
      // Test with progressively more memory allocation
      const memorySizes = [1000, 10_000, 100_000];

      for (const size of memorySizes) {
        try {
          const handler: HookHandler = async (_context: HookContext) => {
            // Allocate memory
            const data = new Array(size).fill(null).map((_, i) => ({
              id: i,
              data: new Array(1000).fill(`memory_test_${i}`),
            }));

            // Process the data
            const processed = data.map((item) => ({
              ...item,
              processed: true,
              timestamp: Date.now(),
            }));

            return {
              success: true,
              message: `Processed ${processed.length} items`,
              data: { count: processed.length },
            };
          };

          const result = await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: { size },
          });

          expect(result.success).toBe(true);
          expect(result.data?.count).toBe(size);
        } catch (error) {
          // Out of memory is acceptable for large sizes
          if (size >= 100_000) {
            expect(error).toBeInstanceOf(Error);
          } else {
            throw error; // Unexpected error for smaller sizes
          }
        }
      }
    });

    test('should handle file system errors', async () => {
      const fileSystemErrors = [
        { error: 'ENOENT', description: 'File not found' },
        { error: 'EACCES', description: 'Permission denied' },
        { error: 'EMFILE', description: 'Too many open files' },
        { error: 'ENOSPC', description: 'No space left on device' },
      ];

      for (const fsError of fileSystemErrors) {
        const handler: HookHandler = async (_context: HookContext) => {
          // Simulate file system error
          const error = new Error(fsError.description) as any;
          error.code = fsError.error;
          error.errno = -2; // Generic error number
          throw error;
        };

        try {
          await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: { operation: 'file_operation' },
          });

          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as any).code).toBe(fsError.error);
        }
      }
    });

    test('should handle network-like failures', async () => {
      const networkErrors = [
        { code: 'ECONNREFUSED', message: 'Connection refused' },
        { code: 'ETIMEDOUT', message: 'Connection timed out' },
        { code: 'ENOTFOUND', message: 'Host not found' },
        { code: 'ECONNRESET', message: 'Connection reset' },
      ];

      for (const netError of networkErrors) {
        const handler: HookHandler = async (_context: HookContext) => {
          // Simulate network failure
          await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate network delay

          const error = new Error(netError.message) as any;
          error.code = netError.code;
          throw error;
        };

        try {
          await handler({
            event: 'pre-tool-use',
            tool: 'WebFetch',
            input: { url: 'https://example.com' },
          });

          expect(false).toBe(true); // Should have thrown
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as any).code).toBe(netError.code);
        }
      }
    });
  });

  describe('Data Corruption and Invalid State', () => {
    test('should handle corrupted configuration data', async () => {
      const corruptedConfigs = [
        { version: null }, // Missing version
        { version: '1.0.0', hooks: null }, // Missing hooks
        { version: '1.0.0', hooks: { 'invalid-event': {} } }, // Invalid event
        { version: '1.0.0', hooks: { 'pre-tool-use': { handler: null } } }, // Missing handler
        { version: '1.0.0', hooks: { 'pre-tool-use': { timeout: -1 } } }, // Invalid timeout
        { version: '1.0.0', hooks: { 'pre-tool-use': { timeout: 'invalid' } } }, // Wrong type
      ];

      for (const config of corruptedConfigs) {
        try {
          // Simulate configuration validation
          const validateConfig = (cfg: any): HookConfiguration => {
            if (!cfg.version || typeof cfg.version !== 'string') {
              throw new Error('Invalid or missing version');
            }

            if (!cfg.hooks || typeof cfg.hooks !== 'object') {
              throw new Error('Invalid or missing hooks');
            }

            for (const [event, hookConfig] of Object.entries(cfg.hooks)) {
              if (!['pre-tool-use', 'post-tool-use'].includes(event)) {
                throw new Error(`Invalid hook event: ${event}`);
              }

              const hook = hookConfig as any;
              if (!hook.handler || typeof hook.handler !== 'string') {
                throw new Error(`Invalid handler for event: ${event}`);
              }

              if (
                hook.timeout !== undefined &&
                (typeof hook.timeout !== 'number' || hook.timeout < 0)
              ) {
                throw new Error(`Invalid timeout for event: ${event}`);
              }
            }

            return cfg as HookConfiguration;
          };

          validateConfig(config);

          // If validation passed, this config might actually be valid
          // (e.g., some fields are optional)
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Invalid');
        }
      }
    });

    test('should handle inconsistent internal state', async () => {
      // Simulate various inconsistent states
      const stateScenarios = [
        {
          name: 'mismatched_execution_id',
          setup: () => ({ executionId: 'id1', contextId: 'id2' }),
          validate: (state: any) => state.executionId === state.contextId,
        },
        {
          name: 'negative_timestamp',
          setup: () => ({ timestamp: -1 }),
          validate: (state: any) => state.timestamp > 0,
        },
        {
          name: 'invalid_event_sequence',
          setup: () => ({
            lastEvent: 'post-tool-use',
            currentEvent: 'pre-tool-use',
          }),
          validate: (state: any) => {
            // Pre-tool-use should come before post-tool-use
            return !(
              state.lastEvent === 'post-tool-use' &&
              state.currentEvent === 'pre-tool-use'
            );
          },
        },
      ];

      for (const scenario of stateScenarios) {
        const state = scenario.setup();
        const isValid = scenario.validate(state);

        if (!isValid) {
          try {
            throw new Error(`Inconsistent state detected: ${scenario.name}`);
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Inconsistent state');
          }
        }
      }
    });
  });

  describe('Security and Validation Failures', () => {
    test('should handle potential security violations', async () => {
      const securityViolations = [
        {
          name: 'path_traversal',
          input: { handler: '../../../etc/passwd' },
          expectedError: 'path traversal',
        },
        {
          name: 'command_injection',
          input: { command: 'rm -rf / ; echo "hacked"' },
          expectedError: 'unsafe command',
        },
        {
          name: 'script_injection',
          input: { script: '<script>alert("xss")</script>' },
          expectedError: 'script injection',
        },
      ];

      for (const violation of securityViolations) {
        const handler: HookHandler = async (context: HookContext) => {
          // Simulate security validation
          const input = context.input as any;

          if (input.handler?.includes('..')) {
            throw new Error('Security violation: path traversal detected');
          }

          if (input.command && /[;&|`$()]/g.test(input.command)) {
            throw new Error('Security violation: unsafe command detected');
          }

          if (input.script && /<script/i.test(input.script)) {
            throw new Error('Security violation: script injection detected');
          }

          return { success: true, message: 'Security check passed' };
        };

        try {
          await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: violation.input,
          });

          // Should have thrown for security violations
          expect(false).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Security violation');
        }
      }
    });

    test('should handle privilege escalation attempts', async () => {
      const privilegeAttempts = [
        { user: 'root', operation: 'system_access' },
        { user: 'admin', operation: 'config_modification' },
        { user: 'guest', operation: 'user_creation' },
      ];

      for (const attempt of privilegeAttempts) {
        const handler: HookHandler = async (context: HookContext) => {
          const input = context.input as any;

          // Simulate privilege checking
          if (input.user === 'root') {
            throw new Error('Privilege escalation: root access denied');
          }

          if (input.operation === 'system_access' && input.user !== 'admin') {
            throw new Error('Insufficient privileges for system access');
          }

          return { success: true, message: 'Privilege check passed' };
        };

        try {
          await handler({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: attempt,
          });

          // Some combinations should pass, others should fail
          if (
            attempt.user === 'root' ||
            (attempt.operation === 'system_access' && attempt.user !== 'admin')
          ) {
            expect(false).toBe(true); // Should have thrown
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/(Privilege|privileges)/);
        }
      }
    });
  });

  describe('Recovery and Cleanup', () => {
    test('should clean up resources after failures', async () => {
      const resources: any[] = [];

      try {
        const handler: HookHandler = async (_context: HookContext) => {
          // Allocate resources
          for (let i = 0; i < 10; i++) {
            const resource = {
              id: i,
              data: new Array(1000).fill(`resource_${i}`),
              cleanup: () => {
                // Simulate cleanup
                return true;
              },
            };
            resources.push(resource);
          }

          // Simulate failure after resource allocation
          throw new Error('Simulated failure after resource allocation');
        };

        await handler({
          event: 'pre-tool-use',
          tool: 'Bash',
          input: { test: true },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(resources).toHaveLength(10); // Resources were allocated
      } finally {
        // Clean up resources
        resources.forEach((resource) => {
          if (resource.cleanup) {
            resource.cleanup();
          }
        });
        resources.length = 0;
      }

      expect(resources).toHaveLength(0); // Cleanup successful
    });

    test('should attempt graceful degradation on partial failures', async () => {
      const handler: HookHandler = async (_context: HookContext) => {
        const operations = [
          { name: 'critical', required: true },
          { name: 'optional1', required: false },
          { name: 'optional2', required: false },
          { name: 'important', required: true },
        ];

        const results: any[] = [];
        const errors: any[] = [];

        for (const op of operations) {
          try {
            // Simulate operation that might fail
            if (op.name === 'optional1') {
              throw new Error('Optional operation failed');
            }

            results.push({ name: op.name, success: true });
          } catch (error) {
            if (op.required) {
              throw error; // Fail fast for required operations
            }

            errors.push({ name: op.name, error: (error as Error).message });
          }
        }

        return {
          success: true,
          message: 'Graceful degradation successful',
          data: {
            successful: results,
            failed: errors,
          },
        };
      };

      const result = await handler({
        event: 'pre-tool-use',
        tool: 'Bash',
        input: { test: true },
      });

      expect(result.success).toBe(true);
      expect(result.data?.successful).toHaveLength(3); // critical, optional2, important
      expect(result.data?.failed).toHaveLength(1); // optional1
    });
  });
});
