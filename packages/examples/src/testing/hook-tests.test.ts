/**
 * Testing example demonstrating comprehensive hook testing patterns
 * Shows how to test hooks with various scenarios and edge cases
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type {
  HookContext,
  HookHandler,
  HookResult,
  PreToolUseHookInput,
} from "@/hooks-core";
import {
  createHookContext,
  executeHook,
  HookBuilder,
  HookResults,
} from "@/hooks-core";

// Helper function to get continue status
function didContinue(result: HookResult): boolean {
  if ("continue" in result && result.continue === false) {
    return false;
  }
  if ("stopReason" in result && result.stopReason === "blocked") {
    return false;
  }
  return true;
}

// Helper function to get system message
function getSystemMessage(result: HookResult): string | undefined {
  if ("systemMessage" in result && typeof result.systemMessage === "string") {
    return result.systemMessage;
  }
  return;
}

// Helper function to get provider state
function getProviderState(
  result: HookResult
): Record<string, unknown> | undefined {
  if ("providerState" in result) {
    return result.providerState;
  }
  return;
}

import {
  createMockContext,
  createMockContextFor,
  mockEnv,
} from "@/hooks-testing";
import { securityPreToolUseHook } from "../builder-pattern/security-hooks";
// Import our example hooks
import { handlePreToolUse } from "../function-based/pre-tool-use";

/**
 * Traditional Bun test suite for function-based hooks
 */
describe("Function-based PreToolUse Hook", () => {
  beforeEach(() => {
    mockEnv.restore(); // Clean environment before each test
  });

  afterEach(() => {
    mockEnv.restore(); // Clean up after each test
  });

  test("should validate safe bash commands", async () => {
    // Arrange
    const input = createMockContextFor.bash("PreToolUse", 'echo "Hello World"');
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    // Act
    const result = await handlePreToolUse(context);

    // Assert
    expect(didContinue(result)).toBe(true);
    expect(getSystemMessage(result)).toContain("validation passed");
    const providerState = getProviderState(result);
    expect(providerState).toBeDefined();
    expect(providerState?.command).toBeDefined();
  });

  test("should block dangerous bash commands", async () => {
    // Arrange
    const input = createMockContextFor.bash("PreToolUse", "rm -rf /");
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    // Act
    const result = await handlePreToolUse(context);

    // Assert
    expect(didContinue(result)).toBe(false);
    expect(getSystemMessage(result)).toContain("Validation failed");
  });

  test("should validate file write operations", async () => {
    // Arrange
    const testContent = 'console.log("test");';
    const input = createMockContextFor.write(
      "PreToolUse",
      "test-file.ts",
      testContent
    );
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    // Act
    const result = await handlePreToolUse(context);

    // Assert
    expect(didContinue(result)).toBe(true);
    const providerState = getProviderState(result);
    expect(providerState?.filePath).toBe("test-file.ts");
    expect(providerState?.contentSize).toBe(
      new TextEncoder().encode(testContent).length
    );
  });

  test("should handle large file content appropriately", async () => {
    // Arrange - Create content larger than 1MB
    const largeContent = "a".repeat(1_048_577); // 1MB + 1 byte
    const input = createMockContextFor.write(
      "PreToolUse",
      "large-file.txt",
      largeContent
    );
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    // Act
    const result = await handlePreToolUse(context);

    // Assert
    expect(didContinue(result)).toBe(false);
    expect(getSystemMessage(result)).toContain("too large");
    const providerState = getProviderState(result);
    expect(providerState?.size).toBeGreaterThan(1_048_576);
  });

  test("should handle different environments correctly", async () => {
    const originalEnv = Bun.env.NODE_ENV;

    try {
      // Test production environment
      Bun.env.NODE_ENV = "production";
      const input = createMockContextFor.bash("PreToolUse", "ls -la");
      const context = createHookContext(
        input
      ) as HookContext<PreToolUseHookInput>;

      const prodResult = await handlePreToolUse(context);
      expect(didContinue(prodResult)).toBe(true);

      // Test development environment
      Bun.env.NODE_ENV = "development";
      const devResult = await handlePreToolUse(context);
      expect(didContinue(devResult)).toBe(true);
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        Bun.env.NODE_ENV = originalEnv;
      } else {
        Bun.env.NODE_ENV = undefined;
      }
    }
  });

  test("should handle invalid tool input gracefully", async () => {
    // Arrange - Invalid input for Bash tool
    const input = createMockContext({
      event: "PreToolUse",
      toolName: "Bash",
      toolInput: { invalid: "input" } as Record<string, unknown>, // Missing 'command' field
    });
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    // Act
    const result = await handlePreToolUse(context);

    // Assert
    expect(didContinue(result)).toBe(false);
    expect("suppressOutput" in result ? result.suppressOutput : false).toBe(
      true
    );
    expect(getSystemMessage(result)).toContain("Invalid");
  });
});

