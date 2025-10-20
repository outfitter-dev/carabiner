/**
 * @outfitter/execution - Hook executor tests
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  createProtocol,
  type HookProtocol,
  type TestProtocol,
} from "@carabiner/protocol";
import type { HookHandler, HookResult } from "@carabiner/types";
import {
  createDirectoryPath,
  createNotificationContext,
  createSessionId,
  createTranscriptPath,
  isToolHookContext,
} from "@carabiner/types";
import { HookExecutor } from "../executor";
import { MetricsCollector } from "../metrics";

describe("HookExecutor", () => {
  let mockProtocol: TestProtocol;

  beforeEach(() => {
    const mockInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
    };
    mockProtocol = createProtocol("test", { input: mockInput }) as TestProtocol;
  });

  test("should execute hook handler", async () => {
    const handler: HookHandler = (context) => {
      expect(context.event).toBe("PreToolUse");
      if (isToolHookContext(context)) {
        expect(context.toolName).toBe("Bash");
      }
      return { continue: true, systemMessage: "Hook executed successfully" };
    };

    const executor = new HookExecutor(mockProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(mockProtocol.output).toBeDefined();
    expect(mockProtocol.output?.continue).not.toBe(false);
  });

  test("should collect metrics", async () => {
    const metricsCollector = new MetricsCollector();
    const handler: HookHandler = async () => ({ continue: true });

    const executor = new HookExecutor(mockProtocol, {
      exitProcess: false,
      collectMetrics: true,
      metricsCollector,
    });

    await executor.execute(handler);

    const metrics = metricsCollector.getMetrics();
    expect(metrics).toHaveLength(1);

    const metric = metrics[0];
    if (metric) {
      expect(metric.event).toBe("PreToolUse");
      expect(metric.toolName).toBe("Bash");
      expect(metric.success).toBe(true);
      expect(metric.timing.duration).toBeGreaterThan(0);
    }
  });

  test("should handle timeout and cleanup timer", async () => {
    // Track if setTimeout and clearTimeout are called properly
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    let setTimeoutCalled = false;
    let clearTimeoutCalled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Mock setTimeout to track calls
    global.setTimeout = ((callback: () => void, ms: number) => {
      setTimeoutCalled = true;
      timeoutId = originalSetTimeout(callback, ms);
      return timeoutId;
    }) as typeof setTimeout;

    // Mock clearTimeout to track cleanup
    global.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      if (id === timeoutId) {
        clearTimeoutCalled = true;
      }
      originalClearTimeout(id);
    }) as typeof clearTimeout;

    try {
      const handler: HookHandler = async () => {
        // Simulate work that completes before timeout
        await new Promise((resolve) => originalSetTimeout(resolve, 50));
        return { continue: true, systemMessage: "Completed" };
      };

      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        timeout: 500, // 500ms timeout
        collectMetrics: false,
      });

      await executor.execute(handler);

      // Verify setTimeout was called for the timeout
      expect(setTimeoutCalled).toBe(true);

      // Verify clearTimeout was called to cleanup
      expect(clearTimeoutCalled).toBe(true);

      // Verify the handler succeeded
      expect(mockProtocol.output?.continue).not.toBe(false);
      expect(mockProtocol.output?.systemMessage).toBe("Completed");
    } finally {
      // Restore original functions
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  test("should cleanup timer even when handler fails", async () => {
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;

    let clearTimeoutCalled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    global.setTimeout = ((callback: () => void, ms: number) => {
      timeoutId = originalSetTimeout(callback, ms);
      return timeoutId;
    }) as typeof setTimeout;

    global.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
      if (id === timeoutId) {
        clearTimeoutCalled = true;
      }
      originalClearTimeout(id);
    }) as typeof clearTimeout;

    try {
      const handler: HookHandler = () => {
        throw new Error("Handler failed");
      };

      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        timeout: 500,
        collectMetrics: false,
      });

      await executor.execute(handler);

      // Verify clearTimeout was called even though handler failed
      expect(clearTimeoutCalled).toBe(true);

      // Verify the error was handled via writeError
      expect(mockProtocol.error).toBeDefined();
      expect(mockProtocol.error?.message).toContain("systemMessage");
    } finally {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });

  test("should parse JSON output correctly", async () => {
    const mockInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
    };
    const testProtocol = createProtocol("test", {
      input: mockInput,
      options: { strictValidation: false },
    }) as TestProtocol;

    const handler: HookHandler = () => {
      return {
        continue: true,
        additionalContext: "test context",
        hookSpecificOutput: {
          permissionDecision: "allow",
          permissionDecisionReason: "test reason",
        },
      };
    };

    const executor = new HookExecutor(testProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(testProtocol.output).toBeDefined();
    expect(testProtocol.output?.continue).toBe(true);
    expect(testProtocol.output?.additionalContext).toBe("test context");
  });

  test("should handle permission decision in hookSpecificOutput", async () => {
    const mockInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
    };
    const testProtocol = createProtocol("test", {
      input: mockInput,
      options: { strictValidation: false },
    }) as TestProtocol;

    const handler: HookHandler = () => {
      return {
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "blocked for security",
        },
      };
    };

    const executor = new HookExecutor(testProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(testProtocol.output).toBeDefined();
    expect(testProtocol.output?.continue).toBe(false);
  });

  test("should block when permission decision requests approval", async () => {
    const mockInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      session_id: "test-session-approval",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
    };

    const testProtocol = createProtocol("test", {
      input: mockInput,
    }) as TestProtocol;

    const handler: HookHandler = () => ({
      hookSpecificOutput: {
        permissionDecision: "ask",
        permissionDecisionReason: "needs approval",
      },
    });

    const executor = new HookExecutor(testProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(testProtocol.output?.continue).toBe(false);
    expect(testProtocol.output?.stopReason).toBe("approval_required");
  });

  test("should handle raw output for SessionStart event", async () => {
    const baseOptions = {
      sessionId: createSessionId("test-session-123"),
      transcriptPath: createTranscriptPath("/tmp/transcript.md"),
      cwd: createDirectoryPath("/tmp"),
      environment: { PATH: "/usr/bin" },
      context: {
        project_name: "test-project",
        claude_version: "3.5-sonnet",
        environment: {
          CLAUDE_PROJECT_ID: "test-project-123",
          CLAUDE_SESSION_ID: "test-session-123",
        },
      },
    };
    const context = createNotificationContext("SessionStart", baseOptions);
    let capturedOutput: HookResult | undefined;
    let capturedError: Error | undefined;

    const protocol: HookProtocol = {
      async readInput() {
        return {};
      },
      async parseContext() {
        return context;
      },
      async writeOutput(result) {
        capturedOutput = result;
      },
      async writeError(error) {
        capturedError = error;
      },
    };

    const handler: HookHandler = () => ({
      continue: true,
      additionalContext: "Raw context string from SessionStart",
    });

    const executor = new HookExecutor(protocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(capturedError).toBeUndefined();
    expect(capturedOutput).toBeDefined();
    expect(capturedOutput?.additionalContext).toBe(
      "Raw context string from SessionStart"
    );
    expect(capturedOutput?.systemMessage).toBeUndefined();
  });

  test("should handle raw output for UserPromptSubmit event", async () => {
    const mockInput = {
      hook_event_name: "UserPromptSubmit",
      prompt: "test prompt",
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
    };
    const testProtocol = createProtocol("test", {
      input: mockInput,
    }) as TestProtocol;

    const handler: HookHandler = () => {
      // Return HookResult with additionalContext
      return {
        continue: true,
        additionalContext: "Additional context from user prompt",
      };
    };

    const executor = new HookExecutor(testProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(testProtocol.output).toBeDefined();
  });

  test("should respect stopHookActive flag", async () => {
    const mockInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      environment: { PATH: "/usr/bin" },
      stop_hook_active: true,
    };
    const testProtocol = createProtocol("test", {
      input: mockInput,
    }) as TestProtocol;

    const handler: HookHandler = () => {
      return {
        continue: true,
        additionalContext: "should not force continue",
      };
    };

    const executor = new HookExecutor(testProtocol, {
      exitProcess: false,
      collectMetrics: false,
    });

    await executor.execute(handler);

    expect(testProtocol.output).toBeDefined();
  });
});
