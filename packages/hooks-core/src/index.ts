/**
 * @outfitter/hooks-core
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
} from './builder';
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
} from './registry';
// Export runtime utilities
export {
  createBashContext,
  createFileContext,
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
  isLSToolInput,
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
  validateHookContext,
} from './runtime';
// Export all types
export type * from './types';

// Version export (prefer env; fallback to package.json when supported)
export const VERSION: string =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.npm_package_version) ||
  (typeof Bun !== 'undefined' && Bun.env && Bun.env.npm_package_version) ||
  '0.0.0';
