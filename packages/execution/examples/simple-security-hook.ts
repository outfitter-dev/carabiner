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

import type { HookHandler } from '@outfitter/types';

interface BashToolInput {
  readonly command: string;
  readonly description?: string;
  readonly timeout?: number;
}

interface BashContext {
  readonly event: string;
  readonly toolName: string;
  readonly toolInput: BashToolInput;
  readonly sessionId: string;
  readonly cwd: string;
  readonly environment: Record<string, string>;
}

interface NonBashContext {
  readonly event: string;
  readonly toolName: string;
  readonly toolInput: Record<string, unknown>;
  readonly sessionId: string;
  readonly cwd: string;
  readonly environment: Record<string, string>;
}

type TestContext = BashContext | NonBashContext;

// We would normally use:
// import { runHook } from '@outfitter/execution';
// But for this example, we'll simulate the execution

import {
  ExecutionTimer,
  MemoryTracker,
  MetricsCollector,
} from '../src/metrics';

// Define our security hook handler
const securityHook: HookHandler = async (context) => {
  console.log(
    `🔒 Security Hook: Checking ${context.event} for ${context.toolName}`
  );

  // Only check PreToolUse events for Bash
  if (context.event !== 'PreToolUse' || context.toolName !== 'Bash') {
    return { success: true, message: 'Not applicable to this tool/event' };
  }

  // Type guard to ensure context has the expected structure
  if (!('toolInput' in context && context.toolInput)) {
    return { success: true, message: 'No tool input to validate' };
  }

  const bashContext = context as BashContext;
  const command = bashContext.toolInput.command;
  if (!command || typeof command !== 'string') {
    return { success: true, message: 'No command to validate' };
  }

  // Define dangerous command patterns
  const dangerousPatterns = [
    /rm\s+-rf\s*\/[^/\w]*/, // rm -rf / (but allow specific dirs)
    /sudo\s+rm/, // sudo rm commands
    />\s*\/dev\/null\s*2>&1/, // Output redirection to null
    /curl.*\|\s*sh/, // Curl pipe to shell
    /wget.*\|\s*sh/, // Wget pipe to shell
    /:\(\)\s*\{\s*:\|:&\}\s*;:/, // Fork bomb
    /dd\s+if=\/dev\/(zero|random)/, // Disk flooding
  ];

  // Check for dangerous patterns
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      console.log(`🚫 BLOCKED: Command matches dangerous pattern: ${pattern}`);
      return {
        success: false,
        block: true,
        message: `Security violation: Command blocked due to dangerous pattern - ${pattern.source}`,
      };
    }
  }

  // Additional checks for suspicious combinations
  if (command.includes('sudo') && command.includes('rm')) {
    console.log('🚫 BLOCKED: Sudo + rm combination detected');
    return {
      success: false,
      block: true,
      message: 'Security violation: sudo rm commands are not allowed',
    };
  }

  console.log('✅ ALLOWED: Command passed security checks');
  return {
    success: true,
    message: `Command "${command.slice(0, 50)}${command.length > 50 ? '...' : ''}" approved by security hook`,
  };
};

// Example usage function for testing
export async function runSecurityExample() {
  console.log('🚀 Security Hook Example\n');

  const testCases: Array<{ name: string; context: TestContext }> = [
    {
      name: 'Safe command',
      context: {
        event: 'PreToolUse' as const,
        toolName: 'Bash',
        sessionId: 'example-1',
        cwd: '/tmp',
        environment: {},
        toolInput: { command: 'ls -la' },
      },
    },
    {
      name: 'Dangerous rm -rf command',
      context: {
        event: 'PreToolUse' as const,
        toolName: 'Bash',
        sessionId: 'example-2',
        cwd: '/tmp',
        environment: {},
        toolInput: { command: 'rm -rf /' },
      },
    },
    {
      name: 'Suspicious sudo rm command',
      context: {
        event: 'PreToolUse' as const,
        toolName: 'Bash',
        sessionId: 'example-3',
        cwd: '/tmp',
        environment: {},
        toolInput: { command: 'sudo rm -f /important-file' },
      },
    },
    {
      name: 'Non-Bash tool (should pass through)',
      context: {
        event: 'PreToolUse' as const,
        toolName: 'Write',
        sessionId: 'example-4',
        cwd: '/tmp',
        environment: {},
        toolInput: { file_path: '/tmp/test.txt', content: 'Hello' },
      },
    },
  ];

  const collector = new MetricsCollector();

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Command: ${JSON.stringify(testCase.context.toolInput)}`);

    const timer = new ExecutionTimer();
    const memoryBefore = MemoryTracker.snapshot();

    try {
      const result = await securityHook(testCase.context);

      const memoryAfter = MemoryTracker.snapshot();

      // Collect metrics
      collector.record(
        testCase.context,
        result,
        timer.getTiming(),
        memoryBefore,
        memoryAfter,
        { testCase: testCase.name }
      );

      console.log(`   Result: ${result.success ? '✅ SUCCESS' : '🚫 BLOCKED'}`);
      console.log(`   Message: ${result.message}`);
      if (result.block) {
        console.log('   🛑 Execution would be blocked');
      }
    } catch (error) {
      console.log(
        `   💥 ERROR: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Show aggregate metrics
  console.log('\n📊 Execution Metrics:');
  const stats = collector.getAggregateMetrics();
  console.log(`   Total executions: ${stats.totalExecutions}`);
  console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
  console.log(`   Average duration: ${stats.averageDuration.toFixed(2)}ms`);
  console.log(`   Blocked commands: ${stats.failedExecutions}`);

  if (stats.topErrors.length > 0) {
    console.log('   Top errors:');
    for (const error of stats.topErrors) {
      console.log(`     - ${error.code}: ${error.count} times`);
    }
  }
}

// Run the example if this file is executed directly
if (import.meta.main) {
  runSecurityExample().catch(console.error);
}
