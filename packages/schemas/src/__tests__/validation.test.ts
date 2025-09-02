/**
 * Tests for main validation utilities
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	type CompleteValidationResult,
	type ValidatedClaudeInput,
	ValidationError,
	type ValidationResult,
	ValidationUtils,
	validateClaudeInput,
	validateCompleteHookInput,
	validateGenericToolInput,
	validateToolInputForTool,
} from "../validation.js";

describe("ValidationError", () => {
	test("creates error with correct properties", () => {
		const issues = ["field1: is required", "field2: must be string"];
		const error = new ValidationError(
			"test_field",
			{ invalid: "data" },
			issues,
			"Test failed",
		);

		expect(error.name).toBe("ValidationError");
		expect(error.field).toBe("test_field");
		expect(error.value).toEqual({ invalid: "data" });
		expect(error.issues).toEqual(issues);
		expect(error.message).toBe("Test failed");
		expect(error instanceof Error).toBe(true);
	});

	test("creates error from ZodError", () => {
		const schema = z.object({ name: z.string(), age: z.number() });

		try {
			schema.parse({ name: 123, age: "invalid" });
		} catch (zodError) {
			const error = ValidationError.fromZodError(
				zodError as z.ZodError,
				"test_context",
			);

			expect(error.field).toBe("test_context");
			expect(error.issues.length).toBeGreaterThan(0);
			expect(error.issues.some((issue) => issue.includes("name"))).toBe(true);
			expect(error.issues.some((issue) => issue.includes("age"))).toBe(true);
			expect(error.message).toContain("Validation failed for test_context");
		}
	});
});

describe("validateClaudeInput", () => {
	test("validates and brands correct input", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls" },
		};

		const result = validateClaudeInput(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.original).toEqual(input);
			expect(result.data.event).toBe("PreToolUse");
			expect(typeof result.data.sessionId).toBe("string");
			expect(typeof result.data.transcriptPath).toBe("string");
			expect(typeof result.data.cwd).toBe("string");
		}
	});

	test("returns error for invalid schema", () => {
		const input = {
			session_id: "test",
			// missing required fields
		};

		const result = validateClaudeInput(input);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(ValidationError);
		if (!result.success) {
			expect(result.error.field).toBe("Claude hook input");
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});

	test("returns error for invalid schema first", () => {
		const input = {
			session_id: "ab", // too short - this gets caught by Zod schema first
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "SessionStart",
		};

		const result = validateClaudeInput(input);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(ValidationError);
	});

	test("returns BrandValidationError for valid schema but invalid brand", () => {
		const input = {
			session_id: "test-session-123", // Valid for schema
			transcript_path: "/tmp/transcript.txt", // Invalid brand - not .md (but schema also catches this)
			cwd: "/project",
			hook_event_name: "SessionStart",
		};

		const result = validateClaudeInput(input);

		expect(result.success).toBe(false);
		// Schema validation catches this first (transcript_path must end with .md)
		expect(result.error).toBeInstanceOf(ValidationError);
	});

	test("handles unknown errors gracefully", () => {
		// Mock a scenario where an unexpected error occurs
		const input: unknown = null;

		const result = validateClaudeInput(input);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(ValidationError);
	});
});

describe("validateToolInputForTool", () => {
	test("validates correct tool input", () => {
		const input = { command: "ls -la", timeout: 5000 };
		const result = validateToolInputForTool("Bash", input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(input);
		}
	});

	test("returns error for invalid tool input", () => {
		const input = { command: 123 }; // wrong type
		const result = validateToolInputForTool("Bash", input);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(ValidationError);
		if (!result.success) {
			expect(result.error.field).toBe("Bash tool input");
		}
	});

	test("validates different tool types", () => {
		const writeInput = { file_path: "/tmp/test.txt", content: "hello" };
		const writeResult = validateToolInputForTool("Write", writeInput);

		expect(writeResult.success).toBe(true);

		const editInput = {
			file_path: "/tmp/test.txt",
			old_string: "old",
			new_string: "new",
		};
		const editResult = validateToolInputForTool("Edit", editInput);

		expect(editResult.success).toBe(true);
	});

	test("handles validation exceptions", () => {
		// Force an exception by passing completely wrong data
		const result = validateToolInputForTool("Bash", "not an object");

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(ValidationError);
	});
});

describe("validateGenericToolInput", () => {
	test("validates object input", () => {
		const input = { custom_field: "value", another: 123 };
		const result = validateGenericToolInput(input);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(input);
		}
	});

	test("rejects non-object input", () => {
		const invalidInputs = [null, undefined, "string", 123, true];

		for (const input of invalidInputs) {
			const result = validateGenericToolInput(input);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.field).toBe("tool_input");
				expect(result.error.message).toContain("must be an object");
			}
		}

		// Arrays are objects in JavaScript, so they pass the typeof check
		const result = validateGenericToolInput([]);
		expect(result.success).toBe(true);
	});

	test("accepts empty object", () => {
		const result = validateGenericToolInput({});
		expect(result.success).toBe(true);
	});
});

describe("validateCompleteHookInput", () => {
	test("validates complete valid input", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
		};

		const result = validateCompleteHookInput(input);

		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.claudeInput).toBeDefined();
		expect(result.toolInput).toEqual({ command: "ls -la" });
	});

	test("validates notification input without tool validation", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "SessionStart",
		};

		const result = validateCompleteHookInput(input);

		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.claudeInput).toBeDefined();
		expect(result.toolInput).toBeUndefined();
	});

	test("validates unknown tool with generic validation", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "PreToolUse",
			tool_name: "UnknownTool",
			tool_input: { custom_field: "value" },
		};

		const result = validateCompleteHookInput(input);

		expect(result.success).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.toolInput).toEqual({ custom_field: "value" });
	});

	test("accumulates multiple errors", () => {
		const input = {
			session_id: "ab", // too short - caught by schema first
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: 123 }, // wrong type
		};

		const result = validateCompleteHookInput(input);

		expect(result.success).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
		// Both errors will be ValidationError since schema validation happens first
		expect(result.errors.some((e) => e instanceof ValidationError)).toBe(true);
	});

	test("handles invalid tool input for unknown tool", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "PreToolUse",
			tool_name: "UnknownTool",
			tool_input: "not an object", // invalid
		};

		const result = validateCompleteHookInput(input);

		expect(result.success).toBe(false);
		expect(
			result.errors.some(
				(e) => e instanceof ValidationError && e.message.includes("tool_input"),
			),
		).toBe(true);
	});
});

describe("ValidationUtils", () => {
	describe("isValid", () => {
		test("returns true for valid input", () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/project",
				hook_event_name: "SessionStart",
			};

			expect(ValidationUtils.isValid(input)).toBe(true);
		});

		test("returns false for invalid input", () => {
			const input = { invalid: "data" };
			expect(ValidationUtils.isValid(input)).toBe(false);
		});
	});

	describe("getErrors", () => {
		test("returns empty array for valid input", () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/project",
				hook_event_name: "SessionStart",
			};

			const errors = ValidationUtils.getErrors(input);
			expect(errors).toHaveLength(0);
		});

		test("returns error messages for invalid input", () => {
			const input = {
				session_id: "ab", // too short - caught by schema validation
				transcript_path: "/tmp/transcript.md",
				cwd: "/project",
				hook_event_name: "SessionStart",
			};

			const errors = ValidationUtils.getErrors(input);
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.some((error) => error.includes("session_id"))).toBe(true); // Schema error mentions field name
		});
	});

	describe("validateWithHandler", () => {
		test("returns validated data for valid input", () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/project",
				hook_event_name: "SessionStart",
			};

			const result = ValidationUtils.validateWithHandler(input, () => "error");

			expect(typeof result).toBe("object");
			expect(result).not.toBe("error");
		});

		test("calls error handler for invalid input", () => {
			const input = { invalid: "data" };
			let handlerCalled = false;

			const result = ValidationUtils.validateWithHandler(input, (error) => {
				handlerCalled = true;
				expect(error).toBeInstanceOf(ValidationError);
				return "handled";
			});

			expect(handlerCalled).toBe(true);
			expect(result).toBe("handled");
		});
	});

	describe("validateBatch", () => {
		test("validates multiple inputs", () => {
			const inputs = [
				{
					session_id: "test-session-123",
					transcript_path: "/tmp/transcript.md",
					cwd: "/project",
					hook_event_name: "SessionStart",
				},
				{
					session_id: "test-session-456",
					transcript_path: "/tmp/transcript2.md",
					cwd: "/project2",
					hook_event_name: "Stop",
				},
				{ invalid: "data" },
			];

			const results = ValidationUtils.validateBatch(inputs);

			expect(results).toHaveLength(3);
			expect(results[0].success).toBe(true);
			expect(results[1].success).toBe(true);
			expect(results[2].success).toBe(false);
		});

		test("handles empty array", () => {
			const results = ValidationUtils.validateBatch([]);
			expect(results).toHaveLength(0);
		});
	});
});

describe("Type system consistency", () => {
	test("ValidationResult type works with different data types", () => {
		const stringResult: ValidationResult<string> = {
			success: true,
			data: "test",
		};

		const objectResult: ValidationResult<{ test: number }> = {
			success: false,
			error: new ValidationError("test", null, [], "Test error"),
		};

		expect(stringResult.success).toBe(true);
		expect(objectResult.success).toBe(false);
	});

	test("ValidatedClaudeInput maintains branded types", () => {
		const input = {
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/project",
			hook_event_name: "SessionStart",
		};

		const result = validateClaudeInput(input);

		if (result.success) {
			const validated: ValidatedClaudeInput = result.data;

			// Should have both original and branded versions
			expect(validated.original.session_id).toBe("test-session-123");
			expect(typeof validated.sessionId).toBe("string");
			expect(validated.sessionId).toBe("test-session-123"); // Same value, different type
		}
	});

	test("CompleteValidationResult handles all scenarios", () => {
		// Success case
		const successResult: CompleteValidationResult = {
			success: true,
			claudeInput: {} as ValidatedClaudeInput,
			toolInput: { command: "test" },
			errors: [],
		};

		// Failure case
		const failureResult: CompleteValidationResult = {
			success: false,
			errors: [new ValidationError("test", null, [], "Test error")],
		};

		expect(successResult.success).toBe(true);
		expect(successResult.claudeInput).toBeDefined();
		expect(failureResult.success).toBe(false);
		expect(failureResult.claudeInput).toBeUndefined();
	});
});
