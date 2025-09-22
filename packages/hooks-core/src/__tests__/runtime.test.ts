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
  isBashToolInput,
  outputHookResult,
  safeHookExecution,
} from "../runtime";
import type {
  HookHandler,
  HookResult,
  PostToolUseHookInput,
  PreToolUseHookInput,
  SessionStartHookInput,
} from "../types";

function expectSyncResult(result: HookResult) {
  if ((result as { async?: boolean }).async === true) {
    throw new Error("Expected synchronous hook result");
  }
  return result as Extract<HookResult, { continue?: boolean }>;
}

describe("Runtime - Input Creation", () => {
  test("should create Bash input correctly", () => {
    const input = createBashInput(
      "PreToolUse",
      "echo test"
    ) as PreToolUseHookInput;

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Bash");
    expect(input.session_id).toBe("test-session");
    expect((input.tool_input as { command: string }).command).toBe("echo test");
  });

  test("should create File input for Write operation", () => {
    const input = createFileInput(
      "PostToolUse",
      "Write",
      "test.ts"
    ) as PostToolUseHookInput;

    expect(input.hook_event_name).toBe("PostToolUse");
    expect(input.tool_name).toBe("Write");
    expect((input.tool_input as { file_path: string }).file_path).toBe(
      "test.ts"
    );
  });

  test("should create File input for Edit operation", () => {
    const input = createFileInput(
      "PreToolUse",
      "Edit",
      "test.ts"
    ) as PreToolUseHookInput;

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Edit");
    expect((input.tool_input as { file_path: string }).file_path).toBe(
      "test.ts"
    );
  });

  test("should create File input for Read operation", () => {
    const input = createFileInput(
      "PreToolUse",
      "Read",
      "test.ts"
    ) as PreToolUseHookInput;

    expect(input.hook_event_name).toBe("PreToolUse");
    expect(input.tool_name).toBe("Read");
    expect((input.tool_input as { file_path: string }).file_path).toBe(
      "test.ts"
    );
  });

  test("should pass-through input creation", () => {
    const originalInput: SessionStartHookInput = {
      hook_event_name: "SessionStart",
      session_id: "my-session",
      transcript_path: "/my/transcript.md",
      cwd: "/my/cwd",
      source: "startup",
    };

    const context = createHookContext(originalInput);

    expect(context.event).toBe("SessionStart");
    expect(context.sessionId).toBe("my-session");
    expect(context.cwd).toBe("/my/cwd");
    expect(context.transcriptPath).toBe("/my/transcript.md");
    expect(context.rawInput).toMatchObject(originalInput);
  });

  test("should create context from event shorthand with overrides", () => {
    const context = createHookContext(
      "PreToolUse",
      {
        session_id: "session-456",
        tool_name: "Bash",
        tool_input: { command: "echo shorthand" },
      },
      {
        environment: { CLAUDE_PROJECT_DIR: "/workspace/project" },
      }
    );

    expect(context.event).toBe("PreToolUse");
    expect(context.sessionId).toBe("session-456");
    expect(context.toolName).toBe("Bash");
    expect(context.toolInput).toEqual({ command: "echo shorthand" });
    expect(context.cwd).toBe("/workspace/project");
  });
});

