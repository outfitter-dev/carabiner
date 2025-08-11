/**
 * @grapple/protocol - Protocol abstraction interface
 * 
 * Defines the contract for I/O protocols that decouple the hooks system
 * from specific transport mechanisms like stdin/stdout, HTTP, or testing.
 */

import type { HookContext, HookResult } from '@outfitter/types';

/**
 * Core protocol interface for Claude Code hooks I/O
 * 
 * This interface abstracts the transport layer, enabling hooks to run
 * over different protocols (stdin/stdout, HTTP, testing, etc.) without
 * changing the core hook logic.
 */
export interface HookProtocol {
  /**
   * Read raw input from the protocol source
   * 
   * @returns Promise resolving to the raw input data
   * @throws {Error} If reading fails or times out
   */
  readInput(): Promise<unknown>;

  /**
   * Parse and validate raw input into a typed hook context
   * 
   * @param input - Raw input from readInput()
   * @returns Validated and typed hook context
   * @throws {ValidationError} If input is invalid
   * @throws {Error} If parsing fails
   */
  parseContext(input: unknown): Promise<HookContext>;

  /**
   * Write successful hook result to the protocol output
   * 
   * @param result - Hook execution result to write
   * @throws {Error} If writing fails
   */
  writeOutput(result: HookResult): Promise<void>;

  /**
   * Write error result to the protocol error channel
   * 
   * @param error - Error that occurred during execution
   * @throws {Error} If writing error fails
   */
  writeError(error: Error): Promise<void>;
}

/**
 * Protocol factory interface for creating protocol instances
 * 
 * Enables dependency injection and testing by providing a consistent
 * way to create protocol instances with different configurations.
 */
export interface HookProtocolFactory<T = unknown> {
  /**
   * Create a new protocol instance
   * 
   * @param options - Protocol-specific configuration options
   * @returns New protocol instance
   */
  create(options?: T): HookProtocol;
  
  /**
   * Protocol type identifier
   */
  readonly type: string;
}

/**
 * Protocol error types for better error handling
 */
export class ProtocolError extends Error {
  override name = 'ProtocolError';
  public readonly code: string;
  override readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export class ProtocolInputError extends ProtocolError {
  override name = 'ProtocolInputError';
  
  constructor(message: string, cause?: unknown) {
    super(message, 'PROTOCOL_INPUT_ERROR', cause);
  }
}

export class ProtocolOutputError extends ProtocolError {
  override name = 'ProtocolOutputError';
  
  constructor(message: string, cause?: unknown) {
    super(message, 'PROTOCOL_OUTPUT_ERROR', cause);
  }
}

export class ProtocolParseError extends ProtocolError {
  override name = 'ProtocolParseError';
  
  constructor(message: string, cause?: unknown) {
    super(message, 'PROTOCOL_PARSE_ERROR', cause);
  }
}

/**
 * Type guard for protocol errors
 */
export function isProtocolError(error: unknown): error is ProtocolError {
  return error instanceof ProtocolError;
}