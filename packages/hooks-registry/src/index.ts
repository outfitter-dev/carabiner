/**
 * @carabiner/hooks-registry - Official Claude Code Hooks Registry
 *
 * A collection of production-ready hooks for common development workflows.
 */

// Re-export hook types for convenience
export type { HookContext, HookHandler, HookResult } from "@carabiner/types";
export {
	createMarkdownFormatterHook,
	type MarkdownFormatterConfig,
	markdownFormatterHook,
} from "./hooks/markdown-formatter.js";
