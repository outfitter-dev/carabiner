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
