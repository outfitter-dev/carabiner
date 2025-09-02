/**
 * Tests for TestProtocol
 */

import { describe, expect, test } from "bun:test";
import { ProtocolParseError } from "../interface.js";
import {
	createNotificationInput,
	createToolHookInput,
	createUserPromptInput,
	TestProtocol,
	TestProtocolFactory,
} from "../protocols/test.js";

describe("TestProtocol", () => {
	describe("readInput", () => {
		test("should return pre-configured input data", async () => {
			const testInput = { test: "data" };
			const protocol = new TestProtocol(testInput);

			const result = await protocol.readInput();

			expect(result).toEqual(testInput);
			expect(protocol.callCounts.readInput).toBe(1);
		});

		test("should capture timing when enabled", async () => {
			const testInput = { test: "data" };
			const protocol = new TestProtocol(testInput, { captureTiming: true });

			await protocol.readInput();

			expect(protocol.timing.readInputTime).toBeGreaterThan(0);
		});
	});

	describe("parseContext", () => {
		test("should parse valid tool hook input", async () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/test/dir",
				hook_event_name: "PreToolUse",
				tool_name: "Bash",
				tool_input: { command: 'echo "test"' },
			};

			const protocol = new TestProtocol(input);
			const context = await protocol.parseContext(input);

			expect(context.event).toBe("PreToolUse");
			expect(context.environment).toBeDefined();
			expect(protocol.callCounts.parseContext).toBe(1);
			expect(protocol.callCounts.parseContext).toBe(1);
		});

		test("should include custom environment variables", async () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/test/dir",
				hook_event_name: "PreToolUse",
				tool_name: "Bash",
				tool_input: { command: 'echo "test"' },
			};

			const protocol = new TestProtocol(input, {
				environment: { CUSTOM_VAR: "custom-value" },
			});

			const context = await protocol.parseContext(input);

			expect(context.environment.CUSTOM_VAR).toBe("custom-value");
			expect(context.environment).toBeDefined();
		});

		test("should throw ProtocolParseError on invalid input by default", async () => {
			const input = { invalid: "input" };
			const protocol = new TestProtocol(input);

			await expect(protocol.parseContext(input)).rejects.toThrow(
				ProtocolParseError,
			);
		});

		test("should return minimal context in non-strict mode", async () => {
			const input = { invalid: "input" };
			const protocol = new TestProtocol(input, { strictValidation: false });

			const context = await protocol.parseContext(input);

			expect(context.event).toBe("PreToolUse");
			expect(context.environment).toBeDefined();
		});

		test("should capture timing when enabled", async () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/test/dir",
				hook_event_name: "PreToolUse",
				tool_name: "Bash",
				tool_input: { command: 'echo "test"' },
			};

			const protocol = new TestProtocol(input, { captureTiming: true });

			await protocol.parseContext(input);

			expect(protocol.timing.parseContextTime).toBeGreaterThan(0);
		});
	});

	describe("writeOutput", () => {
		test("should capture output for testing assertions", async () => {
			const protocol = new TestProtocol({});
			const result = { success: true, message: "Test success" };

			await protocol.writeOutput(result);

			expect(protocol.output).toEqual(result);
			expect(protocol.callCounts.writeOutput).toBe(1);
		});

		test("should capture timing when enabled", async () => {
			const protocol = new TestProtocol({}, { captureTiming: true });

			// Start timing by calling readInput first
			await protocol.readInput();

			const result = { success: true, message: "Test" };
			await protocol.writeOutput(result);

			expect(protocol.timing.writeOutputTime).toBeGreaterThan(0);
			expect(protocol.timing.executionTime).toBeGreaterThan(0);
		});
	});

	describe("writeError", () => {
		test("should capture error for testing assertions", async () => {
			const protocol = new TestProtocol({});
			const error = new Error("Test error");

			await protocol.writeError(error);

			expect(protocol.error).toBe(error);
			expect(protocol.callCounts.writeError).toBe(1);
		});

		test("should capture timing when enabled", async () => {
			const protocol = new TestProtocol({}, { captureTiming: true });

			// Start timing by calling readInput first
			await protocol.readInput();

			const error = new Error("Test error");
			await protocol.writeError(error);

			expect(protocol.timing.writeErrorTime).toBeGreaterThan(0);
			expect(protocol.timing.executionTime).toBeGreaterThan(0);
		});
	});

	describe("helper properties and methods", () => {
		test("wasSuccessful should return true for successful execution", async () => {
			const protocol = new TestProtocol({});

			expect(protocol.wasSuccessful).toBe(false);

			await protocol.writeOutput({ success: true, message: "Success" });

			expect(protocol.wasSuccessful).toBe(true);
		});

		test("hasFailed should return true for failed execution", async () => {
			const protocol = new TestProtocol({});

			expect(protocol.hasFailed).toBe(false);

			await protocol.writeError(new Error("Test error"));

			expect(protocol.hasFailed).toBe(true);
		});

		test("hasFailed should return true for unsuccessful result", async () => {
			const protocol = new TestProtocol({});

			await protocol.writeOutput({ success: false, message: "Failure" });

			expect(protocol.hasFailed).toBe(true);
		});

		test("result should return output or error", async () => {
			const protocol = new TestProtocol({});
			const result = { success: true, message: "Success" };

			expect(protocol.result).toBeUndefined();

			await protocol.writeOutput(result);

			expect(protocol.result).toBe(result);
		});

		test("reset should clear all captured data", async () => {
			const protocol = new TestProtocol({}, { captureTiming: true });

			await protocol.readInput();
			await protocol.writeOutput({ success: true, message: "Test" });

			expect(protocol.output).toBeDefined();
			expect(protocol.callCounts.readInput).toBe(1);
			expect(protocol.timing.readInputTime).toBeDefined();

			protocol.reset();

			expect(protocol.output).toBeUndefined();
			expect(protocol.error).toBeUndefined();
			expect(protocol.callCounts.readInput).toBe(0);
			expect(protocol.timing.readInputTime).toBeUndefined();
		});
	});
});

