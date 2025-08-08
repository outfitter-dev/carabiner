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

/**
 * Example hook handler that works with the new runtime
 */
async function exampleHook(context: HookContext): Promise<HookResult> {
  if (context.matcher) {
  }

  // Access tool input with full type safety
  if (
    (context.event === 'PreToolUse' || context.event === 'PostToolUse') &&
    context.event === 'PostToolUse' &&
    context.toolResponse
  ) {
  }

  if (context.event === 'UserPromptSubmit' && context.userPrompt) {
  }

  return HookResults.success(`${context.event} hook completed successfully`, {
    processedAt: new Date().toISOString(),
    hookVersion: '0.2.0',
  });
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
  const _result = await exampleHook(context);
}

/**
 * Example of using runClaudeHook for actual hook scripts
 */
async function exampleHookScript(context: HookContext): Promise<HookResult> {
  // This is what goes in actual hook scripts
  if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
    const toolInput = context.toolInput as any;
    if (toolInput.command?.includes('rm -rf')) {
      return HookResults.block('Dangerous command blocked for safety');
    }
  }

  return HookResults.success('Hook validation passed');
}

// Main execution
if (import.meta.main) {
  // For testing, run our test function
  if (process.argv.includes('--test')) {
    testNewRuntime().catch(console.error);
  } else {
    // For actual hook execution, use the new runtime
    runClaudeHook(exampleHookScript, {
      outputMode: 'exit-code',
      logLevel: 'info',
      timeout: 30_000,
    });
  }
}
