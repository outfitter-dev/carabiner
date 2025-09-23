/**
 * Runtime utilities for Claude Code hooks
 * Handles stdin JSON parsing, context creation, and hook execution
 * Updated to match the actual Claude Code hooks API
 */

import * as path from "node:path";
import { runtimeLogger } from "./logger";
import { stdout } from "./logging/stdio";
import {
  getDefaultHookProvider,
  type HookProviderAdapter,
  type HookProviderId,
  type NormalizedHookContext,
  requireHookProvider,
} from "./providers";
import type {
  GetToolInput,
  HookContext,
  HookEnvironment,
  HookEvent,
  HookExecutionOptions,
  HookHandler,
  HookInput,
  HookJSONOutput,
  HookMetadata,
  HookResult,
  PreToolUseHookInput,
  StdinParseResult,
  ToolInput,
  ToolInputMap,
  ToolName,
} from "./types";
import { HookError, HookInputError, HookTimeoutError } from "./types";

type ClaudeProviderAdapter = HookProviderAdapter<HookInput, HookJSONOutput>;

type CreateHookContextOptions = {
  environment?: HookEnvironment;
  providerId?: HookProviderId;
  provider?: ClaudeProviderAdapter;
};

function resolveProvider(
  options: HookExecutionOptions = {}
): ClaudeProviderAdapter {
  if (options.provider) {
    return options.provider;
  }

  if (options.providerId) {
    return requireHookProvider(options.providerId) as ClaudeProviderAdapter;
  }

  const provider = getDefaultHookProvider();
  if (!provider) {
    throw new Error(
      "No hook provider is registered. Ensure registerDefaultHookProviders() has executed."
    );
  }
  return provider as ClaudeProviderAdapter;
}

function ensureHookInput(
  inputOrEvent: HookInput | HookEvent,
  environment: HookEnvironment
): HookInput {
  if (typeof inputOrEvent !== "string") {
    return inputOrEvent;
  }

  const event = inputOrEvent;
  const base = {
    hook_event_name: event,
    session_id: process.env.CLAUDE_SESSION_ID ?? "local-session",
    transcript_path:
      process.env.CLAUDE_TRANSCRIPT_PATH ?? "./claude-transcript.md",
    cwd: environment.CLAUDE_PROJECT_DIR ?? process.cwd(),
  } as HookInput;

  if (event === "PreToolUse" || event === "PostToolUse") {
    const toolName = process.env.CLAUDE_TOOL_NAME ?? "Unknown";
    const toolInputRaw = process.env.TOOL_INPUT;
    const toolResponseRaw = process.env.TOOL_OUTPUT;

    (base as any).tool_name = toolName;

    if (toolInputRaw) {
      try {
        (base as any).tool_input = JSON.parse(toolInputRaw);
      } catch {
        runtimeLogger.warn("Failed to parse TOOL_INPUT from environment");
      }
    }

    if (event === "PostToolUse" && toolResponseRaw) {
      try {
        (base as any).tool_response = JSON.parse(toolResponseRaw);
      } catch {
        runtimeLogger.warn("Failed to parse TOOL_OUTPUT from environment");
      }
    }
  }

  if (event === "UserPromptSubmit") {
    (base as any).prompt = process.env.USER_PROMPT ?? "";
  }

  return base;
}

function toHookContext(
  normalized: NormalizedHookContext<HookInput>
): HookContext {
  const tool = normalized.tool;
  const toolName = tool?.name as ToolName | undefined;
  const toolInput = tool?.input as GetToolInput<ToolName> | undefined;

  return {
    ...normalized,
    tool,
    toolName,
    toolInput,
    toolResponse: tool?.response,
    rawInput: normalized.raw,
  } satisfies HookContext;
}

// Note: These type guards are kept for potential future use
// function isPreToolUse(input: HookInput): input is PreToolUseHookInput {
//   return input.hook_event_name === "PreToolUse";
// }
// function isUserPromptSubmit(input: HookInput): input is UserPromptSubmitHookInput {
//   return input.hook_event_name === "UserPromptSubmit";
// }
// function isNotification(input: HookInput): input is NotificationHookInput {
//   return input.hook_event_name === "Notification";
// }
import { getEnvVar } from "./utils/env";

/**
 * Parse JSON input from stdin
 * Enhanced with security validation
 */
