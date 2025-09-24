/**
 * Tests for environment variable injection functionality
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearHookEnvironment,
  getHookEnvironment,
  injectEnvironmentVariables,
  validateHookEnvironment,
} from "../environment";

describe("Environment Variables", () => {
  beforeEach(() => {
    // Clear any existing environment variables before each test
    clearHookEnvironment();
  });

  afterEach(() => {
    // Clean up after each test
    clearHookEnvironment();
  });

  describe("injectEnvironmentVariables", () => {
    it("should inject all required Claude Code environment variables", () => {
      const eventType = "PreToolUse";
      const sessionId = "test-session-123";
      const projectDir = "/Users/test/project";

      injectEnvironmentVariables(eventType, sessionId, projectDir);

      expect(process.env.CLAUDE_HOOK_EVENT).toBe(eventType);
      expect(process.env.CLAUDE_SESSION_ID).toBe(sessionId);
      expect(process.env.CLAUDE_PROJECT_DIR).toBe(projectDir);
    });

    it("should overwrite existing environment variables", () => {
      // Set initial values
      process.env.CLAUDE_HOOK_EVENT = "OldEvent";
      process.env.CLAUDE_SESSION_ID = "old-session";
      process.env.CLAUDE_PROJECT_DIR = "/old/path";

      const eventType = "PostToolUse";
      const sessionId = "new-session-456";
      const projectDir = "/Users/new/project";

      injectEnvironmentVariables(eventType, sessionId, projectDir);

      expect(process.env.CLAUDE_HOOK_EVENT).toBe(eventType);
      expect(process.env.CLAUDE_SESSION_ID).toBe(sessionId);
      expect(process.env.CLAUDE_PROJECT_DIR).toBe(projectDir);
    });

    it("should work with all hook event types", () => {
      const hookEvents = [
        "PreToolUse",
        "PostToolUse",
        "Notification",
        "UserPromptSubmit",
        "Stop",
        "SubagentStop",
        "PreCompact",
        "SessionStart",
        "SessionEnd",
      ] as const;

      hookEvents.forEach((eventType) => {
        clearHookEnvironment();
        const sessionId = `session-${eventType}`;
        const projectDir = `/project/${eventType}`;

        injectEnvironmentVariables(eventType, sessionId, projectDir);

        expect(process.env.CLAUDE_HOOK_EVENT).toBe(eventType);
        expect(process.env.CLAUDE_SESSION_ID).toBe(sessionId);
        expect(process.env.CLAUDE_PROJECT_DIR).toBe(projectDir);
      });
    });
  });

  describe("getHookEnvironment", () => {
    it("should return undefined values when no environment variables are set", () => {
      const env = getHookEnvironment();

      expect(env.CLAUDE_HOOK_EVENT).toBeUndefined();
      expect(env.CLAUDE_SESSION_ID).toBeUndefined();
      expect(env.CLAUDE_PROJECT_DIR).toBeUndefined();
    });

    it("should return current environment variable values", () => {
      const eventType = "Notification";
      const sessionId = "test-session-789";
      const projectDir = "/Users/test/notification-project";

      injectEnvironmentVariables(eventType, sessionId, projectDir);

      const env = getHookEnvironment();

      expect(env.CLAUDE_HOOK_EVENT).toBe(eventType);
      expect(env.CLAUDE_SESSION_ID).toBe(sessionId);
      expect(env.CLAUDE_PROJECT_DIR).toBe(projectDir);
    });

    it("should handle partial environment variable sets", () => {
      process.env.CLAUDE_HOOK_EVENT = "PreCompact";
      process.env.CLAUDE_SESSION_ID = "partial-session";
      // CLAUDE_PROJECT_DIR is not set

      const env = getHookEnvironment();

      expect(env.CLAUDE_HOOK_EVENT).toBe("PreCompact");
      expect(env.CLAUDE_SESSION_ID).toBe("partial-session");
      expect(env.CLAUDE_PROJECT_DIR).toBeUndefined();
    });
  });

  describe("validateHookEnvironment", () => {
    it("should return false when no environment variables are set", () => {
      expect(validateHookEnvironment()).toBe(false);
    });

    it("should return false when only some environment variables are set", () => {
      process.env.CLAUDE_HOOK_EVENT = "SessionStart";
      expect(validateHookEnvironment()).toBe(false);

      process.env.CLAUDE_SESSION_ID = "session-123";
      expect(validateHookEnvironment()).toBe(false);

      // Still missing CLAUDE_PROJECT_DIR
      expect(validateHookEnvironment()).toBe(false);
    });

    it("should return true when all required environment variables are set", () => {
      injectEnvironmentVariables("Stop", "session-456", "/project/path");
      expect(validateHookEnvironment()).toBe(true);
    });

    it("should return false if any environment variable is empty string", () => {
      process.env.CLAUDE_HOOK_EVENT = "";
      process.env.CLAUDE_SESSION_ID = "session-123";
      process.env.CLAUDE_PROJECT_DIR = "/project/path";

      expect(validateHookEnvironment()).toBe(false);
    });
  });

  describe("clearHookEnvironment", () => {
    it("should remove all Claude Code environment variables", () => {
      // Set environment variables
      injectEnvironmentVariables(
        "SessionEnd",
        "session-999",
        "/cleanup/project"
      );

      // Verify they are set
      expect(process.env.CLAUDE_HOOK_EVENT).toBeDefined();
      expect(process.env.CLAUDE_SESSION_ID).toBeDefined();
      expect(process.env.CLAUDE_PROJECT_DIR).toBeDefined();

      // Clear them
      clearHookEnvironment();

      // Verify they are removed
      expect(process.env.CLAUDE_HOOK_EVENT).toBeUndefined();
      expect(process.env.CLAUDE_SESSION_ID).toBeUndefined();
      expect(process.env.CLAUDE_PROJECT_DIR).toBeUndefined();
    });

    it("should not affect other environment variables", () => {
      // Set some other environment variable
      process.env.OTHER_VAR = "should-remain";

      // Set Claude Code environment variables
      injectEnvironmentVariables(
        "SubagentStop",
        "session-777",
        "/other/project"
      );

      // Clear Claude Code environment variables
      clearHookEnvironment();

      // Verify other variable remains
      expect(process.env.OTHER_VAR).toBe("should-remain");

      // Clean up
      process.env.OTHER_VAR = undefined;
    });
  });
});
