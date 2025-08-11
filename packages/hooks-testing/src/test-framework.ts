/**
 * Test framework utilities for Claude Code hooks
 * Provides structured testing patterns and utilities
 */

import type {
  HookContext,
  HookHandler,
  HookResult,
} from '@claude-code/hooks-core';
import { executeHook } from '@claude-code/hooks-core';
import type { MockEnvironmentConfig } from './mock';
import { mockEnv } from './mock';

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  name: string;
  description?: string;
  timeout?: number;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
}

/**
 * Hook test case configuration
 */
export interface HookTestConfig {
  name: string;
  description?: string;
  context: HookContext;
  environment?: MockEnvironmentConfig;
  timeout?: number;
  skip?: boolean;
  only?: boolean;
  expectedResult?: Partial<HookResult>;
  customAssertions?: (
    result: HookResult,
    context: HookContext
  ) => void | Promise<void>;
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: Error;
  result?: HookResult;
  skipped?: boolean;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  name: string;
  tests: TestExecutionResult[];
  passed: boolean;
  duration: number;
  stats: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Hook test runner
 */
export class HookTestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  /**
   * Create a test suite
   */
  suite(config: TestSuiteConfig, suiteFn: () => void): void {
    const newSuite = new TestSuite(config);
    this.suites.push(newSuite);

    const previousSuite = this.currentSuite;
    this.currentSuite = newSuite;

    try {
      suiteFn();
    } finally {
      this.currentSuite = previousSuite;
    }
  }

  /**
   * Add a test to the current suite
   */
  test(handler: HookHandler, testConfig: HookTestConfig): void {
    if (!this.currentSuite) {
      throw new Error('test() must be called within a suite()');
    }

    this.currentSuite.addTest(handler, testConfig);
  }

  /**
   * Run all test suites
   */
  async run(): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];

    for (const testSuite of this.suites) {
      const result = await testSuite.run();
      results.push(result);
    }

    return results;
  }

  /**
   * Run a specific suite by name
   */
  async runSuite(name: string): Promise<TestSuiteResult | null> {
    const targetSuite = this.suites.find((s) => s.config.name === name);
    return targetSuite ? await targetSuite.run() : null;
  }

  /**
   * Get test statistics across all suites
   */
  getStats(results: TestSuiteResult[]): {
    suites: number;
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  } {
    return results.reduce(
      (stats, suiteResult) => ({
        suites: stats.suites + 1,
        tests: stats.tests + suiteResult.stats.total,
        passed: stats.passed + suiteResult.stats.passed,
        failed: stats.failed + suiteResult.stats.failed,
        skipped: stats.skipped + suiteResult.stats.skipped,
        duration: stats.duration + suiteResult.duration,
      }),
      {
        suites: 0,
        tests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      }
    );
  }
}

/**
 * Test suite class
 */
export class TestSuite {
  private tests: HookTest[] = [];

  constructor(public config: TestSuiteConfig) {}

  /**
   * Add test to suite
   */
  addTest(handler: HookHandler, testConfig: HookTestConfig): void {
    this.tests.push(new HookTest(handler, testConfig));
  }

  /**
   * Run all tests in suite
   */
  async run(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestExecutionResult[] = [];

    // Run beforeAll
    if (this.config.beforeAll) {
      await Promise.resolve(this.config.beforeAll());
    }

    // Filter tests (skip, only)
    const testsToRun = this.getTestsToRun();

    for (const testCase of testsToRun) {
      // Run beforeEach
      if (this.config.beforeEach) {
        await Promise.resolve(this.config.beforeEach());
      }

      const result = await testCase.run(this.config.timeout);
      results.push(result);

      // Run afterEach
      if (this.config.afterEach) {
        await Promise.resolve(this.config.afterEach());
      }
    }

    // Add skipped tests
    for (const testCase of this.tests) {
      if (!testsToRun.includes(testCase)) {
        results.push({
          name: testCase.config.name,
          passed: true,
          duration: 0,
          skipped: true,
        });
      }
    }

    // Run afterAll
    if (this.config.afterAll) {
      await Promise.resolve(this.config.afterAll());
    }

    const duration = Date.now() - startTime;
    const stats = this.calculateStats(results);

    return {
      name: this.config.name,
      tests: results,
      passed: stats.failed === 0,
      duration,
      stats,
    };
  }

