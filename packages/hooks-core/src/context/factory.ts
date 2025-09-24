/**
 * Context factory for creating hook contexts with Claude Code compliance
 * Handles environment variable injection and new context fields
 */

import type {
  BaseHookContext,
  CreateContextOptions,
  HookEvent,
  NotificationContext,
  NotificationType,
  PostToolUseContext,
  PreCompactContext,
  PreCompactTrigger,
  PreToolUseContext,
  SessionEndContext,
  SessionStartContext,
  SessionStartTrigger,
  StopContext,
  SubagentStopContext,
  ToolInput,
  ToolName,
  UserPromptHookContext,
} from "@carabiner/types";
import { injectEnvironmentVariables } from "../environment";

/**
 * Create base hook context with environment variable injection
 */
function createBaseContext(
  event: HookEvent,
  options: CreateContextOptions
): BaseHookContext {
  // Inject environment variables
  injectEnvironmentVariables(event, options.sessionId, options.cwd);

  return {
    event,
    sessionId: options.sessionId,
    transcriptPath: options.transcriptPath,
    cwd: options.cwd,
    matcher: options.matcher,
    environment: options.environment || {},
  };
}

/**
 * Create PreToolUse context with hook-specific input and stop hook handling
 */
export function createPreToolUseContext(
  toolName: ToolName,
  toolInput: ToolInput,
  options: CreateContextOptions,
  hookSpecificInput?: { permissionPrompt?: string },
  stopHookActive?: boolean
): PreToolUseContext {
  const baseContext = createBaseContext("PreToolUse", options);

  // Log when stop hook is active
  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active, context will respect stop behavior");
  }

  return {
    ...baseContext,
    event: "PreToolUse",
    toolName,
    toolInput,
    hookSpecificInput,
    stopHookActive,
  };
}

/**
 * Create PostToolUse context
 */
export function createPostToolUseContext(
  toolName: ToolName,
  toolInput: ToolInput,
  toolResponse: Record<string, unknown>,
  options: CreateContextOptions,
  stopHookActive?: boolean
): PostToolUseContext {
  const baseContext = createBaseContext("PostToolUse", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in PostToolUse context");
  }

  return {
    ...baseContext,
    event: "PostToolUse",
    toolName,
    toolInput,
    toolResponse,
    stopHookActive,
  };
}

/**
 * Create Notification context
 */
export function createNotificationContext(
  options: CreateContextOptions,
  message?: string,
  notificationType?: NotificationType,
  stopHookActive?: boolean
): NotificationContext {
  const baseContext = createBaseContext("Notification", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in Notification context");
  }

  return {
    ...baseContext,
    event: "Notification",
    message,
    notificationType,
    stopHookActive,
  };
}

/**
 * Create SessionStart context
 */
export function createSessionStartContext(
  options: CreateContextOptions,
  sessionStartTrigger?: SessionStartTrigger,
  stopHookActive?: boolean,
  message?: string
): SessionStartContext {
  const baseContext = createBaseContext("SessionStart", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in SessionStart context");
  }

  return {
    ...baseContext,
    event: "SessionStart",
    sessionStartTrigger,
    stopHookActive,
    message,
  };
}

/**
 * Create SessionEnd context
 */
export function createSessionEndContext(
  options: CreateContextOptions,
  stopHookActive?: boolean,
  message?: string
): SessionEndContext {
  const baseContext = createBaseContext("SessionEnd", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in SessionEnd context");
  }

  return {
    ...baseContext,
    event: "SessionEnd",
    stopHookActive,
    message,
  };
}

/**
 * Create Stop context
 */
export function createStopContext(
  options: CreateContextOptions,
  stopHookActive?: boolean,
  message?: string
): StopContext {
  const baseContext = createBaseContext("Stop", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in Stop context");
  }

  return {
    ...baseContext,
    event: "Stop",
    stopHookActive,
    message,
  };
}

/**
 * Create SubagentStop context
 */
export function createSubagentStopContext(
  options: CreateContextOptions,
  stopHookActive?: boolean,
  message?: string
): SubagentStopContext {
  const baseContext = createBaseContext("SubagentStop", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in SubagentStop context");
  }

  return {
    ...baseContext,
    event: "SubagentStop",
    stopHookActive,
    message,
  };
}

/**
 * Create PreCompact context
 */
export function createPreCompactContext(
  preCompactTrigger: PreCompactTrigger,
  options: CreateContextOptions,
  stopHookActive?: boolean
): PreCompactContext {
  const baseContext = createBaseContext("PreCompact", options);

  if (stopHookActive) {
    // biome-ignore lint/suspicious/noConsole: required for runtime diagnostics
    console.debug("Stop hook is active in PreCompact context");
  }

  return {
    ...baseContext,
    event: "PreCompact",
    preCompactTrigger,
    stopHookActive,
  };
}

/**
 * Create UserPromptSubmit context
 */
export function createUserPromptContext(
  userPrompt: string,
  options: CreateContextOptions
): UserPromptHookContext {
  const baseContext = createBaseContext("UserPromptSubmit", options);

  return {
    ...baseContext,
    event: "UserPromptSubmit",
    userPrompt,
  };
}

/**
 * Context factory dispatcher - creates appropriate context based on event type
 */
export function createContextForEvent(
  event: HookEvent,
  options: CreateContextOptions,
  additionalParams: Record<string, any> = {}
): BaseHookContext {
  switch (event) {
    case "PreToolUse":
      return createPreToolUseContext(
        additionalParams.toolName,
        additionalParams.toolInput,
        options,
        additionalParams.hookSpecificInput,
        additionalParams.stopHookActive
      );

    case "PostToolUse":
      return createPostToolUseContext(
        additionalParams.toolName,
        additionalParams.toolInput,
        additionalParams.toolResponse,
        options,
        additionalParams.stopHookActive
      );

    case "Notification":
      return createNotificationContext(
        options,
        additionalParams.message,
        additionalParams.notificationType,
        additionalParams.stopHookActive
      );

    case "SessionStart":
      return createSessionStartContext(
        options,
        additionalParams.sessionStartTrigger,
        additionalParams.stopHookActive,
        additionalParams.message
      );

    case "SessionEnd":
      return createSessionEndContext(
        options,
        additionalParams.stopHookActive,
        additionalParams.message
      );

    case "Stop":
      return createStopContext(
        options,
        additionalParams.stopHookActive,
        additionalParams.message
      );

    case "SubagentStop":
      return createSubagentStopContext(
        options,
        additionalParams.stopHookActive,
        additionalParams.message
      );

    case "PreCompact":
      return createPreCompactContext(
        additionalParams.preCompactTrigger,
        options,
        additionalParams.stopHookActive
      );

    case "UserPromptSubmit":
      return createUserPromptContext(additionalParams.userPrompt, options);

    default:
      throw new Error(`Unsupported hook event: ${event}`);
  }
}
