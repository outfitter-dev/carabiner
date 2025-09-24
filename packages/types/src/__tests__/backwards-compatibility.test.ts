/**
 * Tests for backwards compatibility between legacy and new types
 */

import { describe, expect, test } from "bun:test";
import {
  HOOK_EVENTS,
  type HookEvent,
  type HookResult,
  HookResults,
  type LegacyHookResult,
  LegacyHookResults,
} from "../events.js";

describe("Backwards Compatibility", () => {
  describe("Hook Events", () => {
    test("legacy hook events are still supported", () => {
      const legacyEvents = [
        "PreToolUse",
        "PostToolUse",
        "UserPromptSubmit",
        "SessionStart",
        "Stop",
        "SubagentStop",
      ];

      for (const event of legacyEvents) {
        expect(HOOK_EVENTS.includes(event as HookEvent)).toBe(true);
      }
    });

    test("new events are added without breaking existing ones", () => {
      expect(HOOK_EVENTS).toEqual([
        "PreToolUse",
        "PostToolUse",
        "Notification",
        "UserPromptSubmit",
        "Stop",
        "SubagentStop",
        "PreCompact",
        "SessionStart",
        "SessionEnd",
      ]);

      // Should be exactly 9 events now
      expect(HOOK_EVENTS.length).toBe(9);
    });
  });

  describe("Hook Result Types", () => {
    test("new HookResult type is different from legacy", () => {
      const newResult: HookResult = {
        continue: true,
        hookSpecificOutput: {
          permissionDecision: "allow",
          permissionDecisionReason: "Safe operation",
        },
      };

      const legacyResult: LegacyHookResult = {
        success: true,
        message: "Operation completed",
      };

      // Type-level verification - these should have different shapes
      expect("continue" in newResult).toBe(true);
      expect("success" in newResult).toBe(false);
      expect("success" in legacyResult).toBe(true);
      expect("continue" in legacyResult).toBe(false);
    });

    test("legacy result builders still work", () => {
      const successResult = LegacyHookResults.success("Task completed");
      expect(successResult).toEqual({
        success: true,
        message: "Task completed",
        data: undefined,
      });

      const blockResult = LegacyHookResults.block("Security violation");
      expect(blockResult).toEqual({
        success: false,
        message: "Security violation",
        block: true,
      });

      const failureResult = LegacyHookResults.failure("Error occurred", false, {
        code: "E001",
      });
      expect(failureResult).toEqual({
        success: false,
        message: "Error occurred",
        block: false,
        data: { code: "E001" },
      });
    });

    test("new result builders use Claude Code format", () => {
      const allowResult = HookResults.allow("File is safe");
      expect(allowResult).toEqual({
        continue: true,
        hookSpecificOutput: {
          permissionDecision: "allow",
          permissionDecisionReason: "File is safe",
        },
      });

      const denyResult = HookResults.deny("Access blocked");
      expect(denyResult).toEqual({
        continue: false,
        stopReason: "blocked",
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Access blocked",
        },
      });

      const continueResult = HookResults.continue("Processing complete");
      expect(continueResult).toEqual({
        continue: true,
        additionalContext: "Processing complete",
      });
    });
  });

  describe("Migration Path", () => {
    test("both result formats are valid TypeScript types", () => {
      // This test ensures that both result types can coexist
      const processLegacyResult = (result: LegacyHookResult): string => {
        return result.success ? "success" : "failure";
      };

      const processNewResult = (result: HookResult): string => {
        return result.continue !== false ? "continue" : "stop";
      };

      const legacyResult = LegacyHookResults.success();
      const newResult = HookResults.continue();

      expect(processLegacyResult(legacyResult)).toBe("success");
      expect(processNewResult(newResult)).toBe("continue");
    });

    test("migration helper would work conceptually", () => {
      // This shows how one could migrate from legacy to new format
      const migrateLegacyToNew = (legacy: LegacyHookResult): HookResult => {
        if (legacy.success) {
          return {
            continue: true,
            additionalContext: legacy.message,
          };
        }
        return {
          continue: !legacy.block,
          stopReason: legacy.block ? "blocked" : undefined,
          systemMessage: legacy.message,
        };
      };

      const legacySuccess = LegacyHookResults.success("Done");
      const legacyBlock = LegacyHookResults.block("Blocked");

      const migratedSuccess = migrateLegacyToNew(legacySuccess);
      const migratedBlock = migrateLegacyToNew(legacyBlock);

      expect(migratedSuccess.continue).toBe(true);
      expect(migratedSuccess.additionalContext).toBe("Done");

      expect(migratedBlock.continue).toBe(false);
      expect(migratedBlock.stopReason).toBe("blocked");
    });
  });

  describe("API Surface Compatibility", () => {
    test("legacy APIs are still exported", () => {
      // Verify all legacy exports are still available
      expect(typeof LegacyHookResults.success).toBe("function");
      expect(typeof LegacyHookResults.failure).toBe("function");
      expect(typeof LegacyHookResults.block).toBe("function");
      expect(typeof LegacyHookResults.skip).toBe("function");
      expect(typeof LegacyHookResults.warn).toBe("function");
    });

    test("new APIs are available alongside legacy", () => {
      // Verify new exports are available
      expect(typeof HookResults.continue).toBe("function");
      expect(typeof HookResults.allow).toBe("function");
      expect(typeof HookResults.deny).toBe("function");
      expect(typeof HookResults.ask).toBe("function");
      expect(typeof HookResults.stop).toBe("function");
      expect(typeof HookResults.suppress).toBe("function");
    });

    test("event constants remain the same", () => {
      // Original events should still be at same indices for compatibility
      expect(HOOK_EVENTS[0]).toBe("PreToolUse");
      expect(HOOK_EVENTS[1]).toBe("PostToolUse");
      expect(HOOK_EVENTS[2]).toBe("Notification"); // New
      expect(HOOK_EVENTS[3]).toBe("UserPromptSubmit");
      expect(HOOK_EVENTS[4]).toBe("Stop");
      expect(HOOK_EVENTS[5]).toBe("SubagentStop");
      expect(HOOK_EVENTS[6]).toBe("PreCompact"); // New
      expect(HOOK_EVENTS[7]).toBe("SessionStart");
      expect(HOOK_EVENTS[8]).toBe("SessionEnd"); // New
    });
  });

  describe("Type Safety Migration", () => {
    test("legacy and new types are distinct but compatible", () => {
      // This demonstrates that the types are properly separated
      // but can be used in migration scenarios

      function handleResult(result: HookResult | LegacyHookResult): string {
        if ("success" in result) {
          // Legacy format
          return result.success ? "legacy success" : "legacy failure";
        }
        // New format
        return result.continue !== false ? "new continue" : "new stop";
      }

      const legacyResult = LegacyHookResults.success();
      const newResult = HookResults.continue();

      expect(handleResult(legacyResult)).toBe("legacy success");
      expect(handleResult(newResult)).toBe("new continue");
    });
  });
});
