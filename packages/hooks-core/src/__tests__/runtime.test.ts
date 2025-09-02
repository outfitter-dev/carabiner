/**
 * Runtime tests for hook execution and context management
 */

import { describe, expect, test } from "bun:test";
import { createTestContext } from "@carabiner/types";
import {
	createBashContext,
	createFileContext,
	createHookContext,
	executeHook,
	HookResults,
	outputHookResult,
	safeHookExecution,
} from "../runtime";
import type { HookContext, HookHandler } from "../types";

describe("Runtime - Context Creation", () => {
	test("should create Bash context correctly", () => {
		const context = createBashContext("PreToolUse", "echo test");

		expect(context.event).toBe("PreToolUse");
		expect(context.toolName).toBe("Bash");
		expect(context.sessionId).toBe("test-session");
		expect(context.toolInput).toEqual({ command: "echo test" });
	});

	test("should create File context for Write operation", () => {
		const context = createFileContext("PostToolUse", "Write", "test.ts");

		expect(context.event).toBe("PostToolUse");
		expect(context.toolName).toBe("Write");
		expect(context.toolInput.file_path).toBe("test.ts");
	});

	test("should create File context for Edit operation", () => {
		const context = createFileContext("PreToolUse", "Edit", "test.ts");

		expect(context.event).toBe("PreToolUse");
		expect(context.toolName).toBe("Edit");
		expect(context.toolInput.file_path).toBe("test.ts");
	});

	test("should create File context for Read operation", () => {
		const context = createFileContext("PreToolUse", "Read", "test.ts");

		expect(context.event).toBe("PreToolUse");
		expect(context.toolName).toBe("Read");
		expect(context.toolInput.file_path).toBe("test.ts");
	});
});

describe("Runtime - Hook Execution", () => {
	test("should execute successful hook", async () => {
		const handler: HookHandler = async (_context) => {
			return HookResults.success("Hook executed", { test: true });
		};

		const context = createTestContext({
			hookEventName: "PreToolUse",
			toolName: "Bash",
			sessionId: "test-session",
			transcriptPath: "/test/transcript.md",
			cwd: "/test/workspace",
			toolInput: { command: "test" },
		});

		const result = await safeHookExecution(handler, context);

		expect(result.success).toBe(true);
		expect(result.message).toBe("Hook executed");
		expect(result.data).toEqual({ test: true });
	});

	test("should handle hook errors properly", async () => {
		const handler: HookHandler = async () => {
			throw new Error("Test error");
		};

		const context = createTestContext({
			hookEventName: "PreToolUse",
			toolName: "Bash",
			sessionId: "test-session",
			transcriptPath: "/test/transcript.md",
			cwd: "/test/workspace",
			toolInput: { command: "test" },
		});

		const result = await safeHookExecution(handler, context);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Test error");
	});

	test("should handle blocking results for PreToolUse", async () => {
		const handler: HookHandler = async () => {
			return HookResults.block("Operation blocked");
		};

		const context = createTestContext({
			hookEventName: "PreToolUse",
			toolName: "Bash",
			sessionId: "test-session",
			transcriptPath: "/test/transcript.md",
			cwd: "/test/workspace",
			toolInput: { command: "rm -rf /" },
		});

		const result = await safeHookExecution(handler, context);

		expect(result.success).toBe(false);
		expect(result.block).toBe(true);
		expect(result.message).toBe("Operation blocked");
	});

	test("should handle skip results", async () => {
		const handler: HookHandler = async () => {
			return HookResults.skip("Hook skipped");
		};

		const context: HookContext = {
			event: "SessionStart",
			sessionId: "test",
			transcriptPath: "/test",
			cwd: "/test",
			toolInput: {},
			environment: {},
			rawInput: {} as any,
		};

		const result = await safeHookExecution(handler, context);

		expect(result.success).toBe(true);
		expect(result.message).toBe("Hook skipped");
	});
});

