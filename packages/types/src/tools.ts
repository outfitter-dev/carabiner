/**
 * Tool input types for Claude Code tools
 * Concrete types instead of complex generic mappings
 */

import type { CommandString, FilePath } from './brands.js';

/**
 * Tool input types with strict definitions
 */
export interface BashToolInput {
  readonly command: string;
  readonly description?: string;
  readonly timeout?: number;
}

export interface WriteToolInput {
  readonly file_path: string;
  readonly content: string;
}

export interface EditToolInput {
  readonly file_path: string;
  readonly old_string: string;
  readonly new_string: string;
  readonly replace_all?: boolean;
}

export interface MultiEditInput {
  readonly file_path: string;
  readonly edits: readonly {
    readonly old_string: string;
    readonly new_string: string;
    readonly replace_all?: boolean;
  }[];
}

export interface ReadToolInput {
  readonly file_path: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GlobToolInput {
  readonly pattern: string;
  readonly path?: string;
}

export interface GrepToolInput {
  readonly pattern: string;
  readonly path?: string;
  readonly glob?: string;
  readonly output_mode?: 'content' | 'files_with_matches' | 'count';
  readonly head_limit?: number;
  readonly multiline?: boolean;
}

export interface LSToolInput {
  readonly path: string;
  readonly ignore?: readonly string[];
}

export interface TodoWriteToolInput {
  readonly todos: readonly {
    readonly content: string;
    readonly status: 'pending' | 'in_progress' | 'completed';
    readonly id: string;
  }[];
}

export interface WebFetchToolInput {
  readonly url: string;
  readonly prompt: string;
}

export interface WebSearchToolInput {
  readonly query: string;
  readonly allowed_domains?: readonly string[];
  readonly blocked_domains?: readonly string[];
}

export interface NotebookEditToolInput {
  readonly notebook_path: string;
  readonly new_source: string;
  readonly cell_id?: string;
  readonly cell_type?: 'code' | 'markdown';
  readonly edit_mode?: 'replace' | 'insert' | 'delete';
}

/**
 * Strict mapping of tool names to their input types
 */
export interface ToolInputMap {
  Bash: BashToolInput;
  Edit: EditToolInput;
  MultiEdit: MultiEditInput;
  Write: WriteToolInput;
  Read: ReadToolInput;
  Glob: GlobToolInput;
  Grep: GrepToolInput;
  LS: LSToolInput;
  TodoWrite: TodoWriteToolInput;
  WebFetch: WebFetchToolInput;
  WebSearch: WebSearchToolInput;
  NotebookEdit: NotebookEditToolInput;
}

/**
 * Union of all possible tool inputs
 */
export type ToolInput = ToolInputMap[keyof ToolInputMap];

/**
 * Generic tool input type (fallback for unknown tools)
 */
export type UnknownToolInput = Record<string, unknown>;

/**
 * Get input type for a specific tool name
 * Simplified version without complex conditional types
 */
export type GetToolInput<T extends keyof ToolInputMap> = ToolInputMap[T];

/**
 * Branded versions of common tool inputs for better type safety
 */
export interface BrandedBashToolInput {
  readonly command: CommandString;
  readonly description?: string;
  readonly timeout?: number;
}

export interface BrandedFileToolInput {
  readonly file_path: FilePath;
  readonly content?: string;
  readonly old_string?: string;
  readonly new_string?: string;
  readonly replace_all?: boolean;
}

/**
 * Type guards for tool inputs
 */
export function isBashToolInput(input: unknown): input is BashToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'command' in input &&
    typeof (input as BashToolInput).command === 'string'
  );
}

export function isWriteToolInput(input: unknown): input is WriteToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'content' in input &&
    typeof (input as WriteToolInput).file_path === 'string' &&
    typeof (input as WriteToolInput).content === 'string'
  );
}

export function isEditToolInput(input: unknown): input is EditToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'old_string' in input &&
    'new_string' in input &&
    typeof (input as EditToolInput).file_path === 'string' &&
    typeof (input as EditToolInput).old_string === 'string' &&
    typeof (input as EditToolInput).new_string === 'string'
  );
}

export function isReadToolInput(input: unknown): input is ReadToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    typeof (input as ReadToolInput).file_path === 'string'
  );
}

export function isMultiEditToolInput(input: unknown): input is MultiEditInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'edits' in input &&
    typeof (input as MultiEditInput).file_path === 'string' &&
    Array.isArray((input as MultiEditInput).edits)
  );
}

export function isGlobToolInput(input: unknown): input is GlobToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'pattern' in input &&
    typeof (input as GlobToolInput).pattern === 'string'
  );
}

export function isGrepToolInput(input: unknown): input is GrepToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'pattern' in input &&
    typeof (input as GrepToolInput).pattern === 'string'
  );
}

export function isLSToolInput(input: unknown): input is LSToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'path' in input &&
    typeof (input as LSToolInput).path === 'string'
  );
}

export function isTodoWriteToolInput(
  input: unknown
): input is TodoWriteToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'todos' in input &&
    Array.isArray((input as TodoWriteToolInput).todos)
  );
}

export function isWebFetchToolInput(
  input: unknown
): input is WebFetchToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'url' in input &&
    'prompt' in input &&
    typeof (input as WebFetchToolInput).url === 'string' &&
    typeof (input as WebFetchToolInput).prompt === 'string'
  );
}

export function isWebSearchToolInput(
  input: unknown
): input is WebSearchToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'query' in input &&
    typeof (input as WebSearchToolInput).query === 'string'
  );
}

export function isNotebookEditToolInput(
  input: unknown
): input is NotebookEditToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'notebook_path' in input &&
    'new_source' in input &&
    typeof (input as NotebookEditToolInput).notebook_path === 'string' &&
    typeof (input as NotebookEditToolInput).new_source === 'string'
  );
}
