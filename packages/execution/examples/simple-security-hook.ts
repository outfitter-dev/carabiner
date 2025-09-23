#!/usr/bin/env bun

/**
 * Example: Simple Security Hook
 *
 * This demonstrates how to create a basic security hook using the
 * @outfitter/execution package. This hook blocks dangerous bash commands
 * while allowing safe operations to proceed.
 *
 * To test this example:
 *
 * 1. Create mock input:
 *    echo '{"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "rm -rf /"}, "session_id": "test", "cwd": "/tmp", "environment": {}}' | bun simple-security-hook.ts
 *
 * 2. Expected output: Hook should block the dangerous command
 */

import type { PreToolUseHookInput } from "@carabiner/hooks-core";
import { createHookContext, HookResults } from "@carabiner/hooks-core";

// We would normally use:
// import { runHook } from '@carabiner/execution';
// But for this example, we'll simulate the execution

import {
  ExecutionTimer,
  MetricsCollector,
  snapshotMemoryUsage,
} from "../src/metrics";

// Define our security hook handler
const securityHook = (context: ReturnType<typeof createHookContext>) => {
  // Only check PreToolUse events for Bash
  if (context.event !== "PreToolUse" || context.toolName !== "Bash") {
    return HookResults.success("Not applicable to this tool/event");
  }

  const command = (context.toolInput as { command?: string } | undefined)
    ?.command;
  if (!command || typeof command !== "string") {
    return HookResults.success("No command to validate");
  }

  // Define dangerous command patterns
  const dangerousPatterns = [
    // rm -rf / (root only, anchored to end or command separators)
    /\b(?:sudo\s+)?rm\s+-[^\S\r\n]*r[^\S\r\n]*f[^\S\r\n]*\s*\/\s*(?:$|[#;]|&&|\|\|)/i,
    // rm -rf /* (wildcard at root)
    /\b(?:sudo\s+)?rm\s+-[^\n]*\s+\/\*/i,
    // Explicit override of safety guard
    /\brm\b[^\n]*\s--no-preserve-root\b/i,
    // Pipe-to-shell installers
    /\b(?:curl|wget)\b[^\n]*\|\s*(?:sh|bash)\b/i,
    // Fork bomb
    /:\(\)\s*\{\s*:\|:&\}\s*;:/,
    // Potential device flooding
    /\bdd\s+if=\/dev\/(zero|random)\b/i,
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return HookResults.block(
        `Security violation: Command blocked due to dangerous pattern - ${pattern.source}`
      );
    }
  }

  // Additional checks for suspicious combinations
  if (command.includes("sudo") && command.includes("rm")) {
    return HookResults.block(
      "Security violation: sudo rm commands are not allowed"
    );
  }
  return HookResults.success(
    `Command "${command.slice(0, 50)}${command.length > 50 ? "..." : ""}" approved by security hook`
  );
};

// Example usage function for testing
export async function runSecurityExample() {
  const testCases: Array<{
    name: string;
    input: {
      sessionId: string;
      toolName: string;
      toolInput: Record<string, unknown>;
    };
  }> = [
    {
      name: "Safe command",
      input: {
        sessionId: "example-1",
        toolName: "Bash",
        toolInput: { command: "ls -la" },
      },
    },
    {
      name: "Dangerous rm -rf command",
      input: {
        sessionId: "example-2",
        toolName: "Bash",
        toolInput: { command: "rm -rf /" },
      },
    },
    {
      name: "Suspicious sudo rm command",
      input: {
        sessionId: "example-3",
        toolName: "Bash",
        toolInput: { command: "sudo rm -f /important-file" },
      },
    },
    {
      name: "Non-Bash tool (should pass through)",
      input: {
        sessionId: "example-4",
        toolName: "Write",
        toolInput: { file_path: "/tmp/test.txt", content: "Hello" },
      },
    },
  ];

  const collector = new MetricsCollector();

  for (const testCase of testCases) {
    const timer = new ExecutionTimer();
    const memoryBefore = snapshotMemoryUsage();

    const hookInput: PreToolUseHookInput = {
      hook_event_name: "PreToolUse",
      session_id: testCase.input.sessionId,
      transcript_path: "/tmp/transcript.md",
      cwd: "/tmp",
      tool_name: testCase.input.toolName,
      tool_input: testCase.input.toolInput,
    };

    const context = createHookContext(hookInput, undefined, {
      environment: { CLAUDE_PROJECT_DIR: "/tmp" },
    });

    try {
      const result = await securityHook(context);

      const memoryAfter = snapshotMemoryUsage();

      // Collect metrics
      collector.record(
        context,
        result,
        timer.getTiming(),
        memoryBefore,
        memoryAfter,
        { testCase: testCase.name }
      );
      // Additional event recording could be implemented here if needed
    } catch (_error) {
      // Error in test execution - expected for some test cases
    }
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  runSecurityExample().catch((error) => {
    process.stderr.write(`Error running security example: ${error}\n`);
    process.exit(1);
  });
}
