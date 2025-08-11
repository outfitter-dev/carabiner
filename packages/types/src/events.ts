/**
 * Hook event types for Claude Code
 * Simple discriminated unions instead of complex generics
 */

import type { LiteralUnion } from 'type-fest';

/**
 * Hook events supported by Claude Code
 */
export const HOOK_EVENTS = Object.freeze([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'SessionStart',
  'Stop',
  'SubagentStop',
] as const);

export type HookEvent = (typeof HOOK_EVENTS)[number];

/**
 * Tool events (events that involve tool execution)
 */
export type ToolHookEvent = 'PreToolUse' | 'PostToolUse';

/**
 * Notification events (informational events)
 */
export type NotificationEvent = 'SessionStart' | 'Stop' | 'SubagentStop';

/**
 * User interaction events
 */
export type UserEvent = 'UserPromptSubmit';

/**
 * Known tool names from Claude Code
 * Uses LiteralUnion to provide autocomplete while allowing custom tools
 */
export type ToolName = LiteralUnion<
  | 'Bash'
  | 'Edit'
  | 'MultiEdit'
  | 'Write'
  | 'Read'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit',
  string
>;

/**
 * Hook execution result
 */
export interface HookResult {
  readonly success: boolean;
  readonly message?: string;
  readonly block?: boolean; // For PreToolUse hooks - true blocks tool execution
  readonly data?: Record<string, unknown>;
  readonly metadata?: HookMetadata;
}

/**
 * Hook execution metadata
 */
export interface HookMetadata {
  readonly duration?: number;
  readonly timestamp?: string;
  readonly hookVersion?: string;
}

/**
 * Simple hook output for Claude Code communication
 */
export interface ClaudeHookOutput {
  readonly action: 'continue' | 'block' | 'modify';
  readonly message?: string;
  readonly modified_input?: Record<string, unknown>; // For PreToolUse input modification
  readonly data?: Record<string, unknown>;
}

/**
 * Hook output modes
 */
export type HookOutputMode = 'exit-code' | 'json';

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  readonly timeout?: number;
  readonly throwOnError?: boolean;
  readonly captureOutput?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
  readonly outputMode?: HookOutputMode;
}

/**
 * Type guards for hook events
 */
export function isHookEvent(value: unknown): value is HookEvent {
  return typeof value === 'string' && (HOOK_EVENTS as readonly string[]).includes(value);
}

export function isToolHookEvent(event: HookEvent): event is ToolHookEvent {
  return event === 'PreToolUse' || event === 'PostToolUse';
}

export function isNotificationEvent(event: HookEvent): event is NotificationEvent {
  return event === 'SessionStart' || event === 'Stop' || event === 'SubagentStop';
}

export function isUserEvent(event: HookEvent): event is UserEvent {
  return event === 'UserPromptSubmit';
}

/**
 * Hook result builders for common scenarios
 */
export const HookResults = {
  success(message?: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },

  failure(
    message: string,
    block = false,
    data?: Record<string, unknown>
  ): HookResult {
    return { success: false, message, block, data };
  },

  block(message: string): HookResult {
    return { success: false, message, block: true };
  },

  skip(message?: string): HookResult {
    return { success: true, message: message || 'Hook skipped' };
  },

  warn(message: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },
} as const;