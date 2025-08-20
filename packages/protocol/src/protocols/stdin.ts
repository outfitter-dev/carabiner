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
  private activeStream: NodeJS.ReadStream | null = null;
  private isDestroyed = false;

  constructor(private readonly options: StdinProtocolOptions = {}) {}

  /**
   * Read JSON input from stdin with timeout and robust stream destruction
   */
  async readInput(): Promise<unknown> {
    const timeout = this.options.inputTimeout ?? 30_000;

    // Reset state for new read operation
    this.isDestroyed = false;
    this.activeStream = process.stdin;

    try {
      const input: string = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let isCleanedUp = false;

        const onData = (chunk: Buffer) => {
          if (!this.isDestroyed) {
            chunks.push(chunk);
          }
        };

        const onEnd = () => {
          if (!(isCleanedUp || this.isDestroyed)) {
            cleanup(false);
            resolve(Buffer.concat(chunks).toString('utf-8'));
          }
        };

        const onError = (err: unknown) => {
          if (!(isCleanedUp || this.isDestroyed)) {
            cleanup(false);
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };

        const cleanup = (isTimeout = false) => {
          if (isCleanedUp) return;
          isCleanedUp = true;

          // Clear the timeout
          clearTimeout(timeoutId);

          // Remove all listeners
          if (this.activeStream) {
            this.activeStream.removeListener('data', onData);
            this.activeStream.removeListener('end', onEnd);
            this.activeStream.removeListener('error', onError);

            // On timeout, forcefully destroy the stream
            if (isTimeout && !this.isDestroyed) {
              this.isDestroyed = true;

              // Pause the stream first to stop data flow
              if (this.activeStream.readable) {
                this.activeStream.pause();
              }

              // Destroy the stream with an error
              const timeoutError = new Error(
                'Stdin read timed out - stream destroyed'
              );
              this.activeStream.destroy(timeoutError);

              // Ensure any buffered data is cleared
              if (this.activeStream.readableLength > 0) {
                this.activeStream.read(this.activeStream.readableLength);
              }

              // Clear the reference
              this.activeStream = null;
            }
          }
        };

        const timeoutId = setTimeout(() => {
          cleanup(true);
          reject(
            new ProtocolInputError(
              'Stdin read timed out - hard timeout reached',
              new Error(
                'Hard timeout: stream forcibly destroyed after ' +
                  timeout +
                  'ms'
              )
            )
          );
        }, timeout);

        // Attach listeners
        if (this.activeStream) {
          this.activeStream.on('data', onData);
          this.activeStream.once('end', onEnd);
          this.activeStream.once('error', onError);

          // Resume the stream if it was paused
          if (this.activeStream.isPaused?.()) {
            this.activeStream.resume();
          }
        } else {
          cleanup(false);
          reject(new ProtocolInputError('No stdin stream available'));
        }
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
    } finally {
      // Clean up stream reference
      this.activeStream = null;
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
   * Forcefully destroy any active stream operations
   * This method ensures complete cleanup when the protocol needs to shut down
   */
  destroy(): void {
    if (this.activeStream && !this.isDestroyed) {
      this.isDestroyed = true;

      // Pause to stop data flow
      if (this.activeStream.readable) {
        this.activeStream.pause();
      }

      // Remove all possible listeners
      this.activeStream.removeAllListeners();

      // Destroy the stream
      this.activeStream.destroy(
        new Error('Protocol destroyed - cleaning up active streams')
      );

      // Clear buffered data
      if (this.activeStream.readableLength > 0) {
        this.activeStream.read(this.activeStream.readableLength);
      }

      this.activeStream = null;
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