describe("Runtime - createHookContext", () => {
	test("should create context from raw input", () => {
		const rawInput = {
			session_id: "test-123",
			transcript_path: "/transcript",
			cwd: "/workspace",
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
		};

		const context = createHookContext(rawInput);

		expect(context.event).toBe("PreToolUse");
		expect(context.toolName).toBe("Bash");
		expect(context.sessionId).toBe("test-123");
		expect(context.cwd).toBe("/workspace");
		expect(context.toolInput).toEqual({ command: "ls -la" });
	});

	test("should handle SessionStart event", () => {
		const rawInput = {
			session_id: "test-123",
			transcript_path: "/transcript",
			cwd: "/workspace",
			hook_event_name: "SessionStart",
			message: "Session started",
		};

		const context = createHookContext(rawInput);

		expect(context.event).toBe("SessionStart");
		expect(context.toolName).toBe("SessionStart"); // SessionStart sets toolName to event name
		expect(context.sessionId).toBe("test-123");
	});

	test("should handle UserPromptSubmit event", () => {
		const rawInput = {
			session_id: "test-123",
			transcript_path: "/transcript",
			cwd: "/workspace",
			hook_event_name: "UserPromptSubmit",
			prompt: "Test prompt", // Changed from user_prompt to prompt
		};

		const context = createHookContext(rawInput);

		expect(context.event).toBe("UserPromptSubmit");
		expect(context.userPrompt).toBe("Test prompt");
	});
});

describe("Runtime - HookResults Utility", () => {
	test("should create success result", () => {
		const result = HookResults.success("Success message", { data: "test" });

		expect(result.success).toBe(true);
		expect(result.message).toBe("Success message");
		expect(result.data).toEqual({ data: "test" });
		expect(result.block).toBeUndefined();
	});

	test("should create failure result", () => {
		const result = HookResults.failure("Failure message");

		expect(result.success).toBe(false);
		expect(result.message).toBe("Failure message");
		expect(result.block).toBe(false); // Default is false, not undefined
	});

	test("should create block result", () => {
		const result = HookResults.block("Blocked message");

		expect(result.success).toBe(false);
		expect(result.message).toBe("Blocked message");
		expect(result.block).toBe(true);
	});

	test("should create skip result", () => {
		const result = HookResults.skip("Skip message");

		expect(result.success).toBe(true);
		expect(result.message).toBe("Skip message");
		// skip is not a property in the result, it's just a success with a message
	});

	test("should create warn result", () => {
		const result = HookResults.warn("Warning message", { level: "warning" });

		expect(result.success).toBe(true);
		expect(result.message).toBe("Warning message");
		expect(result.data).toEqual({ level: "warning" });
	});
});

describe("Runtime - Output Handling", () => {
	test("should be testable with custom exit handler", () => {
		const result = HookResults.success("Test message");
		let exitCode: number | undefined;

		const mockExitHandler = (code: number): never => {
			exitCode = code;
			throw new Error(`Mock exit with code ${code}`);
		};

		expect(() => {
			outputHookResult(result, "exit-code", mockExitHandler);
		}).toThrow("Mock exit with code 0");

		expect(exitCode).toBe(0);
	});

	test("should handle blocking errors with exit code 2", () => {
		const result = HookResults.block("Blocked operation");
		let exitCode: number | undefined;

		const mockExitHandler = (code: number): never => {
			exitCode = code;
			throw new Error(`Mock exit with code ${code}`);
		};

		expect(() => {
			outputHookResult(result, "exit-code", mockExitHandler);
		}).toThrow("Mock exit with code 2");

		expect(exitCode).toBe(2);
	});

	test("should handle non-blocking errors with exit code 1", () => {
		const result = HookResults.failure("Non-blocking error");
		let exitCode: number | undefined;

		const mockExitHandler = (code: number): never => {
			exitCode = code;
			throw new Error(`Mock exit with code ${code}`);
		};

		expect(() => {
			outputHookResult(result, "exit-code", mockExitHandler);
		}).toThrow("Mock exit with code 1");

		expect(exitCode).toBe(1);
	});

	test("should handle JSON mode with custom exit handler", () => {
		const result = HookResults.success("Test message");
		let exitCode: number | undefined;
		let consoleOutput: string | undefined;

		// Mock console.log to capture JSON output
		const originalLog = console.log;
		console.log = (message: string) => {
			consoleOutput = message;
		};

		const mockExitHandler = (code: number): never => {
			exitCode = code;
			throw new Error(`Mock exit with code ${code}`);
		};

		try {
			expect(() => {
				outputHookResult(result, "json", mockExitHandler);
			}).toThrow("Mock exit with code 0"); // JSON mode always exits 0

			expect(exitCode).toBe(0);
			expect(consoleOutput).toBe(
				'{"action":"continue","message":"Test message"}',
			);
		} finally {
			// Restore console.log
			console.log = originalLog;
		}
	});
});

