/**
 * @outfitter/protocol - Protocol abstraction layer for Claude Code hooks
 * 
 * This package provides:
 * - Core protocol interface for decoupling I/O from hook logic
 * - StdinProtocol for Claude Code compatibility
 * - HttpProtocol for webhook-style integrations  
 * - TestProtocol for comprehensive testing without I/O
 * - Proper error handling and validation
 * 
 * Enables hooks to run over different transport mechanisms while maintaining
 * the same hook logic and ensuring complete testability.
 */

// Import everything first
import type { HookProtocol, HookProtocolFactory } from './interface';
import {
  ProtocolError,
  ProtocolInputError,
  ProtocolOutputError,
  ProtocolParseError,
  isProtocolError,
} from './interface';

import { StdinProtocol, StdinProtocolFactory } from './protocols/stdin';
import type { StdinProtocolOptions } from './protocols/stdin';

import { HttpProtocol, HttpProtocolFactory } from './protocols/http';
import type { HttpProtocolOptions } from './protocols/http';

import { TestProtocol, TestProtocolFactory, TestInputBuilder } from './protocols/test';
import type { TestProtocolOptions } from './protocols/test';

// Export everything
export type {
  HookProtocol,
  HookProtocolFactory,
  StdinProtocolOptions,
  HttpProtocolOptions,
  TestProtocolOptions,
};

export {
  ProtocolError,
  ProtocolInputError,
  ProtocolOutputError,
  ProtocolParseError,
  isProtocolError,
  StdinProtocol,
  StdinProtocolFactory,
  HttpProtocol,
  HttpProtocolFactory,
  TestProtocol,
  TestProtocolFactory,
  TestInputBuilder,
};

/**
 * Registry of available protocol factories
 */
export const ProtocolFactories = {
  stdin: new StdinProtocolFactory(),
  http: new HttpProtocolFactory(),
  test: new TestProtocolFactory(),
} as const;

/**
 * Create a protocol instance by type
 * 
 * @param type - Protocol type identifier
 * @param options - Protocol-specific options
 * @returns New protocol instance
 * 
 * @example
 * ```typescript
 * // Create stdin protocol
 * const stdinProtocol = createProtocol('stdin', { inputTimeout: 10000 });
 * 
 * // Create test protocol
 * const testProtocol = createProtocol('test', { 
 *   input: mockInput, 
 *   options: { environment: { TEST: 'true' } }
 * });
 * ```
 */
export function createProtocol(type: 'stdin', options?: StdinProtocolOptions): StdinProtocol;
export function createProtocol(
  type: 'http',
  options: { request: Request; options?: HttpProtocolOptions }
): HttpProtocol;
export function createProtocol(
  type: 'test',
  options: { input: unknown; options?: TestProtocolOptions }
): TestProtocol;
export function createProtocol(type: string, options?: any): HookProtocol {
  switch (type) {
    case 'stdin':
      return ProtocolFactories.stdin.create(options);
    case 'http':
      return ProtocolFactories.http.create(options);
    case 'test':
      return ProtocolFactories.test.create(options);
    default:
      throw new Error(`Unknown protocol type: ${type}`);
  }
}

/**
 * Type-safe protocol type union
 */
export type ProtocolType = keyof typeof ProtocolFactories;