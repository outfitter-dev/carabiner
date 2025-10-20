import { beforeEach, describe, expect, test } from "bun:test";
import {
  __clearHookProvidersForTests,
  CLAUDE_PROVIDER_METADATA,
  claudeProviderAdapter,
  getDefaultHookProvider,
  getHookProvider,
  type NormalizedHookContext,
  type NormalizedHookResult,
  registerDefaultHookProviders,
  registerHookProvider,
} from "../providers";
import type {
  HookInput,
  HookJSONOutput,
  PostToolUseHookInput,
  PreToolUseHookInput,
} from "../types";

const TEST_ENVIRONMENT = Object.freeze({
  CLAUDE_PROJECT_DIR: "/claude/project",
});

beforeEach(() => {
  __clearHookProvidersForTests();
  registerDefaultHookProviders({ force: true });
});

function createPreToolUseInput(): PreToolUseHookInput {
  return {
    hook_event_name: "PreToolUse",
    session_id: "session-123",
    transcript_path: "/tmp/transcript.md",
    cwd: "/workspace/project",
    tool_name: "Bash",
    tool_input: {
      command: "echo 'hello world'",
      stdin: "",
    },
  } satisfies PreToolUseHookInput;
}

function createPostToolUseInput(): PostToolUseHookInput {
  return {
    hook_event_name: "PostToolUse",
    session_id: "session-456",
    transcript_path: "/tmp/transcript.md",
    cwd: "/workspace/project",
    tool_name: "Bash",
    tool_input: {
      command: "ls",
      stdin: "",
    },
    tool_response: {
      exit_code: 0,
      stdout: "README.md\n",
      stderr: "",
    },
  } satisfies PostToolUseHookInput;
}

function snapshotContext(
  context: NormalizedHookContext<HookInput>
): Record<string, unknown> {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      receivedAt: "<iso-timestamp>",
    },
  };
}

describe("claudeProviderAdapter.fromProviderInput", () => {
  test("normalizes PreToolUse input", () => {
    const input = createPreToolUseInput();

    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    expect(context.event).toBe("PreToolUse");
    expect(context.sessionId).toBe("session-123");
    expect(context.environment).toEqual(TEST_ENVIRONMENT);
    expect(context.tool).toEqual({
      name: "Bash",
      input: input.tool_input as Record<string, unknown>,
      response: undefined,
    });
    expect(context.metadata.provider).toEqual(CLAUDE_PROVIDER_METADATA);

    expect(snapshotContext(context)).toMatchSnapshot();
  });

  test("preserves all Claude Code SDK fields including stop_hook_active", () => {
    const input = {
      ...createPreToolUseInput(),
      stop_hook_active: true,
      hook_specific_input: {
        permissionPrompt: "Allow bash execution?",
      },
      permission_decision: "allow",
      custom_field: "should be preserved",
    } as any;

    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    // Original fields should be preserved in raw
    const rawWithExtras = context.raw as any;
    expect(rawWithExtras.stop_hook_active).toBe(true);
    expect(rawWithExtras.hook_specific_input).toEqual({
      permissionPrompt: "Allow bash execution?",
    });
    expect(rawWithExtras.permission_decision).toBe("allow");
    expect(rawWithExtras.custom_field).toBe("should be preserved");

    // Snake_case should be converted to camelCase
    expect(rawWithExtras.stopHookActive).toBe(true);
    expect(rawWithExtras.hookSpecificInput).toEqual({
      permissionPrompt: "Allow bash execution?",
    });
  });

  test("handles Notification event with notification_type", () => {
    const notificationInput = {
      hook_event_name: "Notification",
      session_id: "session-notify",
      transcript_path: "/tmp/transcript.md",
      cwd: "/workspace/project",
      notification_type: "warning",
      message: "Test notification",
      stop_hook_active: false,
    } as any;

    const context = claudeProviderAdapter.fromProviderInput(
      notificationInput,
      TEST_ENVIRONMENT
    );

    expect(context.event).toBe("Notification");
    const rawNotification = context.raw as any;
    expect(rawNotification.notification_type).toBe("warning");
    expect(rawNotification.notificationType).toBe("warning");
    expect(rawNotification.message).toBe("Test notification");
    expect(rawNotification.stopHookActive).toBe(false);
  });

  test("handles PreCompact event with pre_compact_trigger", () => {
    const preCompactInput = {
      hook_event_name: "PreCompact",
      session_id: "session-compact",
      transcript_path: "/tmp/transcript.md",
      cwd: "/workspace/project",
      pre_compact_trigger: "manual",
      stop_hook_active: true,
    } as any;

    const context = claudeProviderAdapter.fromProviderInput(
      preCompactInput,
      TEST_ENVIRONMENT
    );

    expect(context.event).toBe("PreCompact");
    const rawPreCompact = context.raw as any;
    expect(rawPreCompact.pre_compact_trigger).toBe("manual");
    expect(rawPreCompact.preCompactTrigger).toBe("manual");
    expect(rawPreCompact.stopHookActive).toBe(true);
  });

  test("captures PostToolUse tool response", () => {
    const input = createPostToolUseInput();

    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    expect(context.tool).toEqual({
      name: "Bash",
      input: input.tool_input as Record<string, unknown>,
      response: input.tool_response,
    });

    expect(snapshotContext(context)).toMatchSnapshot();
  });
});