describe("Runtime - executeHook", () => {
	test("should execute hook successfully and clear timeout", async () => {
		const handler: HookHandler = async () => {
			return HookResults.success("Hook executed successfully");
		};

		const context: HookContext = {
			event: "PreToolUse",
			toolName: "Bash",
			sessionId: "test",
			transcriptPath: "/test",
			cwd: "/test",
			toolInput: { command: "echo test" },
			environment: {},
			rawInput: {} as any,
		};

		const result = await executeHook(handler, context, { timeout: 1000 });

		expect(result.success).toBe(true);
		expect(result.message).toBe("Hook executed successfully");
		expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
		expect(result.metadata?.timestamp).toBeDefined();
	});

	test("should timeout and clear timer properly", async () => {
		const handler: HookHandler = async () => {
			// Simulate slow hook that exceeds timeout
			await new Promise((resolve) => setTimeout(resolve, 100));
			return HookResults.success("Should not reach here");
		};

		const context: HookContext = {
			event: "PreToolUse",
			toolName: "Bash",
			sessionId: "test",
			transcriptPath: "/test",
			cwd: "/test",
			toolInput: { command: "echo test" },
			environment: {},
			rawInput: {} as any,
		};

		const result = await executeHook(handler, context, {
			timeout: 50,
			throwOnError: false,
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("timed out");
		expect(result.metadata?.duration).toBeGreaterThanOrEqual(50);
	});

	test("should complete before timeout and clear timer", async () => {
		let timerCleared = false;
		const originalClearTimeout = globalThis.clearTimeout;

		// Mock clearTimeout to verify it's called
		globalThis.clearTimeout = (timer: any) => {
			timerCleared = true;
			originalClearTimeout(timer);
		};

		try {
			const handler: HookHandler = async () => {
				// Complete quickly, well before timeout
				await new Promise((resolve) => setTimeout(resolve, 10));
				return HookResults.success("Completed quickly");
			};

			const context: HookContext = {
				event: "PreToolUse",
				toolName: "Bash",
				sessionId: "test",
				transcriptPath: "/test",
				cwd: "/test",
				toolInput: { command: "echo test" },
				environment: {},
				rawInput: {} as any,
			};

			const result = await executeHook(handler, context, { timeout: 1000 });

			expect(result.success).toBe(true);
			expect(result.message).toBe("Completed quickly");
			expect(timerCleared).toBe(true); // Verify timer was cleared
		} finally {
			// Restore original clearTimeout
			globalThis.clearTimeout = originalClearTimeout;
		}
	});

	test("should handle errors and still clear timeout", async () => {
		let timerCleared = false;
		const originalClearTimeout = globalThis.clearTimeout;

		globalThis.clearTimeout = (timer: any) => {
			timerCleared = true;
			originalClearTimeout(timer);
		};

		try {
			const handler: HookHandler = async () => {
				throw new Error("Handler error");
			};

			const context: HookContext = {
				event: "PreToolUse",
				toolName: "Bash",
				sessionId: "test",
				transcriptPath: "/test",
				cwd: "/test",
				toolInput: { command: "echo test" },
				environment: {},
				rawInput: {} as any,
			};

			const result = await executeHook(handler, context, {
				timeout: 1000,
				throwOnError: false,
			});

			expect(result.success).toBe(false);
			expect(result.message).toBe("Handler error");
			expect(timerCleared).toBe(true); // Timer should be cleared even on errors
		} finally {
			globalThis.clearTimeout = originalClearTimeout;
		}
	});
});
