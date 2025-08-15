/**
 * @outfitter/types - Type system foundation for Claude Code hooks
 *
 * This package provides:
 * - Branded types for compile-time safety and runtime validation
 * - Simple discriminated unions instead of complex generics
 * - Concrete context types for better discoverability
 * - Type guards and validation functions
 *
 * This replaces the complex 477-line types.ts with simple, concrete types
 * that are easy to understand, use, and maintain.
 */

// Branded types and validation
export type {
  CommandString,
  DirectoryPath,
  FilePath,
  SessionId,
  TranscriptPath,
} from './brands';

export {
  BrandValidationError,
  createCommandString,
  createDirectoryPath,
  createFilePath,
  createSessionId,
  createTranscriptPath,
  isCommandString,
  isDirectoryPath,
  isFilePath,
  isSessionId,
  isTranscriptPath,
  UnsafeBrands,
} from './brands';

// Test helpers for type-safe testing
export type {
  TestContextOptions,
} from './test-helpers';

export {
  createTestContext,
  TestAssertions,
  TestFactories,
  TestMocks,
  TestSetupError,
  TestValidationError,
} from './test-helpers';
// Context types
export type {
  BaseHookContext,
  BashHookContext,
  BashHookHandler,
  CreateContextOptions,
  FileHookContext,
  FileHookHandler,
  HookContext,
  HookEnvironment,
  HookHandler,
  NotificationHandler,
  NotificationHookContext,
  PostToolUseContext,
  PostToolUseHandler,
  PreToolUseContext,
  PreToolUseHandler,
  SearchHookContext,
  SessionStartContext,
  SessionStartHandler,
  StopContext,
  StopHandler,
  SubagentStopContext,
  SubagentStopHandler,
  ToolHookContext,
  ToolHookHandler,
  UserPromptHandler,
  UserPromptHookContext,
} from './context';
export {
  createNotificationContext,
  createToolHookContext,
  createUserPromptContext,
  isBashHookContext,
  isFileHookContext,
  isNotificationContext,
  isPostToolUseContext,
  isPreToolUseContext,
  isSearchHookContext,
  isToolHookContext,
  isUserPromptContext,
} from './context';
// Hook events and results
export type {
  ClaudeHookOutput,
  HookEvent,
  HookExecutionOptions,
  HookMetadata,
  HookOutputMode,
  HookResult,
  NotificationEvent,
  ToolHookEvent,
  ToolName,
  UserEvent,
} from './events';
export {
  HOOK_EVENTS,
  HookResults,
  isHookEvent,
  isNotificationEvent,
  isToolHookEvent,
  isUserEvent,
} from './events';
// Tool types
export type {
  BashToolInput,
  BrandedBashToolInput,
  BrandedFileToolInput,
  EditToolInput,
  GetToolInput,
  GlobToolInput,
  GrepToolInput,
  LSToolInput,
  MultiEditInput,
  NotebookEditToolInput,
  ReadToolInput,
  TodoWriteToolInput,
  ToolInput,
  ToolInputMap,
  UnknownToolInput,
  WebFetchToolInput,
  WebSearchToolInput,
  WriteToolInput,
} from './tools';
export {
  isBashToolInput,
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
} from './tools';
