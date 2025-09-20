#!/usr/bin/env bun
/**
 * Simple test for Hello World - ready to run!
 * Run with: bun run packages/examples/src/simple-hello-world-test.ts
 */

import { type HookContext, HookRegistry } from "@carabiner/hooks-core";
import type {
  DirectoryPath,
  SessionId,
  TranscriptPath,
} from "@carabiner/types";
import { bashGreeterHook, helloWorldHook } from "./hello-world.js";

async function runSimpleTest() {
  console.log("🚀 Carabiner Hello World Test\n");

  // Create a registry
  const registry = new HookRegistry();
  registry.register(helloWorldHook);
  registry.register(bashGreeterHook);

  // Create a simple context (minimal required fields)
  const now = Date.now();
  const rawInput = {
    hook_event_name: "PreToolUse" as const,
    tool_name: "Bash",
    tool_input: {
      command: 'echo "Hello from Carabiner!"',
    },
    session_id: `test-${now}`,
    transcript_path: "/tmp/transcript.jsonl",
    cwd: process.cwd(),
  };

  const testContext: HookContext = {
    event: "PreToolUse" as const,
    toolName: "Bash" as const,
    toolInput: {
      command: 'echo "Hello from Carabiner!"',
    },
    sessionId: `test-${now}` as SessionId,
    transcriptPath: "/tmp/transcript.jsonl" as TranscriptPath,
    cwd: process.cwd() as DirectoryPath,
    environment: { CLAUDE_PROJECT_DIR: process.cwd() },
    rawInput: rawInput as any,
    raw: rawInput,
    metadata: {
      provider: {
        id: "test" as any,
        name: "Test Provider",
        version: "1.0.0",
        runtime: "test",
        supports: {
          events: ["PreToolUse"],
          tools: ["Bash"],
          capabilities: [],
        },
      },
      receivedAt: new Date().toISOString(),
    },
  };

  console.log("📝 Executing hooks for Bash command...\n");

  // Debug: Check registered hooks
  const hooks = registry.getHooks("PreToolUse", "Bash");
  console.log(`Number of registered hooks: ${hooks.length}`);

  // Execute the hooks (pass context only)
  const results = await registry.execute(testContext);

  console.log("\n📊 Hook Results:");
  results.forEach((result, index) => {
    const continueValue = "continue" in result ? result.continue : true;
    console.log(`  ${index + 1}. Continue: ${continueValue}`);
    if ("systemMessage" in result && result.systemMessage) {
      console.log(`     Message: ${result.systemMessage}`);
    }
  });

  console.log("\n✅ Test completed successfully!");
}

// Run it!
runSimpleTest().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
