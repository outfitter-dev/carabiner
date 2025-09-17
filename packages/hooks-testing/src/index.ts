/**
 * @carabiner/hooks-testing
 * Testing utilities for Claude Code hooks
 */

export type {
  MockEnvironmentConfig,
  MockInputOptions,
  // Backward compatibility - deprecated
  MockInputOptions as MockContextOptions,
} from "@/hooks-testing/src/mock";
// Export mock utilities
export {
  createMockInput,
  // Backward compatibility - deprecated
  createMockInput as createMockContext,
  createMockInputFor,
  createMockInputFor as createMockContextFor,
  MockEnvironment,
  mockEnv,
  mockToolInputs,
  TestUtils,
} from "@/hooks-testing/src/mock";
export type {
  HookTestConfig,
  TestExecutionResult,
  TestSuiteConfig,
  TestSuiteResult,
} from "@/hooks-testing/src/test-framework";
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
} from "@/hooks-testing/src/test-framework";

// Version export (derived from package.json)
import pkg from "../package.json" with { type: "json" };
export const VERSION = pkg.version as string;