describe("TestProtocolFactory", () => {
	test("should create TestProtocol instances", () => {
		const factory = new TestProtocolFactory();
		const testInput = { test: "data" };
		const protocol = factory.create({
			input: testInput,
			options: { captureTiming: true },
		});

		expect(protocol).toBeInstanceOf(TestProtocol);
		expect(factory.type).toBe("test");
	});
});

describe("Test Input Utilities", () => {
	test("should create valid tool hook input", () => {
		const input = createToolHookInput({
			tool_name: "Write",
			tool_input: { file_path: "/test/file.txt", content: "test" },
		});

		expect(input.session_id).toBe("test-session-123");
		expect(input.hook_event_name).toBe("PreToolUse");
		expect(input.tool_name).toBe("Write");
		expect(input.tool_input.file_path).toBe("/test/file.txt");
	});

	test("should create valid user prompt input", () => {
		const input = createUserPromptInput({
			prompt: "Custom test prompt",
		});

		expect(input.session_id).toBe("test-session-123");
		expect(input.hook_event_name).toBe("UserPromptSubmit");
		expect(input.prompt).toBe("Custom test prompt");
	});

	test("should create valid notification input", () => {
		const input = createNotificationInput({
			notification: "Custom notification",
		});

		expect(input.session_id).toBe("test-session-123");
		expect(input.hook_event_name).toBe("SessionStart");
		expect(input.notification).toBe("Custom notification");
	});

	test("should apply overrides correctly", () => {
		const input = createToolHookInput({
			session_id: "custom-session-456",
			cwd: "/custom/dir",
		});

		expect(input.session_id).toBe("custom-session-456");
		expect(input.cwd).toBe("/custom/dir");
		expect(input.tool_name).toBe("Bash"); // Default preserved
	});
});
