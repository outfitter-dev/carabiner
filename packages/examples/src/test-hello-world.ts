#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Test runner for the Hello World example
 * Run with: bun run packages/examples/src/test-hello-world.ts
 */

import { HookRegistry } from "@carabiner/hooks-core";
import { createToolHookContext } from "@carabiner/types";
import { bashGreeterHook, helloWorldHook } from "./hello-world.js";

async function testHelloWorld() {
  console.log("🧪 Testing Carabiner Hello World Hooks\n");

  // Create a registry
  const registry = new HookRegistry();

  // Test 1: Basic Hello World Hook
  console.log("Test 1: Basic Hello World Hook");
  console.log("─".repeat(40));

  registry.register(helloWorldHook);

  const context1 = createToolHookContext("PreToolUse", {
    tool: "Write",
    parameters: {
      file_path: "/tmp/test.txt",
      content: "Hello from Carabiner!",
    },
    sessionId: "test-session",
    timestamp: Date.now(),
  });

  const results1 = await registry.execute("PreToolUse", context1);
  console.log("Results:", results1);
  console.log();

  // Test 2: Bash-specific Hook
  console.log("Test 2: Bash-specific Hook");
  console.log("─".repeat(40));

  registry.clear();
  registry.register(bashGreeterHook);

  const context2 = createToolHookContext("PreToolUse", {
    tool: "Bash",
    parameters: {
      command: 'echo "Testing Carabiner"',
    },
    sessionId: "test-session",
    timestamp: Date.now(),
  });

  const results2 = await registry.execute("PreToolUse", context2);
  console.log("Results:", results2);
  console.log();

  // Test 3: Both hooks together
  console.log("Test 3: Both Hooks Together");
  console.log("─".repeat(40));

  registry.clear();
  registry.register(helloWorldHook);
  registry.register(bashGreeterHook);

  const results3 = await registry.execute("PreToolUse", context2);
  console.log("Results:", results3);
  console.log();

  console.log("✅ All tests completed successfully!");
}

// Run the tests
testHelloWorld().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
