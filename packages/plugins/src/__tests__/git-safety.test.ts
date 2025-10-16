/**
 * @file git-safety.test.ts
 * @description Tests for git safety plugin
 */

import { describe, expect, test } from "bun:test";
import type {
  HookEvent,
  HookInput,
  PostToolUseHookInput,
  PreToolUseHookInput,
} from "@carabiner/hooks-core";
import { createHookContext } from "@carabiner/hooks-core";
import { gitSafetyPlugin } from "../git-safety/index";

type TestHookContext = Parameters<typeof gitSafetyPlugin.apply>[0];

type ContextOptions = {
  event?: HookEvent;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  cwd?: string;
};

const createContext = ({
  event = "PreToolUse",
  toolName = "Bash",
  toolInput = { command: "echo" },
  cwd = "/test/repo",
}: ContextOptions = {}): TestHookContext => {
  let input: HookInput;
  if (event === "PreToolUse") {
    const preInput = {
      hook_event_name: event,
      session_id: "test-session",
      transcript_path: "/tmp/transcript",
      cwd,
      tool_name: toolName,
      tool_input: toolInput,
    } satisfies PreToolUseHookInput;
    input = preInput;
  } else if (event === "PostToolUse") {
    const postInput = {
      hook_event_name: event,
      session_id: "test-session",
      transcript_path: "/tmp/transcript",
      cwd,
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: { exit_code: 0, stdout: "", stderr: "" },
    } satisfies PostToolUseHookInput;
    input = postInput;
  } else {
    throw new Error(`Unsupported event for git-safety tests: ${event}`);
  }

  return createHookContext(input, undefined, {
    environment: { CLAUDE_PROJECT_DIR: cwd },
  }) as unknown as TestHookContext;
};

const createBashContext = (
  command: string,
  options: Partial<Pick<ContextOptions, "cwd">> = {}
): TestHookContext => createContext({ toolInput: { command }, ...options });

const createNonBashContext = (): TestHookContext =>
  createContext({
    toolName: "Write",
    toolInput: { file_path: "/test/file.txt", content: "test" },
  });

