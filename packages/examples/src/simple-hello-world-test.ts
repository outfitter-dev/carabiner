#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Simple test for Hello World - ready to run!
 * Run with: bun run packages/examples/src/simple-hello-world-test.ts
 */

import { HookRegistry } from "@carabiner/hooks-core";
import { bashGreeterHook, helloWorldHook } from "./hello-world.js";

async function runSimpleTest() {
  console.log("🚀 Carabiner Hello World Test\n");

  // Create a registry
  const registry = new HookRegistry();
  registry.register(helloWorldHook);
  registry.register(bashGreeterHook);

  // Create a simple context (minimal required fields)
  const testContext = {
    event: "PreToolUse" as const,
    tool: "Bash" as const,
    parameters: {
      command: 'echo "Hello from Carabiner!"',
    },
    sessionId: `test-${Date.now()}`,
    timestamp: Date.now(),
    environment: {},
  };

  console.log("📝 Executing hooks for Bash command...\n");

  // Debug: Check registered hooks
  const hooks = registry.getHooks("PreToolUse");
  console.log(`Number of registered hooks: ${hooks.length}`);

  // Execute the hooks (pass event and context)
  const results = await registry.execute("PreToolUse", testContext);

  console.log("\n📊 Hook Results:");
  results.forEach((result, index) => {
    console.log(`  ${index + 1}. Status: ${result.status}`);
    if (result.message) {
      console.log(`     Message: ${result.message}`);
    }
  });

  console.log("\n✅ Test completed successfully!");
}

// Run it!
runSimpleTest().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
