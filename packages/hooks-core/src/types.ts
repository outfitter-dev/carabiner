/**
 * Core types for Claude Code hooks
 * Provides comprehensive type safety for hook development
 */

import type { LiteralUnion, Simplify } from 'type-fest';

/**
 * JSON parsing result for stdin input
 */
export type ParsedStdinInput<T = unknown> = {
  success: true;
  data: T;
};

export type ParsedStdinError = {
  success: false;
  error: string;
  rawInput?: string;
};

export type StdinParseResult<T = unknown> =
  | ParsedStdinInput<T>
  | ParsedStdinError;

/**
 * Hook events supported by Claude Code
 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'Stop'
  | 'SubagentStop';

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
 * Base input structure received from Claude Code via stdin
 * All hooks receive this minimal structure, with event-specific additions
 */
export type ClaudeHookInput = {
  readonly session_id: string;
  readonly transcript_path: string;
  readonly cwd: string;
  readonly hook_event_name: HookEvent;
  readonly matcher?: string; // What triggered this hook
};

/**
 * Extended input for PreToolUse and PostToolUse hooks
 */
export type ClaudeToolHookInput = ClaudeHookInput & {
  readonly hook_event_name: 'PreToolUse' | 'PostToolUse';
  readonly tool_name: ToolName;
  readonly tool_input: Record<string, unknown>;
  readonly tool_response?: Record<string, unknown>; // PostToolUse only
};

/**
 * Extended input for UserPromptSubmit hooks
 */
export type ClaudeUserPromptInput = ClaudeHookInput & {
  readonly hook_event_name: 'UserPromptSubmit';
  readonly prompt: string;
};

/**
 * Extended input for notification events
 */
export type ClaudeNotificationInput = ClaudeHookInput & {
  readonly hook_event_name: 'SessionStart' | 'Stop' | 'SubagentStop';
  readonly message?: string;
};

/**
 * Union of all possible Claude hook input types
 */
export type ClaudeHookInputVariant =
  | ClaudeToolHookInput
  | ClaudeUserPromptInput
  | ClaudeNotificationInput;

/**
 * Environment variables provided by Claude Code runtime
 * Only CLAUDE_PROJECT_DIR is actually provided according to docs
 */
export type HookEnvironment = {
  readonly CLAUDE_PROJECT_DIR?: string;
};

/**
 * Tool input type definitions with strict mapping
 */
export type BashToolInput = {
  command: string;
  description?: string;
  timeout?: number;
};

export type WriteToolInput = {
  file_path: string;
  content: string;
};

export type EditToolInput = {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
};

export type MultiEditInput = {
  file_path: string;
  edits: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;
};

export type ReadToolInput = {
  file_path: string;
  limit?: number;
  offset?: number;
};

export type GlobToolInput = {
  pattern: string;
  path?: string;
};

export type GrepToolInput = {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  head_limit?: number;
  multiline?: boolean;
};

export type LSToolInput = {
  path: string;
  ignore?: string[];
};

export type TodoWriteToolInput = {
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    id: string;
  }>;
};

export type WebFetchToolInput = {
  url: string;
  prompt: string;
};

export type WebSearchToolInput = {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
};

export type NotebookEditToolInput = {
  notebook_path: string;
  new_source: string;
  cell_id?: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: 'replace' | 'insert' | 'delete';
};

/**
 * Strict mapping of tool names to their input types
 * Provides compile-time safety for tool-specific logic
 */
export type ToolInputMap = {
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
};

/**
 * Generic tool input type (fallback for unknown tools)
 */
export type UnknownToolInput = Record<string, unknown>;

/**
 * Union of all possible tool inputs
 */
export type ToolInput = ToolInputMap[keyof ToolInputMap] | UnknownToolInput;

/**
 * Get input type for a specific tool name
 */
export type GetToolInput<T extends ToolName> = T extends keyof ToolInputMap
  ? ToolInputMap[T]
  : UnknownToolInput;

/**
 * Hook execution context - updated to match actual Claude Code input structure
 */
export type HookContext<
  TEvent extends HookEvent = HookEvent,
  TTool extends ToolName = ToolName,
> = {
  readonly event: TEvent;
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly cwd: string;
  readonly matcher?: string;
  readonly toolName?: TTool; // Optional for non-tool events
  readonly toolInput?: GetToolInput<TTool>; // Optional for non-tool events
  readonly toolResponse?: Record<string, unknown>; // For PostToolUse
  readonly userPrompt?: string; // For UserPromptSubmit
  readonly message?: string; // For notification events
  readonly environment: HookEnvironment;
  readonly rawInput: ClaudeHookInputVariant; // Access to original input
};

/**
 * Hook execution result - supports both exit codes and JSON output
 */
export type HookResult = {
  success: boolean;
  message?: string;
  block?: boolean; // For PreToolUse hooks - true blocks tool execution
  data?: Record<string, unknown>;
  metadata?: {
    duration?: number;
    timestamp?: string;
    hookVersion?: string;
  };
};

/**
 * Structured JSON output for advanced hook control
 * Alternative to simple exit codes
 */
export type ClaudeHookOutput = {
  action: 'continue' | 'block';
  message?: string;
  data?: Record<string, unknown>;
};

/**
 * Hook output mode - determines how results are returned to Claude
 */
export type HookOutputMode = 'exit-code' | 'json';

/**
 * Hook handler function signature
 */
