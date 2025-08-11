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
  SessionId,
  FilePath,
  CommandString,
  TranscriptPath,
  DirectoryPath,
} from './brands';

export {
  BrandValidationError,
  createSessionId,
  createFilePath,
  createCommandString,
  createTranscriptPath,
  createDirectoryPath,
  isSessionId,
  isFilePath,
  isCommandString,
  isTranscriptPath,
  isDirectoryPath,
  UnsafeBrands,
} from './brands';

// Hook events and results
export type {
  HookEvent,
  ToolHookEvent,
  NotificationEvent,
  UserEvent,
  ToolName,
  HookResult,
  HookMetadata,
  ClaudeHookOutput,
  HookOutputMode,
  HookExecutionOptions,
} from './events';

export {
  HOOK_EVENTS,
  isHookEvent,
  isToolHookEvent,
  isNotificationEvent,
  isUserEvent,
  HookResults,
} from './events';

// Tool types
export type {
  BashToolInput,
  WriteToolInput,
  EditToolInput,
  MultiEditInput,
  ReadToolInput,
  GlobToolInput,
  GrepToolInput,
  LSToolInput,
  TodoWriteToolInput,
  WebFetchToolInput,
  WebSearchToolInput,
  NotebookEditToolInput,
  ToolInputMap,
  ToolInput,
  UnknownToolInput,
  GetToolInput,
  BrandedBashToolInput,
  BrandedFileToolInput,
} from './tools';

export {
  isBashToolInput,
  isWriteToolInput,
  isEditToolInput,
  isReadToolInput,
  isMultiEditToolInput,
  isGlobToolInput,
  isGrepToolInput,
  isLSToolInput,
  isTodoWriteToolInput,
  isWebFetchToolInput,
  isWebSearchToolInput,
  isNotebookEditToolInput,
} from './tools';

// Context types
export type {
  HookEnvironment,
  BaseHookContext,
  ToolHookContext,
  BashHookContext,
  FileHookContext,
  SearchHookContext,
  UserPromptHookContext,
  NotificationHookContext,
  HookContext,
  PreToolUseContext,
  PostToolUseContext,
  SessionStartContext,
  StopContext,
  SubagentStopContext,
  HookHandler,
  ToolHookHandler,
  BashHookHandler,
  FileHookHandler,
  UserPromptHandler,
  NotificationHandler,
  PreToolUseHandler,
  PostToolUseHandler,
  SessionStartHandler,
  StopHandler,
  SubagentStopHandler,
  CreateContextOptions,
} from './context';

export {
  isToolHookContext,
  isBashHookContext,
  isFileHookContext,
  isSearchHookContext,
  isUserPromptContext,
  isNotificationContext,
  isPreToolUseContext,
  isPostToolUseContext,
  createToolHookContext,
  createUserPromptContext,
  createNotificationContext,
} from './context';