/**
 * Hook event types for Claude Code
 * Simple discriminated unions instead of complex generics
 */

import type { LiteralUnion } from "type-fest";

/**
 * Hook events supported by Claude Code
 * All 9 events according to the official specification
 */
export const HOOK_EVENTS = Object.freeze([
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "UserPromptSubmit",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionStart",
  "SessionEnd",
] as const);

export type HookEvent = (typeof HOOK_EVENTS)[number];

/**
 * Tool events (events that involve tool execution)
 */
export type ToolHookEvent = "PreToolUse" | "PostToolUse";

/**
 * Notification events (informational events)
 */
export type NotificationEvent =
  | "Notification"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "SubagentStop";

/**
 * User interaction events
 */
export type UserEvent = "UserPromptSubmit";

/**
 * Compact events
 */
export type CompactEvent = "PreCompact";

/**
 * Known tool names from Claude Code
 * Uses LiteralUnion to provide autocomplete while allowing custom tools
 */
export type ToolName = LiteralUnion<
  | "Bash"
  | "Edit"
  | "MultiEdit"
  | "Write"
  | "Read"
  | "Glob"
  | "Grep"
  | "LS"
  | "TodoWrite"
  | "WebFetch"
  | "WebSearch"
  | "NotebookEdit",
  string
>;

/**
 * Hook execution result - Claude Code compliant format
 * Only contains Claude SDK v2 fields
 */
export type HookResult = {
  readonly continue?: boolean;
  readonly stopReason?: string;
  readonly suppressOutput?: boolean;
  readonly systemMessage?: string;
  readonly hookSpecificOutput?: Record<string, unknown>;
  readonly additionalContext?: string;
  readonly metadata?: HookMetadata;
};

/**
 * Hook execution metadata
 */
export type HookMetadata = {
  readonly duration?: number;
  readonly timestamp?: string;
  readonly hookVersion?: string;
};

/**
 * Hook output modes
 */
export type HookOutputMode = "exit-code" | "json";

/**
 * Hook execution options
 */
export type HookExecutionOptions = {
  readonly timeout?: number;
  readonly throwOnError?: boolean;
  readonly captureOutput?: boolean;
  readonly logLevel?: "debug" | "info" | "warn" | "error";
  readonly outputMode?: HookOutputMode;
};

/**
 * Type guards for hook events
 */
export function isHookEvent(value: unknown): value is HookEvent {
  return (
    typeof value === "string" &&
    (HOOK_EVENTS as readonly string[]).includes(value)
  );
}

export function isToolHookEvent(event: HookEvent): event is ToolHookEvent {
  return event === "PreToolUse" || event === "PostToolUse";
}

export function isNotificationEvent(
  event: HookEvent
): event is NotificationEvent {
  return (
    event === "Notification" ||
    event === "SessionStart" ||
    event === "SessionEnd" ||
    event === "Stop" ||
    event === "SubagentStop"
  );
}

export function isUserEvent(event: HookEvent): event is UserEvent {
  return event === "UserPromptSubmit";
}

export function isCompactEvent(event: HookEvent): event is CompactEvent {
  return event === "PreCompact";
}

/**
 * Hook result builders for Claude Code SDK v2
 */
export const HookResults = {
  /**
   * Continue execution with optional additional context
   */
  continue(additionalContext?: string): HookResult {
    return { continue: true, additionalContext };
  },

  /**
   * Allow permission with optional reason
   */
  allow(reason?: string): HookResult {
    return {
      continue: true,
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: reason,
      },
    };
  },

  /**
   * Deny permission with optional reason
   */
  deny(reason?: string): HookResult {
    return {
      continue: false,
      stopReason: "blocked",
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    };
  },

  /**
   * Ask user for permission with optional reason
   */
  ask(reason?: string): HookResult {
    return {
      continue: false,
      hookSpecificOutput: {
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    };
  },

  /**
   * Stop execution with reason
   */
  stop(reason: string): HookResult {
    return { continue: false, stopReason: reason };
  },

  /**
   * Suppress output with optional system message
   */
  suppress(systemMessage?: string): HookResult {
    return { suppressOutput: true, systemMessage };
  },
} as const;
