/**
 * @outfitter/protocol - Test Protocol Implementation
 *
 * Implements a testing protocol that allows for easy unit testing of hooks
 * without requiring actual I/O operations. Provides full control over input
 * and captures all output for assertions.
 */

import {
	parseClaudeHookInput,
	validateAndCreateBrandedInput,
} from "@carabiner/schemas";
import type {
	BashToolInput,
	DirectoryPath,
	HookContext,
	HookResult,
	NotificationEvent,
	SessionId,
	ToolHookEvent,
	ToolInput,
	TranscriptPath,
} from "@carabiner/types";
import {
	createDirectoryPath,
	createNotificationContext,
	createSessionId,
	createToolHookContext,
	createTranscriptPath,
	createUserPromptContext,
} from "@carabiner/types";
import type { HookProtocol } from "../interface";
import { ProtocolParseError } from "../interface";

/**
 * Configuration options for TestProtocol
 */
export type TestProtocolOptions = {
	/**
	 * Custom environment variables to inject into context
	 * @default {}
	 */
	environment?: Record<string, string>;

	/**
	 * Whether to validate input strictly (throw on invalid input)
	 * @default true
	 */
	strictValidation?: boolean;

	/**
	 * Whether to capture timing information
	 * @default false
	 */
	captureTiming?: boolean;
};

/**
 * Test protocol for unit testing hooks without I/O
 *
 * This protocol enables comprehensive testing of hook logic by providing
 * controlled input and capturing all outputs for verification.
 *
 * @example
 * ```typescript
 * const protocol = new TestProtocol(mockInput, {
 *   environment: { TEST_MODE: 'true' },
 *   captureTiming: true
 * });
 *
 * const executor = new HookExecutor(protocol);
 * await executor.execute(myHookHandler);
 *
 * expect(protocol.output).toEqual({ success: true });
 * expect(protocol.error).toBeUndefined();
 * expect(protocol.timing.executionTime).toBeLessThan(100);
 * ```
 */
export class TestProtocol implements HookProtocol {
	/**
	 * Captured output from writeOutput()
	 */
	public output?: HookResult;

	/**
	 * Captured error from writeError()
	 */
	public error?: Error;

	/**
	 * Timing information (if captureTiming is enabled)
	 */
	public timing: {
		readInputTime?: number;
		parseContextTime?: number;
		writeOutputTime?: number;
		writeErrorTime?: number;
		executionTime?: number;
	} = {};

	/**
	 * Number of times each method has been called (for testing)
	 */
	public callCounts = {
		readInput: 0,
		parseContext: 0,
		writeOutput: 0,
		writeError: 0,
	};

	private startTime?: number;

	constructor(
		private readonly inputData: unknown,
		private readonly options: TestProtocolOptions = {},
	) {}

	/**
	 * Return the pre-configured test input data
	 */
	async readInput(): Promise<unknown> {
		this.callCounts.readInput++;

		if (this.options.captureTiming) {
			this.startTime = performance.now();
			const start = performance.now();

			// Simulate async behavior
			await new Promise((resolve) => setTimeout(resolve, 0));

			this.timing.readInputTime = performance.now() - start;
		}

		return this.inputData;
	}

	/**
	 * Parse and validate input into typed hook context
	 */
	async parseContext(input: unknown): Promise<HookContext> {
		this.callCounts.parseContext++;

		const start = this.options.captureTiming ? performance.now() : 0;

		try {
			// First validate with Zod schemas
			const claudeInput = parseClaudeHookInput(input);

			// Then create branded types and context
			const validatedInput = await validateAndCreateBrandedInput(claudeInput);

			const context = this.createTypedContext(validatedInput);

			if (this.options.captureTiming) {
				this.timing.parseContextTime = performance.now() - start;
			}

			return context;
		} catch (error) {
			if (this.options.strictValidation !== false) {
				if (error instanceof Error) {
					throw new ProtocolParseError(
						`Failed to parse hook context: ${error.message}`,
						error,
					);
				}
				throw new ProtocolParseError("Failed to parse hook context");
			}

			// In non-strict mode, return a minimal context for testing
			return this.createMinimalContext();
		}
	}

	/**
	 * Capture output for testing assertions
	 */
	async writeOutput(result: HookResult): Promise<void> {
		this.callCounts.writeOutput++;

		if (this.options.captureTiming) {
			const start = performance.now();

			// Simulate async write
			await new Promise((resolve) => setTimeout(resolve, 0));

			this.timing.writeOutputTime = performance.now() - start;

			if (this.startTime) {
				this.timing.executionTime = performance.now() - this.startTime;
			}
		}

		this.output = result;
	}

	/**
	 * Capture error for testing assertions
	 */
	async writeError(error: Error): Promise<void> {
		this.callCounts.writeError++;

		if (this.options.captureTiming) {
			const start = performance.now();

			// Simulate async write
			await new Promise((resolve) => setTimeout(resolve, 0));

			this.timing.writeErrorTime = performance.now() - start;

			if (this.startTime) {
				this.timing.executionTime = performance.now() - this.startTime;
			}
		}

		this.error = error;
	}

