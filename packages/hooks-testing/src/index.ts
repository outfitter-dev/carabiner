/**
 * @claude-code/hooks-testing
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

// Version export (derived from package.json)
import pkg from '../package.json' with { type: 'json' };
export const VERSION = pkg.version as string;
