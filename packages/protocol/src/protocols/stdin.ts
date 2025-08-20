/**
 * @outfitter/protocol - Stdin/Stdout Protocol Implementation
 *
 * Implements the classic Claude Code hooks protocol that reads JSON input
 * from stdin and writes results to stdout/stderr.
 */

import {
  parseClaudeHookInput,
  validateAndCreateBrandedInput,
} from '@outfitter/schemas';
import type {
  DirectoryPath,
  HookContext,
  HookResult,
  NotificationEvent,
  SessionId,
  ToolHookEvent,
  ToolInput,
  TranscriptPath,
} from '@outfitter/types';
import {
  createNotificationContext,
  createToolHookContext,
  createUserPromptContext,
} from '@outfitter/types';
import type { HookProtocol } from '../interface';
import {
  ProtocolInputError,
  ProtocolOutputError,
  ProtocolParseError,
} from '../interface';

/**
 * Configuration options for StdinProtocol
 */
export type StdinProtocolOptions = {
  /**
   * Maximum time to wait for stdin input (ms)
   * @default 30000
   */
  inputTimeout?: number;

  /**
   * Whether to pretty-print JSON output
   * @default false
   */
  prettyOutput?: boolean;

  /**
   * Whether to include stack traces in error output
   * @default true
   */
  includeErrorStack?: boolean;
};

/**
 * Protocol implementation for Claude Code's stdin/stdout communication
 *
 * This protocol maintains backward compatibility with existing Claude Code
 * hook runners while providing the new abstracted interface.
 *
 * @example
 * ```typescript
 * const protocol = new StdinProtocol({ inputTimeout: 10000 });
 *
 * // Use with hook executor
 * const executor = new HookExecutor(protocol);
 * await executor.execute(myHookHandler);
 * ```
 */
export class StdinProtocol implements HookProtocol {
  constructor(private readonly options: StdinProtocolOptions = {}) {}

  /**
   * Read JSON input from stdin with timeout
   */
  async readInput(): Promise<unknown> {
    const timeout = this.options.inputTimeout ?? 30_000;

    try {
      const input: string = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        const onData = (chunk: Buffer) => {
          chunks.push(chunk);
        };
        const onEnd = () => {
          cleanup();
          resolve(Buffer.concat(chunks).toString('utf-8'));
        };
        const onError = (err: unknown) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        };
        const cleanup = () => {
          clearTimeout(timeoutId);
          process.stdin.off('data', onData);
          process.stdin.off('end', onEnd);
          process.stdin.off('error', onError);
        };
        const timeoutId = setTimeout(() => {
          cleanup();
          // Destroy to unblock the stream if no further chunks arrive
          process.stdin.destroy(new Error('Stdin read timed out'));
          reject(new Error('Stdin read timed out'));
        }, timeout);

        process.stdin.on('data', onData);
        process.stdin.once('end', onEnd);
        process.stdin.once('error', onError);
      });

      const trimmedInput = input.trim();

      if (!trimmedInput) {
        throw new ProtocolInputError('No input received from stdin');
      }

      try {
        return JSON.parse(trimmedInput);
      } catch (parseError) {
        throw new ProtocolInputError(
          'Failed to parse JSON from stdin',
          parseError
        );
      }
    } catch (error) {
      if (error instanceof ProtocolInputError) {
        throw error;
      }
      throw new ProtocolInputError('Failed to read input from stdin', error);
    }
  }

  /**
   * Parse and validate raw input into typed hook context
   */
  async parseContext(input: unknown): Promise<HookContext> {
    try {
      // First validate with Zod schemas
      const claudeInput = parseClaudeHookInput(input);

      // Then create branded types and context
      const validatedInput = await validateAndCreateBrandedInput(claudeInput);

      return this.createTypedContext(validatedInput);
    } catch (error) {
      if (error instanceof Error) {
        throw new ProtocolParseError(
          `Failed to parse hook context: ${error.message}`,
          error
        );
      }
      throw new ProtocolParseError('Failed to parse hook context');
    }
  }

  /**
   * Write successful result to stdout
   */
  async writeOutput(result: HookResult): Promise<void> {
    try {
      const output = this.options.prettyOutput
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      process.stdout.write(output);

      // Ensure output is flushed
      await new Promise<void>((resolve, reject) => {
        process.stdout.write('', (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new ProtocolOutputError('Failed to write output to stdout', error);
    }
  }

  /**
   * Write error to stderr
   */
  async writeError(error: Error): Promise<void> {
    try {
      const errorOutput = {
        error: error.message,
        type: error.name,
        ...(this.options.includeErrorStack !== false && { stack: error.stack }),
      };

      const output = this.options.prettyOutput
        ? JSON.stringify(errorOutput, null, 2)
        : JSON.stringify(errorOutput);

      process.stderr.write(output);

      // Ensure error output is flushed
      await new Promise<void>((resolve, reject) => {
        process.stderr.write('', (writeError) => {
          if (writeError) {
            reject(writeError);
          } else {
            resolve();
          }
        });
      });
    } catch (writeError) {
      throw new ProtocolOutputError(
        'Failed to write error to stderr',
        writeError
      );
    }
  }

  /**
   * Create typed context from validated Claude input
   */
  private createTypedContext(input: Record<string, unknown>): HookContext {
    if ('tool_name' in input) {
      // Tool hook context (PreToolUse/PostToolUse)
      return createToolHookContext(
        input.hook_event_name as ToolHookEvent,
        input.tool_name as string,
        input.tool_input as ToolInput,
        {
          sessionId: input.sessionId as SessionId,
          transcriptPath: input.transcriptPath as TranscriptPath,
          cwd: input.cwd as DirectoryPath,
          environment: process.env as Record<string, string>,
          matcher: input.matcher as string | undefined,
        },
        input.tool_response as Record<string, unknown> | undefined
      );
    }

    if ('prompt' in input) {
      // User prompt context
      return createUserPromptContext(input.prompt as string, {
        sessionId: input.sessionId as SessionId,
        transcriptPath: input.transcriptPath as TranscriptPath,
        cwd: input.cwd as DirectoryPath,
        environment: process.env as Record<string, string>,
        matcher: input.matcher as string | undefined,
      });
    }

    if ('notification' in input) {
      // Notification context
      return createNotificationContext(
        input.hook_event_name as NotificationEvent,
        {
          sessionId: input.sessionId as SessionId,
          transcriptPath: input.transcriptPath as TranscriptPath,
          cwd: input.cwd as DirectoryPath,
          environment: process.env as Record<string, string>,
          matcher: input.matcher as string | undefined,
        },
        input.notification as string | undefined
      );
    }

    throw new ProtocolParseError(
      `Unsupported hook event: ${String(input.hook_event_name)}`
    );
  }
}

/**
 * Factory for creating StdinProtocol instances
 */
export class StdinProtocolFactory {
  readonly type = 'stdin';

  create(options?: StdinProtocolOptions): HookProtocol {
    return new StdinProtocol(options);
  }
}
