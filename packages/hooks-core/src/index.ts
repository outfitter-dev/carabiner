/**
 * @outfitter/hooks-core
 * Core TypeScript types and runtime utilities for Claude Code hooks
 */

// Legacy builder pattern (deprecated - use hook-factories instead)
export {
  createHook,
  type DeclarativeHookConfig,
  defineHook,
  HookBuilder,
  hook,
  middleware,
} from './builder';
// New type-safe context creation
export { contextFactories, createHookContext } from './context-factories';
// New type-safe execution utilities
export {
  type ExecutionMetadata,
  executeHookSafely,
  executionValidation,
  performanceMonitoring,
  timeoutConfiguration,
} from './execution-utils';
// New immutable factory pattern
export {
  createHook as createHookImmutable,
  type HookConfig,
  hookFactories,
  hookPresets,
  hookUtils,
} from './hook-factories';
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
// Legacy runtime utilities (some deprecated)
export {
  createBashContext,
  createFileContext,
  executeHook, // @deprecated - use executeHookSafely
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
  parseHookEnvironment, // @deprecated - use context-factories
  // New stdin-based runtime
  parseStdinInput,
  parseToolInput,
  runClaudeHook,
  safeHookExecution,
  validateHookContext, // @deprecated - use executionValidation
} from './runtime';
// Export all types
export type * from './types';
// New type-safe validation utilities
export {
  assertValidToolInput,
  createToolInputValidator,
  getSupportedToolNames,
  hasValidationSchemaForTool,
  isValidToolInput,
  parseToolInput as parseToolInputSafe,
  type ToolInputValidationResult,
  toolInputValidators,
  validateMultipleToolInputs,
  validateToolInputSafely,
  validateToolInputWithDetails,
} from './validation-utils';

// Version export (prefer env; fallback to package.json when supported)
export const VERSION: string =
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.npm_package_version) ||
  (typeof Bun !== 'undefined' && Bun.env && Bun.env.npm_package_version) ||
  '0.0.0';
