/**
 * Zod validation schemas for Claude Code tool inputs
 * Provides runtime validation with excellent error messages
 */

import type {
	BashToolInput,
	EditToolInput,
	GlobToolInput,
	GrepToolInput,
	LSToolInput,
	MultiEditInput,
	NotebookEditToolInput,
	ReadToolInput,
	TodoWriteToolInput,
	WebFetchToolInput,
	WebSearchToolInput,
	WriteToolInput,
} from "@carabiner/types";
import { z } from "zod";

/**
 * Common validation schemas
 */
const nonEmptyString = z.string().min(1, "Must not be empty");
const filePath = z
	.string()
	.min(1)
	.regex(/^\//, "Must be absolute path starting with /");
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().nonnegative();

/**
 * Bash tool input schema
 */
export const bashToolInputSchema = z.object({
	command: nonEmptyString,
	description: z.string().optional(),
	timeout: positiveInteger.optional(),
}) satisfies z.ZodType<BashToolInput>;

/**
 * Write tool input schema
 */
export const writeToolInputSchema = z.object({
	file_path: filePath,
	content: z.string(), // Allow empty content
}) satisfies z.ZodType<WriteToolInput>;

/**
 * Edit tool input schema
 */
export const editToolInputSchema = z.object({
	file_path: filePath,
	old_string: z.string(),
	new_string: z.string(),
	replace_all: z.boolean().optional(),
}) satisfies z.ZodType<EditToolInput>;

/**
 * Multi-edit tool input schema
 */
export const multiEditInputSchema = z.object({
	file_path: filePath,
	edits: z
		.array(
			z.object({
				old_string: z.string(),
				new_string: z.string(),
				replace_all: z.boolean().optional(),
			}),
		)
		.min(1, "Must have at least one edit"),
}) satisfies z.ZodType<MultiEditInput>;

/**
 * Read tool input schema
 */
export const readToolInputSchema = z.object({
	file_path: filePath,
	limit: positiveInteger.optional(),
	offset: nonNegativeInteger.optional(),
}) satisfies z.ZodType<ReadToolInput>;

/**
 * Glob tool input schema
 */
export const globToolInputSchema = z.object({
	pattern: nonEmptyString,
	path: z.string().optional(),
}) satisfies z.ZodType<GlobToolInput>;

/**
 * Grep tool input schema
 */
export const grepToolInputSchema = z.object({
	pattern: nonEmptyString,
	path: z.string().optional(),
	glob: z.string().optional(),
	output_mode: z.enum(["content", "files_with_matches", "count"]).optional(),
	head_limit: positiveInteger.optional(),
	multiline: z.boolean().optional(),
}) satisfies z.ZodType<GrepToolInput>;

/**
 * LS tool input schema
 */
export const lsToolInputSchema = z.object({
	path: filePath,
	ignore: z.array(z.string()).optional(),
}) satisfies z.ZodType<LSToolInput>;

/**
 * TodoWrite tool input schema
 */
export const todoWriteToolInputSchema = z.object({
	todos: z
		.array(
			z.object({
				content: nonEmptyString,
				status: z.enum(["pending", "in_progress", "completed"]),
				id: nonEmptyString,
			}),
		)
		.min(1, "Must have at least one todo"),
}) satisfies z.ZodType<TodoWriteToolInput>;

/**
 * WebFetch tool input schema
 */
export const webFetchToolInputSchema = z.object({
	url: z.string().url("Must be a valid URL"),
	prompt: nonEmptyString,
}) satisfies z.ZodType<WebFetchToolInput>;

/**
 * WebSearch tool input schema
 */
export const webSearchToolInputSchema = z.object({
	query: nonEmptyString,
	allowed_domains: z.array(z.string()).optional(),
	blocked_domains: z.array(z.string()).optional(),
}) satisfies z.ZodType<WebSearchToolInput>;

/**
 * NotebookEdit tool input schema
 */
export const notebookEditToolInputSchema = z.object({
	notebook_path: filePath.regex(/\.ipynb$/, "Must be a .ipynb file"),
	new_source: z.string(),
	cell_id: z.string().optional(),
	cell_type: z.enum(["code", "markdown"]).optional(),
	edit_mode: z.enum(["replace", "insert", "delete"]).optional(),
}) satisfies z.ZodType<NotebookEditToolInput>;

/**
 * Tool input schema map
 */
export const toolInputSchemas = {
	Bash: bashToolInputSchema,
	Edit: editToolInputSchema,
	MultiEdit: multiEditInputSchema,
	Write: writeToolInputSchema,
	Read: readToolInputSchema,
	Glob: globToolInputSchema,
	Grep: grepToolInputSchema,
	LS: lsToolInputSchema,
	TodoWrite: todoWriteToolInputSchema,
	WebFetch: webFetchToolInputSchema,
	WebSearch: webSearchToolInputSchema,
	NotebookEdit: notebookEditToolInputSchema,
} as const;

/**
 * Union schema for any tool input
 */
export const toolInputSchema = z.union([
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
]);

/**
 * Generic tool input schema (for unknown tools)
 */
export const unknownToolInputSchema = z.record(z.string(), z.unknown());

/**
 * Get schema for specific tool name
 */
export function getToolInputSchema(toolName: keyof typeof toolInputSchemas) {
	return toolInputSchemas[toolName];
}

/**
 * Validate tool input with specific schema
 */
export function validateToolInput<T extends keyof typeof toolInputSchemas>(
	toolName: T,
	input: unknown,
): (typeof toolInputSchemas)[T]["_output"] {
	const schema = toolInputSchemas[toolName];
	return schema.parse(input);
}

/**
 * Safe validation that returns results instead of throwing
 */
export function safeValidateToolInput<T extends keyof typeof toolInputSchemas>(
	toolName: T,
	input: unknown,
): z.SafeParseReturnType<unknown, (typeof toolInputSchemas)[T]["_output"]> {
	const schema = toolInputSchemas[toolName];
	return schema.safeParse(input);
}
