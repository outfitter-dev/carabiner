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
  NotificationHookInput,
  PostToolUseHookInput,
  PreCompactHookInput,
  PreToolUseHookInput,
  SessionEndHookInput,
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

export type HookProviderId = LiteralUnion<"claude", string>;

export type HookProviderMetadata = {
  readonly id: HookProviderId;
  readonly name: string;
  readonly displayName?: string;
  readonly version: string;
  readonly runtime: string;
  readonly supports: {
    readonly events: readonly HookEvent[];
    readonly tools?: readonly ToolName[];
    readonly capabilities?: readonly string[];
  };
  readonly links?: {
    readonly homepage?: string;
    readonly docs?: string;
  };
};

export type NormalizedToolContext = {
  readonly name?: ToolName;
  readonly input?: ToolInput | Record<string, unknown>;
  readonly response?: unknown;
};

export type NormalizedHookContext<TProviderInput = unknown> = {
  readonly event: HookEvent;
  readonly sessionId: string;
  readonly cwd: string;
  readonly transcriptPath?: string;
  readonly userPrompt?: string;
  readonly environment: HookEnvironment;
  readonly tool?: NormalizedToolContext;
  readonly raw: TProviderInput;
  readonly metadata: {
    readonly provider: HookProviderMetadata;
    readonly receivedAt: string;
  };
};

type MaybePromise<T> = T | Promise<T>;

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
> = NormalizedHookContext<TInput> & {
  readonly tool?: NormalizedToolContext;
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
 * Hook execution result - aligned with SDK output types
 */
export type HookMetadata = {
  duration?: number;
  timestamp?: string;
  hookVersion?: string;
  provider?: HookProviderMetadata;
};

type LegacyHookResultCompat = {
  /** @deprecated use continue */
  success?: boolean;
  /** @deprecated use systemMessage */
  message?: string;
  /** @deprecated use stopReason === "blocked" */
  block?: boolean;
  /** @deprecated provide structured metadata instead */
  data?: Record<string, unknown>;
};

export type HookResult = HookJSONOutput & {
  metadata?: HookMetadata;
  providerState?: Record<string, unknown>;
} & LegacyHookResultCompat;

export type NormalizedHookResult = HookResult;

export type HookProviderAdapter<
  TProviderInput = unknown,
  TProviderOutput = HookJSONOutput,
> = {
  readonly id: HookProviderId;
  readonly metadata: HookProviderMetadata;
  fromProviderInput(
    input: TProviderInput,
    environment?: HookEnvironment
  ): NormalizedHookContext<TProviderInput>;
  toProviderOutput(
    result: NormalizedHookResult,
    context: NormalizedHookContext<TProviderInput>
  ): TProviderOutput;
};

/**
 * Hook handler function signature using SDK types
 */
export type HookHandler<TContext extends HookContext = HookContext> = (
  context: TContext,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => MaybePromise<HookResult>;

/**
 * Typed hook handler for specific event types
 */
export type TypedHookHandler<TContext extends HookContext> =
  HookHandler<TContext>;

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
  providerId?: HookProviderId;
  provider?: HookProviderAdapter<HookInput, HookJSONOutput>;
};

/**
 * Hook registry entry
 */
export type HookRegistryEntry<TContext extends HookContext = HookContext> = {
  event: HookEvent;
  handler: HookHandler<TContext>;
  priority?: number;
  enabled?: boolean;
  matcher?: string; // Pattern matching for specific tools/conditions
};

/**
 * Utility types for hook composition
 */
export type HookMiddleware<TContext extends HookContext = HookContext> = (
  context: TContext,
  toolUseID: string | undefined,
  next: HookHandler<TContext>
) => MaybePromise<HookResult>;

export type ConditionalHook<TContext extends HookContext = HookContext> = {
  condition: (context: TContext) => boolean | Promise<boolean>;
  handler: HookHandler<TContext>;
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
export type HookBuilder<TContext extends HookContext = HookContext> = {
  forEvent<E extends HookEvent>(event: E): HookBuilder<TContext>;
  withMatcher(matcher: string): HookBuilder<TContext>;
  withHandler(handler: HookHandler<TContext>): HookBuilder<TContext>;
  withTimeout(timeout: number): HookBuilder<TContext>;
  withCondition(
    condition: (context: TContext) => boolean | Promise<boolean>
  ): HookBuilder<TContext>;
  build(): HookRegistryEntry<TContext>;
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

export function isSessionEndInput(
  input: HookInput
): input is SessionEndHookInput {
  return input.hook_event_name === "SessionEnd";
}

export function isPreCompactInput(
  input: HookInput
): input is PreCompactHookInput {
  return input.hook_event_name === "PreCompact";
}

export function isNotificationInput(
  input: HookInput
): input is NotificationHookInput {
  return input.hook_event_name === "Notification";
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
