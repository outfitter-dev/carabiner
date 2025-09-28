/**
 * Tests for multi-hook configuration and matchers
 * Tests PR 4 implementation: Configuration & Matchers
 */

import { describe, expect, test } from "bun:test";
import {
  ConfigManager,
  executeHooksForEvent,
  type ExtendedHookConfiguration,
  type HookCommand,
  type HookConfigItem,
  type HookConfiguration,
  isExecutable,
  MatcherResolver,
  matchesEnumTrigger,
  PreCompactTrigger,
  SessionStartTrigger,
  validateConfiguration,
} from "../config";

describe("Multi-Hook Configuration", () => {
  test("should support HookConfiguration interface with multiple hooks per event", () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          hooks: [
            { type: "command", command: "security-check.sh", timeout: 30_000 },
            { type: "command", command: "log-write.sh" },
          ],
        },
        {
          matcher: "mcp__filesystem__read_file",
          hooks: [{ type: "command", command: "validate-mcp-read.sh" }],
        },
      ],
    };

    expect(config.PreToolUse).toHaveLength(2);
    expect(config.PreToolUse[0].hooks).toHaveLength(2);
    expect(config.PreToolUse[0].hooks[0].timeout).toBe(30_000);
    expect(config.PreToolUse[1].hooks[0].command).toBe("validate-mcp-read.sh");
  });

  test("should support HookConfigItem with optional matcher", () => {
    const configItem: HookConfigItem = {
      matcher: "Write",
      hooks: [{ type: "command", command: "test.sh" }],
    };

    expect(configItem.matcher).toBe("Write");
    expect(configItem.hooks).toHaveLength(1);

    // Test without matcher
    const configItemNoMatcher: HookConfigItem = {
      hooks: [{ type: "command", command: "test.sh" }],
    };

    expect(configItemNoMatcher.matcher).toBeUndefined();
  });

  test("should support HookCommand with default timeout", () => {
    const command: HookCommand = {
      type: "command",
      command: "test.sh",
    };

    expect(command.type).toBe("command");
    expect(command.timeout).toBeUndefined();

    const commandWithTimeout: HookCommand = {
      type: "command",
      command: "test.sh",
      timeout: 5000,
    };

    expect(commandWithTimeout.timeout).toBe(5000);
  });
});

describe("MatcherResolver", () => {
  test("should match wildcard pattern", () => {
    expect(MatcherResolver.matches("*", "Write")).toBe(true);
    expect(MatcherResolver.matches("*", "mcp__filesystem__read")).toBe(true);
    expect(MatcherResolver.matches("*", "anyTool")).toBe(true);
  });

  test("should match exact tool names", () => {
    expect(MatcherResolver.matches("Write", "Write")).toBe(true);
    expect(MatcherResolver.matches("Edit", "Edit")).toBe(true);
    expect(MatcherResolver.matches("Write", "Edit")).toBe(false);
  });

  test("should match MCP tool names exactly (no wildcards)", () => {
    const mcpTool = "mcp__filesystem__read_file";

    // Exact match should work
    expect(MatcherResolver.matches(mcpTool, mcpTool)).toBe(true);

    // Partial matches should not work
    expect(MatcherResolver.matches("mcp__filesystem__*", mcpTool)).toBe(false);
    expect(MatcherResolver.matches("mcp__*", mcpTool)).toBe(false);

    // Different MCP tools should not match
    expect(
      MatcherResolver.matches("mcp__filesystem__write_file", mcpTool)
    ).toBe(false);
  });

  test("should support regex patterns for non-MCP tools", () => {
    expect(MatcherResolver.matches("/Write|Edit/", "Write")).toBe(true);
    expect(MatcherResolver.matches("/Write|Edit/", "Edit")).toBe(true);
    expect(MatcherResolver.matches("/Write|Edit/", "Read")).toBe(false);

    expect(MatcherResolver.matches("/^Web/", "WebFetch")).toBe(true);
    expect(MatcherResolver.matches("/^Web/", "WebSearch")).toBe(true);
    expect(MatcherResolver.matches("/^Web/", "Read")).toBe(false);
  });

  test("should validate MCP tool names", () => {
    expect(MatcherResolver.validateMcpToolName("mcp__provider__tool")).toBe(
      true
    );
    expect(
      MatcherResolver.validateMcpToolName("mcp__filesystem__read_file")
    ).toBe(true);
    expect(MatcherResolver.validateMcpToolName("mcp__convex__query")).toBe(
      true
    );

    expect(MatcherResolver.validateMcpToolName("Write")).toBe(false);
    expect(MatcherResolver.validateMcpToolName("mcp__invalid")).toBe(false);
    expect(MatcherResolver.validateMcpToolName("invalid__mcp__tool")).toBe(
      false
    );
  });
});