describe("Runtime - Hook Execution", () => {
  test("should execute successful hook", async () => {
    const handler: HookHandler = async (_context) => {
      return HookResults.success("Hook executed");
    };

    const context = createHookContext(
      createBashInput("PreToolUse", "test command")
    );
    const result = await safeHookExecution(handler, context);
    const sync = expectSyncResult(result);

    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Hook executed");
    expect(sync.metadata?.provider?.id).toBe("claude");
  });

  test("should handle hook errors properly", async () => {
    const handler: HookHandler = async () => {
      throw new Error("Hook failed");
    };

    const context = createHookContext(
      createBashInput("PreToolUse", "test command")
    );
    const result = await safeHookExecution(handler, context);
    const sync = expectSyncResult(result);

    expect(sync.continue).toBe(false);
    expect(sync.systemMessage).toBe("Hook failed");
    expect(sync.metadata?.provider?.id).toBe("claude");
  });

  test("should handle security blocking", async () => {
    const handler: HookHandler = async (context) => {
      if (
        context.toolInput &&
        isBashToolInput(context.toolInput) &&
        context.toolInput.command === "rm -rf /"
      ) {
        return HookResults.block("Dangerous command blocked");
      }
      if (context.toolInput && !isBashToolInput(context.toolInput)) {
        return HookResults.block("Dangerous command blocked");
      }
      return HookResults.success();
    };

    const context = createHookContext(
      createBashInput("PreToolUse", "rm -rf /")
    );
    const result = await safeHookExecution(handler, context);
    const sync = expectSyncResult(result);

    expect(sync.continue).toBe(false);
    expect(sync.systemMessage).toBe("Dangerous command blocked");
    expect(sync.stopReason).toBe("blocked");
    expect(sync.metadata?.provider?.id).toBe("claude");
  });

  test("should handle hook with fallback", async () => {
    const handler: HookHandler = async () => {
      throw new Error("Primary hook failed");
    };

    const fallback = () => HookResults.success("Fallback executed");

    const context = createHookContext(
      createBashInput("PreToolUse", "test command")
    );
    const result = await safeHookExecution(handler, context, fallback);
    const sync = expectSyncResult(result);

    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Fallback executed");
    expect(sync.metadata?.provider?.id).toBe("claude");
  });
});

describe("Runtime - HookResults Utility", () => {
  test("should create success result", () => {
    const result = HookResults.success("Success message");

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Success message");
  });

  test("should create failure result", () => {
    const result = HookResults.failure("Failure message");

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(false);
    expect(sync.systemMessage).toBe("Failure message");
  });

  test("should create block result", () => {
    const result = HookResults.block("Blocked message");

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(false);
    expect(sync.systemMessage).toBe("Blocked message");
    expect(sync.stopReason).toBe("blocked");
  });

  test("should create skip result", () => {
    const result = HookResults.skip("Skip message");

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Skip message");
  });

  test("should create warn result", () => {
    const result = HookResults.warn("Warning message");

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Warning message");
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
    const handler: HookHandler = async () => {
      return HookResults.success("Success");
    };

    const context = createHookContext(
      createBashInput("PreToolUse", "test command")
    );
    const result = await executeHook(handler, context, { timeout: 1000 });
    const sync = expectSyncResult(result);

    expect(sync.continue).toBe(true);
    expect(sync.systemMessage).toBe("Success");
    expect(sync.metadata?.provider?.id).toBe("claude");
  });

  test("should timeout and return failure", async () => {
    const handler: HookHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return HookResults.success("Should not reach here");
    };

    const context = createHookContext(
      createBashInput("PreToolUse", "test command")
    );
    const result = await executeHook(handler, context, {
      timeout: 50,
      throwOnError: false,
    });

    const sync = expectSyncResult(result);
    expect(sync.continue).toBe(false);
    expect(sync.systemMessage).toContain("timed out");
    expect(sync.metadata?.provider?.id).toBe("claude");
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
      const handler: HookHandler = async () => {
        return HookResults.success("Fast execution");
      };

      const context = createHookContext(
        createBashInput("PreToolUse", "test command")
      );
      const result = await executeHook(handler, context, { timeout: 1000 });
      const sync = expectSyncResult(result);

      expect(sync.continue).toBe(true);
      expect(sync.systemMessage).toBe("Fast execution");
      expect(timerCleared).toBe(true);
      expect(sync.metadata?.provider?.id).toBe("claude");
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

      const context = createHookContext(
        createBashInput("PreToolUse", "test command")
      );
      const result = await executeHook(handler, context, {
        timeout: 1000,
        throwOnError: false,
      });

      const sync = expectSyncResult(result);
      expect(sync.continue).toBe(false);
      expect(sync.systemMessage).toBe("Handler error");
      expect(timerCleared).toBe(true);
      expect(sync.metadata?.provider?.id).toBe("claude");
    } finally {
      globalThis.clearTimeout = originalClearTimeout;
    }
  });
});