export type HookHandler<
  TEvent extends HookEvent = HookEvent,
  TTool extends ToolName = ToolName,
> = (context: HookContext<TEvent, TTool>) => Promise<HookResult> | HookResult;

/**
 * Typed hook handler for specific event and tool combinations
 */
export type TypedHookHandler<
  TEvent extends HookEvent,
  TTool extends ToolName,
> = HookHandler<TEvent, TTool>;

/**
 * Hook configuration for a specific tool
 */
export type ToolHookConfig = {
  command: string;
  timeout?: number;
  enabled?: boolean;
  detached?: boolean;
};

/**
 * Complete hook configuration structure
 */
export type HookConfiguration = {
  PreToolUse?: Partial<Record<ToolName, ToolHookConfig>>;
  PostToolUse?: Partial<Record<ToolName, ToolHookConfig>>;
  UserPromptSubmit?: ToolHookConfig;
  SessionStart?: ToolHookConfig;
  Stop?: ToolHookConfig;
  SubagentStop?: ToolHookConfig;
};

/**
 * Hook execution options
 */
export type HookExecutionOptions = {
  timeout?: number;
  throwOnError?: boolean;
  captureOutput?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  outputMode?: HookOutputMode; // How to return results to Claude
};

/**
 * Hook registry entry
 */
export type HookRegistryEntry<TEvent extends HookEvent = HookEvent> = {
  event: TEvent;
  handler: HookHandler<TEvent>;
  priority?: number;
  enabled?: boolean;
  tool?: ToolName; // NEW: Optional tool targeting for scoped hooks
};

/**
 * Utility types for better developer experience
 */
export type UniversalHookEntry<TEvent extends HookEvent> =
  HookRegistryEntry<TEvent> & { tool?: undefined };
export type ToolSpecificHookEntry<TEvent extends HookEvent> =
  HookRegistryEntry<TEvent> & { tool: ToolName };

/**
 * Utility types for hook composition
 */
export type HookMiddleware<TContext = HookContext> = (
  context: TContext,
  next: (ctx: TContext) => Promise<HookResult>
) => Promise<HookResult>;

export type ConditionalHook<TContext = HookContext> = {
  condition: (context: TContext) => boolean | Promise<boolean>;
  handler: HookHandler;
};

/**
 * Error types for hook execution
 */
/**
 * Hook input parsing error - for malformed JSON or invalid structure
 */
export class HookInputError extends Error {
  readonly rawInput?: string;
  readonly originalError?: Error;

  constructor(message: string, rawInput?: string, originalError?: Error) {
    super(message);
    this.name = 'HookInputError';
    this.rawInput = rawInput;
    this.originalError = originalError;
  }
}

export class HookError extends Error {
  readonly context?: HookContext;
  readonly originalError?: Error;

  constructor(message: string, context?: HookContext, originalError?: Error) {
    super(message);
    this.name = 'HookError';
    this.context = context;
    this.originalError = originalError;
  }
}

export class HookValidationError extends HookError {
  constructor(message: string, context?: HookContext) {
    super(message, context);
    this.name = 'HookValidationError';
  }
}

export class HookTimeoutError extends HookError {
  constructor(timeout: number, context?: HookContext) {
    super(`Hook execution timed out after ${timeout}ms`, context);
    this.name = 'HookTimeoutError';
  }
}

/**
 * Builder pattern types for fluent hook creation
 */
export type HookBuilder<TEvent extends HookEvent = HookEvent> = {
  forEvent<E extends HookEvent>(event: E): HookBuilder<E>;
  forTool<T extends ToolName>(toolName: T): HookBuilder<TEvent>;
  withHandler<E extends TEvent>(handler: HookHandler<E>): HookBuilder<E>;
  withTimeout(timeout: number): HookBuilder<TEvent>;
  withCondition(
    condition: (context: HookContext<TEvent>) => boolean
  ): HookBuilder<TEvent>;
  build(): HookRegistryEntry<TEvent>;
};

/**
 * Simplified hook result for quick success/failure
 */
export type SimpleHookResult = Simplify<
  Pick<HookResult, 'success' | 'message' | 'block'>
>;

/**
 * Hook execution stats for monitoring
 */
export type HookExecutionStats = {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  blockedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: string;
};

/**
 * Type guards for Claude input validation
 */
export function isClaudeToolHookInput(
  input: ClaudeHookInputVariant
): input is ClaudeToolHookInput {
  return (
    (input.hook_event_name === 'PreToolUse' ||
      input.hook_event_name === 'PostToolUse') &&
    'tool_name' in input &&
    'tool_input' in input
  );
}

export function isClaudeUserPromptInput(
  input: ClaudeHookInputVariant
): input is ClaudeUserPromptInput {
  return input.hook_event_name === 'UserPromptSubmit' && 'prompt' in input;
}

export function isClaudeNotificationInput(
  input: ClaudeHookInputVariant
): input is ClaudeNotificationInput {
  return ['SessionStart', 'Stop', 'SubagentStop'].includes(
    input.hook_event_name
  );
}

/**
 * Utility type for event-specific context inference
 */
export type EventSpecificContext<TEvent extends HookEvent> = TEvent extends
  | 'PreToolUse'
  | 'PostToolUse'
  ? HookContext<TEvent, ToolName>
  : TEvent extends 'UserPromptSubmit'
    ? HookContext<TEvent, 'UserPromptSubmit'>
    : HookContext<TEvent, never>;
