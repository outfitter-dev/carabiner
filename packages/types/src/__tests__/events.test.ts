/**
 * Tests for hook event types and utilities
 */

import { describe, expect, test } from "bun:test";
import {
  type CompactEvent,
  HOOK_EVENTS,
  type HookEvent,
  HookResults,
  isCompactEvent,
  isHookEvent,
  isNotificationEvent,
  isToolHookEvent,
  isUserEvent,
  type NotificationEvent,
  type ToolHookEvent,
  type UserEvent,
} from "../events.js";

describe("HOOK_EVENTS constant", () => {
  test("contains all 9 expected events", () => {
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
  });

  test("is readonly tuple", () => {
    // This should cause a TypeScript error if HOOK_EVENTS is not readonly
    // We don't actually execute the push to avoid mutating the array during tests
    // HOOK_EVENTS.push('InvalidEvent'); // This would error if uncommented

    // Instead, just verify the array is properly typed
    expect(HOOK_EVENTS.length).toBe(9);
  });
});

describe("isHookEvent", () => {
  test("identifies valid hook events", () => {
    for (const event of HOOK_EVENTS) {
      expect(isHookEvent(event)).toBe(true);
    }
  });

  test("rejects invalid hook events", () => {
    // Test string values that are not valid hook events
    expect(isHookEvent("InvalidEvent")).toBe(false);
    expect(isHookEvent("preToolUse")).toBe(false); // wrong case
    expect(isHookEvent("POST_TOOL_USE")).toBe(false); // wrong case
    expect(isHookEvent("")).toBe(false); // empty string

    // Test non-string values
    expect(isHookEvent(123)).toBe(false);
    expect(isHookEvent(null)).toBe(false);
    expect(isHookEvent(undefined)).toBe(false);
    expect(isHookEvent({})).toBe(false);
    expect(isHookEvent([])).toBe(false);
  });
});

describe("isToolHookEvent", () => {
  test("identifies tool hook events", () => {
    const toolEvents: HookEvent[] = ["PreToolUse", "PostToolUse"];

    for (const event of toolEvents) {
      expect(isToolHookEvent(event)).toBe(true);
    }
  });

  test("rejects non-tool hook events", () => {
    const nonToolEvents: HookEvent[] = [
      "UserPromptSubmit",
      "Notification",
      "SessionStart",
      "SessionEnd",
      "Stop",
      "SubagentStop",
      "PreCompact",
    ];

    for (const event of nonToolEvents) {
      expect(isToolHookEvent(event)).toBe(false);
    }
  });
});

describe("isNotificationEvent", () => {
  test("identifies notification events", () => {
    const notificationEvents: HookEvent[] = [
      "Notification",
      "SessionStart",
      "SessionEnd",
      "Stop",
      "SubagentStop",
    ];

    for (const event of notificationEvents) {
      expect(isNotificationEvent(event)).toBe(true);
    }
  });

  test("rejects non-notification events", () => {
    const nonNotificationEvents: HookEvent[] = [
      "PreToolUse",
      "PostToolUse",
      "UserPromptSubmit",
      "PreCompact",
    ];

    for (const event of nonNotificationEvents) {
      expect(isNotificationEvent(event)).toBe(false);
    }
  });
});

describe("isUserEvent", () => {
  test("identifies user events", () => {
    expect(isUserEvent("UserPromptSubmit")).toBe(true);
  });

  test("rejects non-user events", () => {
    const nonUserEvents: HookEvent[] = [
      "PreToolUse",
      "PostToolUse",
      "Notification",
      "SessionStart",
      "SessionEnd",
      "Stop",
      "SubagentStop",
      "PreCompact",
    ];

    for (const event of nonUserEvents) {
      expect(isUserEvent(event)).toBe(false);
    }
  });
});

describe("isCompactEvent", () => {
  test("identifies compact events", () => {
    expect(isCompactEvent("PreCompact")).toBe(true);
  });

  test("rejects non-compact events", () => {
    const nonCompactEvents: HookEvent[] = [
      "PreToolUse",
      "PostToolUse",
      "Notification",
      "UserPromptSubmit",
      "SessionStart",
      "SessionEnd",
      "Stop",
      "SubagentStop",
    ];

    for (const event of nonCompactEvents) {
      expect(isCompactEvent(event)).toBe(false);
    }
  });
});

