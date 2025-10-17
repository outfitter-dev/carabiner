/**
 * Tests for hooks-config package configuration management
 * Focuses on immutability and proper config updates
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConfigManager,
  type ExtendedHookConfiguration,
  type HookCommand,
  type HookConfigItem,
} from "../config";

describe("ConfigManager - Immutability Tests", () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hooks-config-test-"));
    configManager = new ConfigManager(tempDir);
  });

  // Clean up after each test
  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("should create immutable updates in setHookConfig for tool-specific config", async () => {
    // Load initial config
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig)); // Deep copy for comparison

    // Set a new tool config
    await configManager.setHookConfig("PreToolUse", "Write", {
      command: "bun run hooks/custom-pre.ts",
      timeout: 5000,
      enabled: true,
    });

    const updatedConfig = configManager.getConfig();

    // Verify the original config wasn't mutated
    expect(initialConfig).toEqual(originalConfig);

    // Verify the update was applied correctly
    const toolConfig = updatedConfig.PreToolUse as
      | Record<string, HookCommand>
      | undefined;
    expect(toolConfig?.Write).toEqual({
      command: "bun run hooks/custom-pre.ts",
      timeout: 5000,
      enabled: true,
    });

    // Verify it's a different object reference
    expect(updatedConfig).not.toBe(initialConfig);
    expect(updatedConfig.PreToolUse).not.toBe(initialConfig.PreToolUse);
  });

  test("should create immutable updates in setHookConfig for event-level config", async () => {
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig));

    // Set event-level config
    await configManager.setHookConfig("SessionStart", {
      command: "bun run hooks/custom-session.ts",
      timeout: 15_000,
      enabled: true,
    });

    const updatedConfig = configManager.getConfig();

    // Verify original wasn't mutated
    expect(initialConfig).toEqual(originalConfig);

    // Verify the update
    const sessionStartConfig = updatedConfig.SessionStart as
      | HookCommand
      | undefined;
    expect(sessionStartConfig).toEqual({
      command: "bun run hooks/custom-session.ts",
      timeout: 15_000,
      enabled: true,
    });

    // Different references
    expect(updatedConfig).not.toBe(initialConfig);
  });

  test("should create immutable updates in toggleHook for tool-specific hooks", async () => {
    await configManager.load();

    // Ensure we have a tool config to toggle
    await configManager.setHookConfig("PreToolUse", "Bash", {
      command: "bun run hooks/pre-bash.ts",
      timeout: 3000,
      enabled: true,
    });

    const beforeToggle = configManager.getConfig();
    const originalBeforeToggle = JSON.parse(JSON.stringify(beforeToggle));

    // Toggle the hook
    await configManager.toggleHook("PreToolUse", "Bash", false);

    const afterToggle = configManager.getConfig();

    // Verify original wasn't mutated
    expect(beforeToggle).toEqual(originalBeforeToggle);

    // Verify the toggle
    const toggledToolConfig = afterToggle.PreToolUse as
      | Record<string, HookCommand>
      | undefined;
    expect(toggledToolConfig?.Bash?.enabled).toBe(false);
    expect(toggledToolConfig?.Bash?.command).toBe("bun run hooks/pre-bash.ts");
    expect(toggledToolConfig?.Bash?.timeout).toBe(3000);

    // Different references
    expect(afterToggle).not.toBe(beforeToggle);
    expect(afterToggle.PreToolUse).not.toBe(beforeToggle.PreToolUse);
  });

  test("should create immutable updates in toggleHook for event-level hooks", async () => {
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig));

    // Toggle event-level hook (SessionStart is event-level by default)
    await configManager.toggleHook("SessionStart", undefined, false);

    const updatedConfig = configManager.getConfig();

    // Verify original wasn't mutated
    expect(initialConfig).toEqual(originalConfig);

    // Verify the toggle
    const sessionToggle = updatedConfig.SessionStart as HookCommand | undefined;
    expect(sessionToggle?.enabled).toBe(false);

    // Different references
    expect(updatedConfig).not.toBe(initialConfig);
  });

  test("should handle nested config updates without mutating parent objects", async () => {
    await configManager.load();

    // Set multiple tool configs
    await configManager.setHookConfig("PreToolUse", "Write", {
      command: "bun run hooks/pre-write.ts",
      timeout: 2000,
      enabled: true,
    });

    const afterFirstUpdate = configManager.getConfig();
    const originalAfterFirst = JSON.parse(JSON.stringify(afterFirstUpdate));

    await configManager.setHookConfig("PreToolUse", "Edit", {
      command: "bun run hooks/pre-edit.ts",
      timeout: 3000,
      enabled: true,
    });

    const afterSecondUpdate = configManager.getConfig();

    // Verify first update state wasn't mutated
    expect(afterFirstUpdate).toEqual(originalAfterFirst);

    // Verify both configs exist
    const secondToolConfig = afterSecondUpdate.PreToolUse as
      | Record<string, HookCommand>
      | undefined;
    expect(secondToolConfig?.Write).toEqual({
      command: "bun run hooks/pre-write.ts",
      timeout: 2000,
      enabled: true,
    });
    expect(secondToolConfig?.Edit).toEqual({
      command: "bun run hooks/pre-edit.ts",
      timeout: 3000,
      enabled: true,
    });

    // Different references
    expect(afterSecondUpdate).not.toBe(afterFirstUpdate);
  });

  test("setHookConfig preserves multi-hook entries for event-level updates", async () => {
    const settable = configManager as unknown as {
      setConfig(config: ExtendedHookConfiguration): void;
      configPath: string | null;
      save(config: ExtendedHookConfiguration, format?: string): Promise<void>;
    };

    const initialConfig: ExtendedHookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          enabled: true,
          hooks: [
            {
              type: "command",
              command: "bun run hooks/write.ts",
              enabled: true,
            },
          ],
        },
        {
          matcher: "Edit",
          enabled: true,
          hooks: [
            {
              type: "command",
              command: "bun run hooks/edit.ts",
              enabled: true,
            },
          ],
        },
      ] satisfies HookConfigItem[],
    };

    settable.setConfig(initialConfig);
    settable.configPath = join(tempDir, "hooks.config.json");
    settable.save = async (config: ExtendedHookConfiguration) => {
      settable.setConfig(config);
    };

    await configManager.setHookConfig("PreToolUse", {
      command: "bun run hooks/default.ts",
      timeout: 2000,
      enabled: true,
    });

    const updated = configManager.getConfig();
    const updatedPreToolUse = updated.PreToolUse as
      | HookConfigItem[]
      | undefined;
    expect(updatedPreToolUse).toHaveLength(3);

    const defaultItem = updatedPreToolUse?.find((item) => !item.matcher);
    expect(defaultItem?.enabled).toBe(true);
    expect(defaultItem?.hooks[0]?.command).toBe("bun run hooks/default.ts");
    expect(defaultItem?.hooks[0]?.timeout).toBe(2000);

    const writeItem = updatedPreToolUse?.find(
      (item) => item.matcher === "Write"
    );
    expect(writeItem?.hooks[0]?.command).toBe("bun run hooks/write.ts");
    const editItem = updatedPreToolUse?.find((item) => item.matcher === "Edit");
    expect(editItem?.hooks[0]?.command).toBe("bun run hooks/edit.ts");
  });

  test("toggleHook updates enabled flags in multi-hook arrays", async () => {
    const settable = configManager as unknown as {
      setConfig(config: ExtendedHookConfiguration): void;
      configPath: string | null;
      save(config: ExtendedHookConfiguration, format?: string): Promise<void>;
    };

    const initialConfig: ExtendedHookConfiguration = {
      PreToolUse: [
        {
          matcher: "Write",
          enabled: true,
          hooks: [
            {
              type: "command",
              command: "bun run hooks/write-primary.ts",
              enabled: true,
            },
            {
              type: "command",
              command: "bun run hooks/write-secondary.ts",
              enabled: true,
            },
          ] satisfies HookCommand[],
        },
      ] satisfies HookConfigItem[],
    };

    settable.setConfig(initialConfig);
    settable.configPath = join(tempDir, "hooks.config.json");
    settable.save = async (config: ExtendedHookConfiguration) => {
      settable.setConfig(config);
    };

    await configManager.toggleHook("PreToolUse", "Write", false);

    const updated = configManager.getConfig();
    const updatedPreToolUse = updated.PreToolUse as
      | HookConfigItem[]
      | undefined;
    const writeItem = updatedPreToolUse?.find(
      (item) => item.matcher === "Write"
    );
    expect(writeItem?.enabled).toBe(false);
    expect(writeItem?.hooks.every((hook) => hook.enabled === false)).toBe(true);
  });
});
