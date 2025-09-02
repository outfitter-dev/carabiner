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

// Export types and errors directly
export type { HookProtocol, HookProtocolFactory } from "./interface";
export {
	isProtocolError,
	ProtocolError,
	ProtocolInputError,
	ProtocolOutputError,
	ProtocolParseError,
} from "./interface";

// Import types and factories for internal use
import type { HookProtocol } from "./interface";
import type { HttpProtocolOptions } from "./protocols/http";
import { type HttpProtocol, HttpProtocolFactory } from "./protocols/http";
import type { StdinProtocolOptions } from "./protocols/stdin";
import { type StdinProtocol, StdinProtocolFactory } from "./protocols/stdin";
import type { TestProtocolOptions } from "./protocols/test";
import { type TestProtocol, TestProtocolFactory } from "./protocols/test";

// Export all protocol types and implementations
export type { HttpProtocolOptions } from "./protocols/http";
export { HttpProtocol, HttpProtocolFactory } from "./protocols/http";
export type { StdinProtocolOptions } from "./protocols/stdin";
export { StdinProtocol, StdinProtocolFactory } from "./protocols/stdin";
export type { TestProtocolOptions } from "./protocols/test";
export {
	createNotificationInput,
	createToolHookInput,
	createUserPromptInput,
	TestProtocol,
	TestProtocolFactory,
} from "./protocols/test";

// Note: Types and implementations are exported directly above

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
export function createProtocol(
	type: "stdin",
	options?: StdinProtocolOptions,
): StdinProtocol;
export function createProtocol(
	type: "http",
	options: { request: Request; options?: HttpProtocolOptions },
): HttpProtocol;
export function createProtocol(
	type: "test",
	options: { input: unknown; options?: TestProtocolOptions },
): TestProtocol;
export function createProtocol(type: string, options?: unknown): HookProtocol {
	switch (type) {
		case "stdin":
			return ProtocolFactories.stdin.create(options as StdinProtocolOptions);
		case "http":
			return ProtocolFactories.http.create(
				options as { request: Request; options?: HttpProtocolOptions },
			);
		case "test":
			return ProtocolFactories.test.create(
				options as { input: unknown; options?: TestProtocolOptions },
			);
		default:
			throw new Error(`Unknown protocol type: ${String(type)}`);
	}
}

/**
 * Type-safe protocol type union
 */
export type ProtocolType = keyof typeof ProtocolFactories;