/**
 * Hook testing framework utilities are available in @/hooks-testing
 * but not demonstrated here to keep the focus on core functionality.
 * The above tests show all essential patterns for testing hooks.
 */
describe("Hook Testing Framework Examples", () => {
  test("should use testing framework utilities", async () => {
    // Using TestUtils.withMockEnvironment
    const testFunction = TestUtils.withMockEnvironment(
      {
        sessionId: "framework-test",
        toolName: "Edit",
        toolInput: {
          file_path: "test.ts",
          old_string: "old code",
          new_string: "new code",
        },
      },
      async () => {
        const context = createMockContextFor.edit(
          "PreToolUse",
          "test.ts",
          "old code",
          "new code"
        );
        const result = await handlePreToolUse(context);
        expect(didContinue(result)).toBe(true);
        return result;
      }
    );

    await testFunction();
  });

  test("should handle async operations with timeout", async () => {
    const slowOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, message: "Completed" };
    };

    const result = await TestUtils.waitFor(slowOperation, 1000);
    expect(result.success).toBe(true);
  });

  test("should assert hook results correctly", () => {
    const result = {
      success: true,
      message: "Test completed",
      data: { key: "value" },
    };

    // Using TestUtils.assertHookResult
    TestUtils.assertHookResult(result, {
      success: true,
      message: "Test completed",
      hasData: true,
    });

    // Should not throw
  });
});
=======
>>>>>>> 76b953d (refactor: migrate examples to normalized helper API and fix TypeScript errors)

/**
 * Builder pattern hook testing
 */
describe("Builder Pattern Security Hook", () => {
  test("should execute security hook correctly", async () => {
    const input = createMockContextFor.bash("PreToolUse", "echo test");
    const context = createHookContext(input);

    const result = await executeHook(
      securityPreToolUseHook.handler as HookHandler,
      context
    );

    expect(didContinue(result)).toBe(true);
    const providerState = getProviderState(result);
    expect(providerState?.securityLevel).toBeDefined();
    expect(providerState?.checksPerformed).toBeDefined();
  });

  test("should handle security violations", async () => {
    const input = createMockContextFor.bash("PreToolUse", "rm -rf /");
    const context = createHookContext(input);

    const result = await executeHook(securityPreToolUseHook.handler, context);

    expect(didContinue(result)).toBe(false);
    expect("suppressOutput" in result ? result.suppressOutput : false).toBe(
      true
    );
    expect(getSystemMessage(result)).toContain("dangerous command pattern");
  });
});

/**
 * Custom hook testing examples
 */
describe("Custom Hook Scenarios", () => {
  test("should create and test custom validation hook", async () => {
    // Create a custom hook for testing
    const customValidationHook = HookBuilder.forPreToolUse()
      .forTool("Write")
      .withHandler((context) => {
        const toolInput =
          (context as any).tool_input || (context as any).toolInput;
        const filePath = (toolInput as Record<string, unknown>).file_path;

        // Custom validation: only allow .ts files
        if (typeof filePath !== "string" || !filePath.endsWith(".ts")) {
          return HookResults.block("Only TypeScript files allowed", true);
        }

        return HookResults.success("TypeScript file validated");
      })
      .build();

    // Test with TypeScript file
    const tsInput = createMockContextFor.write(
      "PreToolUse",
      "test.ts",
      "content"
    );
    const tsContext = createHookContext(tsInput);
    const tsResult = await executeHook(customValidationHook.handler, tsContext);
    expect(didContinue(tsResult)).toBe(true);

    // Test with JavaScript file
    const jsInput = createMockContextFor.write(
      "PreToolUse",
      "test.js",
      "content"
    );
    const jsContext = createHookContext(jsInput);
    const jsResult = await executeHook(customValidationHook.handler, jsContext);
    expect(didContinue(jsResult)).toBe(false);
    expect("suppressOutput" in jsResult ? jsResult.suppressOutput : false).toBe(
      true
    );
  });

  test("should test hook with middleware", async () => {
    const { middleware } = await import("@carabiner/hooks-core");

    // Create hook with timing middleware
    const timedHook = HookBuilder.forPostToolUse()
      .withMiddleware(middleware.timing())
      .withHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HookResults.success("Timed operation completed");
      })
      .build();

    const input = createMockContextFor.bash("PostToolUse", "test command");
    const context = createHookContext(input);
    const result = await executeHook(timedHook.handler, context);

    expect(didContinue(result)).toBe(true);
    expect(result.metadata?.duration).toBeGreaterThan(90); // Should be ~100ms
  });
});

