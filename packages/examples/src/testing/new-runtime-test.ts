#!/usr/bin/env bun

/**
 * Test for the new stdin-based Claude Code hooks runtime
 * Demonstrates how the new system works with actual Claude input format
 */

import type {
  ClaudeToolHookInput,
  HookContext,
  HookResult,
} from '@claude-code/hooks-core';
import {
  createHookContext,
  HookResults,
  runClaudeHook,
} from '@claude-code/hooks-core';

function hasCommand(input: unknown): input is { command: string } {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as Record<string, unknown>).command === 'string'
  );
}

/**
 * Example hook handler that works with the new runtime
 */
function exampleHook(context: HookContext): HookResult {
  // Example: access matcher info if provided
  // if (context.matcher) { /* ... */ }

  // Access tool input with full type safety
  if (context.event === 'PostToolUse' && context.toolResponse) {
    // Example: inspect toolResponse here
    void 0; // No-op: intentionally empty for demonstration
  }

  if (context.event === 'UserPromptSubmit' && context.userPrompt) {
    void 0; // No-op: intentionally empty for demonstration
  }

  const timestamp = new Date().toISOString();
  return {
    ...HookResults.success(`${context.event} hook completed successfully`, {
      processedAt: timestamp,
    }),
    metadata: {
      hookVersion: '0.2.0',
      timestamp,
    },
  };
}

/**
 * Test function that simulates Claude Code input
 */
export async function testNewRuntime(): Promise<void> {
  // Example 1: PreToolUse hook input
  const preToolUseInput: ClaudeToolHookInput = {
    session_id: 'test-session-123',
    transcript_path: '/tmp/claude-transcript.md',
    cwd: '/Users/developer/project',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: {
      command: 'echo "Hello from Claude Code!"',
      description: 'Test command',
      timeout: 5000,
    },
    matcher: 'bash-command',
  };

  // Create context from Claude input
  const context = createHookContext(preToolUseInput);

  // Execute hook
  const result = exampleHook(context);
  process.stdout.write(`[exampleHook] ${JSON.stringify(result, null, 2)}\n`);
}

/**
 * Example of using runClaudeHook for actual hook scripts
 */
function exampleHookScript(context: HookContext): HookResult {
  // This is what goes in actual hook scripts
  if (
    context.event === 'PreToolUse' &&
    context.toolName === 'Bash' &&
    hasCommand(context.toolInput) &&
    context.toolInput.command.includes('rm -rf')
  ) {
    return HookResults.block('Dangerous command blocked for safety');
  }

  return HookResults.success('Hook validation passed');
}

// Main execution
if (import.meta.main) {
  // For testing, run our test function
  if (process.argv.includes('--test')) {
    testNewRuntime().catch((error) => {
      process.stderr.write(`Error: ${error}\n`);
      process.exit(1);
    });
  } else {
    // For actual hook execution, use the new runtime
    runClaudeHook(exampleHookScript, {
      outputMode: 'exit-code',
      logLevel: 'info',
      timeout: 30_000,
    });
  }
}
