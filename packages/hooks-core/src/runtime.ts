/**
 * Runtime utilities for Claude Code hooks
 * Handles stdin JSON parsing, context creation, and hook execution
 * Updated to match the actual Claude Code hooks API
 */

import { createHookContext } from './context-factories';
import { executeHookSafely, executionValidation } from './execution-utils';
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
  ToolName,
} from './types';
import { HookInputError } from './types';

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
 * @deprecated Use parseHookEnvironment from context-factories instead
 */
export function parseHookEnvironment(): HookEnvironment {
  return {
    CLAUDE_PROJECT_DIR: Bun.env.CLAUDE_PROJECT_DIR,
  };
}

/**
 * Type-safe tool input validation using Zod schemas
 * Eliminates unsafe 'as' assertions with proper runtime validation
 * @deprecated Use parseToolInput from validation-utils module instead
 */
export function parseToolInput<T extends ToolName>(
  toolName: T,
  toolInput: Record<string, unknown>
): GetToolInput<T> {
  const { parseToolInput: parseToolInputSafe } = require('./validation-utils');
  return parseToolInputSafe(toolName, toolInput);
}

/**
 * @deprecated Use createHookContext from context-factories module instead
 * This function has been replaced with type-safe factory functions
 */
export { createHookContext };

/**
 * Type-safe tool input validation - now delegated to validation-utils module
 * @deprecated Import these functions directly from validation-utils module
 */

// Re-export validation utilities for backward compatibility
export {
  assertValidToolInput,
  isBashToolInput,
  isEditToolInput,
  isGlobToolInput,
  isGrepToolInput,
  isLSToolInput,
  isMultiEditToolInput,
  isNotebookEditToolInput,
  isReadToolInput,
  isTodoWriteToolInput,
  isValidToolInput,
  isWebFetchToolInput,
  isWebSearchToolInput,
  isWriteToolInput,
  type ToolInputValidationResult,
  validateToolInputWithDetails,
} from './validation-utils';

/**
 * @deprecated Use executeHookSafely from execution-utils module instead
 * This function has been replaced with a decomposed, type-safe implementation
 */
export { executeHookSafely as executeHook };

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

    // Validate context and options before execution
    executionValidation.validateContext(context);
    executionValidation.validateOptions(options);

    // Execute the hook
    const result = await executeHookSafely(handler, context, options);

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
 * @deprecated Use executionValidation.validateContext from execution-utils instead
 */
export function validateHookContext(context: HookContext): void {
  executionValidation.validateContext(context);
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
