/**
 * Zod validation schemas for Claude Code hook inputs
 * Validates the JSON input structure from Claude Code
 */

import { HOOK_EVENTS, type ToolName } from "@carabiner/types";
import { z } from "zod";

/**
 * Hook event validation
 */
export const hookEventSchema = z.enum(HOOK_EVENTS);

/**
 * Tool name validation (known tools + custom)
 */
export const toolNameSchema = z.string().min(1) as z.ZodType<ToolName>;

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
});

/**
 * Tool hook input schema (PreToolUse, PostToolUse)
 */
export const claudeToolHookInputSchema = baseClaudeHookInputSchema.extend({
	hook_event_name: z.enum(["PreToolUse", "PostToolUse"]),
	tool_name: toolNameSchema,
	tool_input: z.record(z.string(), z.unknown()),
	tool_response: z.record(z.string(), z.unknown()).optional(),
});

/**
 * User prompt input schema
 */
export const claudeUserPromptInputSchema = baseClaudeHookInputSchema.extend({
	hook_event_name: z.literal("UserPromptSubmit"),
	prompt: z.string().min(1),
});

/**
 * Notification input schema
 */
export const claudeNotificationInputSchema = baseClaudeHookInputSchema.extend({
	hook_event_name: z.enum(["SessionStart", "Stop", "SubagentStop"]),
	message: z.string().optional(),
});

/**
 * Union of all possible Claude hook inputs
 */
export const claudeHookInputSchema = z.discriminatedUnion("hook_event_name", [
	claudeToolHookInputSchema,
	claudeUserPromptInputSchema,
	claudeNotificationInputSchema,
]);

/**
 * Hook environment schema
 */
export const hookEnvironmentSchema = z.object({
	CLAUDE_PROJECT_DIR: z.string().optional(),
});

/**
 * Hook result schema
 */
export const hookResultSchema = z.object({
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
export type HookEnvironment = z.infer<typeof hookEnvironmentSchema>;
export type HookResult = z.infer<typeof hookResultSchema>;
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

export function parseHookExecutionOptions(
	options: unknown,
): HookExecutionOptions {
	return hookExecutionOptionsSchema.parse(options);
}

/**
 * Type guards using Zod validation
 */
export function isValidClaudeHookInput(
	input: unknown,
): input is ClaudeHookInput {
	return claudeHookInputSchema.safeParse(input).success;
}

export function isValidToolHookInput(
	input: unknown,
): input is ClaudeToolHookInput {
	return claudeToolHookInputSchema.safeParse(input).success;
}

export function isValidUserPromptInput(
	input: unknown,
): input is ClaudeUserPromptInput {
	return claudeUserPromptInputSchema.safeParse(input).success;
}

export function isValidNotificationInput(
	input: unknown,
): input is ClaudeNotificationInput {
	return claudeNotificationInputSchema.safeParse(input).success;
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
