#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Test runner for the Hello World example
 * Run with: bun run packages/examples/src/test-hello-world.ts
 */

import { type HookContext, HookRegistry } from "@carabiner/hooks-core";
import type {
  DirectoryPath,
  SessionId,
  TranscriptPath,
} from "@carabiner/types";
import { bashGreeterHook, helloWorldHook } from "./hello-world.js";

async function testHelloWorld() {
  console.log("🧪 Testing Carabiner Hello World Hooks\n");

  // Create a registry
  const registry = new HookRegistry();

  // Test 1: Basic Hello World Hook
  console.log("Test 1: Basic Hello World Hook");
  console.log("─".repeat(40));

  registry.register(helloWorldHook);

  const rawInput1 = {
    hook_event_name: "PreToolUse" as const,
    tool_name: "Write",
    tool_input: {
      file_path: "/tmp/test.txt",
      content: "Hello from Carabiner!",
    },
    session_id: "test-session",
    transcript_path: "/tmp/transcript.jsonl",
    cwd: process.cwd(),
  };

  const context1: HookContext = {
    event: "PreToolUse" as const,
    toolName: "Write" as const,
    toolInput: {
      file_path: "/tmp/test.txt",
      content: "Hello from Carabiner!",
    },
    sessionId: "test-session" as SessionId,
    transcriptPath: "/tmp/transcript.jsonl" as TranscriptPath,
    cwd: process.cwd() as DirectoryPath,
    environment: { CLAUDE_PROJECT_DIR: process.cwd() },
    rawInput: rawInput1 as any,
    raw: rawInput1,
    metadata: {
      provider: {
        id: "test" as any,
        name: "Test Provider",
        version: "1.0.0",
        runtime: "test",
        supports: {
          events: ["PreToolUse"],
          tools: ["Bash", "Write"],
          capabilities: [],
        },
      },
      receivedAt: new Date().toISOString(),
    },
  };

  const results1 = await registry.execute(context1);
  console.log("Results:", results1);
  console.log();

  // Test 2: Bash-specific Hook
  console.log("Test 2: Bash-specific Hook");
  console.log("─".repeat(40));

  registry.clear();
  registry.register(bashGreeterHook);

  const rawInput2 = {
    hook_event_name: "PreToolUse" as const,
    tool_name: "Bash",
    tool_input: {
      command: 'echo "Testing Carabiner"',
    },
    session_id: "test-session",
    transcript_path: "/tmp/transcript.jsonl",
    cwd: process.cwd(),
  };

  const context2: HookContext = {
    event: "PreToolUse" as const,
    toolName: "Bash" as const,
    toolInput: {
      command: 'echo "Testing Carabiner"',
    },
    sessionId: "test-session" as SessionId,
    transcriptPath: "/tmp/transcript.jsonl" as TranscriptPath,
    cwd: process.cwd() as DirectoryPath,
    environment: { CLAUDE_PROJECT_DIR: process.cwd() },
    rawInput: rawInput2 as any,
    raw: rawInput2,
    metadata: {
      provider: {
        id: "test" as any,
        name: "Test Provider",
        version: "1.0.0",
        runtime: "test",
        supports: {
          events: ["PreToolUse"],
          tools: ["Bash", "Write"],
          capabilities: [],
        },
      },
      receivedAt: new Date().toISOString(),
    },
  };

  const results2 = await registry.execute(context2);
  console.log("Results:", results2);
  console.log();

  // Test 3: Both hooks together
  console.log("Test 3: Both Hooks Together");
  console.log("─".repeat(40));

  registry.clear();
  registry.register(helloWorldHook);
  registry.register(bashGreeterHook);

  const results3 = await registry.execute(context2);
  console.log("Results:", results3);
  console.log();

  console.log("✅ All tests completed successfully!");
}

// Run the tests
testHelloWorld().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
