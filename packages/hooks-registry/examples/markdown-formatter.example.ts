#!/usr/bin/env bun
/**
 * Example: Using the Markdown Formatter Hook
 * 
 * This example demonstrates how to use the markdown formatter hook
 * in a Claude Code hooks configuration.
 */

import { HookExecutor } from '@outfitter/executor';
import { StdinProtocol } from '@outfitter/protocol';
import { createMarkdownFormatterHook } from '@outfitter/hooks-registry';

// Example 1: Basic usage with auto-detection
const basicHook = createMarkdownFormatterHook();

// Example 2: Prefer markdownlint with custom config
const markdownlintHook = createMarkdownFormatterHook({
  formatter: 'markdownlint',
  additionalArgs: ['--config', '.markdownlint.json'],
  autoFix: true
});

// Example 3: Use prettier with specific options
const prettierHook = createMarkdownFormatterHook({
  formatter: 'prettier',
  additionalArgs: ['--prose-wrap', 'always', '--print-width', '80'],
  autoFix: true
});

// Example 4: Check-only mode (no auto-fix)
const checkOnlyHook = createMarkdownFormatterHook({
  formatter: 'auto',
  autoFix: false
});

// Example 5: Custom file patterns
const customPatternsHook = createMarkdownFormatterHook({
  patterns: ['*.md', '*.mdx', '*.markdown', 'README*'],
  formatter: 'auto',
  autoFix: true
});

// Example usage in a hooks configuration file (.claude/hooks/PostToolUse.js)
async function main() {
  // Create protocol and executor
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);

  // Use the markdown formatter hook
  await executor.execute(createMarkdownFormatterHook({
    formatter: 'auto',      // Auto-detect formatter
    autoFix: true,         // Fix issues automatically
    patterns: ['*.md'],    // Only process .md files
    additionalArgs: []     // No additional arguments
  }));
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

// Export for use in other configurations
export {
  basicHook,
  markdownlintHook,
  prettierHook,
  checkOnlyHook,
  customPatternsHook
};