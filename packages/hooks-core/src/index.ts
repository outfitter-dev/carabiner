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
// Export production logging system
export * from './logging';
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

// Version export (derived from package.json)
import type { PackageJson } from 'type-fest';
import pkgJson from '../package.json' with { type: 'json' };

const pkg = pkgJson as PackageJson;
export const VERSION = pkg.version || '0.0.0';
