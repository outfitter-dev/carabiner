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
 */
export type HookResult = {
  readonly success?: boolean;
  readonly continue?: boolean;
  readonly stopReason?: string;
  readonly suppressOutput?: boolean;
  readonly systemMessage?: string;
  readonly hookSpecificOutput?: Record<string, unknown>;
  readonly additionalContext?: string;
  readonly message?: string;
  readonly block?: boolean;
  readonly data?: Record<string, unknown>;
  readonly metadata?: HookMetadata;
};

/**
 * Legacy hook result format - deprecated but maintained for backwards compatibility
 * @deprecated Use HookResult instead
 */
export type LegacyHookResult = {
  readonly success: boolean;
  readonly message?: string;
  readonly block?: boolean;
  readonly data?: Record<string, unknown>;
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
 * Simple hook output for Claude Code communication - deprecated format
 * @deprecated Use HookResult instead
 */
export type ClaudeHookOutput = {
  readonly action: "continue" | "block";
  readonly message?: string;
  readonly data?: Record<string, unknown>;
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
 * Hook result builders for Claude Code compliant scenarios
 */
export const HookResults = {
  continue(additionalContext?: string): HookResult {
    return { continue: true, additionalContext };
  },

  success(message?: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },

  allow(reason?: string): HookResult {
    return {
      continue: true,
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: reason,
      },
    };
  },

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

  failure(
    message: string,
    options: {
      data?: Record<string, unknown>;
      stopReason?: string;
      block?: boolean;
    } = {}
  ): HookResult {
    const { data, stopReason, block } = options;
    return {
      success: false,
      message,
      data,
      block,
      stopReason: stopReason ?? (block ? "blocked" : undefined),
      continue: block === true ? false : undefined,
    };
  },

  ask(reason?: string): HookResult {
    return {
      continue: false,
      hookSpecificOutput: {
        permissionDecision: "ask",
        permissionDecisionReason: reason,
      },
    };
  },

  stop(reason: string): HookResult {
    return { continue: false, stopReason: reason };
  },

  block(message: string, data?: Record<string, unknown>): HookResult {
    return {
      success: false,
      continue: false,
      stopReason: "blocked",
      block: true,
      message,
      data,
    };
  },

  skip(message = "Hook skipped"): HookResult {
    return { success: true, message };
  },

  warn(message: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },

  suppress(systemMessage?: string): HookResult {
    return { suppressOutput: true, systemMessage };
  },
} as const;

/**
 * Legacy hook result builders - deprecated but maintained for backwards compatibility
 * @deprecated Use HookResults instead
 */
export const LegacyHookResults = {
  success(message?: string, data?: Record<string, unknown>): LegacyHookResult {
    return { success: true, message, data };
  },

  failure(
    message: string,
    block = false,
    data?: Record<string, unknown>
  ): LegacyHookResult {
    return { success: false, message, block, data };
  },

  block(message: string): LegacyHookResult {
    return { success: false, message, block: true };
  },

  skip(message?: string): LegacyHookResult {
    return { success: true, message: message || "Hook skipped" };
  },

  warn(message: string, data?: Record<string, unknown>): LegacyHookResult {
    return { success: true, message, data };
  },
} as const;