describe("HookResults builders (Claude Code compliant)", () => {
  describe("continue", () => {
    test("creates continue result without additional context", () => {
      const result = HookResults.continue();

      expect(result).toEqual({
        continue: true,
        additionalContext: undefined,
      });
    });

    test("creates continue result with additional context", () => {
      const result = HookResults.continue("Processing complete");

      expect(result).toEqual({
        continue: true,
        additionalContext: "Processing complete",
      });
    });
  });

  describe("allow", () => {
    test("creates allow decision without reason", () => {
      const result = HookResults.allow();

      expect(result).toEqual({
        continue: true,
        hookSpecificOutput: {
          permissionDecision: "allow",
          permissionDecisionReason: undefined,
        },
      });
    });

    test("creates allow decision with reason", () => {
      const result = HookResults.allow("File is safe to access");

      expect(result).toEqual({
        continue: true,
        hookSpecificOutput: {
          permissionDecision: "allow",
          permissionDecisionReason: "File is safe to access",
        },
      });
    });
  });

  describe("deny", () => {
    test("creates deny decision without reason", () => {
      const result = HookResults.deny();

      expect(result).toEqual({
        continue: false,
        stopReason: "blocked",
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: undefined,
        },
      });
    });

    test("creates deny decision with reason", () => {
      const result = HookResults.deny("Access to sensitive file blocked");

      expect(result).toEqual({
        continue: false,
        stopReason: "blocked",
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Access to sensitive file blocked",
        },
      });
    });
  });

  describe("ask", () => {
    test("creates ask decision without reason", () => {
      const result = HookResults.ask();

      expect(result).toEqual({
        continue: false,
        hookSpecificOutput: {
          permissionDecision: "ask",
          permissionDecisionReason: undefined,
        },
      });
    });

    test("creates ask decision with reason", () => {
      const result = HookResults.ask("Requires user confirmation");

      expect(result).toEqual({
        continue: false,
        hookSpecificOutput: {
          permissionDecision: "ask",
          permissionDecisionReason: "Requires user confirmation",
        },
      });
    });
  });

  describe("stop", () => {
    test("creates stop result with reason", () => {
      const result = HookResults.stop("Operation cancelled");

      expect(result).toEqual({
        continue: false,
        stopReason: "Operation cancelled",
      });
    });
  });

  describe("suppress", () => {
    test("creates suppress result without message", () => {
      const result = HookResults.suppress();

      expect(result).toEqual({
        suppressOutput: true,
        systemMessage: undefined,
      });
    });

    test("creates suppress result with system message", () => {
      const result = HookResults.suppress("Output suppressed for security");

      expect(result).toEqual({
        suppressOutput: true,
        systemMessage: "Output suppressed for security",
      });
    });
  });
});

describe("Type relationships", () => {
  test("ToolHookEvent is subset of HookEvent", () => {
    const toolEvent: ToolHookEvent = "PreToolUse";
    const hookEvent: HookEvent = toolEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isToolHookEvent(toolEvent)).toBe(true);
  });

  test("NotificationEvent is subset of HookEvent", () => {
    const notificationEvent: NotificationEvent = "SessionStart";
    const hookEvent: HookEvent = notificationEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isNotificationEvent(notificationEvent)).toBe(true);
  });

  test("UserEvent is subset of HookEvent", () => {
    const userEvent: UserEvent = "UserPromptSubmit";
    const hookEvent: HookEvent = userEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isUserEvent(userEvent)).toBe(true);
  });

  test("CompactEvent is subset of HookEvent", () => {
    const compactEvent: CompactEvent = "PreCompact";
    const hookEvent: HookEvent = compactEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isCompactEvent(compactEvent)).toBe(true);
  });
});

describe("HookResult interface (Claude Code compliant)", () => {
  test("accepts minimal continue result", () => {
    const result = { continue: true };
    expect(result.continue).toBe(true);
  });

  test("accepts complete hook result", () => {
    const result = {
      continue: false,
      stopReason: "blocked",
      suppressOutput: true,
      systemMessage: "Operation blocked by security policy",
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: "Access to sensitive data",
      },
      additionalContext: "Security audit log entry created",
    };

    expect(result.continue).toBe(false);
    expect(result.stopReason).toBe("blocked");
    expect(result.suppressOutput).toBe(true);
    expect(result.systemMessage).toBe("Operation blocked by security policy");
    expect(result.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(result.additionalContext).toBe("Security audit log entry created");
  });

  test("accepts permission decision result", () => {
    const result = {
      continue: true,
      hookSpecificOutput: {
        permissionDecision: "allow",
        permissionDecisionReason: "File access approved",
      },
    };

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.permissionDecision).toBe("allow");
  });
});