describe("claudeProviderAdapter.toProviderOutput", () => {
  test("round-trips HookJSONOutput without provider-specific fields", () => {
    const input = createPreToolUseInput();
    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    const normalized: NormalizedHookResult = {
      continue: true,
      systemMessage: "All good",
      metadata: {
        duration: 42,
      },
      providerState: {
        seen: true,
      },
    } satisfies NormalizedHookResult;

    const output = claudeProviderAdapter.toProviderOutput(normalized, context);

    const expected: HookJSONOutput = {
      continue: true,
      systemMessage: "All good",
    };

    expect(output).toStrictEqual(expected);
  });

  test("passes through hookSpecificOutput including permission decisions", () => {
    const input = createPreToolUseInput();
    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    const normalized: NormalizedHookResult = {
      continue: false,
      stopReason: "blocked",
      systemMessage: "Permission denied",
      hookSpecificOutput: {
        permissionDecision: "deny",
        permissionDecisionReason: "Security policy violation",
        hookEventName: "PreToolUse",
        customField: "should be preserved",
      },
      additionalContext: "Additional debugging info",
      metadata: {
        duration: 25,
      },
      providerState: {
        blocked: true,
      },
    } satisfies NormalizedHookResult;

    const output = claudeProviderAdapter.toProviderOutput(normalized, context);

    // Should include all the standard fields
    const outputWithFields = output as any;
    expect(outputWithFields.continue).toBe(false);
    expect(outputWithFields.stopReason).toBe("blocked");
    expect(outputWithFields.systemMessage).toBe("Permission denied");
    expect(outputWithFields.additionalContext).toBe(
      "Additional debugging info"
    );

    // Should pass through hookSpecificOutput untouched
    expect(outputWithFields.hookSpecificOutput).toEqual({
      permissionDecision: "deny",
      permissionDecisionReason: "Security policy violation",
      hookEventName: "PreToolUse",
      customField: "should be preserved",
    });

    // Should NOT include provider-specific metadata
    expect(output).not.toHaveProperty("metadata");
    expect(output).not.toHaveProperty("providerState");
  });

  test("handles empty hookSpecificOutput", () => {
    const input = createPreToolUseInput();
    const context = claudeProviderAdapter.fromProviderInput(
      input,
      TEST_ENVIRONMENT
    );

    const normalized: NormalizedHookResult = {
      continue: true,
      suppressOutput: true,
    } satisfies NormalizedHookResult;

    const output = claudeProviderAdapter.toProviderOutput(normalized, context);

    const outputWithOptionalFields = output as any;
    expect(outputWithOptionalFields.continue).toBe(true);
    expect(outputWithOptionalFields.suppressOutput).toBe(true);
    expect(outputWithOptionalFields.hookSpecificOutput).toBeUndefined();
    expect(outputWithOptionalFields.stopReason).toBeUndefined();
    expect(outputWithOptionalFields.systemMessage).toBeUndefined();
    expect(outputWithOptionalFields.additionalContext).toBeUndefined();
  });
});

describe("provider registry", () => {
  test("registerDefaultHookProviders seeds the default claude adapter", () => {
    const provider = getDefaultHookProvider();
    expect(provider).toBeDefined();
    if (!provider) {
      throw new Error("Default provider not registered");
    }
    expect(provider.id).toBe("claude");
    expect(getHookProvider("claude")).toBe(provider);
  });

  test("registerHookProvider prevents duplicate registrations by default", () => {
    expect(() => registerHookProvider(claudeProviderAdapter)).toThrow(
      /already registered/
    );

    expect(() =>
      registerHookProvider(claudeProviderAdapter, {
        replaceExisting: true,
        makeDefault: true,
      })
    ).not.toThrow();
  });
});
