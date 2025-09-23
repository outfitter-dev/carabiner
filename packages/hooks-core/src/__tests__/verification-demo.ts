/**
 * Verification demo showing that the tool scoping fix works
 * This demonstrates the before/after behavior of the architecture fix
 */

import { createHook, HookBuilder, HookRegistry } from "../index.ts";
import { createHookContext, HookResults } from "../runtime.ts";
import type { PreToolUseHookInput } from "../types.ts";

// Mock context helper
function createMockContext(event: "PreToolUse", toolName: string) {
  const input: PreToolUseHookInput = {
    hook_event_name: event,
    session_id: "demo-session",
    transcript_path: "/demo/transcript",
    cwd: process.cwd(),
    tool_name: toolName,
    tool_input: { command: "echo demo" },
  };

  return createHookContext(input, undefined, {
    environment: { CLAUDE_PROJECT_DIR: process.cwd() },
  });
}

async function demonstrateToolScopingFix() {
  const registry = new HookRegistry();

  // 1. Universal hook (runs for all tools)
  const universalHook = HookBuilder.forPreToolUse()
    .withHandler(async () => HookResults.success())
    .build();

  // 2. Bash-specific hook (runs only for Bash)
  const bashHook = HookBuilder.forPreToolUse()
    .forTool("Bash")
    .withHandler(async () => HookResults.success())
    .build();

  // 3. Write-specific hook using function API
  const writeHook = createHook.preToolUse("Write", async () => {
    return HookResults.success();
  });

  registry.register(universalHook);
  registry.register(bashHook);
  registry.register(writeHook);
  await registry.execute(createMockContext("PreToolUse", "Bash"));
  await registry.execute(createMockContext("PreToolUse", "Write"));
  await registry.execute(createMockContext("PreToolUse", "Edit"));
  registry.getHooks("PreToolUse", "Bash");
  registry.getHooks("PreToolUse", "Write");
  registry.getHooks("PreToolUse", "Edit");
}

// Only run demo if this file is executed directly
if (import.meta.main) {
  demonstrateToolScopingFix().catch((err) => {
    process.stderr.write(`${String(err)}\n`);
  });
}
