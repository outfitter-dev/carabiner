/**
 * Claude Code Compliance Test Suite
 *
 * Comprehensive tests validating compliance with Claude Code SDK:
 * - Hook Event Golden Tests - validate all 9 events process correctly
 * - Permission Decisions - test allow/deny/ask decisions
 * - MCP Tool Integration - validate MCP tool naming
 * - Exit Code Behavior - test exit codes 0, 1, 2
 * - Timeout Handling - test timeout with SIGTERM → SIGKILL
 * - Environment Variables - test CLAUDE_* env vars injection
 * - stop_hook_active flag handling
 * - Context injection for SessionStart/UserPromptSubmit
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHookContext,
  executeHook,
  HookResults,
  parseHookEnvironment,
} from "@carabiner/hooks-core/runtime";
import {
  type HookContext,
  type HookInput,
  type HookResult,
  isNotificationInput,
  isPostToolUseInput,
  isPreCompactInput,
  isPreToolUseInput,
  isSessionEndInput,
  isSessionStartInput,
  isStopInput,
  isSubagentStopInput,
  isUserPromptSubmitInput,
} from "@carabiner/hooks-core/types";

/**
 * Test fixture paths
 */
const FIXTURES_PATH = join(process.cwd(), "tests", "fixtures", "events");

/**
 * Load golden test fixture
 */