	/**
	 * Reset all captured data (useful for reusing protocol instances)
	 */
	reset(): void {
		this.output = undefined;
		this.error = undefined;
		this.timing = {};
		this.callCounts = {
			readInput: 0,
			parseContext: 0,
			writeOutput: 0,
			writeError: 0,
		};
		this.startTime = undefined;
	}

	/**
	 * Check if hook execution was successful
	 */
	get wasSuccessful(): boolean {
		return this.output?.success === true && this.error === undefined;
	}

	/**
	 * Check if hook execution failed
	 */
	get hasFailed(): boolean {
		return this.error !== undefined || this.output?.success === false;
	}

	/**
	 * Get the final result (output or error)
	 */
	get result(): HookResult | Error | undefined {
		return this.output || this.error;
	}

	/**
	 * Create typed context from validated Claude input
	 */
	private createTypedContext(input: Record<string, unknown>): HookContext {
		const inRec = input as Record<string, unknown>;
		const get = <T = unknown>(camel: string, snake: string) =>
			(inRec[camel] ?? inRec[snake]) as T;
		const environment = {
			CLAUDE_PROJECT_DIR: Bun.env.CLAUDE_PROJECT_DIR,
			...this.options.environment,
		};

		if ("tool_name" in inRec || "toolName" in inRec) {
			// Tool hook context (PreToolUse/PostToolUse)
			return createToolHookContext(
				get<ToolHookEvent>("hookEventName", "hook_event_name"),
				get<string>("toolName", "tool_name"),
				get<ToolInput>("toolInput", "tool_input"),
				{
					sessionId: get<SessionId>("sessionId", "session_id"),
					transcriptPath: get<TranscriptPath>(
						"transcriptPath",
						"transcript_path",
					),
					cwd: get<DirectoryPath>("cwd", "cwd"),
					environment,
					matcher: get<string | undefined>("matcher", "matcher"),
				},
				get<Record<string, unknown> | undefined>(
					"toolResponse",
					"tool_response",
				),
			);
		}

		if ("prompt" in inRec) {
			// User prompt context
			return createUserPromptContext(inRec.prompt as string, {
				sessionId: get<SessionId>("sessionId", "session_id"),
				transcriptPath: get<TranscriptPath>(
					"transcriptPath",
					"transcript_path",
				),
				cwd: get<DirectoryPath>("cwd", "cwd"),
				environment,
				matcher: get<string | undefined>("matcher", "matcher"),
			});
		}

		if ("notification" in inRec) {
			// Notification context
			return createNotificationContext(
				get<NotificationEvent>("hookEventName", "hook_event_name"),
				{
					sessionId: get<SessionId>("sessionId", "session_id"),
					transcriptPath: get<TranscriptPath>(
						"transcriptPath",
						"transcript_path",
					),
					cwd: get<DirectoryPath>("cwd", "cwd"),
					environment,
					matcher: get<string | undefined>("matcher", "matcher"),
				},
				inRec.notification as string | undefined,
			);
		}

		throw new ProtocolParseError(
			`Unsupported hook event: ${String(get("hookEventName", "hook_event_name"))}`,
		);
	}

	/**
	 * Create a minimal context for non-strict testing scenarios
	 */
	private createMinimalContext(): HookContext {
		return createToolHookContext(
			"PreToolUse",
			"Bash",
			{ command: 'echo "test"' } as BashToolInput,
			{
				sessionId: createSessionId("test-session"),
				transcriptPath: createTranscriptPath("/test/transcript.md"),
				cwd: createDirectoryPath("/test/dir"),
				environment: {
					CLAUDE_PROJECT_DIR: Bun.env.CLAUDE_PROJECT_DIR,
					...this.options.environment,
				},
			},
		);
	}
}

/**
 * Factory for creating TestProtocol instances
 */
export class TestProtocolFactory {
	readonly type = "test";

	create({
		input,
		options,
	}: {
		input: unknown;
		options?: TestProtocolOptions;
	}): HookProtocol {
		return new TestProtocol(input, options);
	}
}

/**
 * Utility functions for creating test inputs
 */
/**
 * Create a mock tool hook input
 */
export function createToolHookInput(
	overrides: Partial<Record<string, unknown>> = {},
) {
	return {
		session_id: "test-session-123",
		transcript_path: "/tmp/test-transcript.md",
		cwd: "/test/cwd",
		hook_event_name: "PreToolUse",
		tool_name: "Bash",
		tool_input: { command: 'echo "test"' },
		...overrides,
	};
}

/**
 * Create a mock user prompt input
 */
export function createUserPromptInput(
	overrides: Partial<Record<string, unknown>> = {},
) {
	return {
		session_id: "test-session-123",
		transcript_path: "/tmp/test-transcript.md",
		cwd: "/test/cwd",
		hook_event_name: "UserPromptSubmit",
		prompt: "Test prompt",
		...overrides,
	};
}

/**
 * Create a mock notification input
 */
export function createNotificationInput(
	overrides: Partial<Record<string, unknown>> = {},
) {
	return {
		session_id: "test-session-123",
		transcript_path: "/tmp/test-transcript.md",
		cwd: "/test/cwd",
		hook_event_name: "SessionStart",
		notification: "Session started",
		...overrides,
	};
}
