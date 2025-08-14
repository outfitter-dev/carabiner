/**
 * Runtime utilities for Claude Code hooks
 * Handles stdin JSON parsing, context creation, and hook execution
 * Updated to match the actual Claude Code hooks API
 */

import { runtimeLogger } from './logger';
import type {
  ClaudeHookInputVariant,
  ClaudeHookOutput,
  ClaudeToolHookInput,
  GetToolInput,
  HookContext,
  HookEnvironment,
  HookEvent,
  HookExecutionOptions,
  HookHandler,
  HookOutputMode,
  HookResult,
  StdinParseResult,
  ToolInput,
  ToolInputMap,
  ToolName,
} from './types';
import {
  HookError,
  HookInputError,
  HookTimeoutError,
  isClaudeNotificationInput,
  isClaudeToolHookInput,
  isClaudeUserPromptInput,
} from './types';

/**
 * Parse JSON input from stdin
 */
export async function parseStdinInput(): Promise<
  StdinParseResult<ClaudeHookInputVariant>
> {
  try {
    // Read from stdin
    const decoder = new TextDecoder();
    const input = decoder.decode(await Bun.stdin.bytes());

    if (!input.trim()) {
      return {
        success: false,
        error: 'No input received from stdin',
        rawInput: input,
      };
    }

    // Parse JSON
    const parsedData = JSON.parse(input.trim()) as ClaudeHookInputVariant;

    // Basic validation
    if (
      !(parsedData.session_id && parsedData.hook_event_name && parsedData.cwd)
    ) {
      return {
        success: false,
        error:
          'Invalid input: missing required fields (session_id, hook_event_name, cwd)',
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
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

/**
 * Parse hook environment variables (only CLAUDE_PROJECT_DIR is provided)
 */
export function parseHookEnvironment(): HookEnvironment {
  return {
    CLAUDE_PROJECT_DIR: Bun.env.CLAUDE_PROJECT_DIR,
  };
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
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: clarity prioritized over splitting tiny branches
export function createHookContext<
  TEvent extends HookEvent,
  TTool extends ToolName = ToolName,
>(
  claudeInput: ClaudeHookInputVariant,
  overrides?: Partial<HookContext<TEvent, TTool>>
): HookContext<TEvent, TTool> {
  const env = parseHookEnvironment();

  // Base context shared by all hook types
  const baseContext = {
    event: claudeInput.hook_event_name as TEvent,
    sessionId: claudeInput.session_id,
    transcriptPath: claudeInput.transcript_path,
    cwd: claudeInput.cwd,
    matcher: claudeInput.matcher,
    environment: env,
    rawInput: claudeInput,
    ...overrides,
  };

  // Event-specific context creation
  if (isClaudeToolHookInput(claudeInput)) {
    const toolContext = {
      ...baseContext,
      toolName: claudeInput.tool_name as TTool,
      toolInput: parseToolInput(
        claudeInput.tool_name as TTool,
        claudeInput.tool_input
      ),
      toolResponse: claudeInput.tool_response,
      userPrompt: undefined,
      message: undefined,
    };
    return toolContext as HookContext<TEvent, TTool>;
  }

  if (isClaudeUserPromptInput(claudeInput)) {
    const promptContext = {
      ...baseContext,
      toolName: undefined,
      toolInput: undefined as unknown as GetToolInput<TTool>,
      toolResponse: undefined,
      userPrompt: claudeInput.prompt,
      message: undefined,
    };
    return promptContext as HookContext<TEvent, TTool>;
  }

  if (isClaudeNotificationInput(claudeInput)) {
    const notificationContext = {
      ...baseContext,
      toolName: undefined,
      toolInput: undefined as unknown as GetToolInput<TTool>,
      toolResponse: undefined,
      userPrompt: undefined,
      message: claudeInput.message,
    };
    return notificationContext as HookContext<TEvent, TTool>;
  }

  // Fallback for unknown event types
  return {
    ...baseContext,
    toolName: undefined,
    toolInput: undefined as unknown as GetToolInput<TTool>,
    toolResponse: undefined,
    userPrompt: undefined,
    message: undefined,
  } as HookContext<TEvent, TTool>;
}

/**
 * Type guards for tool input validation
 */
export function isBashToolInput(
  input: ToolInput
): input is ToolInputMap['Bash'] {
  return typeof input === 'object' && input !== null && 'command' in input;
}

export function isWriteToolInput(
  input: ToolInput
): input is ToolInputMap['Write'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'content' in input
  );
}

export function isEditToolInput(
  input: ToolInput
): input is ToolInputMap['Edit'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'old_string' in input &&
    'new_string' in input
  );
}

export function isReadToolInput(
  input: ToolInput
): input is ToolInputMap['Read'] {
  return typeof input === 'object' && input !== null && 'file_path' in input;
}

export function isMultiEditToolInput(
  input: ToolInput
): input is ToolInputMap['MultiEdit'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'file_path' in input &&
    'edits' in input &&
    Array.isArray(input.edits)
  );
}

export function isGlobToolInput(
  input: ToolInput
): input is ToolInputMap['Glob'] {
  return typeof input === 'object' && input !== null && 'pattern' in input;
}

export function isGrepToolInput(
  input: ToolInput
): input is ToolInputMap['Grep'] {
  return typeof input === 'object' && input !== null && 'pattern' in input;
}

export function isLSToolInput(input: ToolInput): input is ToolInputMap['LS'] {
  return typeof input === 'object' && input !== null && 'path' in input;
}

export function isTodoWriteToolInput(
  input: ToolInput
): input is ToolInputMap['TodoWrite'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'todos' in input &&
    Array.isArray(input.todos)
  );
}

export function isWebFetchToolInput(
  input: ToolInput
): input is ToolInputMap['WebFetch'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'url' in input &&
    'prompt' in input
  );
}

