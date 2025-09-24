/**
 * Tests for decision types and utilities
 */

import { describe, expect, test } from "bun:test";
import {
  HookOutputBuilder,
  isMCPToolName,
  isNotificationType,
  isPermissionDecision,
  isPreCompactTrigger,
  isSessionStartTrigger,
  MCP_TOOL_NAME_PATTERN,
  type NotificationType,
  type PermissionDecision,
  type PreCompactTrigger,
  type SessionStartTrigger,
  validateMCPToolName,
} from "../decisions.js";

describe("PermissionDecision", () => {
  test("includes all expected values", () => {
    const validDecisions: PermissionDecision[] = ["allow", "deny", "ask"];

    for (const decision of validDecisions) {
      expect(isPermissionDecision(decision)).toBe(true);
    }
  });

  test("rejects invalid values", () => {
    const invalidDecisions = ["approve", "block", "continue", "stop", ""];

    for (const decision of invalidDecisions) {
      expect(isPermissionDecision(decision)).toBe(false);
    }
  });
});

describe("PreCompactTrigger", () => {
  test("includes manual and auto", () => {
    const validTriggers: PreCompactTrigger[] = ["manual", "auto"];

    for (const trigger of validTriggers) {
      expect(isPreCompactTrigger(trigger)).toBe(true);
    }
  });

  test("rejects invalid values", () => {
    const invalidTriggers = ["automatic", "user", "system", ""];

    for (const trigger of invalidTriggers) {
      expect(isPreCompactTrigger(trigger)).toBe(false);
    }
  });
});

describe("SessionStartTrigger", () => {
  test("includes all expected values", () => {
    const validTriggers: SessionStartTrigger[] = [
      "startup",
      "resume",
      "clear",
      "compact",
    ];

    for (const trigger of validTriggers) {
      expect(isSessionStartTrigger(trigger)).toBe(true);
    }
  });

  test("rejects invalid values", () => {
    const invalidTriggers = ["start", "begin", "init", ""];

    for (const trigger of invalidTriggers) {
      expect(isSessionStartTrigger(trigger)).toBe(false);
    }
  });
});

describe("NotificationType", () => {
  test("includes all expected values", () => {
    const validTypes: NotificationType[] = [
      "info",
      "warning",
      "error",
      "system",
    ];

    for (const type of validTypes) {
      expect(isNotificationType(type)).toBe(true);
    }
  });

  test("rejects invalid values", () => {
    const invalidTypes = ["debug", "log", "trace", ""];

    for (const type of invalidTypes) {
      expect(isNotificationType(type)).toBe(false);
    }
  });
});

describe("MCP tool name validation", () => {
  describe("MCP_TOOL_NAME_PATTERN", () => {
    test("matches valid MCP tool names", () => {
      const validNames = [
        "mcp__filesystem__read_file",
        "mcp__github__get_issue",
        "mcp__database__query",
        "mcp__api__fetch_data",
        "mcp__server123__tool456",
      ];

      for (const name of validNames) {
        expect(MCP_TOOL_NAME_PATTERN.test(name)).toBe(true);
        expect(isMCPToolName(name)).toBe(true);
      }
    });

    test("rejects invalid MCP tool names", () => {
      const invalidNames = [
        "mcp_filesystem_read_file", // wrong separators
        "mcp__filesystem__", // empty tool name
        "mcp____read_file", // empty server name
        "filesystem__read_file", // missing mcp prefix
        "mcp__filesystem__read__file", // too many parts
        "mcp__filesystem__read-file", // dash in tool name (invalid)
        "mcp____", // empty parts
        "",
      ];

      for (const name of invalidNames) {
        expect(MCP_TOOL_NAME_PATTERN.test(name)).toBe(false);
        expect(isMCPToolName(name)).toBe(false);
      }
    });
  });

  describe("validateMCPToolName", () => {
    test("passes for valid MCP tool names", () => {
      const validNames = [
        "mcp__filesystem__read_file",
        "mcp__github__get_issue",
      ];

      for (const name of validNames) {
        expect(() => validateMCPToolName(name)).not.toThrow();
      }
    });

    test("throws for invalid MCP tool names", () => {
      const invalidNames = [
        "mcp_filesystem_read_file",
        "regular_tool_name",
        "",
      ];

      for (const name of invalidNames) {
        expect(() => validateMCPToolName(name)).toThrow();
      }
    });

    test("throws with descriptive error message", () => {
      expect(() => validateMCPToolName("invalid_name")).toThrow(
        'Invalid MCP tool name: "invalid_name". MCP tools must follow the pattern: mcp__<server>__<tool>'
      );
    });
  });
});

describe("HookOutputBuilder", () => {
  describe("allow", () => {
    test("creates allow output without reason", () => {
      const output = HookOutputBuilder.allow();

      expect(output).toEqual({
        hookEventName: undefined,
        permissionDecision: "allow",
        permissionDecisionReason: undefined,
      });
    });

    test("creates allow output with reason", () => {
      const output = HookOutputBuilder.allow("File is safe", "PreToolUse");

      expect(output).toEqual({
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "File is safe",
      });
    });
  });

  describe("deny", () => {
    test("creates deny output without reason", () => {
      const output = HookOutputBuilder.deny();

      expect(output).toEqual({
        hookEventName: undefined,
        permissionDecision: "deny",
        permissionDecisionReason: undefined,
      });
    });

    test("creates deny output with reason", () => {
      const output = HookOutputBuilder.deny(
        "Security risk detected",
        "PreToolUse"
      );

      expect(output).toEqual({
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Security risk detected",
      });
    });
  });

  describe("ask", () => {
    test("creates ask output without reason", () => {
      const output = HookOutputBuilder.ask();

      expect(output).toEqual({
        hookEventName: undefined,
        permissionDecision: "ask",
        permissionDecisionReason: undefined,
      });
    });

    test("creates ask output with reason", () => {
      const output = HookOutputBuilder.ask("Needs confirmation", "PreToolUse");

      expect(output).toEqual({
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "Needs confirmation",
      });
    });
  });
});

describe("Hook event data types", () => {
  test("PreToolUseEventData structure", () => {
    const eventData = {
      session_id: "test-session-123",
      transcript_path: "/path/to/transcript.md",
      cwd: "/current/working/dir",
      hook_event_name: "PreToolUse" as const,
      tool_name: "Write",
      tool_input: { file_path: "/test.txt", content: "hello" },
      stop_hook_active: false,
      hook_specific_input: {
        permissionPrompt: "Allow file write?",
      },
    };

    expect(eventData.hook_event_name).toBe("PreToolUse");
    expect(eventData.tool_name).toBe("Write");
    expect(eventData.stop_hook_active).toBe(false);
  });

  test("NotificationEventData structure", () => {
    const eventData = {
      session_id: "test-session-123",
      transcript_path: "/path/to/transcript.md",
      cwd: "/current/working/dir",
      hook_event_name: "Notification" as const,
      notification_type: "warning" as const,
      message: "Low disk space",
      stop_hook_active: false,
    };

    expect(eventData.hook_event_name).toBe("Notification");
    expect(eventData.notification_type).toBe("warning");
    expect(eventData.message).toBe("Low disk space");
  });

  test("PreCompactEventData structure", () => {
    const eventData = {
      session_id: "test-session-123",
      transcript_path: "/path/to/transcript.md",
      cwd: "/current/working/dir",
      hook_event_name: "PreCompact" as const,
      pre_compact_trigger: "manual" as const,
      stop_hook_active: false,
    };

    expect(eventData.hook_event_name).toBe("PreCompact");
    expect(eventData.pre_compact_trigger).toBe("manual");
  });
});
