/**
 * Type-safe context factory functions
 * Replaces the complex createHookContext function with specialized factories
 */

import type {
  ClaudeHookInputVariant,
  ClaudeNotificationInput,
  ClaudeToolHookInput,
  ClaudeUserPromptInput,
  GetToolInput,
  HookContext,
  HookEnvironment,
  HookEvent,
  ToolName,
} from './types';
import {
  isClaudeNotificationInput,
  isClaudeToolHookInput,
  isClaudeUserPromptInput,
} from './types';
import { safeParseToolInput } from './validation-utils';

/**
 * Parse hook environment variables (only CLAUDE_PROJECT_DIR is provided)
 */
function parseHookEnvironment(): HookEnvironment {
  return {
    CLAUDE_PROJECT_DIR: Bun.env.CLAUDE_PROJECT_DIR,
  };
}

/**
 * Parse tool input against known schemas with full validation
 * Uses the new type-safe validation utilities
 */
function _parseToolInput<T extends ToolName>(
  toolName: T,
  toolInput: Record<string, unknown>
): GetToolInput<T> {
  // Import from validation-utils to avoid circular dependency
  const { parseToolInput: parseToolInputSafe } = require('./validation-utils');
  return parseToolInputSafe(toolName, toolInput);
}

/**
 * Base context builder - shared properties across all hook types
 */
function createBaseContext<TEvent extends HookEvent>(
  claudeInput: ClaudeHookInputVariant,
  event: TEvent
): Pick<
  HookContext<TEvent>,
  | 'event'
  | 'sessionId'
  | 'transcriptPath'
  | 'cwd'
  | 'matcher'
  | 'environment'
  | 'rawInput'
> {
  return {
    event,
    sessionId: claudeInput.session_id,
    transcriptPath: claudeInput.transcript_path,
    cwd: claudeInput.cwd,
    matcher: claudeInput.matcher,
    environment: parseHookEnvironment(),
    rawInput: claudeInput,
  };
}

/**
 * Create context for tool-based events (PreToolUse/PostToolUse)
 */
function createToolContext<
  TEvent extends 'PreToolUse' | 'PostToolUse',
  TTool extends ToolName,
>(claudeInput: ClaudeToolHookInput, event: TEvent): HookContext<TEvent, TTool> {
  const baseContext = createBaseContext(claudeInput, event);

  // Use safe parsing for tool input to handle test scenarios gracefully
  const toolInputResult = safeParseToolInput(
    claudeInput.tool_name as TTool,
    claudeInput.tool_input
  );

  return {
    ...baseContext,
    toolName: claudeInput.tool_name as TTool,
    toolInput: toolInputResult.success
      ? toolInputResult.data
      : (claudeInput.tool_input as GetToolInput<TTool>), // Fallback for tests
    toolResponse: claudeInput.tool_response,
    userPrompt: undefined,
    message: undefined,
  };
}

/**
 * Create context for user prompt events
 */
function createUserPromptContext<TEvent extends 'UserPromptSubmit'>(
  claudeInput: ClaudeUserPromptInput,
  event: TEvent
): HookContext<TEvent, never> {
  const baseContext = createBaseContext(claudeInput, event);

  return {
    ...baseContext,
    toolName: undefined,
    toolInput: undefined,
    toolResponse: undefined,
    userPrompt: claudeInput.prompt,
    message: undefined,
  } as HookContext<TEvent, never>;
}

/**
 * Create context for notification events
 */
function createNotificationContext<
  TEvent extends 'SessionStart' | 'Stop' | 'SubagentStop',
>(
  claudeInput: ClaudeNotificationInput,
  event: TEvent
): HookContext<TEvent, never> {
  const baseContext = createBaseContext(claudeInput, event);

  return {
    ...baseContext,
    toolName: undefined,
    toolInput: undefined,
    toolResponse: undefined,
    userPrompt: undefined,
    message: claudeInput.message,
  } as HookContext<TEvent, never>;
}

/**
 * Type-safe context creation using discriminated union approach
 * Replaces the monolithic createHookContext function
 */
export function createHookContext<
  TEvent extends HookEvent,
  TTool extends ToolName = ToolName,
>(
  claudeInput: ClaudeHookInputVariant,
  overrides?: Partial<HookContext<TEvent, TTool>>
): HookContext<TEvent, TTool> {
  const event = claudeInput.hook_event_name as TEvent;

  // Use discriminated union with type guards for safe context creation
  if (
    isClaudeToolHookInput(claudeInput) &&
    (event === 'PreToolUse' || event === 'PostToolUse')
  ) {
    const context = createToolContext(claudeInput, event);
    return { ...context, ...overrides } as HookContext<TEvent, TTool>;
  }

  if (isClaudeUserPromptInput(claudeInput) && event === 'UserPromptSubmit') {
    const context = createUserPromptContext(claudeInput, event);
    return { ...context, ...overrides } as HookContext<TEvent, TTool>;
  }

  if (
    isClaudeNotificationInput(claudeInput) &&
    (event === 'SessionStart' || event === 'Stop' || event === 'SubagentStop')
  ) {
    const context = createNotificationContext(claudeInput, event);
    return { ...context, ...overrides } as HookContext<TEvent, TTool>;
  }

  // This should never happen with proper input validation
  throw new Error(`Unsupported event type: ${event}`);
}

/**
 * Type-safe factory functions for specific context types
 * These provide maximum type safety for known use cases
 */
export const contextFactories = {
  /**
   * Create PreToolUse context with full type safety
   */
  preToolUse<TTool extends ToolName>(
    claudeInput: ClaudeToolHookInput,
    overrides?: Partial<HookContext<'PreToolUse', TTool>>
  ): HookContext<'PreToolUse', TTool> {
    if (claudeInput.hook_event_name !== 'PreToolUse') {
      throw new Error('Input must be PreToolUse event');
    }
    const context = createToolContext(claudeInput, 'PreToolUse');
    return { ...context, ...overrides } as HookContext<'PreToolUse', TTool>;
  },

  /**
   * Create PostToolUse context with full type safety
   */
  postToolUse<TTool extends ToolName>(
    claudeInput: ClaudeToolHookInput,
    overrides?: Partial<HookContext<'PostToolUse', TTool>>
  ): HookContext<'PostToolUse', TTool> {
    if (claudeInput.hook_event_name !== 'PostToolUse') {
      throw new Error('Input must be PostToolUse event');
    }
    const context = createToolContext(claudeInput, 'PostToolUse');
    return { ...context, ...overrides } as HookContext<'PostToolUse', TTool>;
  },

  /**
   * Create UserPromptSubmit context with full type safety
   */
  userPromptSubmit(
    claudeInput: ClaudeUserPromptInput,
    overrides?: Partial<HookContext<'UserPromptSubmit', never>>
  ): HookContext<'UserPromptSubmit', never> {
    if (claudeInput.hook_event_name !== 'UserPromptSubmit') {
      throw new Error('Input must be UserPromptSubmit event');
    }
    const context = createUserPromptContext(claudeInput, 'UserPromptSubmit');
    return { ...context, ...overrides };
  },

  /**
   * Create SessionStart context with full type safety
   */
  sessionStart(
    claudeInput: ClaudeNotificationInput,
    overrides?: Partial<HookContext<'SessionStart', never>>
  ): HookContext<'SessionStart', never> {
    if (claudeInput.hook_event_name !== 'SessionStart') {
      throw new Error('Input must be SessionStart event');
    }
    const context = createNotificationContext(claudeInput, 'SessionStart');
    return { ...context, ...overrides };
  },
} as const;
