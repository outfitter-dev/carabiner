/**
 * @grapple/protocol - Stdin/Stdout Protocol Implementation
 * 
 * Implements the classic Claude Code hooks protocol that reads JSON input
 * from stdin and writes results to stdout/stderr.
 */

import type { HookContext, HookResult } from '@outfitter/types';
import {
  parseClaudeHookInput,
  validateAndCreateBrandedInput,
  type ClaudeHookInput,
} from '@outfitter/schemas';
import {
  createToolHookContext,
  createUserPromptContext,
  createNotificationContext,
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
export interface StdinProtocolOptions {
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
}

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
    const timeout = this.options.inputTimeout ?? 30000;
    
    try {
      const chunks: Buffer[] = [];
      const controller = new AbortController();
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      try {
        // Read all stdin chunks
        for await (const chunk of process.stdin) {
          if (controller.signal.aborted) {
            throw new Error('Stdin read timed out');
          }
          chunks.push(chunk);
        }
      } finally {
        clearTimeout(timeoutId);
      }

      const input = Buffer.concat(chunks).toString('utf-8').trim();
      
      if (!input) {
        throw new ProtocolInputError('No input received from stdin');
      }

      try {
        return JSON.parse(input);
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
      throw new ProtocolInputError(
        'Failed to read input from stdin',
        error
      );
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
          if (error) reject(error);
          else resolve();
        });
      });
    } catch (error) {
      throw new ProtocolOutputError(
        'Failed to write output to stdout',
        error
      );
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
          if (writeError) reject(writeError);
          else resolve();
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
  private createTypedContext(input: any): HookContext {
    if ('tool_name' in input) {
      // Tool hook context (PreToolUse/PostToolUse)
      return createToolHookContext(
        input.hook_event_name,
        input.tool_name,
        input.tool_input,
        {
          sessionId: input.sessionId,
          transcriptPath: input.transcriptPath,
          cwd: input.cwd,
          environment: process.env as Record<string, string>,
          matcher: input.matcher,
        },
        input.tool_response
      );
    }
    
    if ('prompt' in input) {
      // User prompt context
      return createUserPromptContext(
        input.prompt,
        {
          sessionId: input.sessionId,
          transcriptPath: input.transcriptPath,
          cwd: input.cwd,
          environment: process.env as Record<string, string>,
          matcher: input.matcher,
        }
      );
    }
    
    if ('notification' in input) {
      // Notification context
      return createNotificationContext(
        input.hook_event_name,
        {
          sessionId: input.sessionId,
          transcriptPath: input.transcriptPath,
          cwd: input.cwd,
          environment: process.env as Record<string, string>,
          matcher: input.matcher,
        },
        input.notification
      );
    }
    
    throw new ProtocolParseError(
      `Unsupported hook event: ${input.hook_event_name}`
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