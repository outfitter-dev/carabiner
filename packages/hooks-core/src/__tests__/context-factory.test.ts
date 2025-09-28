/**
 * Tests for context factory functionality
 */

import type {
  CreateContextOptions,
  NotificationContext,
  PostToolUseContext,
  PreCompactContext,
  PreToolUseContext,
  SessionStartContext,
  UserPromptHookContext,
} from "@carabiner/types";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createContextForEvent,
  createNotificationContext,
  createPostToolUseContext,
  createPreCompactContext,
  createPreToolUseContext,
  createSessionEndContext,
  createSessionStartContext,
  createStopContext,
  createSubagentStopContext,
  createUserPromptContext,
} from "../context/factory";
import { clearHookEnvironment, getHookEnvironment } from "../environment";

// Mock console.debug to test logging
const mockConsoleDebug = vi
  .spyOn(console, "debug")
  .mockImplementation(() => {});

describe("Context Factory", () => {
  const baseOptions: CreateContextOptions = {
    sessionId: "test-session-123",
    transcriptPath: "/path/to/transcript.jsonl",
    cwd: "/project/directory",
    matcher: "Write",
    environment: { TEST_VAR: "test-value" },
  };

  beforeEach(() => {
    clearHookEnvironment();
    mockConsoleDebug.mockClear();
  });

  afterEach(() => {
    clearHookEnvironment();
  });

  afterAll(() => {
    mockConsoleDebug.mockRestore();
  });

  describe("createPreToolUseContext", () => {
    it("should create PreToolUse context with all required fields", () => {
      const context = createPreToolUseContext(
        "Write",
        { file_path: "/test/file.ts", content: "test content" },
        baseOptions
      );

      expect(context).toMatchObject({
        event: "PreToolUse",
        sessionId: "test-session-123",
        transcriptPath: "/path/to/transcript.jsonl",
        cwd: "/project/directory",
        matcher: "Write",
        toolName: "Write",
        toolInput: { file_path: "/test/file.ts", content: "test content" },
        environment: { TEST_VAR: "test-value" },
      });
    });

    it("should inject environment variables", () => {
      createPreToolUseContext("Bash", { command: "ls -la" }, baseOptions);

      const env = getHookEnvironment();
      expect(env.CLAUDE_HOOK_EVENT).toBe("PreToolUse");
      expect(env.CLAUDE_SESSION_ID).toBe("test-session-123");
      expect(env.CLAUDE_PROJECT_DIR).toBe("/project/directory");
    });

    it("should handle hookSpecificInput", () => {
      const hookSpecificInput = { permissionPrompt: "Allow this operation?" };
      const context = createPreToolUseContext(
        "Read",
        { file_path: "/secret/file.txt" },
        baseOptions,
        hookSpecificInput
      );

      expect(context.hookSpecificInput).toEqual(hookSpecificInput);
    });

    it("should handle stopHookActive flag and log when active", () => {
      const context = createPreToolUseContext(
        "Edit",
        { file_path: "/test.ts", old_string: "old", new_string: "new" },
        baseOptions,
        undefined,
        true
      );

      expect(context.stopHookActive).toBe(true);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active, context will respect stop behavior"
      );
    });

    it("should handle stopHookActive false", () => {
      const context = createPreToolUseContext(
        "Glob",
        { pattern: "*.ts" },
        baseOptions,
        undefined,
        false
      );

      expect(context.stopHookActive).toBe(false);
      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });
  });

  describe("createPostToolUseContext", () => {
    it("should create PostToolUse context with tool response", () => {
      const toolResponse = {
        success: true,
        output: "Tool executed successfully",
      };
      const context = createPostToolUseContext(
        "Bash",
        { command: "echo hello" },
        toolResponse,
        baseOptions
      );

      expect(context).toMatchObject({
        event: "PostToolUse",
        toolName: "Bash",
        toolInput: { command: "echo hello" },
        toolResponse,
        sessionId: "test-session-123",
      });
    });

    it("should log when stopHookActive is true", () => {
      createPostToolUseContext(
        "Write",
        { file_path: "/test.ts", content: "content" },
        { created: true },
        baseOptions,
        true
      );

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in PostToolUse context"
      );
    });
  });

  describe("createNotificationContext", () => {
    it("should create Notification context with message and type", () => {
      const context = createNotificationContext(
        baseOptions,
        "System notification",
        "info"
      );

      expect(context).toMatchObject({
        event: "Notification",
        message: "System notification",
        notificationType: "info",
        sessionId: "test-session-123",
      });
    });

    it("should handle stopHookActive flag", () => {
      createNotificationContext(
        baseOptions,
        "Warning message",
        "warning",
        true
      );

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in Notification context"
      );
    });
  });

  describe("createSessionStartContext", () => {
    it("should create SessionStart context with trigger", () => {
      const context = createSessionStartContext(baseOptions, "startup");

      expect(context).toMatchObject({
        event: "SessionStart",
        sessionStartTrigger: "startup",
        sessionId: "test-session-123",
      });
    });

    it("should handle all SessionStart triggers", () => {
      const triggers = ["startup", "resume", "clear", "compact"] as const;

      triggers.forEach((trigger) => {
        const context = createSessionStartContext(baseOptions, trigger);
        expect(context.sessionStartTrigger).toBe(trigger);
      });
    });

    it("should log when stopHookActive is true", () => {
      createSessionStartContext(baseOptions, "resume", true);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in SessionStart context"
      );
    });
  });

  describe("createSessionEndContext", () => {
    it("should create SessionEnd context", () => {
      const context = createSessionEndContext(
        baseOptions,
        false,
        "Session ended normally"
      );

      expect(context).toMatchObject({
        event: "SessionEnd",
        stopHookActive: false,
        message: "Session ended normally",
      });
    });
  });

  describe("createStopContext", () => {
    it("should create Stop context", () => {
      const context = createStopContext(
        baseOptions,
        true,
        "User requested stop"
      );

      expect(context).toMatchObject({
        event: "Stop",
        stopHookActive: true,
        message: "User requested stop",
      });

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in Stop context"
      );
    });
  });

  describe("createSubagentStopContext", () => {
    it("should create SubagentStop context", () => {
      const context = createSubagentStopContext(
        baseOptions,
        true,
        "Subagent execution halted"
      );

      expect(context).toMatchObject({
        event: "SubagentStop",
        stopHookActive: true,
        message: "Subagent execution halted",
      });

      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in SubagentStop context"
      );
    });
  });

  describe("createPreCompactContext", () => {
    it("should create PreCompact context with trigger", () => {
      const context = createPreCompactContext("manual", baseOptions);

      expect(context).toMatchObject({
        event: "PreCompact",
        preCompactTrigger: "manual",
      });
    });

    it("should handle auto trigger", () => {
      const context = createPreCompactContext("auto", baseOptions, true);

      expect(context.preCompactTrigger).toBe("auto");
      expect(context.stopHookActive).toBe(true);
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        "Stop hook is active in PreCompact context"
      );
    });
  });

  describe("createUserPromptContext", () => {
    it("should create UserPromptSubmit context", () => {
      const context = createUserPromptContext(
        "How can I help you today?",
        baseOptions
      );

      expect(context).toMatchObject({
        event: "UserPromptSubmit",
        userPrompt: "How can I help you today?",
        sessionId: "test-session-123",
      });
    });

    it("should inject environment variables", () => {
      createUserPromptContext("Test prompt", baseOptions);

      const env = getHookEnvironment();
      expect(env.CLAUDE_HOOK_EVENT).toBe("UserPromptSubmit");
      expect(env.CLAUDE_SESSION_ID).toBe("test-session-123");
      expect(env.CLAUDE_PROJECT_DIR).toBe("/project/directory");
    });
  });

  describe("createContextForEvent", () => {
    it("should create PreToolUse context", () => {
      const context = createContextForEvent("PreToolUse", baseOptions, {
        toolName: "Write",
        toolInput: { file_path: "/test.ts", content: "test" },
        hookSpecificInput: { permissionPrompt: "Allow?" },
        stopHookActive: true,
      });

      expect(context.event).toBe("PreToolUse");
      expect((context as PreToolUseContext).toolName).toBe("Write");
      expect((context as PreToolUseContext).stopHookActive).toBe(true);
    });

    it("should create PostToolUse context", () => {
      const context = createContextForEvent("PostToolUse", baseOptions, {
        toolName: "Bash",
        toolInput: { command: "ls" },
        toolResponse: { stdout: "file1.txt\nfile2.ts" },
        stopHookActive: false,
      });

      expect(context.event).toBe("PostToolUse");
      expect((context as PostToolUseContext).toolName).toBe("Bash");
      expect((context as PostToolUseContext).toolResponse).toEqual({
        stdout: "file1.txt\nfile2.ts",
      });
    });

    it("should create Notification context", () => {
      const context = createContextForEvent("Notification", baseOptions, {
        message: "System alert",
        notificationType: "warning",
        stopHookActive: false,
      });

      expect(context.event).toBe("Notification");
      expect((context as NotificationContext).message).toBe("System alert");
      expect((context as NotificationContext).notificationType).toBe("warning");
    });

    it("should create SessionStart context", () => {
      const context = createContextForEvent("SessionStart", baseOptions, {
        sessionStartTrigger: "startup",
        stopHookActive: false,
        message: "Session starting",
      });

      expect(context.event).toBe("SessionStart");
      expect((context as SessionStartContext).sessionStartTrigger).toBe(
        "startup"
      );
    });

    it("should create UserPromptSubmit context", () => {
      const context = createContextForEvent("UserPromptSubmit", baseOptions, {
        userPrompt: "What's the weather like?",
      });

      expect(context.event).toBe("UserPromptSubmit");
      expect((context as UserPromptHookContext).userPrompt).toBe(
        "What's the weather like?"
      );
    });

    it("should create PreCompact context", () => {
      const context = createContextForEvent("PreCompact", baseOptions, {
        preCompactTrigger: "auto",
        stopHookActive: true,
      });

      expect(context.event).toBe("PreCompact");
      expect((context as PreCompactContext).preCompactTrigger).toBe("auto");
      expect((context as PreCompactContext).stopHookActive).toBe(true);
    });

    it("should throw error for unsupported event", () => {
      expect(() => {
        createContextForEvent("UnsupportedEvent" as any, baseOptions, {});
      }).toThrow("Unsupported hook event: UnsupportedEvent");
    });
  });

  describe("Environment variable integration", () => {
    it("should inject different event types correctly", () => {
      const events = [
        "PreToolUse",
        "PostToolUse",
        "Notification",
        "Stop",
      ] as const;

      events.forEach((event) => {
        clearHookEnvironment();

        createContextForEvent(event, baseOptions, {
          toolName:
            event === "PreToolUse" || event === "PostToolUse"
              ? "Write"
              : undefined,
          toolInput:
            event === "PreToolUse" || event === "PostToolUse"
              ? { file_path: "/test" }
              : undefined,
          message:
            event === "Notification" || event === "Stop"
              ? "Test message"
              : undefined,
        });

        const env = getHookEnvironment();
        expect(env.CLAUDE_HOOK_EVENT).toBe(event);
        expect(env.CLAUDE_SESSION_ID).toBe(baseOptions.sessionId);
        expect(env.CLAUDE_PROJECT_DIR).toBe(baseOptions.cwd);
      });
    });
  });
});
