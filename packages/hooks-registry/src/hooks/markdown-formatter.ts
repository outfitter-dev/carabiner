/**
 * @outfitter/hooks-registry - Markdown Formatter Hook
 * 
 * Automatically formats markdown files when they are edited using either
 * markdownlint-cli2 or prettier, depending on what's available.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { HookHandler, HookResult } from '@outfitter/types';

/**
 * Configuration for the markdown formatter hook
 */
export type MarkdownFormatterConfig = {
  /**
   * Preferred formatter to use ('markdownlint' | 'prettier' | 'auto')
   * @default 'auto'
   */
  formatter?: 'markdownlint' | 'prettier' | 'auto';
  
  /**
   * Additional arguments to pass to the formatter
   */
  additionalArgs?: string[];
  
  /**
   * Whether to fix issues automatically
   * @default true
   */
  autoFix?: boolean;
  
  /**
   * File patterns to include (glob patterns)
   * @default ['*.md', '*.mdx']
   */
  patterns?: string[];
};

/**
 * Check if a command exists in the system
 */
function commandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Format markdown files using markdownlint-cli2
 */
function formatWithMarkdownlint(
  filePath: string,
  autoFix: boolean,
  additionalArgs: string[] = []
): { success: boolean; output: string } {
  try {
    const args = [
      autoFix ? '--fix' : '',
      ...additionalArgs,
      `"${filePath}"`
    ].filter(Boolean).join(' ');
    
    const output = execSync(`markdownlint-cli2 ${args}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    return {
      success: true,
      output: output || 'Markdown file formatted successfully with markdownlint'
    };
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      output: `Failed to format with markdownlint: ${errorOutput}`
    };
  }
}

/**
 * Format markdown files using prettier
 */
function formatWithPrettier(
  filePath: string,
  autoFix: boolean,
  additionalArgs: string[] = []
): { success: boolean; output: string } {
  try {
    const args = [
      autoFix ? '--write' : '--check',
      ...additionalArgs,
      `"${filePath}"`
    ].filter(Boolean).join(' ');
    
    const output = execSync(`prettier ${args}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    return {
      success: true,
      output: output || 'Markdown file formatted successfully with prettier'
    };
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      output: `Failed to format with prettier: ${errorOutput}`
    };
  }
}

/**
 * Create a markdown formatter hook handler
 */
export function createMarkdownFormatterHook(
  config: MarkdownFormatterConfig = {}
): HookHandler {
  const {
    formatter = 'auto',
    additionalArgs = [],
    autoFix = true,
    patterns = ['*.md', '*.mdx']
  } = config;

  return async (context) => {
    // Only process PostToolUse events for file editing tools
    if (context.event !== 'PostToolUse') {
      return { success: true };
    }

    // Check if this is a file editing tool
    const fileEditingTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
    if (!('toolName' in context) || !fileEditingTools.includes(context.toolName)) {
      return { success: true };
    }

    // Extract file path from tool input
    const toolInput = context.toolInput as Record<string, unknown>;
    const filePath = toolInput.file_path || toolInput.path;
    
    if (typeof filePath !== 'string') {
      return { success: true };
    }

    // Check if the file matches our patterns
    const isMarkdownFile = patterns.some(pattern => {
      const regex = new RegExp(
        pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
        'i'
      );
      return regex.test(filePath);
    });

    if (!isMarkdownFile) {
      return { success: true };
    }

    // Check if file exists (it should after an edit)
    if (!existsSync(filePath)) {
      return {
        success: false,
        message: `File not found: ${filePath}`
      };
    }

    // Determine which formatter to use
    let selectedFormatter: 'markdownlint' | 'prettier' | null = null;
    
    if (formatter === 'auto') {
      // Try markdownlint first, then prettier
      if (commandExists('markdownlint-cli2')) {
        selectedFormatter = 'markdownlint';
      } else if (commandExists('prettier')) {
        selectedFormatter = 'prettier';
      }
    } else if (formatter === 'markdownlint' && commandExists('markdownlint-cli2')) {
      selectedFormatter = 'markdownlint';
    } else if (formatter === 'prettier' && commandExists('prettier')) {
      selectedFormatter = 'prettier';
    }

    if (!selectedFormatter) {
      return {
        success: false,
        message: 'No markdown formatter available. Install markdownlint-cli2 or prettier.'
      };
    }

    // Format the file
    const result = selectedFormatter === 'markdownlint'
      ? formatWithMarkdownlint(filePath, autoFix, additionalArgs)
      : formatWithPrettier(filePath, autoFix, additionalArgs);

    return {
      success: result.success,
      message: result.output,
      metadata: {
        formatter: selectedFormatter,
        filePath,
        autoFix
      }
    };
  };
}

/**
 * Default markdown formatter hook instance
 */
export const markdownFormatterHook = createMarkdownFormatterHook();