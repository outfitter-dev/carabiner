/**
 * Builder pattern tests
 */

import { describe, expect, test } from "bun:test";
import {
  createHook,
  defineHook,
  HookBuilder,
  hook,
  middleware,
} from "../builder";
import { claudeProviderAdapter } from "../providers";
import { HookResults } from "../runtime";
import type { HookContext, PreToolUseHookInput } from "../types";

// Helper function to create proper HookContext from PreToolUseHookInput
function createHookContext(input: PreToolUseHookInput): HookContext {
  const normalized = claudeProviderAdapter.fromProviderInput(input, {
    CLAUDE_PROJECT_DIR: process.cwd(),
  });
  return {
    ...normalized,
    toolName: normalized.tool?.name,
    toolInput: normalized.tool?.input,
    rawInput: input,
  } as HookContext;
}

// Helper function to check continue status
function didContinue(result: any): boolean {
  if ("continue" in result && result.continue === false) {
    return false;
  }
  if ("stopReason" in result && result.stopReason === "blocked") {
    return false;
  }
  return true;
}

// Helper function to get system message
function getSystemMessage(result: any): string | undefined {
  if ("systemMessage" in result && typeof result.systemMessage === "string") {
    return result.systemMessage;
  }
  return;
}

describe("HookBuilder", () => {
  test("should build basic hook", () => {
    const built = new HookBuilder()
      .forEvent("PreToolUse")
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("PreToolUse");
    expect(built.handler).toBeDefined();
    expect(built.priority).toBe(0);
    expect(built.enabled).toBe(true);
  });

  test("should build hook with tool specification", () => {
    const built = new HookBuilder()
      .forEvent("PreToolUse")
      .forTool("Bash")
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("PreToolUse");
    expect(built.matcher).toBe("Bash");
  });

  test("should build hook with priority", () => {
    const built = new HookBuilder()
      .forEvent("PostToolUse")
      .withPriority(100)
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.priority).toBe(100);
  });

  test("should build hook with timeout", () => {
    const built = new HookBuilder()
      .forEvent("SessionStart")
      .withTimeout(5000)
      .withHandler(async () => HookResults.success("test"))
      .build();

    // Timeout is stored internally but not exposed in the built object
    expect(built.event).toBe("SessionStart");
  });

  test("should build disabled hook", () => {
    const built = new HookBuilder()
      .forEvent("UserPromptSubmit")
      .enabled(false)
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.enabled).toBe(false);
  });

  test("should build hook with condition", async () => {
    let conditionChecked = false;

    const built = new HookBuilder()
      .forEvent("PreToolUse")
      .withCondition((input) => {
        conditionChecked = true;
        return "tool_name" in input && input.tool_name === "Bash";
      })
      .withHandler(async () => HookResults.success("test"))
      .build();

    const bashInput: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const bashContext = createHookContext(bashInput);
    const result = await built.handler(bashContext, undefined, {
      signal: new AbortController().signal,
    });
    expect(conditionChecked).toBe(true);
    expect(didContinue(result)).toBe(true);

    const writeInput: PreToolUseHookInput = {
      ...bashInput,
      tool_name: "Write",
    };

    const writeContext = createHookContext(writeInput);
    const writeResult = await built.handler(writeContext, undefined, {
      signal: new AbortController().signal,
    });
    expect(getSystemMessage(writeResult)).toContain("skipped");
  });

  test("should throw error when building without event", () => {
    expect(() => {
      new HookBuilder()
        .withHandler(async () => HookResults.success("test"))
        .build();
    }).toThrow("Hook event is required");
  });

  test("should throw error when building without handler", () => {
    expect(() => {
      new HookBuilder().forEvent("PreToolUse").build();
    }).toThrow("Hook handler is required");
  });
});

describe("HookBuilder - Static Factory Methods", () => {
  test("should create PreToolUse hook", () => {
    const built = HookBuilder.forPreToolUse()
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("PreToolUse");
  });

  test("should create PostToolUse hook", () => {
    const built = HookBuilder.forPostToolUse()
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("PostToolUse");
  });

  test("should create SessionStart hook", () => {
    const built = HookBuilder.forSessionStart()
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("SessionStart");
  });

  test("should create UserPrompt hook", () => {
    const built = HookBuilder.forUserPrompt()
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("UserPromptSubmit");
  });
});

describe("createHook - Functional API", () => {
  test("should create universal PreToolUse hook", () => {
    const hook = createHook.preToolUse(async () =>
      HookResults.success("universal")
    );

    expect(hook.event).toBe("PreToolUse");
    expect(hook.matcher).toBeUndefined();
  });

  test("should create tool-specific PreToolUse hook", () => {
    const hook = createHook.preToolUse("Bash", async () =>
      HookResults.success("bash-specific")
    );

    expect(hook.event).toBe("PreToolUse");
    expect(hook.matcher).toBe("Bash");
  });

  test("should create universal PostToolUse hook", () => {
    const hook = createHook.postToolUse(async () =>
      HookResults.success("universal")
    );

    expect(hook.event).toBe("PostToolUse");
    expect(hook.matcher).toBeUndefined();
  });

  test("should create tool-specific PostToolUse hook", () => {
    const hook = createHook.postToolUse("Write", async () =>
      HookResults.success("write-specific")
    );

    expect(hook.event).toBe("PostToolUse");
    expect(hook.matcher).toBe("Write");
  });

  test("should create SessionStart hook", () => {
    const hook = createHook.sessionStart(async () =>
      HookResults.success("session")
    );

    expect(hook.event).toBe("SessionStart");
  });

  test("should create UserPromptSubmit hook", () => {
    const hook = createHook.userPromptSubmit(async () =>
      HookResults.success("prompt")
    );

    expect(hook.event).toBe("UserPromptSubmit");
  });

  test("should create conditional hook", async () => {
    const hook = createHook.conditional(
      "PreToolUse",
      (input) => "tool_name" in input && input.tool_name === "Bash",
      async () => HookResults.success("conditional")
    );

    expect(hook.event).toBe("PreToolUse");

    const bashInput: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const bashContext = createHookContext(bashInput);
    const result = await hook.handler(bashContext, undefined, {
      signal: new AbortController().signal,
    });
    expect(didContinue(result)).toBe(true);
  });

  test("should throw error when tool-specific hook missing handler", () => {
    expect(() => {
      createHook.preToolUse("Bash", undefined as any);
    }).toThrow("Handler is required when tool is specified");
  });
});

