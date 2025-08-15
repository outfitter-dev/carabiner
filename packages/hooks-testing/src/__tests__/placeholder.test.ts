/**
 * Example usage of the simplified hook testing framework
 * Demonstrates functional composition over complex class patterns
 */

import { describe, expect, test } from 'bun:test';
import type { HookHandler } from '@outfitter/hooks-core';
import {
  createHookTests,
  hookTest,
  runHookTest,
  testBuilders,
} from '../test-framework';

// Example hook handler for testing
const exampleHandler: HookHandler = async (context) => {
  if (context.request?.url?.includes('error')) {
    return { success: false, message: 'Simulated error' };
  }
  return { success: true, message: 'Hook executed successfully' };
};

describe('Hook Testing Framework', () => {
  test('should run simple hook test', async () => {
    await hookTest(exampleHandler, {
      name: 'should succeed with valid context',
      context: { request: { url: 'https://example.com' } },
      expectedResult: { success: true },
    });
  });

  test('should handle test builders', async () => {
    const testConfig = testBuilders.successCase(
      { request: { url: 'https://example.com' } },
      'Hook executed successfully'
    );

    await hookTest(exampleHandler, testConfig);
  });

  test('should create multiple tests', async () => {
    const configs = [
      testBuilders.successCase({ request: { url: 'https://example.com' } }),
      testBuilders.errorHandling({
        request: { url: 'https://example.com/error' },
      }),
    ] as const;

    const testFunctions = createHookTests(exampleHandler, configs);

    // Run all test functions
    for (const testFn of testFunctions) {
      await testFn();
    }
  });

  test('should use runHookTest directly', async () => {
    const result = await runHookTest(exampleHandler, {
      name: 'direct usage test',
      context: { request: { url: 'https://example.com' } },
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Hook executed successfully');
  });
});
