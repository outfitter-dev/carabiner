/* eslint-disable no-console */
/**
 * Hello World Example
 *
 * The simplest possible Carabiner hook to get you started.
 * This hook runs before any tool execution and logs a friendly message.
 */

import { createHook, HookResults } from "@carabiner/hooks-core";
import type { HookContext } from "@carabiner/types";

// Create a simple hook that greets the user
export const helloWorldHook = createHook.preToolUse(
  async (context: HookContext) => {
    const time = new Date().toLocaleTimeString();

    console.log("┌─────────────────────────────────────┐");
    console.log("│  🎉 Hello from Carabiner!           │");
    console.log("├─────────────────────────────────────┤");
    console.log(`│  Time: ${time.padEnd(28)}│`);
    console.log(`│  Tool: ${context.tool.padEnd(28)}│`);
    console.log("└─────────────────────────────────────┘");

    // Return success to allow the tool to proceed
    return HookResults.success("Hello World hook executed successfully!");
  }
);

// Alternative: Tool-specific version (only for Bash commands)
export const bashGreeterHook = createHook.preToolUse(
  "Bash",
  async (context) => {
    const command = context.parameters.command;
    console.log(`📟 Bash command intercepted: ${command}`);

    // Add a fun fact about the command
    if (command.includes("echo")) {
      console.log(
        "💡 Fun fact: The echo command was first introduced in Unix Version 7!"
      );
    }

    return HookResults.success();
  }
);

// Export both hooks
export default {
  helloWorldHook,
  bashGreeterHook,
};
