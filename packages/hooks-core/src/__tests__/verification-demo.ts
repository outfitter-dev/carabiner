/**
 * Verification demo showing that the tool scoping fix works
 * This demonstrates the before/after behavior of the architecture fix
 */

import { createHook, HookBuilder, HookRegistry } from "../index.ts";

// Mock context helper
function createMockContext(event: "PreToolUse", toolName: string) {
	return {
		event,
		toolName,
		sessionId: "demo-session",
		transcriptPath: "/demo/transcript",
		cwd: process.cwd(),
		toolInput: { command: "echo demo" },
		environment: {},
		rawInput: {
			session_id: "demo-session",
			transcript_path: "/demo/transcript",
			cwd: process.cwd(),
			hook_event_name: event,
			tool_name: toolName,
			tool_input: { command: "echo demo" },
		},
	} as Record<string, unknown>;
}

async function demonstrateToolScopingFix() {
	const registry = new HookRegistry();

	// 1. Universal hook (runs for all tools)
	const universalHook = HookBuilder.forPreToolUse()
		.withHandler(async (_context) => {
			return { success: true };
		})
		.build();

	// 2. Bash-specific hook (runs only for Bash)
	const bashHook = HookBuilder.forPreToolUse()
		.forTool("Bash")
		.withHandler(async (_context) => {
			return { success: true };
		})
		.build();

	// 3. Write-specific hook using function API
	const writeHook = createHook.preToolUse("Write", async (_context) => {
		return { success: true };
	});

	registry.register(universalHook);
	registry.register(bashHook);
	registry.register(writeHook);
	await registry.execute(createMockContext("PreToolUse", "Bash"));
	await registry.execute(createMockContext("PreToolUse", "Write"));
	await registry.execute(createMockContext("PreToolUse", "Edit"));
	const _bashHooks = registry.getHooks("PreToolUse", "Bash");
	const _writeHooks = registry.getHooks("PreToolUse", "Write");
	const _editHooks = registry.getHooks("PreToolUse", "Edit");
}

// Only run demo if this file is executed directly
if (import.meta.main) {
	demonstrateToolScopingFix().catch(console.error);
}