  /**
   * Get tests to run based on skip/only flags
   */
  private getTestsToRun(): HookTest[] {
    // If any test has 'only', run only those
    const onlyTests = this.tests.filter((t) => t.config.only);
    if (onlyTests.length > 0) {
      return onlyTests;
    }

    // Otherwise run all non-skipped tests
    return this.tests.filter((t) => !t.config.skip);
  }

  /**
   * Calculate test statistics
   */
  private calculateStats(results: TestExecutionResult[]) {
    return results.reduce(
      (stats, result) => ({
        total: stats.total + 1,
        passed: stats.passed + (result.passed ? 1 : 0),
        failed: stats.failed + (result.passed || result.skipped ? 0 : 1),
        skipped: stats.skipped + (result.skipped ? 1 : 0),
      }),
      {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      }
    );
  }
}

/**
 * Individual hook test
 */
export class HookTest {
  constructor(
    private handler: HookHandler,
    public config: HookTestConfig
  ) {}

  /**
   * Run the test
   */
  async run(suiteTimeout?: number): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const timeout = this.config.timeout || suiteTimeout || 30_000;

    try {
      // Set up environment if specified
      if (this.config.environment) {
        mockEnv.setup(this.config.environment);
      }

      // Execute hook with timeout
      const result = await Promise.race([
        executeHook(this.handler, this.config.context),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Test timeout after ${timeout}ms`)),
            timeout
          )
        ),
      ]);

      // Perform assertions
      await this.performAssertions(result);

      return {
        name: this.config.name,
        passed: true,
        duration: Date.now() - startTime,
        result,
      };
    } catch (error) {
      return {
        name: this.config.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      // Clean up environment
      if (this.config.environment) {
        mockEnv.restore();
      }
    }
  }

  /**
   * Perform test assertions
   */
  private async performAssertions(result: HookResult): Promise<void> {
    // Check expected result if specified
    if (this.config.expectedResult) {
      for (const [key, expectedValue] of Object.entries(
        this.config.expectedResult
      )) {
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

        const actualValue = result[key];
        if (actualValue !== expectedValue) {
          throw new Error(
            `Expected ${key} to be ${expectedValue}, got ${actualValue}`
          );
        }
      }
    }

    // Run custom assertions
    if (this.config.customAssertions) {
      await Promise.resolve(
        this.config.customAssertions(result, this.config.context)
      );
    }
  }
}

/**
 * Test builders for common patterns
 */
export const testBuilders = {
  /**
   * Build security validation test
   */
  securityValidation(
    _handler: HookHandler,
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
  performance(
    _handler: HookHandler,
    context: HookContext,
    maxDurationMs: number
  ): HookTestConfig {
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
  errorHandling(
    _handler: HookHandler,
    faultyContext: HookContext
  ): HookTestConfig {
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
  successCase(
    _handler: HookHandler,
    context: HookContext,
    expectedMessage?: string
  ): HookTestConfig {
    return {
      name: 'should succeed with valid input',
      context,
      expectedResult: {
        success: true,
        ...(expectedMessage && { message: expectedMessage }),
      },
    };
  },
};

/**
 * Global test runner instance
 */
export const testRunner = new HookTestRunner();

/**
 * Convenience functions for creating tests
 */
export function suite(config: TestSuiteConfig, suiteFn: () => void): void {
  testRunner.suite(config, suiteFn);
}

export function test(handler: HookHandler, config: HookTestConfig): void {
  testRunner.test(handler, config);
}

/**
 * Run all tests and report results
 */
export async function runTests(): Promise<void> {
  const results = await testRunner.run();
  const stats = testRunner.getStats(results);

  for (const suiteResult of results) {
    const icon = suiteResult.passed ? '✅' : '❌';
    console.log(`${icon} ${suiteResult.name}`);

    for (const testResult of suiteResult.tests) {
      if (testResult.skipped) {
        console.log(`  ⏭️  ${testResult.name} (skipped)`);
      } else if (testResult.passed) {
        console.log(`  ✅ ${testResult.name} (${testResult.duration}ms)`);
      } else if (testResult.error) {
        console.log(`  ❌ ${testResult.name}: ${testResult.error.message}`);
      }
    }
  }

  // Exit with appropriate code
  if (stats.failed > 0) {
    process.exit(1);
  }
}
