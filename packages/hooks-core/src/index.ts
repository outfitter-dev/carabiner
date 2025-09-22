/**
 * @carabiner/hooks-core
 * Core TypeScript types and runtime utilities for Claude Code hooks
 */

// Export builder pattern
export {
  createHook,
  type DeclarativeHookConfig,
  defineHook,
  HookBuilder,
  hook,
  middleware,
} from "./builder";
// Export production logging system
export * from "./logging";
// Export provider adapters and registry helpers
export * from "./providers";
// Export registry
export {
  createHookRegistry,
  executeHooks,
  executeHooksAndCombine,
  getHookStats,
  globalRegistry,
  HookRegistry,
  hasHooksForEvent,
  registerHook,
  registerHooks,
} from "./registry";
// Export runtime utilities
export {
  createBashInput,
  createFileInput,
  createHookContext,
  executeHook,
  getSessionInfo,
  HookLogger,
  HookResults,
  // Type guards
  isBashToolInput,
  isClaudeCodeEnvironment,
  isEditToolInput,
  isGlobToolInput,
  isGrepToolInput,
  isMultiEditToolInput,
  isNotebookEditToolInput,
  isReadToolInput,
  isTodoWriteToolInput,
  isWebFetchToolInput,
  isWebSearchToolInput,
  isWriteToolInput,
  outputHookResult,
  // Updated runtime utilities
  parseHookEnvironment,
  // New stdin-based runtime
  parseStdinInput,
  parseToolInput,
  runClaudeHook,
  safeHookExecution,
  validateHookInput,
} from "./runtime";
// Export all types
export type * from "./types";
// Re-export Claude SDK types for compatibility
export type {
  AsyncHookJSONOutput,
  HookCallback,
  HookEnvironment,
  HookInput,
  HookJSONOutput,
  NotificationHookInput,
  PostToolUseHookInput,
  PreCompactHookInput,
  PreToolUseHookInput,
  SessionEndHookInput,
  SessionStartHookInput,
  StopHookInput,
  SubagentStopHookInput,
  UserPromptSubmitHookInput,
} from "./types";
// Export environment utilities
export {
  getEnv,
  getEnvVar,
  isBun,
  isDebug,
  isDevelopment,
  isProduction,
  isTest,
} from "./utils/env";

// Version export (derived from package.json)
import type { PackageJson } from "type-fest";
import pkgJson from "../package.json" with { type: "json" };

const pkg = pkgJson as PackageJson;
export const VERSION = pkg.version || "0.0.0";
