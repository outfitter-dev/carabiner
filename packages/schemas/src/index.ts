/**
 * @outfitter/schemas - Zod validation schemas for Claude Code hooks
 * 
 * This package provides:
 * - Runtime validation for all Claude Code hook inputs
 * - Integration with branded types from @outfitter/types
 * - Comprehensive error reporting with detailed messages
 * - Type-safe validation functions
 * 
 * Works seamlessly with @outfitter/types to provide both compile-time
 * and runtime type safety for Claude Code hooks.
 */

// Input validation schemas and functions
export {
  hookEventSchema,
  toolNameSchema,
  baseClaudeHookInputSchema,
  claudeToolHookInputSchema,
  claudeUserPromptInputSchema,
  claudeNotificationInputSchema,
  claudeHookInputSchema,
  hookEnvironmentSchema,
  hookResultSchema,
  claudeHookOutputSchema,
  hookExecutionOptionsSchema,
  parseClaudeHookInput,
  safeParseClaudeHookInput,
  parseHookEnvironment,
  parseHookResult,
  parseHookExecutionOptions,
  isValidClaudeHookInput,
  isValidToolHookInput,
  isValidUserPromptInput,
  isValidNotificationInput,
  validateAndCreateBrandedInput,
} from './input.js';

export type {
  ClaudeHookInput,
  ClaudeToolHookInput,
  ClaudeUserPromptInput,
  ClaudeNotificationInput,
  HookEnvironment,
  HookResult,
  ClaudeHookOutput,
  HookExecutionOptions,
} from './input.js';

// Tool validation schemas and functions
export {
  bashToolInputSchema,
  writeToolInputSchema,
  editToolInputSchema,
  multiEditInputSchema,
  readToolInputSchema,
  globToolInputSchema,
  grepToolInputSchema,
  lsToolInputSchema,
  todoWriteToolInputSchema,
  webFetchToolInputSchema,
  webSearchToolInputSchema,
  notebookEditToolInputSchema,
  toolInputSchemas,
  toolInputSchema,
  unknownToolInputSchema,
  getToolInputSchema,
  validateToolInput,
  safeValidateToolInput,
} from './tools.js';

// Main validation utilities
export {
  ValidationError,
  validateClaudeInput,
  validateToolInputForTool,
  validateGenericToolInput,
  validateCompleteHookInput,
  ValidationUtils,
} from './validation.js';

export type {
  ValidationResult,
  ValidatedClaudeInput,
  CompleteValidationResult,
} from './validation.js';

/**
 * Re-export commonly used types from @outfitter/types for convenience
 */
export type {
  SessionId,
  FilePath,
  CommandString,
  TranscriptPath,
  DirectoryPath,
  HookEvent,
  ToolName,
  HookContext,
  HookHandler,
} from '@outfitter/types';