export function isWebSearchToolInput(
  input: ToolInput
): input is ToolInputMap['WebSearch'] {
  return typeof input === 'object' && input !== null && 'query' in input;
}

export function isNotebookEditToolInput(
  input: ToolInput
): input is ToolInputMap['NotebookEdit'] {
  return (
    typeof input === 'object' &&
    input !== null &&
    'notebook_path' in input &&
    'new_source' in input
  );
}

/**
 * Execute hook with timeout and error handling
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: error and timeout handling requires multiple branches
export async function executeHook(
  handler: HookHandler,
  context: HookContext,
  options: HookExecutionOptions = {}
): Promise<HookResult> {
  const startTime = Date.now();
  const { timeout = 30_000, throwOnError = false } = options;

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new HookTimeoutError(timeout, context)), timeout);
    });

    // Execute handler with timeout
    const result = await Promise.race([
      Promise.resolve(handler(context)),
      timeoutPromise,
    ]);

    // Add execution metadata
    const duration = Date.now() - startTime;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        duration,
        timestamp: new Date().toISOString(),
        hookVersion: '0.2.0',
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof HookTimeoutError) {
      runtimeLogger.error(
        { timeout, context },
        `Hook execution timed out after ${timeout}ms`
      );
    } else {
      runtimeLogger.error(
        { error, context },
        `Hook execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (throwOnError) {
      throw error instanceof HookError
        ? error
        : new HookError(
            error instanceof Error ? error.message : 'Unknown error',
            context,
            error instanceof Error ? error : undefined
          );
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      block: context.event === 'PreToolUse', // Block on PreToolUse failures by default
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
        hookVersion: '0.2.0',
      },
    };
  }
}

/**
 * Output hook result to Claude Code - supports both exit codes and JSON
 */
export function outputHookResult(
  result: HookResult,
  mode: HookOutputMode = 'exit-code',
  exitHandler: (code: number) => never = (code) => process.exit(code)
): never {
  if (mode === 'json') {
    // Structured JSON output for advanced control
    let action: 'continue' | 'block';
    if (result.success) {
      action = 'continue';
    } else if (result.block) {
      action = 'block';
    } else {
      action = 'continue';
    }
    const claudeOutput: ClaudeHookOutput = {
      action,
      message: result.message,
      data: result.data,
    };
    // Must use console.log for Claude Code communication protocol
    // biome-ignore lint/suspicious/noConsole: console.log is part of Claude protocol contract
    console.log(JSON.stringify(claudeOutput));
    return exitHandler(0); // Always exit 0 for JSON mode, let JSON control behavior
  }
  // Traditional exit code mode - must use console for Claude Code communication
  if (result.message) {
    if (result.success) {
      // biome-ignore lint/suspicious/noConsole: console.log is part of Claude protocol contract
      console.log(result.message);
    } else {
      // biome-ignore lint/suspicious/noConsole: console.error is part of Claude protocol contract
      console.error(result.message);
    }
  }

  // Exit codes: 0 = success, 2 = blocking error, 1 = non-blocking error
  if (result.success) {
    return exitHandler(0);
  }
  if (result.block) {
    return exitHandler(2);
  }
  return exitHandler(1);
}

