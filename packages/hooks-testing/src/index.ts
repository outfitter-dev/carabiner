/**
 * @outfitter/hooks-testing
 * Testing utilities for Claude Code hooks
 */

export type {
  MockContextOptions,
  MockEnvironmentConfig,
} from './mock';
// Export mock utilities
export {
  createMockContext,
  createMockContextFor,
  MockEnvironment,
  mockEnv,
  mockToolInputs,
  TestUtils,
} from './mock';
export type {
  HookTestConfig,
  TestExecutionResult,
  TestSuiteConfig,
  TestSuiteResult,
} from './test-framework';
// Export test framework
export {
  HookTest,
  HookTestRunner,
  runTests,
  suite,
  TestSuite,
  test,
  testBuilders,
  testRunner,
} from './test-framework';

// Version export (prefer env)
export const VERSION: string =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.npm_package_version) ||
  (typeof Bun !== 'undefined' && Bun.env && Bun.env.npm_package_version) ||
  '0.0.0';
