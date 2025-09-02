/**
 * Tests for HttpProtocol
 */

import { describe, expect, test } from "bun:test";
import { ProtocolInputError, ProtocolParseError } from "../interface.js";
import { HttpProtocol, HttpProtocolFactory } from "../protocols/http.js";

describe("HttpProtocol", () => {
	describe("readInput", () => {
		test("should read JSON from request body successfully", async () => {
			const testInput = { test: "data" };
			const request = new Request("http://test.com", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(testInput),
			});

			const protocol = new HttpProtocol(request);
			const result = await protocol.readInput();

			expect(result).toEqual(testInput);
		});

		test("should throw ProtocolInputError for wrong content type", async () => {
			const request = new Request("http://test.com", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "test data",
			});

			const protocol = new HttpProtocol(request);

			await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
		});

		test("should throw ProtocolInputError for empty body", async () => {
			const request = new Request("http://test.com", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "",
			});

			const protocol = new HttpProtocol(request);

			await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
		});

		test("should throw ProtocolInputError for invalid JSON", async () => {
			const request = new Request("http://test.com", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "invalid json",
			});

			const protocol = new HttpProtocol(request);

			await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
		});

		test("should throw ProtocolInputError for oversized body", async () => {
			const largeData = "x".repeat(2_000_000); // 2MB
			const request = new Request("http://test.com", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": largeData.length.toString(),
				},
				body: largeData,
			});

			const protocol = new HttpProtocol(request, { maxBodySize: 1_000_000 }); // 1MB limit

			await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
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

			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request);
			const context = await protocol.parseContext(input);

			expect(context.event).toBe("PreToolUse");
			expect(context.environment.PROTOCOL_TYPE).toBe("http");
			expect(context.environment.REQUEST_METHOD).toBe("POST");
			expect(context.environment.REQUEST_URL).toBe("http://test.com/");
		});

		test("should extract environment from custom headers", async () => {
			const input = {
				session_id: "test-session-123",
				transcript_path: "/tmp/transcript.md",
				cwd: "/test/dir",
				hook_event_name: "PreToolUse",
				tool_name: "Bash",
				tool_input: { command: 'echo "test"' },
			};

			const request = new Request("http://test.com", {
				method: "POST",
				headers: {
					"X-Env-Custom-Var": "custom-value",
					"X-Env-Another-Var": "another-value",
				},
			});

			const protocol = new HttpProtocol(request);
			const context = await protocol.parseContext(input);

			expect(context.environment.CUSTOM_VAR).toBe("custom-value");
			expect(context.environment.ANOTHER_VAR).toBe("another-value");
		});

		test("should throw ProtocolParseError on invalid input", async () => {
			const input = { invalid: "input" };
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request);

			await expect(protocol.parseContext(input)).rejects.toThrow(
				ProtocolParseError,
			);
		});
	});

	describe("writeOutput and writeError", () => {
		test("should store output for later response generation", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request);
			const result = { success: true, message: "Test success" };

			await protocol.writeOutput(result);
			const response = protocol.getResponse();

			expect(response.status).toBe(200);
			const responseBody = await response.json();
			expect(responseBody).toEqual(result);
		});

		test("should store error for later response generation", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request, { includeErrorDetails: true });
			const error = new Error("Test error");

			await protocol.writeError(error);
			const response = protocol.getResponse();

			expect(response.status).toBe(500);
			const responseBody = await response.json();
			expect(responseBody.error).toBe("Test error");
			expect(responseBody.type).toBe("Error");
		});

		test("should return 400 for unsuccessful results", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request);
			const result = { success: false, message: "Test failure" };

			await protocol.writeOutput(result);
			const response = protocol.getResponse();

			expect(response.status).toBe(400);
		});

		test("should include custom response headers", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request, {
				responseHeaders: { "X-Custom-Header": "custom-value" },
			});

			const result = { success: true, message: "Test" };
			await protocol.writeOutput(result);
			const response = protocol.getResponse();

			expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
			expect(response.headers.get("Content-Type")).toBe("application/json");
		});

		test("should hide error details when configured", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request, {
				includeErrorDetails: false,
			});
			const error = new Error("Sensitive error");

			await protocol.writeError(error);
			const response = protocol.getResponse();

			const responseBody = await response.json();
			expect(responseBody.error).toBe("Hook execution failed");
			expect(responseBody.type).toBeUndefined();
		});
	});

	describe("CORS support", () => {
		test("should add CORS headers when configured", async () => {
			const request = new Request("http://test.com", { method: "POST" });
			const protocol = new HttpProtocol(request, {
				cors: {
					origin: "*",
					methods: ["POST", "OPTIONS"],
					headers: ["Content-Type", "X-Custom"],
					credentials: true,
				},
			});

			const result = { success: true, message: "Test" };
			await protocol.writeOutput(result);
			const response = protocol.getResponse();

			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
				"POST, OPTIONS",
			);
			expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
				"Content-Type, X-Custom",
			);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
				"true",
			);
		});

		test("should create OPTIONS response for preflight requests", () => {
			const response = HttpProtocol.createOptionsResponse({
				cors: {
					origin: "https://example.com",
					methods: ["POST"],
					headers: ["Content-Type"],
				},
			});

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://example.com",
			);
			expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST");
			expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
		});
	});
});

describe("HttpProtocolFactory", () => {
	test("should create HttpProtocol instances", () => {
		const factory = new HttpProtocolFactory();
		const request = new Request("http://test.com", { method: "POST" });
		const protocol = factory.create({
			request,
			options: { maxBodySize: 500_000 },
		});

		expect(protocol).toBeInstanceOf(HttpProtocol);
		expect(factory.type).toBe("http");
	});
});
