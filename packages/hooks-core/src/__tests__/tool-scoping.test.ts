/**
 * Comprehensive tests for tool scoping architecture fix
 * Validates that the critical bug where forTool() calls are ignored is resolved
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createHook, HookBuilder, HookRegistry } from "../index.ts";
import {
  createBashInput,
  createHookContext,
  HookResults,
  isBashToolInput,
} from "../runtime.ts";
import type { HookContext, HookJSONOutput, HookResult } from "../types.ts";

// Mock input helper that matches the actual HookInput structure
function createMockContext(
  event: "PreToolUse" | "PostToolUse",
  options: { toolName?: string } = {}
): HookContext {
  const baseInput = createBashInput(event, "echo test") as any;
  if (options.toolName) {
    baseInput.tool_name = options.toolName;
  }
  if (event === "PostToolUse") {
    baseInput.tool_response = baseInput.tool_response ?? "Command executed";
  }
  return createHookContext(baseInput);
}

function expectSync<T extends HookJSONOutput | HookResult>(
  result: T
): Exclude<T, { async: true }> {
  if ((result as { async?: boolean }).async === true) {
    throw new Error("Expected synchronous hook result");
  }
  return result as Exclude<T, { async: true }>;
}

function expectSyncArray<T extends HookJSONOutput | HookResult>(
  results: readonly T[]
): Exclude<T, { async: true }>[] {
  return results.map((result) => expectSync(result));
}

describe("Tool Scoping Fix - Registry Core", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test("tool-specific hooks only execute for specified tool", async () => {
    const bashHandler = mock().mockResolvedValue({ continue: true });

    const bashHook = HookBuilder.forPreToolUse()
      .forTool("Bash")
      .withHandler(bashHandler)
      .build();

    registry.register(bashHook);

    // Should execute for Bash
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );
    expect(bashHandler).toHaveBeenCalledTimes(1);

    // Should NOT execute for Write
    bashHandler.mockClear();
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Write" })
    );
    expect(bashHandler).not.toHaveBeenCalled();
  });

  test("universal hooks execute for all tools", async () => {
    const universalHandler = mock().mockResolvedValue({ continue: true });

    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(universalHandler)
      .build();

    registry.register(universalHook);

    // Should execute for any tool
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);

    universalHandler.mockClear();
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Write" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);

    universalHandler.mockClear();
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Edit" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
  });

  test("mixed universal and tool-specific hooks execute correctly", async () => {
    const universalHandler = mock().mockResolvedValue(HookResults.success());
    const bashHandler = mock().mockResolvedValue(HookResults.success());
    const writeHandler = mock().mockResolvedValue(HookResults.success());

    registry.register(
      HookBuilder.forPreToolUse().withHandler(universalHandler).build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool("Bash")
        .withHandler(bashHandler)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool("Write")
        .withHandler(writeHandler)
        .build()
    );

    // For Bash: both universal and bash-specific should run
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).toHaveBeenCalledTimes(1);
    expect(writeHandler).not.toHaveBeenCalled();

    // For Write: universal and write-specific should run
    universalHandler.mockClear();
    bashHandler.mockClear();
    writeHandler.mockClear();
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Write" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).not.toHaveBeenCalled();
    expect(writeHandler).toHaveBeenCalledTimes(1);

    // For Edit: only universal should run
    universalHandler.mockClear();
    bashHandler.mockClear();
    writeHandler.mockClear();
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Edit" })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).not.toHaveBeenCalled();
    expect(writeHandler).not.toHaveBeenCalled();
  });

  test("hook priority works correctly with mixed universal and tool-specific hooks", async () => {
    const results: string[] = [];

    const universalLow = mock().mockImplementation(() => {
      results.push("universal-low");
      return HookResults.success();
    });

    const universalHigh = mock().mockImplementation(() => {
      results.push("universal-high");
      return HookResults.success();
    });

    const bashLow = mock().mockImplementation(() => {
      results.push("bash-low");
      return HookResults.success();
    });

    const bashHigh = mock().mockImplementation(() => {
      results.push("bash-high");
      return HookResults.success();
    });

    // Register hooks with different priorities
    registry.register(
      HookBuilder.forPreToolUse()
        .withHandler(universalLow)
        .withPriority(1)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .withHandler(universalHigh)
        .withPriority(10)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool("Bash")
        .withHandler(bashLow)
        .withPriority(2)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool("Bash")
        .withHandler(bashHigh)
        .withPriority(5)
        .build()
    );

    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );

    // Should execute in priority order: universal-high(10), bash-high(5), bash-low(2), universal-low(1)
    expect(results).toEqual([
      "universal-high",
      "bash-high",
      "bash-low",
      "universal-low",
    ]);
  });

  test("registry stores hooks with correct keys", () => {
    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(mock())
      .build();
    const bashHook = HookBuilder.forPreToolUse()
      .forTool("Bash")
      .withHandler(mock())
      .build();

    registry.register(universalHook);
    registry.register(bashHook);

    // Should have different hook counts for different tools
    const bashHooks = registry.getHooks("PreToolUse", "Bash");
    const writeHooks = registry.getHooks("PreToolUse", "Write");
    const universalOnly = registry.getHooks("PreToolUse");

    expect(bashHooks).toHaveLength(2); // universal + bash-specific
    expect(writeHooks).toHaveLength(1); // only universal
    expect(universalOnly).toHaveLength(1); // only universal when no tool specified
  });
});

describe("Tool Scoping Fix - Builder Pattern", () => {
  test("builder includes matcher field in output", () => {
    const bashHook = HookBuilder.forPreToolUse()
      .forTool("Bash")
      .withHandler(mock())
      .build();

    expect(bashHook.matcher).toBe("Bash");
    expect(bashHook.event).toBe("PreToolUse");

    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(mock())
      .build();

    expect(universalHook.matcher).toBeUndefined();
    expect(universalHook.event).toBe("PreToolUse");
  });

  test("builder supports method chaining with forTool", () => {
    const hook = HookBuilder.forPreToolUse()
      .forTool("Write")
      .withPriority(5)
      .withHandler(mock())
      .enabled(true)
      .build();

    expect(hook.matcher).toBe("Write");
    expect(hook.priority).toBe(5);
    expect(hook.enabled).toBe(true);
    expect(hook.event).toBe("PreToolUse");
  });
});

describe("Tool Scoping Fix - Function-Based API", () => {
  test("createHook.preToolUse supports both universal and tool-specific syntax", () => {
    // Universal hook syntax
    const universalHook = createHook.preToolUse(mock());
    expect(universalHook.matcher).toBeUndefined();
    expect(universalHook.event).toBe("PreToolUse");

    // Tool-specific syntax
    const bashHook = createHook.preToolUse("Bash", mock());
    expect(bashHook.matcher).toBe("Bash");
    expect(bashHook.event).toBe("PreToolUse");
  });

  test("createHook.postToolUse supports both universal and tool-specific syntax", () => {
    // Universal hook syntax
    const universalHook = createHook.postToolUse(mock());
    expect(universalHook.matcher).toBeUndefined();
    expect(universalHook.event).toBe("PostToolUse");

    // Tool-specific syntax
    const writeHook = createHook.postToolUse("Write", mock());
    expect(writeHook.matcher).toBe("Write");
    expect(writeHook.event).toBe("PostToolUse");
  });

  test("createHook throws error when tool specified without handler", () => {
    expect(() => {
      createHook.preToolUse("Bash", undefined as any);
    }).toThrow("Handler is required when tool is specified");

    expect(() => {
      createHook.postToolUse("Write", undefined as any);
    }).toThrow("Handler is required when tool is specified");
  });
});

describe("Tool Scoping Fix - Integration Tests", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test("real-world scenario: logging hooks with tool-specific overrides", async () => {
    const logs: string[] = [];

    // Universal logging hook (logs all tools)
    const universalLogger = createHook.preToolUse((context) => {
      const tool = context.toolName ?? "(none)";
      logs.push(`[UNIVERSAL] ${context.event} for ${tool}`);
      return HookResults.success();
    });

    // Bash-specific enhanced logging
    const bashLogger = createHook.preToolUse("Bash", (context) => {
      const tool = context.toolName ?? "(none)";
      logs.push(`[BASH-SPECIFIC] Enhanced logging for ${tool}`);
      return HookResults.success();
    });

    registry.register(universalLogger);
    registry.register(bashLogger);

    // Test Bash execution (should trigger both)
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );
    expect(logs).toContain("[UNIVERSAL] PreToolUse for Bash");
    expect(logs).toContain("[BASH-SPECIFIC] Enhanced logging for Bash");

    logs.length = 0; // Clear logs

    // Test Write execution (should trigger only universal)
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Write" })
    );
    expect(logs).toContain("[UNIVERSAL] PreToolUse for Write");
    expect(logs).not.toContain("[BASH-SPECIFIC]");
  });

  test("security validation scenario: block dangerous commands only for Bash", async () => {
    // Universal hook (allows all)
    const universalHook = createHook.preToolUse(() => {
      return HookResults.success("Universal validation passed");
    });

    // Bash-specific security hook (blocks rm -rf)
    const bashSecurityHook = createHook.preToolUse("Bash", (context) => {
      const command =
        context.toolInput && isBashToolInput(context.toolInput)
          ? context.toolInput.command
          : "";
      if (command.includes("rm -rf")) {
        return HookResults.block("Dangerous command blocked");
      }
      return HookResults.success("Bash security check passed");
    });

    registry.register(universalHook);
    registry.register(bashSecurityHook);

    // Test safe Bash command (should pass both)
    const safeBashResults = expectSyncArray(
      await registry.execute(
        createHookContext(createBashInput("PreToolUse", "echo safe"), {
          tool_input: { command: 'echo "hello world"' },
        })
      )
    );
    expect(safeBashResults).toHaveLength(2);
    expect(safeBashResults.every((r) => r.continue)).toBe(true);

    // Test dangerous Bash command (should be blocked)
    const dangerousBashResults = expectSyncArray(
      await registry.execute(
        createHookContext(createBashInput("PreToolUse", "echo dangerous"), {
          tool_input: { command: "rm -rf /" },
        })
      )
    );
    expect(dangerousBashResults).toHaveLength(2);
    const [universalDanger, bashDanger] = dangerousBashResults;
    expect(universalDanger?.continue).toBe(true); // Universal passes
    expect(bashDanger?.continue).toBe(false); // Bash security blocks

    // Test Write tool with dangerous-looking content (should pass - no Bash security)
    const writeResults = expectSyncArray(
      await registry.execute(
        createHookContext(createBashInput("PreToolUse", "echo write"), {
          tool_name: "Write",
          tool_input: { file_path: "script.sh", content: "rm -rf /" },
        })
      )
    );
    expect(writeResults).toHaveLength(1); // Only universal hook
    expect(writeResults[0]?.continue).toBe(true);
  });

  test("performance monitoring: tool-specific vs universal hooks", async () => {
    let universalExecutions = 0;
    let bashExecutions = 0;
    let writeExecutions = 0;

    // Universal performance monitor
    registry.register(
      createHook.preToolUse(() => {
        universalExecutions++;
        return HookResults.success();
      })
    );

    // Bash-specific monitor
    registry.register(
      createHook.preToolUse("Bash", () => {
        bashExecutions++;
        return HookResults.success();
      })
    );

    // Write-specific monitor
    registry.register(
      createHook.preToolUse("Write", () => {
        writeExecutions++;
        return HookResults.success();
      })
    );

    // Execute for different tools
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Write" })
    );
    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Edit" })
    );

    // Universal should execute for all
    expect(universalExecutions).toBe(3);

    // Tool-specific should execute only for their tools
    expect(bashExecutions).toBe(1);
    expect(writeExecutions).toBe(1);
  });
});

describe("Tool Scoping Fix - Error Scenarios", () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test("blocking failure in tool-specific hook stops execution", async () => {
    const results: string[] = [];

    // Universal hook
    registry.register(
      createHook.preToolUse(() => {
        results.push("universal");
        return HookResults.success();
      })
    );

    // Bash hook that blocks
    registry.register(
      createHook.preToolUse("Bash", () => {
        results.push("bash-blocker");
        return HookResults.block("Blocked by bash hook");
      })
    );

    // Another bash hook (should not execute due to blocking)
    registry.register(
      createHook.preToolUse("Bash", () => {
        results.push("bash-after-blocker");
        return HookResults.success();
      })
    );

    await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );

    expect(results).toContain("universal");
    expect(results).toContain("bash-blocker");
    expect(results).not.toContain("bash-after-blocker"); // Should be blocked
  });

  test("error handling preserves tool scoping", async () => {
    const results: string[] = [];

    // Universal hook that throws
    registry.register(
      createHook.preToolUse(() => {
        results.push("universal-error");
        throw new Error("Universal hook error");
      })
    );

    // Bash hook that should not execute due to universal error stopping execution
    registry.register(
      createHook.preToolUse("Bash", () => {
        results.push("bash-after-error");
        return HookResults.success();
      })
    );

    const hookResults = await registry.execute(
      createMockContext("PreToolUse", { toolName: "Bash" })
    );

    expect(results).toContain("universal-error");
    expect(results).not.toContain("bash-after-error"); // Execution stopped due to blocking error

    expect(hookResults).toHaveLength(1);
    expect(expectSync(hookResults[0]!).continue).toBe(false);
  });
});

describe("Tool Scoping Fix - Backward Compatibility", () => {
  test("existing hook patterns work unchanged", async () => {
    const registry = new HookRegistry();

    // Old pattern: builder without forTool (should be universal)
    const oldBuilderHook = HookBuilder.forPreToolUse()
      .withHandler(mock().mockResolvedValue(HookResults.success()))
      .build();

    registry.register(oldBuilderHook);

    // Should work for any tool
    const bashResult = expectSyncArray(
      await registry.execute(
        createMockContext("PreToolUse", { toolName: "Bash" })
      )
    );
    const writeResult = expectSyncArray(
      await registry.execute(
        createMockContext("PreToolUse", { toolName: "Write" })
      )
    );

    expect(bashResult).toHaveLength(1);
    expect(writeResult).toHaveLength(1);
    expect(bashResult[0]?.continue).toBe(true);
    expect(writeResult[0]?.continue).toBe(true);
  });

  test("manual hook registry entries work with new system", () => {
    const registry = new HookRegistry();

    // Manual registry entry (old style - no matcher field)
    registry.register({
      event: "PreToolUse",
      handler: mock().mockResolvedValue(HookResults.success()),
      priority: 0,
      enabled: true,
      // No matcher field - should be universal
    });

    const bashHooks = registry.getHooks("PreToolUse", "Bash");
    const writeHooks = registry.getHooks("PreToolUse", "Write");

    expect(bashHooks).toHaveLength(1);
    expect(writeHooks).toHaveLength(1);
  });
});