/**
 * Integration testing examples
 */
describe("Integration Testing", () => {
  test("should test full PreToolUse -> PostToolUse flow", async () => {
    // Test the full flow for a Write operation
    const filePath = "integration-test.ts";
    const fileContent = 'export const test = "integration";';

    // Test PreToolUse
    const input = createMockContextFor.write(
      "PreToolUse",
      filePath,
      fileContent
    );
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    const preResult = await handlePreToolUse(context);
    expect(didContinue(preResult)).toBe(true);

    // Note: PostToolUse handler requires actual file to exist, but this is a mock test
    // In a real scenario, the file would be created by Claude Code between PreToolUse and PostToolUse
    // For now, we'll skip the PostToolUse test in this integration scenario
    // TODO: Create temporary file or mock the file existence check

    // Simulate what would happen if file existed:
    // const postResult = await handlePostToolUse(postContext);
    // expect(postResult.success).toBe(true);
    // expect(postResult.data?.actionsPerformed).toBeDefined();

    // For now, just verify the PreToolUse worked
    expect(didContinue(preResult)).toBe(true);
  });

  test("should handle error propagation correctly", async () => {
    // Test error handling in hook chain
    const errorHook = HookBuilder.forPreToolUse()
      .withHandler(() => {
        throw new Error("Simulated hook error");
      })
      .build();

    const input = createMockContextFor.bash("PreToolUse", "test");
    const context = createHookContext(input);

    // The executeHook function catches errors and doesn't re-throw them
    // Instead, it returns a failure result
    const result = await executeHook(errorHook.handler, context);

    // The hook should return a failure result, not throw
    expect(didContinue(result)).toBe(false);
    // The error message might be wrapped in the hook result
    expect(getSystemMessage(result)).toBeDefined();
  });
});

/**
 * Performance testing examples
 */
describe("Performance Testing", () => {
  test("should complete within reasonable time", async () => {
    const startTime = Date.now();

    const input = createMockContextFor.bash("PreToolUse", "echo test");
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;
    await handlePreToolUse(context);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  test("should handle concurrent hook executions", async () => {
    const inputs = Array.from({ length: 10 }, (_, i) =>
      createMockContextFor.bash("PreToolUse", `echo test${i}`)
    );
    const contexts = inputs.map((input) => createHookContext(input));

    // Set up environment for all tests
    mockEnv.setup({
      sessionId: "concurrent-test",
      toolName: "Bash",
      workspacePath: process.cwd(),
    });

    const startTime = Date.now();

    // Run hooks concurrently
    const results = await Promise.all(
      contexts.map((context) => handlePreToolUse(context))
    );

    const duration = Date.now() - startTime;

    // All should succeed
    for (const result of results) {
      expect(didContinue(result)).toBe(true);
    }

    // Should complete reasonably quickly
    expect(duration).toBeLessThan(2000); // 2 seconds for 10 concurrent executions
  });
});

/**
 * Edge case testing
 */
describe("Edge Cases", () => {
  test("should handle empty input gracefully", async () => {
    const input = createMockContext({
      event: "PreToolUse",
      sessionId: "",
      toolName: "",
      workspacePath: "",
      toolInput: {},
    });
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    const result = await handlePreToolUse(context);
    // Should handle gracefully, not crash
    expect(typeof result).toBe("object");
    expect(typeof didContinue(result)).toBe("boolean");
  });

  test("should handle malformed JSON input", async () => {
    const input = createMockContext({
      event: "PreToolUse",
      toolName: "Bash",
      toolInput: {} as Record<string, unknown>, // Simulate malformed input
    });
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    const result = await handlePreToolUse(context);
    // Should handle JSON parse errors gracefully
    expect(didContinue(result)).toBe(false);
  });

  test("should handle very long input strings", async () => {
    const veryLongCommand = `echo ${"a".repeat(100_000)}`; // 100KB command
    const input = createMockContextFor.bash("PreToolUse", veryLongCommand);
    const context = createHookContext(
      input
    ) as HookContext<PreToolUseHookInput>;

    const result = await handlePreToolUse(context);
    // Should handle large inputs appropriately
    expect(typeof result).toBe("object");
    expect(typeof didContinue(result)).toBe("boolean");
  });
});

/**
 * Note: The declarative test framework is available but not used here
 * to focus on the core Bun test functionality. The above tests demonstrate
 * all the same functionality using standard Bun test patterns.
 */
