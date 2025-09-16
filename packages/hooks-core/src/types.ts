/**
 * Core types for Claude Code hooks
 * Built on top of @anthropic-ai/claude-code SDK for full type safety
 */

import type { LiteralUnion, Simplify } from "type-fest";

// Re-export all Claude Code SDK types for convenience
export type {
  AsyncHookJSONOutput,
  // Specific hook input types
  BaseHookInput,
  CanUseTool,
  HookCallback,
  HookCallbackMatcher,
  // Hook types
  HookEvent,
  HookInput,
  HookJSONOutput,
  NotificationHookInput,
  Options,
  PermissionBehavior,
  // Other SDK types
  PermissionResult,
  PostToolUseHookInput,
  PreCompactHookInput,
  PreToolUseHookInput,
  Query,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
  SessionEndHookInput,
  SessionStartHookInput,
  StopHookInput,
  SubagentStopHookInput,
  SyncHookJSONOutput,
  UserPromptSubmitHookInput,
} from "@anthropic-ai/claude-code";

// Re-export tool types from sdk-tools
export type {
  AgentInput,
  BashInput,
  BashOutputInput,
  ExitPlanModeInput,
  FileEditInput,
  FileMultiEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  KillShellInput,
  ListMcpResourcesInput,
  McpInput,
  NotebookEditInput,
  ReadMcpResourceInput,
  TodoWriteInput,
  ToolInputSchemas,
  WebFetchInput,
  WebSearchInput,
} from "@anthropic-ai/claude-code/sdk-tools";

import type {
  HookEvent,
  HookInput,
  HookJSONOutput,
  PostToolUseHookInput,
  PreToolUseHookInput,
  SessionStartHookInput,
  StopHookInput,
  SubagentStopHookInput,
  UserPromptSubmitHookInput,
} from "@anthropic-ai/claude-code";

import type {
  BashInput,
  FileEditInput,
  FileMultiEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  NotebookEditInput,
  TodoWriteInput,
  WebFetchInput,
  WebSearchInput,
} from "@anthropic-ai/claude-code/sdk-tools";

/**
 * JSON parsing result for stdin input
 */
export type ParsedStdinInput<T = HookInput> = {
  success: true;
  data: T;
};

export type ParsedStdinError = {
  success: false;
  error: string;
  rawInput?: string;
};

export type StdinParseResult<T = HookInput> =
  | ParsedStdinInput<T>
  | ParsedStdinError;

/**
 * Known tool names from Claude Code
 * Uses LiteralUnion to provide autocomplete while allowing custom tools
 */
export type ToolName = LiteralUnion<
  | "Agent"
  | "Bash"
  | "BashOutput"
  | "Edit"
  | "MultiEdit"
  | "Write"
  | "Read"
  | "Glob"
  | "Grep"
  | "KillShell"
  | "NotebookEdit"
  | "TodoWrite"
  | "WebFetch"
  | "WebSearch"
  | "ExitPlanMode"
  | "ListMcpResources"
  | "ReadMcpResource",
  string
>;

/**
 * Environment variables provided by Claude Code runtime
 * Only CLAUDE_PROJECT_DIR is actually provided according to docs
 */
export type HookEnvironment = {
  readonly CLAUDE_PROJECT_DIR?: string;
};

/**
 * Strict mapping of tool names to their input types
 * Uses SDK types directly
 */
