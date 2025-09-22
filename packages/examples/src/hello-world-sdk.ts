/**
 * Hello World Example - SDK Version
 *
 * This example shows how to create hooks using the Claude Code SDK types directly.
 * It demonstrates the full type safety and compatibility provided by the SDK integration.
 */

import type {
  BashInput,
  HookCallback,
  HookJSONOutput,
  PreToolUseHookInput,
} from "@carabiner/hooks-core";

/**
 * Simple hook that runs before any tool execution
 * Uses the SDK's HookCallback signature directly
 */
export const helloWorldHook: HookCallback = async (
  input,
  _toolUseID,
  _options
) => {
  // Type-safe check for PreToolUse event
  if (input.hook_event_name === "PreToolUse") {
    // Could process tool input here if needed
  }

  // Return SDK-compliant output
  return {
    continue: true,
    systemMessage: "Hello World hook executed successfully!",
  };
};

/**
 * Tool-specific hook for Bash commands
 * Demonstrates type-safe tool input handling
 */
export const bashGreeterHook: HookCallback = async (
  input,
  _toolUseID,
  _options
) => {
  // Only process PreToolUse events for Bash
  if (input.hook_event_name === "PreToolUse") {
    const toolInput = input as PreToolUseHookInput;

    if (toolInput.tool_name === "Bash") {
      const bashInput = toolInput.tool_input as BashInput;
      const command = bashInput.command;

      // Add a fun fact about the command
      if (command.includes("echo")) {
      }

      // Demonstrate conditional blocking
      if (command.includes("rm -rf /")) {
        return {
          continue: false,
          systemMessage: "⚠️ Dangerous command blocked by Hello World hook",
        };
      }
    }
  }

  return { continue: true };
};

/**
 * Advanced hook with async behavior
 * Shows how to use the asyncTimeout feature
 */
export const asyncGreeterHook: HookCallback = async (
  input,
  _toolUseID,
  options
) => {
  // Check if we should abort based on signal
  if (options.signal.aborted) {
    return { continue: false, systemMessage: "Hook aborted" };
  }

  // Return async indicator for long-running operations
  if (input.hook_event_name === "SessionStart") {
    // Simulate async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      async: true,
      asyncTimeout: 5000, // 5 second timeout for async operations
    };
  }

  return { continue: true };
};

/**
 * Hook that demonstrates all SDK output options
 */
export const advancedHook: HookCallback = async (
  input,
  _toolUseID,
  _options
) => {
  const output: HookJSONOutput = {
    // Control flow
    continue: true,

    // Optional: suppress tool output
    suppressOutput: false,

    // Optional: provide system message
    systemMessage: "Processing with advanced hook",

    // Optional: stop reason if stopping
    stopReason: undefined,

    // Hook-specific output based on event type
    hookSpecificOutput: undefined,
  };

  // Add hook-specific output for PreToolUse
  if (input.hook_event_name === "PreToolUse") {
    output.hookSpecificOutput = {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Tool usage allowed by advanced hook",
    };
  }

  // Add additional context for UserPromptSubmit
  if (input.hook_event_name === "UserPromptSubmit") {
    const promptInput = input as any; // Type assertion for brevity
    output.hookSpecificOutput = {
      hookEventName: "UserPromptSubmit",
      additionalContext: `Processing prompt: "${promptInput.prompt?.slice(0, 50)}..."`,
    };
  }

  return output;
};

// Export all hooks
export default {
  helloWorldHook,
  bashGreeterHook,
  asyncGreeterHook,
  advancedHook,
};
