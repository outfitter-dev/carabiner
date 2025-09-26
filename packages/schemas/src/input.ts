/**
 * Zod validation schemas for Claude Code hook inputs
 * Validates the JSON input structure from Claude Code
 */

import {
  HOOK_EVENTS,
  MCP_TOOL_NAME_PATTERN,
  type ToolName,
} from "@carabiner/types";
import { z } from "zod";

/**
 * Hook event validation
 */
export const hookEventSchema = z.enum(HOOK_EVENTS);

/**
 * Tool name validation (known tools + custom + MCP tools)
 */
export const toolNameSchema = z.string().min(1) as z.ZodType<ToolName>;

/**
 * MCP tool name validation
 * Must follow pattern: mcp__<server>__<tool>
 */
export const mcpToolNameSchema = z.string().regex(MCP_TOOL_NAME_PATTERN, {
  message: "MCP tool names must follow pattern: mcp__<server>__<tool>",
});

/**
 * PreCompact trigger matchers
 */
export const preCompactMatcherSchema = z.enum(["manual", "auto"]);

/**
 * SessionStart trigger matchers
 */
export const sessionStartMatcherSchema = z.enum([
  "startup",
  "resume",
  "clear",
  "compact",
]);

/**
 * Notification type validation
 */
export const notificationTypeSchema = z.enum([
  "info",
  "warning",
  "error",
  "system",
]);

/**
 * Permission decision validation
 */
export const permissionDecisionSchema = z.enum(["allow", "deny", "ask"]);

/**
 * Base Claude hook input schema
 */
export const baseClaudeHookInputSchema = z.object({
  session_id: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  transcript_path: z
    .string()
    .min(1)
    .regex(/^\/.*\.md$/),
  cwd: z.string().min(1).regex(/^\//),
  hook_event_name: hookEventSchema,
  matcher: z.string().optional(),
  stop_hook_active: z.boolean().optional(),
}).passthrough();

/**
 * Tool hook input schema (PreToolUse, PostToolUse)
 */
export const claudeToolHookInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.enum(["PreToolUse", "PostToolUse"]),
  tool_name: toolNameSchema,
  tool_input: z.record(z.string(), z.unknown()),
  tool_response: z.record(z.string(), z.unknown()).optional(),
  hook_specific_input: z
    .object({
      permissionPrompt: z.string().optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

/**
 * User prompt input schema
 */
export const claudeUserPromptInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("UserPromptSubmit"),
  prompt: z.string().min(1),
}).passthrough();

/**
 * Notification input schema
 */
export const claudeNotificationInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("Notification"),
  notification_type: notificationTypeSchema.optional(),
  message: z.string().optional(),
}).passthrough();

/**
 * SessionStart input schema
 */
export const claudeSessionStartInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("SessionStart"),
  session_start_trigger: sessionStartMatcherSchema.optional(),
  message: z.string().optional(),
}).passthrough();

/**
 * SessionEnd input schema
 */
export const claudeSessionEndInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("SessionEnd"),
  reason: z.string().optional(),
}).passthrough();

/**
 * Stop hook input schema
 */
export const claudeStopInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("Stop"),
  reason: z.string().optional(),
}).passthrough();

/**
 * SubagentStop input schema
 */
export const claudeSubagentStopInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("SubagentStop"),
  reason: z.string().optional(),
}).passthrough();

/**
 * PreCompact input schema
 */
export const claudePreCompactInputSchema = baseClaudeHookInputSchema.extend({
  hook_event_name: z.literal("PreCompact"),
  pre_compact_trigger: preCompactMatcherSchema,
}).passthrough();

/**
 * Union of all possible Claude hook inputs
 */
export const claudeHookInputSchema = z.discriminatedUnion("hook_event_name", [
  claudeToolHookInputSchema,
  claudeUserPromptInputSchema,
  claudeNotificationInputSchema,
  claudeSessionStartInputSchema,
  claudeSessionEndInputSchema,
  claudeStopInputSchema,
  claudeSubagentStopInputSchema,
  claudePreCompactInputSchema,
]);

/**
 * Hook environment schema
 */
export const hookEnvironmentSchema = z.object({
  CLAUDE_PROJECT_DIR: z.string().optional(),
  CLAUDE_SESSION_ID: z.string().optional(),
  CLAUDE_HOOK_EVENT: z.string().optional(),
});

/**
 * Hook result schema - Claude Code compliant format
 */
export const hookResultSchema = z.object({
  success: z.boolean().optional(),
  continue: z.boolean().optional(),
  stopReason: z.string().optional(),
  suppressOutput: z.boolean().optional(),
  systemMessage: z.string().optional(),
  hookSpecificOutput: z.record(z.string(), z.unknown()).optional(),
  additionalContext: z.string().optional(),
  message: z.string().optional(),
  block: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  metadata: z
    .object({
      duration: z.number().optional(),
      timestamp: z.string().optional(),
      hookVersion: z.string().optional(),
    })
    .optional(),
});

/**
 * Hook-specific output schema
 */
export const hookSpecificOutputSchema = z
  .object({
    hookEventName: z.string().optional(),
    permissionDecision: permissionDecisionSchema.optional(),
    permissionDecisionReason: z.string().optional(),
  })
  .catchall(z.unknown());

/**
 * Legacy hook result schema - deprecated but maintained for backwards compatibility
 */