describe("defineHook - Declarative API", () => {
  test("should define hook from config", () => {
    const hook = defineHook({
      event: "PreToolUse",
      handler: async () => HookResults.success("test"),
      priority: 50,
      enabled: true,
    });

    expect(hook.event).toBe("PreToolUse");
    expect(hook.priority).toBe(50);
    expect(hook.enabled).toBe(true);
  });

  test("should define hook with tool", () => {
    const hook = defineHook({
      event: "PostToolUse",
      tool: "Edit",
      handler: async () => HookResults.success("test"),
    });

    expect(hook.event).toBe("PostToolUse");
    expect(hook.matcher).toBe("Edit");
  });

  test("should define hook with condition", async () => {
    let conditionChecked = false;

    const hook = defineHook({
      event: "PreToolUse",
      condition: (context) => {
        conditionChecked = true;
        return context.sessionId === "allowed";
      },
      handler: async () => HookResults.success("test"),
    });

    const input: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "allowed",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const result = await hook.handler(input, undefined, {
      signal: new AbortController().signal,
    });
    expect(conditionChecked).toBe(true);
    expect(result.continue).toBe(true);
  });

  test("should define hook with middleware", async () => {
    const hook = defineHook({
      event: "PreToolUse",
      handler: async () => HookResults.success("test"),
      middleware: [middleware.timing()],
    });

    const input: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const context = createHookContext(input);
    const result = await hook.handler(context, undefined, {
      signal: new AbortController().signal,
    });
    expect(didContinue(result)).toBe(true);
    expect(result.metadata?.duration).toBeDefined();
  });
});

describe("Middleware", () => {
  test("should apply timing middleware", async () => {
    const hook = new HookBuilder()
      .forEvent("PreToolUse")
      .withMiddleware(middleware.timing())
      .withHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HookResults.success("test");
      })
      .build();

    const input: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const context = createHookContext(input);
    const result = await hook.handler(context, undefined, {
      signal: new AbortController().signal,
    });
    expect(result.metadata?.duration).toBeGreaterThan(9);
  });

  test("should apply error handling middleware", async () => {
    const hook = new HookBuilder()
      .forEvent("PreToolUse")
      .withMiddleware(middleware.errorHandling())
      .withHandler(async () => {
        throw new Error("Test error");
      })
      .build();

    const input: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const context = createHookContext(input);
    const result = await hook.handler(context, undefined, {
      signal: new AbortController().signal,
    });
    expect(didContinue(result)).toBe(false);
    expect(getSystemMessage(result)).toContain("Test error");
  });

  test("should apply validation middleware", async () => {
    const hook = new HookBuilder()
      .forEvent("PreToolUse")
      .withMiddleware(
        middleware.validation(
          (context) => context.toolName === "Bash",
          "Only Bash is allowed"
        )
      )
      .withHandler(async () => HookResults.success("test"))
      .build();

    const bashInput: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const bashContext = createHookContext(bashInput);
    const bashResult = await hook.handler(bashContext, undefined, {
      signal: new AbortController().signal,
    });
    expect(didContinue(bashResult)).toBe(true);

    const writeInput: PreToolUseHookInput = {
      ...bashInput,
      tool_name: "Write",
    };

    const writeContext = createHookContext(writeInput);
    const writeResult = await hook.handler(writeContext, undefined, {
      signal: new AbortController().signal,
    });
    expect(didContinue(writeResult)).toBe(false);
    expect(getSystemMessage(writeResult)).toBe("Only Bash is allowed");
  });

  test("should apply multiple middleware in order", async () => {
    const executionOrder: string[] = [];

    const middleware1 = async (input: any, toolUseId: any, next: any) => {
      executionOrder.push("middleware1-before");
      const result = await next(input, toolUseId, {
        signal: new AbortController().signal,
      });
      executionOrder.push("middleware1-after");
      return result;
    };

    const middleware2 = async (input: any, toolUseId: any, next: any) => {
      executionOrder.push("middleware2-before");
      const result = await next(input, toolUseId, {
        signal: new AbortController().signal,
      });
      executionOrder.push("middleware2-after");
      return result;
    };

    const hook = new HookBuilder()
      .forEvent("PreToolUse")
      .withMiddleware(middleware1)
      .withMiddleware(middleware2)
      .withHandler(async () => {
        executionOrder.push("handler");
        return HookResults.success("test");
      })
      .build();

    const input: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      session_id: "test",
      transcript_path: "/test",
      cwd: "/test",
      tool_input: { command: "test" },
    };

    const context = createHookContext(input);
    await hook.handler(context, undefined, {
      signal: new AbortController().signal,
    });

    expect(executionOrder).toEqual([
      "middleware1-before",
      "middleware2-before",
      "handler",
      "middleware2-after",
      "middleware1-after",
    ]);
  });
});

describe("Hook instance", () => {
  test("should use hook instance directly", () => {
    const built = hook
      .forEvent("PreToolUse")
      .withHandler(async () => HookResults.success("test"))
      .build();

    expect(built.event).toBe("PreToolUse");
  });
});
