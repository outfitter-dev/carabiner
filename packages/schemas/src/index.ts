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

/**
 * Re-export commonly used types from @outfitter/types for convenience
 */
export type {
  CommandString,
  DirectoryPath,
  FilePath,
  HookContext,
  HookEvent,
  HookHandler,
  SessionId,
  ToolName,
  TranscriptPath,
} from '@outfitter/types';

export type {
  ClaudeHookInput,
  ClaudeHookOutput,
  ClaudeNotificationInput,
  ClaudeToolHookInput,
  ClaudeUserPromptInput,
  HookEnvironment,
  HookExecutionOptions,
  HookResult,
} from './input.js';
// Input validation schemas and functions
export {
  baseClaudeHookInputSchema,
  claudeHookInputSchema,
  claudeHookOutputSchema,
  claudeNotificationInputSchema,
  claudeToolHookInputSchema,
  claudeUserPromptInputSchema,
  hookEnvironmentSchema,
  hookEventSchema,
  hookExecutionOptionsSchema,
  hookResultSchema,
  isValidClaudeHookInput,
  isValidNotificationInput,
  isValidToolHookInput,
  isValidUserPromptInput,
  parseClaudeHookInput,
  parseHookEnvironment,
  parseHookExecutionOptions,
  parseHookResult,
  safeParseClaudeHookInput,
  toolNameSchema,
  validateAndCreateBrandedInput,
} from './input.js';
// Tool validation schemas and functions
export {
  bashToolInputSchema,
  editToolInputSchema,
  getToolInputSchema,
  globToolInputSchema,
  grepToolInputSchema,
  lsToolInputSchema,
  multiEditInputSchema,
  notebookEditToolInputSchema,
  readToolInputSchema,
  safeValidateToolInput,
  todoWriteToolInputSchema,
  toolInputSchema,
  toolInputSchemas,
  unknownToolInputSchema,
  validateToolInput,
  webFetchToolInputSchema,
  webSearchToolInputSchema,
  writeToolInputSchema,
} from './tools.js';

export type {
  CompleteValidationResult,
  ValidatedClaudeInput,
  ValidationResult,
} from './validation.js';
// Main validation utilities
export {
  ValidationError,
  ValidationUtils,
  validateClaudeInput,
  validateCompleteHookInput,
  validateGenericToolInput,
  validateToolInputForTool,
} from './validation.js';
