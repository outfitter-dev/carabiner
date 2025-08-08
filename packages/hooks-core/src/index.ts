/**
 * @claude-code/hooks-core
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
  exitWithError,
  // Deprecated - use outputHookResult instead
  exitWithResult,
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

// Version export - updated for new stdin-based runtime
export const VERSION = '0.2.0';