/**
 * Main hook execution function - reads from stdin, executes hook, outputs result
 */
export async function runClaudeHook(
  handler: HookHandler,
  options: HookExecutionOptions = {}
): Promise<never> {
  try {
    // Parse stdin input
    const parseResult = await parseStdinInput();

    if (!parseResult.success) {
      throw new HookInputError(parseResult.error, parseResult.rawInput);
    }

    // Create context from Claude input
    const context = createHookContext(parseResult.data);

    // Execute the hook
    const result = await executeHook(handler, context, options);

    // Output result to Claude
    outputHookResult(result, options.outputMode);
  } catch (error) {
    const result: HookResult = {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown error during hook execution',
      block: true, // Block by default on runtime errors
    };

    outputHookResult(result, options.outputMode);
  }
}

/**
 * Environment detection utilities
 */
export function isClaudeCodeEnvironment(): boolean {
  return Boolean(Bun.env.CLAUDE_PROJECT_DIR);
}

export function getSessionInfo(): { projectDir?: string } {
  return {
    projectDir: Bun.env.CLAUDE_PROJECT_DIR,
  };
}

/**
 * Hook result builders for common scenarios
 */
export const HookResults = {
  success(message?: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },

  failure(
    message: string,
    block = false,
    data?: Record<string, unknown>
  ): HookResult {
    return { success: false, message, block, data };
  },

  block(message: string): HookResult {
    return { success: false, message, block: true };
  },

  skip(message?: string): HookResult {
    return { success: true, message: message || 'Hook skipped' };
  },

  warn(message: string, data?: Record<string, unknown>): HookResult {
    return { success: true, message, data };
  },
};

/**
 * Utility for safe hook execution with error boundaries
 */
export async function safeHookExecution<T extends HookContext>(
  handler: HookHandler,
  context: T,
  fallback?: () => HookResult
): Promise<HookResult> {
  try {
    const result = await Promise.resolve(handler(context));
    return result;
  } catch (error) {
    if (fallback) {
      return fallback();
    }

    return HookResults.failure(
      error instanceof Error ? error.message : 'Unknown error occurred',
      context.event === 'PreToolUse' // Block PreToolUse on errors
    );
  }
}

/**
 * Context validation utilities
 */
export function validateHookContext(context: HookContext): void {
  if (!context.event) {
    throw new HookError('Invalid hook context: missing event', context);
  }

  if (!context.sessionId) {
    throw new HookError('Invalid hook context: missing session ID', context);
  }

  if (!context.cwd) {
    throw new HookError(
      'Invalid hook context: missing current working directory',
      context
    );
  }
}

/**
 * Context creation helpers for testing
 */
export function createBashContext(
  hookEvent: HookEvent,
  command?: string
): HookContext<typeof hookEvent, 'Bash'> {
  const mockInput: ClaudeToolHookInput = {
    session_id: 'test-session',
    transcript_path: '/tmp/transcript.md',
    cwd: process.cwd(),
    hook_event_name: hookEvent as 'PreToolUse' | 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: command || 'echo test' },
  };

  return createHookContext(mockInput) as HookContext<typeof hookEvent, 'Bash'>;
}

export function createFileContext(
  hookEvent: HookEvent,
  toolName: 'Write' | 'Edit' | 'Read',
  filePath?: string
): HookContext<typeof hookEvent, typeof toolName> {
  const mockInput: ClaudeToolHookInput = {
    session_id: 'test-session',
    transcript_path: '/tmp/transcript.md',
    cwd: process.cwd(),
    hook_event_name: hookEvent as 'PreToolUse' | 'PostToolUse',
    tool_name: toolName,
    tool_input: { file_path: filePath || '/tmp/test.txt' },
  };

  return createHookContext(mockInput) as HookContext<
    typeof hookEvent,
    typeof toolName
  >;
}

// HookLogger is now exported from logger.ts with proper pino implementation
export { HookLogger } from './logger';