export const legacyHookResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  block: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  metadata: z
    .object({
      duration: z.number().optional(),
      timestamp: z.string().optional(),
      hookVersion: z.string().optional(),
    })
    .optional(),
});

/**
 * Claude hook output schema
 */
export const claudeHookOutputSchema = z.object({
  action: z.enum(["continue", "block"]),
  message: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Hook execution options schema
 */
export const hookExecutionOptionsSchema = z.object({
  timeout: z.number().positive().optional(),
  throwOnError: z.boolean().optional(),
  captureOutput: z.boolean().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
  outputMode: z.enum(["exit-code", "json"]).optional(),
});

/**
 * Type exports from schemas
 */
export type ClaudeHookInput = z.infer<typeof claudeHookInputSchema>;
export type ClaudeToolHookInput = z.infer<typeof claudeToolHookInputSchema>;
export type ClaudeUserPromptInput = z.infer<typeof claudeUserPromptInputSchema>;
export type ClaudeNotificationInput = z.infer<
  typeof claudeNotificationInputSchema
>;
export type ClaudeSessionStartInput = z.infer<
  typeof claudeSessionStartInputSchema
>;
export type ClaudeSessionEndInput = z.infer<typeof claudeSessionEndInputSchema>;
export type ClaudeStopInput = z.infer<typeof claudeStopInputSchema>;
export type ClaudeSubagentStopInput = z.infer<
  typeof claudeSubagentStopInputSchema
>;
export type ClaudePreCompactInput = z.infer<typeof claudePreCompactInputSchema>;
export type HookEnvironment = z.infer<typeof hookEnvironmentSchema>;
export type HookResult = z.infer<typeof hookResultSchema>;
export type HookSpecificOutput = z.infer<typeof hookSpecificOutputSchema>;
export type LegacyHookResult = z.infer<typeof legacyHookResultSchema>;
export type ClaudeHookOutput = z.infer<typeof claudeHookOutputSchema>;
export type HookExecutionOptions = z.infer<typeof hookExecutionOptionsSchema>;

/**
 * Validation functions with branded types
 */
export function parseClaudeHookInput(input: unknown): ClaudeHookInput {
  return claudeHookInputSchema.parse(input);
}

export function safeParseClaudeHookInput(input: unknown) {
  return claudeHookInputSchema.safeParse(input);
}

export function parseHookEnvironment(env: unknown): HookEnvironment {
  return hookEnvironmentSchema.parse(env);
}

export function parseHookResult(result: unknown): HookResult {
  return hookResultSchema.parse(result);
}

export function parseHookSpecificOutput(output: unknown): HookSpecificOutput {
  return hookSpecificOutputSchema.parse(output);
}

export function parseLegacyHookResult(result: unknown): LegacyHookResult {
  return legacyHookResultSchema.parse(result);
}

export function parseHookExecutionOptions(
  options: unknown
): HookExecutionOptions {
  return hookExecutionOptionsSchema.parse(options);
}

/**
 * Type guards using Zod validation
 */
export function isValidClaudeHookInput(
  input: unknown
): input is ClaudeHookInput {
  return claudeHookInputSchema.safeParse(input).success;
}

export function isValidToolHookInput(
  input: unknown
): input is ClaudeToolHookInput {
  return claudeToolHookInputSchema.safeParse(input).success;
}

export function isValidUserPromptInput(
  input: unknown
): input is ClaudeUserPromptInput {
  return claudeUserPromptInputSchema.safeParse(input).success;
}

export function isValidNotificationInput(
  input: unknown
): input is ClaudeNotificationInput {
  return claudeNotificationInputSchema.safeParse(input).success;
}

export function isValidSessionStartInput(
  input: unknown
): input is ClaudeSessionStartInput {
  return claudeSessionStartInputSchema.safeParse(input).success;
}

export function isValidSessionEndInput(
  input: unknown
): input is ClaudeSessionEndInput {
  return claudeSessionEndInputSchema.safeParse(input).success;
}

export function isValidStopInput(input: unknown): input is ClaudeStopInput {
  return claudeStopInputSchema.safeParse(input).success;
}

export function isValidSubagentStopInput(
  input: unknown
): input is ClaudeSubagentStopInput {
  return claudeSubagentStopInputSchema.safeParse(input).success;
}

export function isValidPreCompactInput(
  input: unknown
): input is ClaudePreCompactInput {
  return claudePreCompactInputSchema.safeParse(input).success;
}

export function isValidMCPToolName(name: unknown): name is string {
  return typeof name === "string" && mcpToolNameSchema.safeParse(name).success;
}

export function isValidPermissionDecision(
  decision: unknown
): decision is z.infer<typeof permissionDecisionSchema> {
  return permissionDecisionSchema.safeParse(decision).success;
}

/**
 * Input validation with branded type creation
 */
export async function validateAndCreateBrandedInput(input: unknown) {
  const parsed = parseClaudeHookInput(input);

  // Import brands dynamically to avoid circular dependency
  const { createSessionId, createTranscriptPath, createDirectoryPath } =
    await import("@carabiner/types");

  return {
    ...parsed,
    sessionId: createSessionId(parsed.session_id),
    transcriptPath: createTranscriptPath(parsed.transcript_path),
    cwd: createDirectoryPath(parsed.cwd),
  };
}
