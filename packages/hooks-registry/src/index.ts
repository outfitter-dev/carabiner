/**
 * @outfitter/hooks-registry - Official Claude Code Hooks Registry
 * 
 * A collection of production-ready hooks for common development workflows.
 */

export {
  createMarkdownFormatterHook,
  markdownFormatterHook,
  type MarkdownFormatterConfig
} from './hooks/markdown-formatter.js';

// Re-export hook types for convenience
export type { HookHandler, HookResult, HookContext } from '@outfitter/types';