export async function parseStdinInput(): Promise<StdinParseResult<HookInput>> {
  try {
    // Read from stdin with size limits for security
    const MAX_INPUT_SIZE = 1024 * 1024; // 1MB limit
    const isBun = typeof (globalThis as any).Bun?.stdin?.bytes === "function";
    let inputBytes: Uint8Array;
    if (isBun) {
      inputBytes = await (globalThis as any).Bun.stdin.bytes();
    } else {
      inputBytes = await (async function readNodeStdin(max: number) {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of process.stdin) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buf.length;
          if (total > max) {
            break;
          }
          chunks.push(buf);
        }
        return new Uint8Array(Buffer.concat(chunks));
      })(MAX_INPUT_SIZE);
    }

    if (inputBytes.length > MAX_INPUT_SIZE) {
      return {
        success: false,
        error: `Input exceeds maximum size limit (${MAX_INPUT_SIZE} bytes)`,
        rawInput: "[INPUT TOO LARGE]",
      };
    }

    const decoder = new TextDecoder();
    const input = decoder.decode(inputBytes);

    if (!input.trim()) {
      return {
        success: false,
        error: "No input received from stdin",
        rawInput: input,
      };
    }

    // Security: strip dangerous control chars but allow TAB/LF/CR for JSON formatting
    const sanitizedInput = input
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control characters for sanitization
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();

    // Parse JSON with additional validation
    const parsedData = JSON.parse(sanitizedInput) as HookInput;

    // Basic validation
    if (
      !(parsedData.session_id && parsedData.hook_event_name && parsedData.cwd)
    ) {
      return {
        success: false,
        error:
          "Invalid input: missing required fields (session_id, hook_event_name, cwd)",
        rawInput: input,
      };
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown parsing error",
    };
  }
}

/**
 * Parse hook environment variables (only CLAUDE_PROJECT_DIR is provided)
 * Enhanced with security sanitization
 */
export function parseHookEnvironment(): HookEnvironment {
  const claudeProjectDir = getEnvVar("CLAUDE_PROJECT_DIR");

  // Security: Validate CLAUDE_PROJECT_DIR path
  if (claudeProjectDir) {
    // Remove any null bytes or control characters
    const controlChars = Array.from(new Array(32).keys())
      .map((i) => String.fromCharCode(i))
      .join("");
    const extendedControlChars = Array.from(new Array(32).keys())
      .map((i) => String.fromCharCode(i + 127))
      .join("");
    const sanitized = claudeProjectDir
      .split("")
      .filter(
        (c) => !(controlChars.includes(c) || extendedControlChars.includes(c))
      )
      .join("");

    // Ensure it's an absolute path and not a path traversal
    const normalized = path.normalize(sanitized);
    if (!path.isAbsolute(normalized) || normalized.includes("..")) {
      throw new HookInputError(
        "Invalid CLAUDE_PROJECT_DIR environment variable",
        claudeProjectDir
      );
    }

    return { CLAUDE_PROJECT_DIR: normalized };
  }

  return { CLAUDE_PROJECT_DIR: undefined };
}

/**
 * Validate tool input against known schemas
 */
export function parseToolInput<T extends ToolName>(
  _toolName: T,
  toolInput: Record<string, unknown>
): GetToolInput<T> {
  // Type-safe parsing would go here
  // For now, we'll trust the input structure from Claude
  return toolInput as GetToolInput<T>;
}

/**
 * Create hook context from Claude Code JSON input
 */
export function createHookContext<T extends HookInput = HookInput>(
  providerInput: T,
  overrides?: Partial<T>,
  options?: CreateHookContextOptions
): HookContext<T>;
export function createHookContext<E extends HookEvent = HookEvent>(
  providerInput: E,
  overrides?: Partial<HookInput>,
  options?: CreateHookContextOptions
): HookContext;
export function createHookContext(
  providerInput: HookInput | HookEvent,
  overrides?: Partial<HookInput>,
  options: CreateHookContextOptions = {}
): HookContext {
  const provider = resolveProvider({
    provider: options.provider,
    providerId: options.providerId,
  });

  const environment = options.environment ?? parseHookEnvironment();
  const baseInput = ensureHookInput(providerInput, environment);
  const mergedInput = overrides
    ? ({ ...baseInput, ...overrides } as HookInput)
    : baseInput;

  const normalized = provider.fromProviderInput(mergedInput, environment);
  return toHookContext(normalized);
}

/**
 * Type guards for tool input validation
 */
export function isBashToolInput(
  input: ToolInput
): input is ToolInputMap["Bash"] {
  return typeof input === "object" && input !== null && "command" in input;
}

export function isWriteToolInput(
  input: ToolInput
): input is ToolInputMap["Write"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "file_path" in input &&
    "content" in input
  );
}

export function isEditToolInput(
  input: ToolInput
): input is ToolInputMap["Edit"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "file_path" in input &&
    "old_string" in input &&
    "new_string" in input
  );
}

export function isReadToolInput(
  input: ToolInput
): input is ToolInputMap["Read"] {
  return typeof input === "object" && input !== null && "file_path" in input;
}