describe("Git Safety Plugin", () => {
  describe("Basic Functionality", () => {
    test("should have correct plugin metadata", async () => {
      expect(gitSafetyPlugin.name).toBe("git-safety");
      expect(gitSafetyPlugin.version).toBe("1.0.0");
      expect(gitSafetyPlugin.events).toContain("PreToolUse");
      expect(gitSafetyPlugin.tools).toContain("Bash");
      expect(gitSafetyPlugin.priority).toBe(90);
    });

    test("should ignore non-Bash tools", async () => {
      const context = createNonBashContext();
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
      expect(result.pluginName).toBe("git-safety");
    });

    test("should ignore non-PreToolUse events", async () => {
      const context = createContext({
        event: "PostToolUse",
        toolInput: { command: "git status" },
      });

      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
    });

    test("should ignore non-git commands", async () => {
      const context = createBashContext("ls -la");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
      expect(result.metadata?.safe).toBe(true);
    });
  });

  describe("Safe Git Commands", () => {
    test("should allow safe git commands", async () => {
      const safeCommands = [
        "git status",
        "git log",
        "git diff",
        "git branch",
        "git show",
        "git reflog",
      ];

      for (const command of safeCommands) {
        const context = createBashContext(command);
        const result = await gitSafetyPlugin.apply(context);

        expect(result.continue).not.toBe(false);
        expect(result.metadata?.allowed).toBe(true);
      }
    });

    test("should allow git commands with arguments", async () => {
      const context = createBashContext("git log --oneline --graph");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
    });
  });

  describe("Dangerous Git Commands", () => {
    test("should block force push", async () => {
      const commands = [
        "git push --force",
        "git push -f",
        "git push origin main --force",
        "git push --force-with-lease",
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = await gitSafetyPlugin.apply(context);

        expect(result.continue).toBe(false);
        expect(result.stopReason).toBe("blocked");
        expect(result.systemMessage).toContain("dangerous pattern");
      }
    });

    test("should block hard reset", async () => {
      const commands = [
        "git reset --hard",
        "git reset --hard HEAD~5",
        "git reset --hard origin/main",
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = await gitSafetyPlugin.apply(context);

        expect(result.continue).toBe(false);
        expect(result.stopReason).toBe("blocked");
      }
    });

    test("should block dangerous clean commands", async () => {
      const commands = [
        "git clean -f -d",
        "git clean -fd",
        "git clean -f -d .",
        "git clean --force -d",
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = await gitSafetyPlugin.apply(context);

        expect(result.continue).toBe(false);
        expect(result.stopReason).toBe("blocked");
      }
    });

    test("should block force branch deletion", async () => {
      const commands = [
        "git branch -D feature-branch",
        "git branch --delete --force main",
      ];

      for (const command of commands) {
        const context = createBashContext(command);
        const result = await gitSafetyPlugin.apply(context);

        expect(result.continue).toBe(false);
        expect(result.stopReason).toBe("blocked");
      }
    });
  });

  describe("Configuration", () => {
    test("should respect custom block patterns", async () => {
      const config = {
        blockPatterns: ["custom-dangerous-command"],
        allowList: [],
      };

      const context = createBashContext("git custom-dangerous-command");
      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe("blocked");
    });

    test("should respect custom allow list", async () => {
      const config = {
        blockPatterns: ["push.*--force"],
        allowList: ["git push --force origin feature"],
      };

      const context = createBashContext("git push --force origin feature");
      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).not.toBe(false);
      expect(result.metadata?.allowed).toBe(true);
    });

    test("should use custom rules", async () => {
      const config = {
        customRules: [
          {
            name: "No main branch force push",
            pattern: "push.*origin.*main.*--force",
            systemMessage: "Force pushing to main branch is not allowed",
            severity: "block" as const,
          },
        ],
      };

      const context = createBashContext("git push origin main --force");
      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe("blocked");
      expect(result.systemMessage).toContain(
        "Force pushing to main branch is not allowed"
      );
    });

    test("should handle warning severity in custom rules", async () => {
      const config = {
        customRules: [
          {
            name: "Warning rule",
            pattern: "merge.*--no-ff",
            systemMessage: "Consider using fast-forward merge",
            severity: "warn" as const,
          },
        ],
      };

      const context = createBashContext("git merge --no-ff feature");
      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).not.toBe(false);
      expect(result.systemMessage).toContain(
        "Consider using fast-forward merge"
      );
      expect(result.metadata?.warning).toBe(true);
    });

    test("should exclude repositories based on path patterns", async () => {
      const config = {
        excludeRepos: ["/tmp/.*", ".*test.*"],
      };

      const context = createBashContext("git push --force", {
        cwd: "/tmp/test-repo",
      });

      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).not.toBe(false);
      expect(result.metadata?.skipped).toBe(true);
    });

    test("should include only specified repositories", async () => {
      const config = {
        includeRepos: ["/important/.*"],
      };

      // Should skip repo not in include list
      const context1 = createBashContext("git push --force", {
        cwd: "/unimportant/repo",
      });

      const result1 = await gitSafetyPlugin.apply(context1, config);
      expect(result1.continue).not.toBe(false);
      expect(result1.metadata?.skipped).toBe(true);

      // Should process repo in include list
      const context2 = createBashContext("git push --force", {
        cwd: "/important/repo",
      });

      const result2 = await gitSafetyPlugin.apply(context2, config);
      expect(result2.continue).toBe(false);
      expect(result2.stopReason).toBe("blocked");
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty command", async () => {
      const context = createBashContext("");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
    });

    test("should handle commands with multiple spaces", async () => {
      const context = createBashContext("git    push    --force");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe("blocked");
    });

    test("should handle case insensitive patterns", async () => {
      const context = createBashContext("GIT PUSH --FORCE");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe("blocked");
    });

    test("should handle git aliases and shortcuts", async () => {
      const context = createBashContext("git pf"); // Assuming pf is alias for push --force
      const config = {
        customRules: [
          {
            name: "Block git aliases",
            pattern: "\\bpf\\b",
            systemMessage: "Dangerous git alias detected",
            severity: "block" as const,
          },
        ],
      };

      const result = await gitSafetyPlugin.apply(context, config);

      expect(result.continue).toBe(false);
      expect(result.stopReason).toBe("blocked");
    });

    test("should provide detailed metadata", async () => {
      const context = createBashContext("git status");
      const result = await gitSafetyPlugin.apply(context);

      expect(result.continue).not.toBe(false);
      expect(result.metadata?.scanned).toBe(true);
      expect(result.metadata?.command).toBe("git status");
      expect(result.metadata?.safe).toBe(true);
    });
  });

  describe("Plugin Lifecycle", () => {
    test("should have init method", async () => {
      expect(typeof gitSafetyPlugin.init).toBe("function");
    });

    test("should have healthCheck method", async () => {
      expect(typeof gitSafetyPlugin.healthCheck).toBe("function");
    });

    test("should have proper metadata", async () => {
      expect(gitSafetyPlugin.metadata).toBeDefined();
      expect(gitSafetyPlugin.metadata?.name).toBe("git-safety");
      expect(gitSafetyPlugin.metadata?.keywords).toContain("git");
      expect(gitSafetyPlugin.metadata?.keywords).toContain("safety");
    });
  });
});