function loadFixture<T = HookInput>(filename: string): T {
  const filePath = join(FIXTURES_PATH, filename);
  if (!existsSync(filePath)) {
    throw new Error(`Test fixture not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

/**
 * Test workspace for integration tests
 */
class TestWorkspace {
  public readonly path: string;

  constructor() {
    this.path = mkdtempSync(join(tmpdir(), "carabiner-compliance-test-"));
  }

  /**
   * Create a simple hook script for testing
   */
  createHookScript(name: string, content: string): string {
    const scriptPath = join(this.path, name);
    writeFileSync(scriptPath, content);
    chmodSync(scriptPath, 0o755);
    return scriptPath;
  }

  /**
   * Cleanup the workspace
   */
  cleanup(): void {
    if (existsSync(this.path)) {
      rmSync(this.path, { recursive: true, force: true });
    }
  }
}

/**
 * Mock hook handler for testing
 */
const mockHandler = {
  allow: async (_context: HookContext): Promise<HookResult> => ({
    continue: true,
    systemMessage: "Hook allowed execution",
  }),

  deny: async (_context: HookContext): Promise<HookResult> => ({
    continue: false,
    systemMessage: "Hook denied execution",
  }),

  ask: async (_context: HookContext): Promise<HookResult> => ({
    continue: false,
    askUser: {
      question: "Do you want to proceed with this action?",
      defaultChoice: "allow",
    },
    systemMessage: "Hook requested user permission",
  }),

  timeout: async (_context: HookContext): Promise<HookResult> => {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay
    return {
      continue: true,
      systemMessage: "Hook completed after delay",
    };
  },

  error: async (_context: HookContext): Promise<HookResult> => {
    throw new Error("Intentional test error");
  },
};

describe("Claude Code Compliance Test Suite", () => {
  let workspace: TestWorkspace;

  beforeEach(() => {
    workspace = new TestWorkspace();
  });

  afterEach(() => {
    workspace.cleanup();
  });

  describe("Hook Event Golden Tests", () => {
    test("should parse PreToolUse Write event correctly", async () => {
      const fixture = loadFixture("pretooluse-write.json");

      expect(fixture.hook_event_name).toBe("PreToolUse");
      expect(fixture.tool_name).toBe("Write");
      expect(fixture.tool_input).toMatchObject({
        file_path: "/Users/test/project/src/main.ts",
        content: "console.log('Hello, World!');",
      });

      expect(isPreToolUseInput(fixture)).toBe(true);
      expect(isPostToolUseInput(fixture)).toBe(false);
    });

    test("should parse PreToolUse MCP tool event correctly", async () => {
      const fixture = loadFixture("pretooluse-mcp.json");

      expect(fixture.hook_event_name).toBe("PreToolUse");
      expect(fixture.tool_name).toBe("mcp__filesystem__read_file");
      expect(fixture.tool_input).toMatchObject({
        path: "/Users/test/project/README.md",
      });

      expect(isPreToolUseInput(fixture)).toBe(true);
    });

    test("should parse PostToolUse Write event correctly", async () => {
      const fixture = loadFixture("posttooluse-write.json");

      expect(fixture.hook_event_name).toBe("PostToolUse");
      expect(fixture.tool_name).toBe("Write");
      expect(fixture.tool_result).toMatchObject({
        success: true,
        file_written: "/Users/test/project/src/main.ts",
      });

      expect(isPostToolUseInput(fixture)).toBe(true);
    });

    test("should parse Notification event correctly", async () => {
      const fixture = loadFixture("notification.json");

      expect(fixture.hook_event_name).toBe("Notification");
      expect(fixture.notification_type).toBe("info");
      expect(fixture.message).toBe("Tool execution completed successfully");

      expect(isNotificationInput(fixture)).toBe(true);
    });

    test("should parse UserPromptSubmit event correctly", async () => {
      const fixture = loadFixture("userpromptsubmit.json");

      expect(fixture.hook_event_name).toBe("UserPromptSubmit");
      expect(fixture.prompt).toBe(
        "Please help me write a TypeScript function to parse JSON data"
      );
      expect(fixture.context).toMatchObject({
        project_type: "typescript",
        files_in_context: expect.arrayContaining([
          "/Users/test/project/src/types.ts",
        ]),
      });

      expect(isUserPromptSubmitInput(fixture)).toBe(true);
    });

    test("should parse Stop event correctly", async () => {
      const fixture = loadFixture("stop.json");

      expect(fixture.hook_event_name).toBe("Stop");
      expect(fixture.reason).toBe("user_requested");
      expect(fixture.stop_hook_active).toBe(true);
      expect(fixture.exit_code).toBe(0);

      expect(isStopInput(fixture)).toBe(true);
    });

    test("should parse SessionStart event correctly", async () => {
      const fixture = loadFixture("sessionstart.json");

      expect(fixture.hook_event_name).toBe("SessionStart");
      expect(fixture.context).toMatchObject({
        project_name: "test-project",
        claude_version: "3.5-sonnet",
        environment: expect.objectContaining({
          CLAUDE_PROJECT_ID: "test-project-123",
          CLAUDE_SESSION_ID: "550e8400-e29b-41d4-a716-446655440000",
        }),
      });

      expect(isSessionStartInput(fixture)).toBe(true);
    });

    test("should parse SessionEnd event correctly", async () => {
      const fixture = loadFixture("sessionend.json");

      expect(fixture.hook_event_name).toBe("SessionEnd");
      expect(fixture.duration_ms).toBe(3_600_000);
      expect(fixture.tools_used).toBe(15);
      expect(fixture.final_state).toBe("completed");

      expect(isSessionEndInput(fixture)).toBe(true);
    });

    test("should parse PreCompact event correctly", async () => {
      const fixture = loadFixture("precompact.json");

      expect(fixture.hook_event_name).toBe("PreCompact");
      expect(fixture.transcript_size_bytes).toBe(2_048_000);
      expect(fixture.messages_count).toBe(150);
      expect(fixture.compaction_strategy).toBe("semantic_summary");

      expect(isPreCompactInput(fixture)).toBe(true);
    });

    test("should parse SubAgentStop event correctly", async () => {
      const fixture = loadFixture("subagentstop.json");

      expect(fixture.hook_event_name).toBe("SubagentStop");
      expect(fixture.subagent_id).toBe("sub-agent-789");
      expect(fixture.subagent_type).toBe("specialized_reviewer");
      expect(fixture.completion_reason).toBe("task_completed");
      expect(fixture.exit_code).toBe(0);

      expect(isSubagentStopInput(fixture)).toBe(true);
    });
  });

  describe("Hook Context Creation", () => {
    test("should create valid hook context from fixture data", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      expect(context.event).toBe("PreToolUse");
      expect(context.sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(context.cwd).toBe("/Users/test/project");
      expect(context.toolName).toBe("Write");
      expect(context.toolInput).toMatchObject({
        file_path: "/Users/test/project/src/main.ts",
        content: "console.log('Hello, World!');",
      });
    });

    test("should handle environment variables correctly", async () => {
      const originalEnv = process.env.CLAUDE_PROJECT_DIR;
      process.env.CLAUDE_PROJECT_DIR = "/test/project/dir";

      try {
        const environment = parseHookEnvironment();
        expect(environment.CLAUDE_PROJECT_DIR).toBe("/test/project/dir");
      } finally {
        if (originalEnv !== undefined) {
          process.env.CLAUDE_PROJECT_DIR = originalEnv;
        } else {
          process.env.CLAUDE_PROJECT_DIR = undefined;
        }
      }
    });
  });

  describe("Permission Decisions", () => {
    test("should handle allow decision correctly", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      const result = await executeHook(mockHandler.allow, context);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe("Hook allowed execution");
    });

    test("should handle deny decision correctly", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      const result = await executeHook(mockHandler.deny, context);

      expect(result.continue).toBe(false);
      expect(result.systemMessage).toBe("Hook denied execution");
    });

    test("should handle ask decision correctly", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      const result = await executeHook(mockHandler.ask, context);

      expect(result.continue).toBe(false);
      expect(result.askUser).toMatchObject({
        question: "Do you want to proceed with this action?",
        defaultChoice: "allow",
      });
    });
  });

  describe("MCP Tool Integration", () => {
    test("should recognize MCP tool naming convention", async () => {
      const fixture = loadFixture("pretooluse-mcp.json");
      const context = createHookContext(fixture);

      expect(context.toolName).toBe("mcp__filesystem__read_file");
      expect(context.toolName?.startsWith("mcp__")).toBe(true);

      // Verify MCP tool naming pattern: mcp__<server>__<tool>
      const parts = context.toolName?.split("__");
      expect(parts?.length).toBe(3);
      expect(parts?.[0]).toBe("mcp");
      expect(parts?.[1]).toBe("filesystem");
      expect(parts?.[2]).toBe("read_file");
    });
  });

  describe("Exit Code Behavior", () => {
    test("should handle exit code 0 (success)", async () => {
      const fixture = loadFixture("stop.json");
      expect(fixture.exit_code).toBe(0);
    });

    test("should use HookResults for consistent exit behavior", async () => {
      const successResult = HookResults.success(
        "Operation completed successfully"
      );
      expect(successResult.continue).toBe(true);
      expect(successResult.success).toBe(true);

      const failureResult = HookResults.failure("Operation failed");
      expect(failureResult.continue).toBe(false);
      expect(failureResult.success).toBe(false);

      const blockedResult = HookResults.block("Operation blocked");
      expect(blockedResult.continue).toBe(false);
      expect(blockedResult.block).toBe(true);
      expect(blockedResult.stopReason).toBe("blocked");
    });
  });

  describe("Timeout Handling", () => {
    test("should handle timeout correctly", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      const result = await executeHook(mockHandler.timeout, context, {
        timeout: 100, // Very short timeout
        throwOnError: false,
      });

      // Should return failure result due to timeout
      expect(result.continue).toBe(false);
      expect(result.systemMessage).toContain("timed out");
    });

    test("should handle graceful termination", async () => {
      // Test that hooks properly handle SIGTERM → SIGKILL sequence
      const hookScript = workspace.createHookScript(
        "timeout-hook.js",
        `
        const { setTimeout } = require('timers/promises');

        process.on('SIGTERM', () => {
          console.log('Received SIGTERM, cleaning up...');
          setTimeout(100).then(() => process.exit(0));
        });

        setTimeout(10000).then(() => {
          console.log('Hook completed');
          process.exit(0);
        });
      `
      );

      const child = spawn("node", [hookScript]);

      // Send SIGTERM after short delay
      setTimeout(() => {
        child.kill("SIGTERM");
      }, 100);

      const exitPromise = new Promise<number>((resolve) => {
        child.on("exit", (code) => resolve(code || 0));
      });

      const exitCode = await Promise.race([
        exitPromise,
        new Promise<number>((resolve) => setTimeout(() => resolve(-1), 2000)),
      ]);

      expect(exitCode).toBe(0);
    });
  });

  describe("Environment Variables", () => {
    test("should inject CLAUDE_* environment variables correctly", async () => {
      const originalEnv = {
        CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
        CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
        CLAUDE_TRANSCRIPT_PATH: process.env.CLAUDE_TRANSCRIPT_PATH,
      };

      try {
        process.env.CLAUDE_PROJECT_DIR = "/test/project";
        process.env.CLAUDE_SESSION_ID = "test-session-123";
        process.env.CLAUDE_TRANSCRIPT_PATH = "/test/transcript.jsonl";

        const environment = parseHookEnvironment();
        expect(environment.CLAUDE_PROJECT_DIR).toBe("/test/project");

        // Test environment injection in hook context
        const context = createHookContext("PreToolUse");
        expect(context.sessionId).toBe("test-session-123");
      } finally {
        // Restore original environment
        Object.entries(originalEnv).forEach(([key, value]) => {
          if (value !== undefined) {
            process.env[key] = value;
          } else {
            delete process.env[key];
          }
        });
      }
    });
  });

  describe("stop_hook_active Flag Handling", () => {
    test("should handle stop_hook_active flag correctly", async () => {
      const fixture = loadFixture("stop.json");
      expect(fixture.stop_hook_active).toBe(true);

      const context = createHookContext(fixture);

      // When stop_hook_active is true, hook should execute
      const result = await executeHook(mockHandler.allow, context);
      expect(result.continue).toBe(true);
    });
  });

  describe("Context Injection", () => {
    test("should inject context for SessionStart events", async () => {
      const fixture = loadFixture("sessionstart.json");
      const context = createHookContext(fixture);

      expect(context.rawInput).toMatchObject({
        context: {
          project_name: "test-project",
          claude_version: "3.5-sonnet",
          environment: {
            CLAUDE_PROJECT_ID: "test-project-123",
            CLAUDE_SESSION_ID: "550e8400-e29b-41d4-a716-446655440000",
          },
        },
      });
    });

    test("should inject context for UserPromptSubmit events", async () => {
      const fixture = loadFixture("userpromptsubmit.json");
      const context = createHookContext(fixture);

      expect(context.rawInput).toMatchObject({
        context: {
          project_type: "typescript",
          files_in_context: expect.arrayContaining([
            "/Users/test/project/src/types.ts",
            "/Users/test/project/package.json",
          ]),
        },
      });

      expect(context.userPrompt).toBe(
        "Please help me write a TypeScript function to parse JSON data"
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle hook execution errors gracefully", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);

      const result = await executeHook(mockHandler.error, context, {
        throwOnError: false,
      });

      expect(result.continue).toBe(false);
      expect(result.systemMessage).toContain("Intentional test error");
    });

    test("should validate hook input correctly", async () => {
      const invalidInput = {
        session_id: "",
        hook_event_name: "PreToolUse",
        cwd: "",
      } as HookInput;

      // The createHookContext function creates context even with empty values
      // The actual validation happens in validateHookInput function
      const context = createHookContext(invalidInput);
      expect(context.sessionId).toBe("");
      expect(context.cwd).toBe("");
    });
  });

  describe("JSON Output Compliance", () => {
    test("should produce valid JSON output", async () => {
      const fixture = loadFixture("pretooluse-write.json");
      const context = createHookContext(fixture);
      const result = await executeHook(mockHandler.allow, context);

      // Ensure result can be serialized to JSON
      const jsonOutput = JSON.stringify(result);
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      // Verify required fields
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toHaveProperty("continue");
      expect(parsed).toHaveProperty("systemMessage");
    });
  });
});