export function isMultiEditToolInput(
  input: ToolInput
): input is ToolInputMap["MultiEdit"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "file_path" in input &&
    "edits" in input &&
    Array.isArray(input.edits)
  );
}

export function isGlobToolInput(
  input: ToolInput
): input is ToolInputMap["Glob"] {
  return typeof input === "object" && input !== null && "pattern" in input;
}

export function isGrepToolInput(
  input: ToolInput
): input is ToolInputMap["Grep"] {
  return typeof input === "object" && input !== null && "pattern" in input;
}

export function isTodoWriteToolInput(
  input: ToolInput
): input is ToolInputMap["TodoWrite"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "todos" in input &&
    Array.isArray(input.todos)
  );
}

export function isWebFetchToolInput(
  input: ToolInput
): input is ToolInputMap["WebFetch"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "url" in input &&
    "prompt" in input
  );
}

export function isWebSearchToolInput(
  input: ToolInput
): input is ToolInputMap["WebSearch"] {
  return typeof input === "object" && input !== null && "query" in input;
}

export function isNotebookEditToolInput(
  input: ToolInput
): input is ToolInputMap["NotebookEdit"] {
  return (
    typeof input === "object" &&
    input !== null &&
    "notebook_path" in input &&
    "new_source" in input
  );
}

/**
 * Execute hook with timeout and error handling
 */