describe("Enum Matchers", () => {
  test("should validate PreCompact triggers", () => {
    const validTriggers = Object.values(PreCompactTrigger);

    expect(matchesEnumTrigger("manual", "manual", validTriggers)).toBe(true);
    expect(matchesEnumTrigger("auto", "auto", validTriggers)).toBe(true);

    expect(() =>
      matchesEnumTrigger("invalid", "manual", validTriggers)
    ).toThrow('Invalid matcher "invalid". Must be one of: manual, auto');
  });

  test("should validate SessionStart triggers", () => {
    const validTriggers = Object.values(SessionStartTrigger);

    expect(matchesEnumTrigger("startup", "startup", validTriggers)).toBe(true);
    expect(matchesEnumTrigger("resume", "resume", validTriggers)).toBe(true);
    expect(matchesEnumTrigger("clear", "clear", validTriggers)).toBe(true);
    expect(matchesEnumTrigger("compact", "compact", validTriggers)).toBe(true);

    expect(() =>
      matchesEnumTrigger("invalid", "startup", validTriggers)
    ).toThrow(
      'Invalid matcher "invalid". Must be one of: startup, resume, clear, compact'
    );
  });
});

describe("Configuration Validation", () => {
  test("should validate valid configuration", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          hooks: [{ type: "command", command: "bun run test.ts" }],
        },
      ],
    };

    // Should not throw
    await expect(validateConfiguration(config)).resolves.toBeUndefined();
  });

  test("should reject invalid PreCompact matchers", async () => {
    const config: HookConfiguration = {
      PreCompact: [
        {
          matcher: "invalid",
          hooks: [{ type: "command", command: "bun run test.ts" }],
        },
      ],
    };

    await expect(validateConfiguration(config)).rejects.toThrow(
      "PreCompact matcher must be one of: manual, auto"
    );
  });

  test("should reject invalid SessionStart matchers", async () => {
    const config: HookConfiguration = {
      SessionStart: [
        {
          matcher: "invalid",
          hooks: [{ type: "command", command: "bun run test.ts" }],
        },
      ],
    };

    await expect(validateConfiguration(config)).rejects.toThrow(
      "SessionStart matcher must be one of: startup, resume, clear, compact"
    );
  });

  test("should validate executable commands", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "nonexistent-command" }],
        },
      ],
    };

    await expect(validateConfiguration(config)).rejects.toThrow(
      "Hook command not found or not executable: nonexistent-command"
    );
  });
});

describe("Claude settings generation", () => {
  test("should omit disabled items and hooks in generated settings", () => {
    const manager = new ConfigManager(process.cwd());
    const customConfig: ExtendedHookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          enabled: true,
          hooks: [
            {
              type: "command",
              command: "bun run lint.ts",
              timeout: 1_000,
              enabled: true,
            },
            {
              type: "command",
              command: "bun run skip.ts",
              enabled: false,
            },
          ],
        },
        {
          matcher: "Edit",
          enabled: false,
          hooks: [
            {
              type: "command",
              command: "bun run edit.ts",
              enabled: true,
            },
          ],
        },
        {
          enabled: true,
          hooks: [
            {
              type: "command",
              command: "bun run default.ts",
              enabled: true,
            },
          ],
        },
      ],
    };

    (manager as unknown as { setConfig(config: ExtendedHookConfiguration): void }).setConfig(
      customConfig
    );

    const settings = manager.generateClaudeSettings();

    expect(settings).toEqual({
      hooks: {
        PreToolUse: [
          {
            matcher: "Write",
            enabled: true,
            hooks: [
              {
                command: "bun run lint.ts",
                timeoutMs: 1_000,
                enabled: true,
              },
            ],
          },
          {
            enabled: true,
            hooks: [
              {
                command: "bun run default.ts",
                enabled: true,
              },
            ],
          },
        ],
      },
    });
  });
});

describe("Execution helpers", () => {
  test("executeHooksForEvent skips disabled items and hooks", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          enabled: false,
          hooks: [
            {
              type: "command",
              command: "should-not-run",
              enabled: false,
            },
          ],
        },
        {
          matcher: "Write",
          hooks: [
            { type: "command", command: "echo write" },
          ],
        },
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "",
              enabled: false,
            },
          ],
        },
      ],
    };

    await expect(
      executeHooksForEvent({ type: "PreToolUse", toolName: "Edit" }, config)
    ).resolves.toBeUndefined();
  });
});

