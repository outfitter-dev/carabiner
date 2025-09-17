/**
 * Runtime tests for hook execution and context management
 */

import { describe, expect, test } from "bun:test";
import { stdout } from "../logging/stdio";
import {
  createBashInput,
  createFileInput,
  createHookContext,
  executeHook,
  HookResults,
  outputHookResult,
  safeHookExecution,
} from "../runtime";
import type { HookCallback } from "../types";

describe("Runtime - Input Creation", () => {
  test("should create Bash input correctly", () => {
    const input = createBashInput("PreToolUse", "echo test");

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Bash");
    expect(input.session_id).toBe("test-session");
    expect(input.tool_input).toEqual({ command: "echo test" });
  });

  test("should create File input for Write operation", () => {
    const input = createFileInput("PostToolUse", "Write", "test.ts");

    expect(input.hook_event_name).toBe("PostToolUse");
    expect(input.tool_name).toBe("Write");
    expect(input.tool_input.file_path).toBe("test.ts");
  });

  test("should create File input for Edit operation", () => {
    const input = createFileInput("PreToolUse", "Edit", "test.ts");

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Edit");
    expect(input.tool_input.file_path).toBe("test.ts");
  });

  test("should create File input for Read operation", () => {
    const input = createFileInput("PreToolUse", "Read", "test.ts");

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Read");
    expect(input.tool_input.file_path).toBe("test.ts");
  });

  test("should pass-through input creation", () => {
    const originalInput = {
      hook_event_name: "SessionStart" as const,
      session_id: "my-session",
      transcript_path: "/my/transcript.md",
      cwd: "/my/cwd",
    };

    const input = createHookContext(originalInput);

    expect(input).toMatchObject(originalInput);
  });
});

describe("Runtime - Hook Execution", () => {
  test("should execute successful hook", async () => {
    const handler: HookCallback = async (_input) => {
      return HookResults.success("Hook executed");
    };

    const input = createBashInput("PreToolUse", "test command");
    const result = await safeHookExecution(handler, input);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Hook executed");
  });

  test("should handle hook errors properly", async () => {
    const handler: HookCallback = async () => {
      throw new Error("Hook failed");
    };

    const input = createBashInput("PreToolUse", "test command");
    const result = await safeHookExecution(handler, input);

    expect(result.continue).toBe(false);
    expect(result.systemMessage).toBe("Hook failed");
  });

  test("should handle security blocking", async () => {
    const handler: HookCallback = async (input) => {
      if ("tool_input" in input && input.tool_input.command === "rm -rf /") {
        return HookResults.block("Dangerous command blocked");
      }
      return HookResults.success();
    };

    const input = createBashInput("PreToolUse", "rm -rf /");
    const result = await safeHookExecution(handler, input);

    expect(result.continue).toBe(false);
    expect(result.systemMessage).toBe("Dangerous command blocked");
    expect(result.stopReason).toBe("blocked");
  });

  test("should handle hook with fallback", async () => {
    const handler: HookCallback = async () => {
      throw new Error("Primary hook failed");
    };

    const fallback = () => HookResults.success("Fallback executed");

    const input = createBashInput("PreToolUse", "test command");
    const result = await safeHookExecution(handler, input, fallback);

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Fallback executed");
  });
});

describe("Runtime - HookResults Utility", () => {
  test("should create success result", () => {
    const result = HookResults.success("Success message");

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Success message");
  });

  test("should create failure result", () => {
    const result = HookResults.failure("Failure message");

    expect(result.continue).toBe(false);
    expect(result.systemMessage).toBe("Failure message");
  });

  test("should create block result", () => {
    const result = HookResults.block("Blocked message");

    expect(result.continue).toBe(false);
    expect(result.systemMessage).toBe("Blocked message");
    expect(result.stopReason).toBe("blocked");
  });

  test("should create skip result", () => {
    const result = HookResults.skip("Skip message");

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Skip message");
  });

  test("should create warn result", () => {
    const result = HookResults.warn("Warning message");

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Warning message");
  });
});

describe("Runtime - Output Handling", () => {
  test("should be testable with custom exit handler", () => {
    let exitCode: number | undefined;
    const mockExit = (code: number) => {
      exitCode = code;
      return undefined as never;
    };

    const result = { continue: true, systemMessage: "Success" };

    try {
      outputHookResult(result, mockExit);
    } catch {
      // Expected to throw since it calls never-returning exit handler
    }

    expect(exitCode).toBe(0);
  });

  test("should handle output via stdout", () => {
    const originalStdout = stdout.json;
    let capturedOutput: any;

    stdout.json = (data: any) => {
      capturedOutput = data;
      return originalStdout.call(stdout, data);
    };

    const result = { continue: false, systemMessage: "Failed" };

    try {
      outputHookResult(result, () => undefined as never);
    } catch {
      // Expected to throw
    }

    expect(capturedOutput).toEqual(result);

    // Restore original function
    stdout.json = originalStdout;
  });
});

describe("Runtime - executeHook", () => {
  test("should execute handler successfully", async () => {
    const handler: HookCallback = async () => {
      return HookResults.success("Success");
    };

    const input = createBashInput("PreToolUse", "test command");
    const result = await executeHook(handler, input, { timeout: 1000 });

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBe("Success");
  });

  test("should timeout and return failure", async () => {
    const handler: HookCallback = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Longer than timeout
      return HookResults.success("Should not reach here");
    };

    const input = createBashInput("PreToolUse", "test command");
    const result = await executeHook(handler, input, {
      timeout: 50,
      throwOnError: false,
    });

    expect(result.continue).toBe(false);
    expect(result.systemMessage).toContain("timed out");
  });

  test("should complete before timeout", async () => {
    let timerCleared = false;
    const originalClearTimeout = globalThis.clearTimeout;

    // Mock clearTimeout to verify it's called
    globalThis.clearTimeout = (timer: any) => {
      timerCleared = true;
      originalClearTimeout(timer);
    };

    try {
      const handler: HookCallback = async () => {
        return HookResults.success("Fast execution");
      };

      const input = createBashInput("PreToolUse", "test command");
      const result = await executeHook(handler, input, { timeout: 1000 });

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe("Fast execution");
      expect(timerCleared).toBe(true);
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
      const handler: HookCallback = async () => {
        throw new Error("Handler error");
      };

      const input = createBashInput("PreToolUse", "test command");
      const result = await executeHook(handler, input, {
        timeout: 1000,
        throwOnError: false,
      });

      expect(result.continue).toBe(false);
      expect(result.systemMessage).toBe("Handler error");
      expect(timerCleared).toBe(true);
    } finally {
      globalThis.clearTimeout = originalClearTimeout;
    }
  });
});
