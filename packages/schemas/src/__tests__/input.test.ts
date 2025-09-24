/**
 * Tests for Claude Code hook input validation schemas
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  baseClaudeHookInputSchema,
  claudeHookInputSchema,
  claudeHookOutputSchema,
  claudeNotificationInputSchema,
  claudePreCompactInputSchema,
  claudeSessionEndInputSchema,
  claudeSessionStartInputSchema,
  claudeStopInputSchema,
  claudeSubagentStopInputSchema,
  claudeToolHookInputSchema,
  claudeUserPromptInputSchema,
  hookEnvironmentSchema,
  hookEventSchema,
  hookExecutionOptionsSchema,
  hookResultSchema,
  hookSpecificOutputSchema,
  isValidClaudeHookInput,
  isValidMCPToolName,
  isValidPermissionDecision,
  isValidPreCompactInput,
  isValidToolHookInput,
  legacyHookResultSchema,
  mcpToolNameSchema,
  notificationTypeSchema,
  parseClaudeHookInput,
  permissionDecisionSchema,
  preCompactMatcherSchema,
  safeParseClaudeHookInput,
  sessionStartMatcherSchema,
  toolNameSchema,
  validateAndCreateBrandedInput,
} from "../input.js";

describe("hookEventSchema", () => {
  test("validates all 9 hook events", () => {
    const validEvents = [
      "PreToolUse",
      "PostToolUse",
      "Notification",
      "UserPromptSubmit",
      "Stop",
      "SubagentStop",
      "PreCompact",
      "SessionStart",
      "SessionEnd",
    ];

    for (const event of validEvents) {
      expect(() => hookEventSchema.parse(event)).not.toThrow();
    }
  });

  test("rejects invalid hook events", () => {
    const invalidEvents = [
      "preToolUse", // wrong case
      "PRETOOLUSE", // wrong case
      "InvalidEvent",
      "",
      123,
      null,
      undefined,
    ];

    for (const event of invalidEvents) {
      expect(() => hookEventSchema.parse(event)).toThrow(z.ZodError);
    }
  });
});

describe("toolNameSchema", () => {
  test("validates known tool names", () => {
    const knownTools = [
      "Bash",
      "Edit",
      "Write",
      "Read",
      "Glob",
      "Grep",
      "LS",
      "TodoWrite",
      "WebFetch",
      "WebSearch",
      "NotebookEdit",
    ];

    for (const tool of knownTools) {
      expect(() => toolNameSchema.parse(tool)).not.toThrow();
    }
  });

  test("validates custom tool names", () => {
    const customTools = [
      "CustomTool",
      "MySpecialTool",
      "tool-with-dashes",
      "tool_with_underscores",
    ];

    for (const tool of customTools) {
      expect(() => toolNameSchema.parse(tool)).not.toThrow();
    }
  });

  test("rejects invalid tool names", () => {
    const invalidTools = [
      "", // empty string
      123,
      null,
      undefined,
      {},
      [],
    ];

    for (const tool of invalidTools) {
      expect(() => toolNameSchema.parse(tool)).toThrow(z.ZodError);
    }
  });
});

describe("baseClaudeHookInputSchema", () => {
  test("validates valid base input", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "PreToolUse",
      matcher: "security-check",
    };

    expect(() => baseClaudeHookInputSchema.parse(validInput)).not.toThrow();
  });

  test("validates input without optional matcher", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "SessionStart" as const,
    };

    expect(() => baseClaudeHookInputSchema.parse(validInput)).not.toThrow();
  });

  test("rejects invalid base input", () => {
    const invalidInputs = [
      {}, // missing all required fields
      { session_id: "test" }, // missing other required fields
      {
        session_id: "ab",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
      }, // session_id too short
      {
        session_id: "test-session",
        transcript_path: "relative.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
      }, // non-absolute transcript_path
      {
        session_id: "test-session",
        transcript_path: "/tmp/file.txt",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
      }, // transcript_path not .md
      {
        session_id: "test-session",
        transcript_path: "/tmp/transcript.md",
        cwd: "relative",
        hook_event_name: "PreToolUse" as const,
      }, // non-absolute cwd
      {
        session_id: "test session",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
      }, // invalid session_id format
    ];

    for (const input of invalidInputs) {
      expect(() => baseClaudeHookInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe("claudeToolHookInputSchema", () => {
  test("validates PreToolUse input", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
    };

    expect(() => claudeToolHookInputSchema.parse(validInput)).not.toThrow();
  });

  test("validates PostToolUse input with response", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: { success: true, output: "file1.txt\nfile2.txt" },
    };

    expect(() => claudeToolHookInputSchema.parse(validInput)).not.toThrow();
  });

  test("rejects invalid tool hook input", () => {
    const invalidInputs = [
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "UserPromptSubmit", // wrong event type
        tool_name: "Bash",
        tool_input: { command: "ls" },
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
        // missing tool_name
        tool_input: { command: "ls" },
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeToolHookInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe("claudeUserPromptInputSchema", () => {
  test("validates user prompt input", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "UserPromptSubmit",
      prompt: "Explain TypeScript generics",
    };

    expect(() => claudeUserPromptInputSchema.parse(validInput)).not.toThrow();
  });

  test("rejects invalid user prompt input", () => {
    const invalidInputs = [
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const, // wrong event type
        prompt: "Test prompt",
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "UserPromptSubmit",
        prompt: "", // empty prompt
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeUserPromptInputSchema.parse(input)).toThrow(
        z.ZodError
      );
    }
  });
});

describe("claudeNotificationInputSchema", () => {
  test("validates notification inputs", () => {
    const validInputs = [
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "Notification" as const,
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "Notification" as const,
        notification_type: "info" as const,
        message: "System notification",
      },
    ];

    for (const input of validInputs) {
      expect(() => claudeNotificationInputSchema.parse(input)).not.toThrow();
    }
  });

  test("rejects invalid notification input", () => {
    const invalidInputs = [
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SessionStart" as const, // wrong event type
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "Notification" as const,
        notification_type: "invalid", // wrong type value
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeNotificationInputSchema.parse(input)).toThrow(
        z.ZodError
      );
    }
  });
});

describe("claudeHookInputSchema (discriminated union)", () => {
  test("validates all input types", () => {
    const validInputs = [
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
        tool_name: "Bash",
        tool_input: { command: "ls" },
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "UserPromptSubmit",
        prompt: "Help me",
      },
      {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SessionStart" as const,
      },
    ];

    for (const input of validInputs) {
      expect(() => claudeHookInputSchema.parse(input)).not.toThrow();
    }
  });

  test("discriminates based on hook_event_name", () => {
    const toolInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      prompt: "This should be ignored", // extra field
    };

    const parsed = claudeHookInputSchema.parse(toolInput);
    expect("tool_name" in parsed).toBe(true);
    expect("prompt" in parsed).toBe(false); // extra field stripped
  });
});

describe("hookEnvironmentSchema", () => {
  test("validates environment with CLAUDE_PROJECT_DIR", () => {
    const validEnvs = [
      { CLAUDE_PROJECT_DIR: "/project" },
      {}, // empty environment allowed
    ];

    for (const env of validEnvs) {
      expect(() => hookEnvironmentSchema.parse(env)).not.toThrow();
    }
  });
});

describe("hookResultSchema", () => {
  test("validates hook results", () => {
    const validResults = [
      {},
      { continue: true },
      {
        stopReason: "User requested stop",
        suppressOutput: true,
        systemMessage: "Execution halted",
      },
      {
        hookSpecificOutput: { decision: "allow" },
        additionalContext: "Captured diagnostic info",
      },
    ];

    for (const result of validResults) {
      expect(() => hookResultSchema.parse(result)).not.toThrow();
    }
  });

  test("rejects invalid hook result values", () => {
    const invalidResults = [
      { continue: "yes" },
      { suppressOutput: "true" },
      { hookSpecificOutput: 42 },
    ];

    for (const result of invalidResults) {
      expect(() => hookResultSchema.parse(result)).toThrow(z.ZodError);
    }
  });
});

describe("claudeHookOutputSchema", () => {
  test("validates Claude hook outputs", () => {
    const validOutputs = [
      { action: "continue" },
      { action: "block", message: "Security violation" },
      {
        action: "block",
        message: "Security check complete",
        data: { level: "high", timestamp: "2024-01-01T00:00:00Z" },
      },
    ];

    for (const output of validOutputs) {
      expect(() => claudeHookOutputSchema.parse(output)).not.toThrow();
    }
  });

  test("rejects invalid actions", () => {
    const invalidOutputs = [
      { action: "invalid" },
      {}, // missing action
    ];

    for (const output of invalidOutputs) {
      expect(() => claudeHookOutputSchema.parse(output)).toThrow(z.ZodError);
    }
  });
});

describe("hookExecutionOptionsSchema", () => {
  test("validates execution options", () => {
    const validOptions = [
      {},
      { timeout: 30_000 },
      {
        timeout: 60_000,
        throwOnError: true,
        captureOutput: false,
        logLevel: "debug",
        outputMode: "json",
      },
    ];

    for (const options of validOptions) {
      expect(() => hookExecutionOptionsSchema.parse(options)).not.toThrow();
    }
  });

  test("rejects invalid options", () => {
    const invalidOptions = [
      { timeout: -1 }, // negative timeout
      { logLevel: "invalid" }, // invalid log level
      { outputMode: "invalid" }, // invalid output mode
    ];

    for (const options of invalidOptions) {
      expect(() => hookExecutionOptionsSchema.parse(options)).toThrow(
        z.ZodError
      );
    }
  });
});

describe("parsing functions", () => {
  describe("parseClaudeHookInput", () => {
    test("parses valid input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
        tool_name: "Bash",
        tool_input: { command: "ls" },
      };

      const parsed = parseClaudeHookInput(input);
      expect(parsed).toEqual(input);
    });

    test("throws on invalid input", () => {
      const input = { invalid: "data" };
      expect(() => parseClaudeHookInput(input)).toThrow(z.ZodError);
    });
  });

  describe("safeParseClaudeHookInput", () => {
    test("returns success for valid input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SessionStart" as const,
      };

      const result = safeParseClaudeHookInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    test("returns error for invalid input", () => {
      const input = { invalid: "data" };
      const result = safeParseClaudeHookInput(input);
      expect(result.success).toBe(false);
    });
  });
});

describe("type guard functions", () => {
  test("isValidClaudeHookInput", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "SessionStart" as const,
    };

    const invalidInput = { invalid: "data" };

    expect(isValidClaudeHookInput(validInput)).toBe(true);
    expect(isValidClaudeHookInput(invalidInput)).toBe(false);
  });

  test("isValidToolHookInput", () => {
    const validInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
    };

    const invalidInput = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "SessionStart" as const, // not a tool event
    };

    expect(isValidToolHookInput(validInput)).toBe(true);
    expect(isValidToolHookInput(invalidInput)).toBe(false);
  });
});

describe("validateAndCreateBrandedInput", () => {
  test("validates and creates branded types", async () => {
    const input = {
      session_id: "test-session-123",
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "SessionStart" as const,
    };

    const result = await validateAndCreateBrandedInput(input);

    expect(result.session_id).toBe("test-session-123");
    expect(result.transcript_path).toBe("/tmp/transcript.md");
    expect(result.cwd).toBe("/project" as any);

    // Branded types should be present
    expect(typeof result.sessionId).toBe("string");
    expect(typeof result.transcriptPath).toBe("string");
    expect(typeof result.cwd).toBe("string");
  });

  test("throws on invalid branded input", async () => {
    const input = {
      session_id: "ab", // too short for SessionId
      transcript_path: "/tmp/transcript.md",
      cwd: "/project",
      hook_event_name: "SessionStart" as const,
    };

    await expect(validateAndCreateBrandedInput(input)).rejects.toThrow();
  });
});

describe("New Claude Code Compliance Schemas", () => {
  describe("MCP Tool Name Schema", () => {
    test("validates correct MCP tool names", () => {
      const validNames = [
        "mcp__filesystem__read_file",
        "mcp__github__get_issue",
        "mcp__database__query",
      ];

      for (const name of validNames) {
        expect(() => mcpToolNameSchema.parse(name)).not.toThrow();
        expect(isValidMCPToolName(name)).toBe(true);
      }
    });

    test("rejects invalid MCP tool names", () => {
      const invalidNames = [
        "mcp_filesystem_read_file",
        "regular_tool",
        "mcp__filesystem__",
        "mcp____read_file",
      ];

      for (const name of invalidNames) {
        expect(() => mcpToolNameSchema.parse(name)).toThrow();
        expect(isValidMCPToolName(name)).toBe(false);
      }
    });
  });

  describe("Permission Decision Schema", () => {
    test("validates permission decisions", () => {
      const validDecisions = ["allow", "deny", "ask"];

      for (const decision of validDecisions) {
        expect(() => permissionDecisionSchema.parse(decision)).not.toThrow();
        expect(isValidPermissionDecision(decision)).toBe(true);
      }
    });

    test("rejects invalid permission decisions", () => {
      const invalidDecisions = ["approve", "block", "continue"];

      for (const decision of invalidDecisions) {
        expect(() => permissionDecisionSchema.parse(decision)).toThrow();
        expect(isValidPermissionDecision(decision)).toBe(false);
      }
    });
  });

  describe("PreCompact Matcher Schema", () => {
    test("validates precompact triggers", () => {
      const validTriggers = ["manual", "auto"];

      for (const trigger of validTriggers) {
        expect(() => preCompactMatcherSchema.parse(trigger)).not.toThrow();
      }
    });

    test("rejects invalid triggers", () => {
      const invalidTriggers = ["automatic", "user", ""];

      for (const trigger of invalidTriggers) {
        expect(() => preCompactMatcherSchema.parse(trigger)).toThrow();
      }
    });
  });

  describe("SessionStart Matcher Schema", () => {
    test("validates session start triggers", () => {
      const validTriggers = ["startup", "resume", "clear", "compact"];

      for (const trigger of validTriggers) {
        expect(() => sessionStartMatcherSchema.parse(trigger)).not.toThrow();
      }
    });

    test("rejects invalid triggers", () => {
      const invalidTriggers = ["start", "begin", ""];

      for (const trigger of invalidTriggers) {
        expect(() => sessionStartMatcherSchema.parse(trigger)).toThrow();
      }
    });
  });

  describe("Notification Type Schema", () => {
    test("validates notification types", () => {
      const validTypes = ["info", "warning", "error", "system"];

      for (const type of validTypes) {
        expect(() => notificationTypeSchema.parse(type)).not.toThrow();
      }
    });

    test("rejects invalid types", () => {
      const invalidTypes = ["debug", "log", ""];

      for (const type of invalidTypes) {
        expect(() => notificationTypeSchema.parse(type)).toThrow();
      }
    });
  });

  describe("PreCompact Input Schema", () => {
    test("validates correct PreCompact input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreCompact" as const,
        pre_compact_trigger: "manual" as const,
        stop_hook_active: false,
      };

      expect(() => claudePreCompactInputSchema.parse(input)).not.toThrow();
      expect(isValidPreCompactInput(input)).toBe(true);
    });

    test("rejects PreCompact input with invalid trigger", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreCompact" as const,
        pre_compact_trigger: "invalid" as any,
      };

      expect(() => claudePreCompactInputSchema.parse(input)).toThrow();
    });
  });

  describe("Notification Input Schema", () => {
    test("validates Notification input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "Notification" as const,
        notification_type: "warning" as const,
        message: "Low disk space",
        stop_hook_active: false,
      };

      expect(() => claudeNotificationInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("SessionStart Input Schema", () => {
    test("validates SessionStart input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SessionStart" as const,
        session_start_trigger: "startup" as const,
        message: "Session starting",
      };

      expect(() => claudeSessionStartInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("SessionEnd Input Schema", () => {
    test("validates SessionEnd input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SessionEnd" as const,
        reason: "User logout",
      };

      expect(() => claudeSessionEndInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("Stop Input Schema", () => {
    test("validates Stop input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "Stop" as const,
        reason: "User cancelled",
        stop_hook_active: true,
      };

      expect(() => claudeStopInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("SubagentStop Input Schema", () => {
    test("validates SubagentStop input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "SubagentStop" as const,
        reason: "Subagent task complete",
      };

      expect(() => claudeSubagentStopInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("Hook Specific Output Schema", () => {
    test("validates hook-specific output", () => {
      const output = {
        hookEventName: "PreToolUse",
        permissionDecision: "allow" as const,
        permissionDecisionReason: "File is safe",
        customField: "custom value",
      };

      expect(() => hookSpecificOutputSchema.parse(output)).not.toThrow();
    });

    test("allows additional fields", () => {
      const output = {
        permissionDecision: "deny" as const,
        customProperty: { nested: "value" },
        additionalData: [1, 2, 3],
      };

      const parsed = hookSpecificOutputSchema.parse(output);
      expect(parsed.permissionDecision).toBe("deny");
      expect(parsed.customProperty).toEqual({ nested: "value" });
    });
  });

  describe("Updated Hook Environment Schema", () => {
    test("validates environment with new fields", () => {
      const env = {
        CLAUDE_PROJECT_DIR: "/project/path",
        CLAUDE_SESSION_ID: "session-123",
        CLAUDE_HOOK_EVENT: "PreToolUse",
      };

      expect(() => hookEnvironmentSchema.parse(env)).not.toThrow();
    });

    test("allows partial environment", () => {
      const env = {
        CLAUDE_PROJECT_DIR: "/project/path",
      };

      expect(() => hookEnvironmentSchema.parse(env)).not.toThrow();
    });
  });

  describe("Updated Tool Hook Input Schema", () => {
    test("validates tool hook with hook_specific_input", () => {
      const input = {
        session_id: "test-session-123",
        transcript_path: "/tmp/transcript.md",
        cwd: "/project",
        hook_event_name: "PreToolUse" as const,
        tool_name: "Write",
        tool_input: { file_path: "/test.txt" },
        stop_hook_active: false,
        hook_specific_input: {
          permissionPrompt: "Allow file write?",
        },
      };

      expect(() => claudeToolHookInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("Claude Code Compliant Hook Result Schema", () => {
    test("validates complete hook result", () => {
      const result = {
        continue: false,
        stopReason: "blocked",
        suppressOutput: true,
        systemMessage: "Access denied",
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "Security policy violation",
        },
        additionalContext: "Audit log created",
      };

      expect(() => hookResultSchema.parse(result)).not.toThrow();
    });

    test("validates minimal hook result", () => {
      const result = {
        continue: true,
      };

      expect(() => hookResultSchema.parse(result)).not.toThrow();
    });
  });

  describe("Legacy Hook Result Schema", () => {
    test("validates legacy format for backwards compatibility", () => {
      const result = {
        success: false,
        message: "Operation failed",
        block: true,
        data: { errorCode: "E001" },
        metadata: {
          duration: 150,
          timestamp: "2024-01-01T00:00:00Z",
        },
      };

      expect(() => legacyHookResultSchema.parse(result)).not.toThrow();
    });
  });
});