export async function executeHook(
  handler: HookHandler,
  context: HookContext,
  options: HookExecutionOptions = {}
): Promise<HookResult> {
  const { timeout = 30_000, throwOnError = false } = options;
  const abortController = new AbortController();
  const execOptions = { signal: abortController.signal };
  const startedAt = Date.now();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abortController.abort();
      reject(new HookTimeoutError(timeout, context.rawInput));
    }, timeout);
  });

  try {
    const handlerPromise = Promise.resolve(
      handler(context, undefined, execOptions)
    );

    const result = await Promise.race<HookResult | HookJSONOutput>([
      handlerPromise,
      timeoutPromise,
    ]);

    const duration = Date.now() - startedAt;
    const metadata: HookMetadata = {
      duration,
      timestamp: new Date().toISOString(),
      provider: context.metadata.provider,
    };

    const normalized = result as HookResult;

    return {
      ...normalized,
      metadata: {
        ...metadata,
        ...(normalized.metadata ?? {}),
      },
    } satisfies HookResult;
  } catch (error) {
    if (error instanceof HookTimeoutError) {
      runtimeLogger.error(`Hook execution timed out after ${timeout}ms`, {
        timeout,
        context,
      });
    } else {
      runtimeLogger.error(
        `Hook execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { error, context }
      );
    }

    if (throwOnError) {
      throw error instanceof HookError
        ? error
        : new HookError(
            error instanceof Error ? error.message : "Unknown error",
            context.rawInput,
            error instanceof Error ? error : undefined
          );
    }

    const failureMetadata: HookMetadata = {
      duration: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      provider: context.metadata.provider,
    };

    return {
      continue: false,
      systemMessage:
        error instanceof Error
          ? error.message
          : "Unknown error during hook execution",
      metadata: failureMetadata,
    } satisfies HookResult;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Output hook result to Claude Code - JSON output only
 */
export function outputHookResult(
  result: HookJSONOutput,
  exitHandler: (code: number) => never = (code) => process.exit(code)
): never {
  stdout.json(result);
  return exitHandler(0);
}

/**
 * Main hook execution function - reads from stdin, executes hook, outputs result
 */
export async function runClaudeHook(
  handler: HookHandler,
  options: HookExecutionOptions = {}
): Promise<never> {
  let provider: ClaudeProviderAdapter | undefined;
  let normalizedContext: NormalizedHookContext<HookInput> | null = null;

  try {
    const resolvedProvider = resolveProvider(options);
    provider = resolvedProvider;

    const parseResult = await parseStdinInput();

    if (!parseResult.success) {
      throw new HookInputError(
        parseResult.error,
        "rawInput" in parseResult ? parseResult.rawInput : undefined
      );
    }

    const environment = parseHookEnvironment();
    normalizedContext = resolvedProvider.fromProviderInput(
      parseResult.data,
      environment
    );

    const context = toHookContext(normalizedContext);

    validateHookInput(context.rawInput);

    const result = await executeHook(handler, context, options);
    const providerResult = resolvedProvider.toProviderOutput(
      result,
      normalizedContext
    );

    outputHookResult(providerResult);
  } catch (error) {
    const systemMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during hook execution";
    const failure: HookResult = {
      continue: false,
      systemMessage,
      success: false,
      message: systemMessage,
      metadata: {
        timestamp: new Date().toISOString(),
        ...(provider ? { provider: provider.metadata } : {}),
      },
    };

    if (normalizedContext && provider) {
      const providerResult = provider.toProviderOutput(
        failure,
        normalizedContext
      );
      outputHookResult(providerResult);
    } else {
      outputHookResult(failure);
    }
  }
}

/**
 * Environment detection utilities
 */
export function isClaudeCodeEnvironment(): boolean {
  return Boolean(getEnvVar("CLAUDE_PROJECT_DIR"));
}

export function getSessionInfo(): { projectDir?: string } {
  return {
    projectDir: getEnvVar("CLAUDE_PROJECT_DIR"),
  };
}

/**
 * Hook result builders for common scenarios
 */
export const HookResults = {
  success(systemMessage?: string): HookResult {
    return {
      continue: true,
      systemMessage,
      success: true,
      message: systemMessage,
    };
  },
  failure(systemMessage: string): HookResult {
    return {
      continue: false,
      systemMessage,
      success: false,
      message: systemMessage,
    };
  },
  block(systemMessage: string, suppressOutput = false): HookResult {
    return {
      continue: false,
      systemMessage,
      stopReason: "blocked",
      ...(suppressOutput && { suppressOutput }),
      success: false,
      message: systemMessage,
      block: true,
    };
  },
  skip(systemMessage?: string): HookResult {
    return {
      continue: true,
      systemMessage: systemMessage || "Hook skipped",
      success: true,
      message: systemMessage || "Hook skipped",
    };
  },
  warn(systemMessage: string): HookResult {
    return {
      continue: true,
      systemMessage,
      success: true,
      message: systemMessage,
    };
  },
};

/**
 * Utility for safe hook execution with error boundaries
 */
export async function safeHookExecution(
  handler: HookHandler,
  context: HookContext,
  fallback?: () => HookResult
): Promise<HookResult> {
  const abortController = new AbortController();
  const startedAt = Date.now();
  try {
    const result = await Promise.resolve(
      handler(context, undefined, { signal: abortController.signal })
    );

    const normalized = result as HookResult;
    const metadata: HookMetadata = {
      provider: context.metadata.provider,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startedAt,
      ...(normalized.metadata ?? {}),
    };
    return {
      ...normalized,
      metadata,
    } satisfies HookResult;
  } catch (error) {
    if (fallback) {
      const fallbackResult = await Promise.resolve(fallback());
      const metadata: HookMetadata = {
        provider: context.metadata.provider,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startedAt,
        ...(fallbackResult.metadata ?? {}),
      };
      return {
        ...fallbackResult,
        metadata,
      } satisfies HookResult;
    }

    const failure = HookResults.failure(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
    const metadata: HookMetadata = {
      provider: context.metadata.provider,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startedAt,
      ...(failure.metadata ?? {}),
    };
    return {
      ...failure,
      metadata,
    } satisfies HookResult;
  } finally {
    abortController.abort();
  }
}

/**
 * Input validation utilities
 */
export function validateHookInput(input: HookInput): void {
  if (!input.session_id) {
    throw new HookError("Invalid hook input: missing session ID", input);
  }
  if (!input.cwd) {
    throw new HookError("Invalid hook input: missing cwd", input);
  }
  if (!input.hook_event_name) {
    throw new HookError("Invalid hook input: missing hook_event_name", input);
  }
}

/**
 * Input creation helpers for testing
 */
export function createBashInput(
  hookEvent: "PreToolUse" | "PostToolUse",
  command?: string
): HookInput {
  if (hookEvent === "PreToolUse") {
    const mockInput: PreToolUseHookInput = {
      session_id: "test-session",
      transcript_path: "/tmp/transcript.md",
      cwd: process.cwd(),
      hook_event_name: hookEvent,
      tool_name: "Bash",
      tool_input: { command: command || "echo test" },
    };
    return mockInput;
  }
  // PostToolUse case
  const mockInput = {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.md",
    cwd: process.cwd(),
    hook_event_name: hookEvent,
    tool_name: "Bash",
    tool_input: { command: command || "echo test" },
    tool_response: "command executed",
  };
  return mockInput as HookInput;
}

export function createFileInput(
  hookEvent: "PreToolUse" | "PostToolUse",
  toolName: "Write" | "Edit" | "Read",
  filePath?: string
): HookInput {
  const mockInput = {
    session_id: "test-session",
    transcript_path: "/tmp/transcript.md",
    cwd: process.cwd(),
    hook_event_name: hookEvent,
    tool_name: toolName,
    tool_input: { file_path: filePath || "/tmp/test.txt" },
  };
  return mockInput as HookInput;
}

// Back-compat aliases (if anything still imports old names)
export {
  createBashInput as createBashContext,
  createFileInput as createFileContext,
};

// HookLogger is now exported from logger.ts with proper pino implementation
export { HookLogger } from "./logger";