export type ToolInputMap = {
  Bash: BashInput;
  Edit: FileEditInput;
  MultiEdit: FileMultiEditInput;
  Write: FileWriteInput;
  Read: FileReadInput;
  Glob: GlobInput;
  Grep: GrepInput;
  TodoWrite: TodoWriteInput;
  WebFetch: WebFetchInput;
  WebSearch: WebSearchInput;
  NotebookEdit: NotebookEditInput;
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
 * Hook execution context - enhanced wrapper around SDK types
 */
export type HookContext<
  TInput extends HookInput = HookInput,
  TTool extends ToolName = ToolName,
> = {
  readonly event: TInput["hook_event_name"];
  readonly sessionId: TInput extends { session_id: string }
    ? TInput["session_id"]
    : string;
  readonly transcriptPath: TInput extends { transcript_path: string }
    ? TInput["transcript_path"]
    : string;
  readonly cwd: TInput extends { cwd: string } ? TInput["cwd"] : string;
  readonly toolName?: TInput extends PreToolUseHookInput | PostToolUseHookInput
    ? TTool
    : undefined;
  readonly toolInput?: TInput extends PreToolUseHookInput | PostToolUseHookInput
    ? GetToolInput<TTool>
    : undefined;
  readonly toolResponse?: TInput extends PostToolUseHookInput
    ? TInput["tool_response"]
    : undefined;
  readonly userPrompt?: TInput extends UserPromptSubmitHookInput
    ? TInput["prompt"]
    : undefined;
  readonly environment: HookEnvironment;
  readonly rawInput: TInput;
};

/**
 * Hook execution result - enhanced to support SDK output types
 */
export type HookResult = {
  success: boolean;
  output?: HookJSONOutput; // SDK output type
  message?: string;
  metadata?: {
    duration?: number;
    timestamp?: string;
    hookVersion?: string;
  };
};

/**
 * Hook handler function signature using SDK types
 */
export type HookHandler<TInput extends HookInput = HookInput> = (
  input: TInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;

/**
 * Typed hook handler for specific event types
 */
export type TypedHookHandler<TInput extends HookInput> = HookHandler<TInput>;

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
  SessionEnd?: ToolHookConfig;
  Stop?: ToolHookConfig;
  SubagentStop?: ToolHookConfig;
  PreCompact?: ToolHookConfig;
  Notification?: ToolHookConfig;
};

/**
 * Hook execution options
 */
export type HookExecutionOptions = {
  timeout?: number;
  throwOnError?: boolean;
  captureOutput?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
};

/**
 * Hook registry entry
 */
export type HookRegistryEntry<TInput extends HookInput = HookInput> = {
  event: HookEvent;
  handler: HookHandler<TInput>;
  priority?: number;
  enabled?: boolean;
  matcher?: string; // Pattern matching for specific tools/conditions
};

/**
 * Utility types for hook composition
 */
export type HookMiddleware<TInput extends HookInput = HookInput> = (
  input: TInput,
  toolUseID: string | undefined,
  next: HookHandler<TInput>
) => Promise<HookJSONOutput>;

export type ConditionalHook<TInput extends HookInput = HookInput> = {
  condition: (input: TInput) => boolean | Promise<boolean>;
  handler: HookHandler<TInput>;
};

/**
 * Error types for hook execution
 */
export class HookInputError extends Error {
  readonly rawInput?: string;
  readonly originalError?: Error;

  constructor(message: string, rawInput?: string, originalError?: Error) {
    super(message);
    this.name = "HookInputError";
    this.rawInput = rawInput;
    this.originalError = originalError;
  }
}

export class HookError extends Error {
  readonly input?: HookInput;
  readonly originalError?: Error;

  constructor(message: string, input?: HookInput, originalError?: Error) {
    super(message);
    this.name = "HookError";
    this.input = input;
    this.originalError = originalError;
  }
}

export class HookValidationError extends HookError {
  constructor(message: string, input?: HookInput) {
    super(message, input);
    this.name = "HookValidationError";
  }
}

export class HookTimeoutError extends HookError {
  constructor(timeout: number, input?: HookInput) {
    super(`Hook execution timed out after ${timeout}ms`, input);
    this.name = "HookTimeoutError";
  }
}

/**
 * Builder pattern types for fluent hook creation
 */
export type HookBuilder<TInput extends HookInput = HookInput> = {
  forEvent<E extends HookEvent>(event: E): HookBuilder;
  withMatcher(matcher: string): HookBuilder<TInput>;
  withHandler(handler: HookHandler<TInput>): HookBuilder<TInput>;
  withTimeout(timeout: number): HookBuilder<TInput>;
  withCondition(condition: (input: TInput) => boolean): HookBuilder<TInput>;
  build(): HookRegistryEntry<TInput>;
};

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
export function isPreToolUseInput(
  input: HookInput
): input is PreToolUseHookInput {
  return input.hook_event_name === "PreToolUse";
}

export function isPostToolUseInput(
  input: HookInput
): input is PostToolUseHookInput {
  return input.hook_event_name === "PostToolUse";
}

export function isUserPromptSubmitInput(
  input: HookInput
): input is UserPromptSubmitHookInput {
  return input.hook_event_name === "UserPromptSubmit";
}

export function isSessionStartInput(
  input: HookInput
): input is SessionStartHookInput {
  return input.hook_event_name === "SessionStart";
}

export function isStopInput(input: HookInput): input is StopHookInput {
  return input.hook_event_name === "Stop";
}

export function isSubagentStopInput(
  input: HookInput
): input is SubagentStopHookInput {
  return input.hook_event_name === "SubagentStop";
}

/**
 * Utility type for creating simplified hook results
 */
export type SimpleHookOutput = Simplify<{
  continue?: boolean;
  suppressOutput?: boolean;
  systemMessage?: string;
}>;

/**
 * Helper type for async hook outputs
 */
export type AsyncHookOutput = {
  async: true;
  asyncTimeout?: number;
};
