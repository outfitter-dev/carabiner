/**
 * @outfitter/execution - Timeout module tests
 *
 * Tests for timeout-aware process execution with proper signal handling,
 * exit code semantics, and graceful shutdown behavior.
 */

import { describe, expect, it } from "bun:test";
import { executeHookProcess, executeWithTimeout, type Hook } from "../timeout";

describe("executeWithTimeout", () => {
  it("should execute a successful command and return result", async () => {
    const result = await executeWithTimeout("echo", ["hello world"], 5000);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello world");
    expect(result.stderr).toBe("");
    expect(result.timedOut).toBe(false);
  });

  it("should handle command that exits with non-zero code", async () => {
    const result = await executeWithTimeout("sh", ["-c", "exit 1"], 5000);

    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it("should handle command that exits with code 2", async () => {
    const result = await executeWithTimeout("sh", ["-c", "exit 2"], 5000);

    expect(result.exitCode).toBe(2);
    expect(result.timedOut).toBe(false);
  });

  it("should timeout and kill process after timeout period", async () => {
    const result = await executeWithTimeout("sleep", ["2"], 100); // 100ms timeout for 2s sleep

    expect(result.exitCode).not.toBe(0);
    expect(result.timedOut).toBe(true);
  });

  it("should collect stdout and stderr properly", async () => {
    const result = await executeWithTimeout(
      "sh",
      ["-c", 'echo "stdout message"; echo "stderr message" >&2'],
      5000
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stdout message");
    expect(result.stderr).toContain("stderr message");
    expect(result.timedOut).toBe(false);
  });

  it("should handle command not found error", async () => {
    const result = await executeWithTimeout("non-existent-command", [], 5000);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Process error");
    expect(result.timedOut).toBe(false);
  });

  it("should use default timeout of 60 seconds when not specified", async () => {
    // This test just verifies the default parameter works - we can't wait 60s in tests
    const result = await executeWithTimeout("echo", ["test"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("test");
    expect(result.timedOut).toBe(false);
  });
});

describe("executeHookProcess", () => {
  it("should execute successful hook (exit code 0)", async () => {
    const hook: Hook = {
      command: "echo",
      args: ["success"],
    };

    const result = await executeHookProcess(hook);
    expect(result.exitCode).toBe(0);
    expect(result.continue).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("should warn on non-blocking exit code (exit code 1)", async () => {
    const hook: Hook = {
      command: "sh",
      args: ["-c", 'echo "warning message" >&2; exit 1'],
    };

    const result = await executeHookProcess(hook);
    expect(result.exitCode).toBe(1);
    expect(result.continue).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("should block and exit on exit code 2", async () => {
    const hook: Hook = {
      command: "sh",
      args: ["-c", 'echo "blocking error" >&2; exit 2'],
    };

    const result = await executeHookProcess(hook);
    expect(result.exitCode).toBe(2);
    expect(result.continue).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.stopReason).toBe("blocked");
  });

  it("should handle custom timeout", async () => {
    const hook: Hook = {
      command: "sleep",
      args: ["2"],
      timeout: 100, // 100ms timeout for 2s sleep
    };

    const result = await executeHookProcess(hook);
    expect(result.timedOut).toBe(true);
    expect(result.continue).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("should pass context for logging", async () => {
    const hook: Hook = {
      command: "echo",
      args: ["test"],
    };
    const context = { event: { type: "PreToolUse" } };

    const result = await executeHookProcess(hook, context);
    expect(result.exitCode).toBe(0);
  });

  it("should handle stderr in blocking error properly", async () => {
    const hook: Hook = {
      command: "sh",
      args: ["-c", 'echo "detailed error message" >&2; exit 2'],
    };

    const result = await executeHookProcess(hook);
    expect(result.blocked).toBe(true);
    expect(result.stderr).toContain("detailed error message");
  });
});

describe("Hook configuration", () => {
  it("should accept hook configuration with all fields", () => {
    const hook: Hook = {
      command: "echo",
      args: ["test"],
      timeout: 30_000,
    };

    expect(hook.command).toBe("echo");
    expect(hook.args).toEqual(["test"]);
    expect(hook.timeout).toBe(30_000);
  });

  it("should accept hook configuration without timeout", () => {
    const hook: Hook = {
      command: "echo",
      args: ["test"],
    };

    expect(hook.command).toBe("echo");
    expect(hook.args).toEqual(["test"]);
    expect(hook.timeout).toBeUndefined();
  });
});