describe("Command Executable Check", () => {
  test("should accept known executables", async () => {
    expect(await isExecutable("bun run test.ts")).toBe(true);
    expect(await isExecutable("node script.js")).toBe(true);
    expect(await isExecutable("npm install")).toBe(true);
    expect(await isExecutable("yarn install")).toBe(true);
    expect(await isExecutable("pnpm install")).toBe(true);
    expect(await isExecutable("bash script.sh")).toBe(true);
  });

  test("should reject unknown executables", async () => {
    expect(await isExecutable("nonexistent-command")).toBe(false);
    expect(await isExecutable("totally-fake-executable")).toBe(false);
  });

  test("should handle commands with arguments", async () => {
    expect(await isExecutable("bun run hooks/test.ts --verbose")).toBe(true);
    expect(await isExecutable('bash -c "echo hello"')).toBe(true);
  });
});

describe("Sequential Hook Execution", () => {
  test("should execute matching hooks sequentially", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          hooks: [
            { type: "command", command: "bun run hook1.ts" },
            { type: "command", command: "bun run hook2.ts" },
          ],
        },
      ],
    };

    // Mock execution - should not throw
    await expect(
      executeHooksForEvent({ type: "PreToolUse", toolName: "Write" }, config)
    ).resolves.toBeUndefined();
  });

  test("should skip non-matching hooks", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", command: "bun run hook.ts" }],
        },
      ],
    };

    // Tool 'Write' should not match matcher 'Edit'
    await expect(
      executeHooksForEvent({ type: "PreToolUse", toolName: "Write" }, config)
    ).resolves.toBeUndefined();
  });

  test("should handle MCP tool matching", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "mcp__filesystem__read_file",
          hooks: [{ type: "command", command: "bun run mcp-hook.ts" }],
        },
      ],
    };

    await expect(
      executeHooksForEvent(
        { type: "PreToolUse", toolName: "mcp__filesystem__read_file" },
        config
      )
    ).resolves.toBeUndefined();
  });

  test("should handle enum-based event matching", async () => {
    const config: HookConfiguration = {
      SessionStart: [
        {
          matcher: "startup",
          hooks: [{ type: "command", command: "bun run startup-hook.ts" }],
        },
      ],
    };

    await expect(
      executeHooksForEvent({ type: "SessionStart", trigger: "startup" }, config)
    ).resolves.toBeUndefined();
  });

  test("should execute hooks without matchers", async () => {
    const config: HookConfiguration = {
      UserPromptSubmit: [
        {
          hooks: [{ type: "command", command: "bun run prompt-hook.ts" }],
        },
      ],
    };

    await expect(
      executeHooksForEvent({ type: "UserPromptSubmit" }, config)
    ).resolves.toBeUndefined();
  });
});

describe("Error Handling", () => {
  test("should validate hook command structure", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "" } as any], // Invalid empty command
        },
      ],
    };

    await expect(
      executeHooksForEvent({ type: "PreToolUse", toolName: "Write" }, config)
    ).rejects.toThrow("Hook command is required and must be a string");
  });

  test("should validate hook timeout", async () => {
    const config: HookConfiguration = {
      PreToolUse: [
        {
          hooks: [{ type: "command", command: "bun run test.ts", timeout: -1 }],
        },
      ],
    };

    await expect(
      executeHooksForEvent({ type: "PreToolUse", toolName: "Write" }, config)
    ).rejects.toThrow("Hook timeout must be non-negative");
  });
});

describe("Example Configurations", () => {
  test("should support the example configuration from requirements", () => {
    const exampleConfig: HookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          hooks: [
            { type: "command", command: "security-check.sh", timeout: 30_000 },
            { type: "command", command: "log-write.sh" },
          ],
        },
        {
          matcher: "mcp__filesystem__read_file",
          hooks: [{ type: "command", command: "validate-mcp-read.sh" }],
        },
      ],
    };

    expect(exampleConfig.PreToolUse).toHaveLength(2);
    expect(exampleConfig.PreToolUse[0].matcher).toBe("Write");
    expect(exampleConfig.PreToolUse[0].hooks).toHaveLength(2);
    expect(exampleConfig.PreToolUse[1].matcher).toBe(
      "mcp__filesystem__read_file"
    );
    expect(exampleConfig.PreToolUse[1].hooks).toHaveLength(1);
  });
});
