/**
 * Hook testing utilities - functional composition over classes
 * Direct integration with Bun's test runner, no custom framework
 */

import type {
  HookContext,
  HookHandler,
  HookResult,
} from '@outfitter/hooks-core';
import { executeHook } from '@outfitter/hooks-core';
import type { MockEnvironmentConfig } from './mock';
import { mockEnv } from './mock';

/**
 * Hook test configuration
 */
export type HookTestConfig = {
  name: string;
  description?: string;
  context: HookContext;
  environment?: MockEnvironmentConfig;
  timeout?: number;
  expectedResult?: Partial<HookResult>;
  customAssertions?: (
    result: HookResult,
    context: HookContext
  ) => void | Promise<void>;
};

/**
 * Execute a hook test with validation and environment setup
 * Returns the result for further validation if needed
 */
export async function runHookTest(
  handler: HookHandler,
  config: HookTestConfig
): Promise<HookResult> {
  const DEFAULT_TIMEOUT_MS = 30_000;
  const timeout = config.timeout || DEFAULT_TIMEOUT_MS;

  try {
    // Set up environment if specified
    if (config.environment) {
      mockEnv.setup(config.environment);
    }

    // Execute hook with timeout
    const result = await Promise.race([
      executeHook(handler, config.context),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Test timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);

    // Perform built-in assertions
    await performAssertions(result, config);

    return result;
  } finally {
    // Clean up environment
    if (config.environment) {
      mockEnv.restore();
    }
  }
}

/**
 * Perform test assertions on hook result
 */
async function performAssertions(
  result: HookResult,
  config: HookTestConfig
): Promise<void> {
  // Check expected result if specified
  if (config.expectedResult) {
    for (const [key, expectedValue] of Object.entries(config.expectedResult)) {
      // Type-safe property access with proper type guard
      function hasProperty<K extends string>(
        obj: unknown,
        prop: K
      ): obj is Record<K, unknown> {
        return typeof obj === 'object' && obj !== null && prop in obj;
      }

      if (!hasProperty(result, key)) {
        throw new Error(`Expected property '${key}' not found in result`);
      }

      const actualValue = (result as Record<string, unknown>)[key];
      if (actualValue !== expectedValue) {
        throw new Error(
          `Expected ${key} to be ${expectedValue}, got ${actualValue}`
        );
      }
    }
  }

  // Run custom assertions
  if (config.customAssertions) {
    await Promise.resolve(config.customAssertions(result, config.context));
  }
}

/**
 * Test builders for common hook testing patterns
 * Pure functions that return test configurations
 */
export const testBuilders = {
  /**
   * Build security validation test
   */
  securityValidation(
    maliciousContext: HookContext,
    expectedBlocked = true
  ): HookTestConfig {
    return {
      name: `should ${expectedBlocked ? 'block' : 'allow'} security validation`,
      context: maliciousContext,
      expectedResult: {
        success: !expectedBlocked,
        block: expectedBlocked,
      },
      customAssertions: (result: HookResult) => {
        if (expectedBlocked && !result.message?.includes('blocked')) {
          throw new Error('Expected blocking message in result');
        }
      },
    };
  },

  /**
   * Build performance test
   */
  performance(context: HookContext, maxDurationMs: number): HookTestConfig {
    return {
      name: `should complete within ${maxDurationMs}ms`,
      context,
      customAssertions: (result: HookResult) => {
        const duration = result.metadata?.duration;
        if (duration && duration > maxDurationMs) {
          throw new Error(
            `Expected execution under ${maxDurationMs}ms, took ${duration}ms`
          );
        }
      },
    };
  },

  /**
   * Build error handling test
   */
  errorHandling(faultyContext: HookContext): HookTestConfig {
    return {
      name: 'should handle errors gracefully',
      context: faultyContext,
      expectedResult: {
        success: false,
      },
      customAssertions: (result: HookResult) => {
        if (!result.message) {
          throw new Error('Expected error message in result');
        }
      },
    };
  },

  /**
   * Build success case test
   */
  successCase(context: HookContext, expectedMessage?: string): HookTestConfig {
    return {
      name: 'should succeed with valid input',
      context,
      expectedResult: {
        success: true,
        ...(expectedMessage && { message: expectedMessage }),
      },
    };
  },
} as const;

/**
 * Convenience function to create and run a hook test within Bun's test framework
 * Use this directly in your test files with Bun's test() function
 */
export async function hookTest(
  handler: HookHandler,
  config: HookTestConfig
): Promise<void> {
  await runHookTest(handler, config);
}

/**
 * Create multiple test cases for the same handler
 * Returns an array of test functions ready for Bun's test runner
 */
export function createHookTests(
  handler: HookHandler,
  configs: readonly HookTestConfig[]
): readonly (() => Promise<void>)[] {
  return configs.map((config) => () => runHookTest(handler, config));
}
