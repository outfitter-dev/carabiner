/**
 * @carabiner/types - Type system foundation for Claude Code hooks
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

export type { HookInput } from "@anthropic-ai/claude-code";

// Branded types and validation
export type {
  CommandString,
  DirectoryPath,
  FilePath,
  SessionId,
  TranscriptPath,
} from "./brands";

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
} from "./brands";
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
  NotificationContext,
  NotificationContextHandler,
  NotificationHookContext,
  NotificationHookHandler,
  PostToolUseContext,
  PostToolUseHandler,
  PreCompactContext,
  PreCompactHandler,
  PreToolUseContext,
  PreToolUseHandler,
  SearchHookContext,
  SessionEndContext,
  SessionEndHandler,
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
} from "./context";
export {
  createNotificationContext,
  createPreCompactContext,
  createPreToolUseContext,
  createToolHookContext,
  createUserPromptContext,
  isBashHookContext,
  isFileHookContext,
  isNotificationContext,
  isPostToolUseContext,
  isPreCompactContext,
  isPreToolUseContext,
  isSearchHookContext,
  isToolHookContext,
  isUserPromptContext,
} from "./context";
// Decision types
export type {
  HookEventData,
  HookSpecificOutput,
  NotificationEventData,
  NotificationType,
  PermissionDecision,
  PostToolUseEventData,
  PreCompactEventData,
  PreCompactTrigger,
  PreToolUseEventData,
  SessionEndEventData,
  SessionStartEventData,
  SessionStartTrigger,
  StopEventData,
  SubagentStopEventData,
  UserPromptSubmitEventData,
} from "./decisions";
export {
  HookOutputBuilder,
  isMCPToolName,
  isNotificationType,
  isPermissionDecision,
  isPreCompactTrigger,
  isSessionStartTrigger,
  MCP_TOOL_NAME_PATTERN,
  validateMCPToolName,
} from "./decisions";
// Hook events and results
export type {
  CompactEvent,
  HookEvent,
  HookExecutionOptions,
  HookMetadata,
  HookOutputMode,
  HookResult,
  NotificationEvent,
  ToolHookEvent,
  ToolName,
  UserEvent,
} from "./events";
export {
  HOOK_EVENTS,
  HookResults,
  isCompactEvent,
  isHookEvent,
  isNotificationEvent,
  isToolHookEvent,
  isUserEvent,
} from "./events";
// Test helpers for type-safe testing
export type { TestContextOptions } from "./test-helpers";
export {
  createTestContext,
  TestAssertions,
  TestFactories,
  TestMocks,
  TestSetupError,
  TestValidationError,
} from "./test-helpers";
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
} from "./tools";
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
} from "./tools";
