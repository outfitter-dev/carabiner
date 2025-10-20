/**
 * Permission decision types for Claude Code hooks
 * Defines the new permission model according to Claude Code specification
 */

/**
 * Permission decisions for Claude Code hooks
 */
export type PermissionDecision = "allow" | "deny" | "ask";

/**
 * Hook-specific output structure for Claude Code
 */
export type HookSpecificOutput = {
  readonly hookEventName?: string;
  readonly permissionDecision?: PermissionDecision;
  readonly permissionDecisionReason?: string;
  readonly [key: string]: unknown;
};

/**
 * PreCompact trigger types
 */
export type PreCompactTrigger = "manual" | "auto";

/**
 * SessionStart trigger types
 */
export type SessionStartTrigger = "startup" | "resume" | "clear" | "compact";

/**
 * Notification types
 */
export type NotificationType = "info" | "warning" | "error" | "system";

/**
 * Hook event data structures for each event type
 */
export type PreToolUseEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreToolUse";
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly stop_hook_active?: boolean;
  readonly hook_specific_input?: {
    readonly permissionPrompt?: string;
  };
};

export type PostToolUseEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PostToolUse";
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_response?: Record<string, unknown>;
  readonly stop_hook_active?: boolean;
};

export type NotificationEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "Notification";
  readonly notification_type?: NotificationType;
  readonly message?: string;
  readonly stop_hook_active?: boolean;
};

export type UserPromptSubmitEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "UserPromptSubmit";
  readonly prompt: string;
  readonly stop_hook_active?: boolean;
};

export type StopEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "Stop";
  readonly reason?: string;
  readonly stop_hook_active?: boolean;
};

export type SubagentStopEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SubagentStop";
  readonly reason?: string;
  readonly stop_hook_active?: boolean;
};

export type PreCompactEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "PreCompact";
  readonly pre_compact_trigger: PreCompactTrigger;
  readonly stop_hook_active?: boolean;
};

export type SessionStartEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionStart";
  readonly session_start_trigger?: SessionStartTrigger;
  readonly stop_hook_active?: boolean;
};

export type SessionEndEventData = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: "SessionEnd";
  readonly reason?: string;
  readonly stop_hook_active?: boolean;
};

/**
 * Union type for all Claude Code hook event data
 */
export type HookEventData =
  | PreToolUseEventData
  | PostToolUseEventData
  | NotificationEventData
  | UserPromptSubmitEventData
  | StopEventData
  | SubagentStopEventData
  | PreCompactEventData
  | SessionStartEventData
  | SessionEndEventData;

/**
 * Type guards for permission decisions
 */
export function isPermissionDecision(
  value: unknown
): value is PermissionDecision {
  return typeof value === "string" && ["allow", "deny", "ask"].includes(value);
}

export function isPreCompactTrigger(
  value: unknown
): value is PreCompactTrigger {
  return typeof value === "string" && ["manual", "auto"].includes(value);
}

export function isSessionStartTrigger(
  value: unknown
): value is SessionStartTrigger {
  return (
    typeof value === "string" &&
    ["startup", "resume", "clear", "compact"].includes(value)
  );
}

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === "string" &&
    ["info", "warning", "error", "system"].includes(value)
  );
}

/**
 * MCP tool name validation
 * Pattern: mcp__<server>__<tool>
 */
export const MCP_TOOL_NAME_PATTERN =
  /^mcp__([a-z0-9]+(?:_[a-z0-9]+)*)__([a-z0-9]+(?:_[a-z0-9]+)*)$/i;

export function isMCPToolName(value: unknown): value is string {
  return typeof value === "string" && MCP_TOOL_NAME_PATTERN.test(value);
}

export function validateMCPToolName(name: string): {
  provider: string;
  tool: string;
} {
  if (!isMCPToolName(name)) {
    throw new Error(
      `Invalid MCP tool name: "${name}". MCP tools must follow the pattern: mcp__<server>__<tool>`
    );
  }

  const match = name.match(MCP_TOOL_NAME_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid MCP tool name: "${name}". MCP tools must follow the pattern: mcp__<server>__<tool>`
    );
  }

  const [, provider, tool] = match;

  if (!(provider && tool)) {
    throw new Error(
      `Invalid MCP tool name: "${name}". MCP tools must follow the pattern: mcp__<server>__<tool>`
    );
  }

  return { provider, tool };
}

/**
 * Helper functions for creating hook-specific outputs
 */
export const HookOutputBuilder = {
  allow(reason?: string, hookEventName?: string): HookSpecificOutput {
    return {
      hookEventName,
      permissionDecision: "allow",
      permissionDecisionReason: reason,
    };
  },

  deny(reason?: string, hookEventName?: string): HookSpecificOutput {
    return {
      hookEventName,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    };
  },

  ask(reason?: string, hookEventName?: string): HookSpecificOutput {
    return {
      hookEventName,
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    };
  },
} as const;

/**
 * Utility to validate MCP tool names according to Claude Code specification
 * MCP tools must follow the pattern: mcp__<server>__<tool>
 * Where server and tool can contain alphanumeric characters and underscores, but not double underscores
 */
// Deprecated legacy helpers kept for backwards compatibility
