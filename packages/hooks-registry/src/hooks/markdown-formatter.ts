/**
 * @carabiner/hooks-registry - Markdown Formatter Hook
 *
 * Automatically formats markdown files when they are edited using either
 * markdownlint-cli2 or prettier, depending on what's available.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HookHandler } from '@carabiner/types';
import { isMatch } from 'picomatch';

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
 * Check if a command exists in the system (cross-platform)
 */
function commandExists(command: string): boolean {
  // Simple memo cache
  const key = `cmd:${process.cwd()}:${process.platform}:${command}`;
  (globalThis as any).__carabinerCmdCache ??= new Map<string, boolean>();
  const cache: Map<string, boolean> = (globalThis as any).__carabinerCmdCache;
  if (cache.has(key)) return cache.get(key)!;

  try {
    // 1) local node_modules/.bin
    const ext = process.platform === 'win32' ? '.cmd' : '';
    const localBin = join(process.cwd(), 'node_modules', '.bin', `${command}${ext}`);
    if (existsSync(localBin)) {
      cache.set(key, true);
      return true;
    }

    const isWindows = process.platform === 'win32';
    const detector = isWindows ? 'where' : 'command';
    const args = isWindows ? [command] : ['-v', command];
    execFileSync(detector, args, { stdio: 'ignore' });
    cache.set(key, true);
    return true;
  } catch {
    // Try common package runner fallbacks for locally installed CLIs
    try {
      execFileSync('npx', ['--no-install', command, '--version'], {
        stdio: 'ignore',
      });
      cache.set(key, true);
      return true;
    } catch {
      try {
        execFileSync('pnpm', ['dlx', command, '--version'], { stdio: 'ignore' });
        cache.set(key, true);
        return true;
      } catch {
        try {
          execFileSync('bunx', [command, '--version'], { stdio: 'ignore' });
          cache.set(key, true);
          return true;
        } catch {
          cache.set(key, false);
          return false;
        }
      }
    }
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
    const args = [...(autoFix ? ['--fix'] : []), ...additionalArgs, filePath];

    const output = execFileSync('markdownlint-cli2', args, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      success: true,
      output:
        output || 'Markdown file formatted successfully with markdownlint',
    };
  } catch (error) {
    const err = error as Record<string, unknown>;
    const errorOutput = err.message || 'Unknown error';
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    return {
      success: false,
      output: `Failed to format with markdownlint: ${errorOutput}${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
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
      ...(autoFix ? ['--write'] : ['--check']),
      ...additionalArgs,
      filePath,
    ];

    const output = execFileSync('prettier', args, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      success: true,
      output: output || 'Markdown file formatted successfully with prettier',
    };
  } catch (error) {
    const err = error as Record<string, unknown>;
    const errorOutput = err.message || 'Unknown error';
    const stderr = err.stderr || '';
    const stdout = err.stdout || '';
    return {
      success: false,
      output: `Failed to format with prettier: ${errorOutput}${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
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
    patterns = ['*.md', '*.mdx'],
  } = config;

  return (context) => {
    // Only process PostToolUse events for file editing tools
    if (context.event !== 'PostToolUse') {
      return { success: true };
    }

    // Check if this is a file editing tool
    const fileEditingTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
    if (
      !('toolName' in context && fileEditingTools.includes(context.toolName))
    ) {
      return { success: true };
    }

    // Extract file path(s) from tool input - handle both single and multi-file tools
    const toolInput = context.toolInput as Record<string, unknown>;
    const singlePath = toolInput.file_path || toolInput.path;
    const multiplePaths =
      toolInput.files || toolInput.paths || toolInput.file_paths;

    const filePaths: string[] = Array.isArray(multiplePaths)
      ? multiplePaths.filter((p: unknown): p is string => typeof p === 'string')
      : typeof singlePath === 'string'
        ? [singlePath]
        : [];

    if (filePaths.length === 0) {
      return { success: true };
    }

    // Process all matching files
    const results: Array<{
      success: boolean;
      message: string;
      filePath: string;
      formatter?: string;
    }> = [];
    for (const filePath of filePaths) {
      // Check if the file matches our patterns using proper glob matching
      const isMarkdownFile = patterns.some((pattern) =>
        isMatch(filePath, pattern, { nocase: true })
      );

      if (!isMarkdownFile) {
        continue;
      }

      // Check if file exists (it should after an edit)
      if (!existsSync(filePath)) {
        results.push({
          success: false,
          message: `File not found: ${filePath}`,
          filePath,
        });
        continue;
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
      } else if (
        formatter === 'markdownlint' &&
        commandExists('markdownlint-cli2')
      ) {
        selectedFormatter = 'markdownlint';
      } else if (formatter === 'prettier' && commandExists('prettier')) {
        selectedFormatter = 'prettier';
      }

      if (!selectedFormatter) {
        results.push({
          success: false,
          message:
            'No markdown formatter available. Install markdownlint-cli2 or prettier.',
          filePath,
        });
        continue;
      }

      // Format the file
      const result =
        selectedFormatter === 'markdownlint'
          ? formatWithMarkdownlint(filePath, autoFix, additionalArgs)
          : formatWithPrettier(filePath, autoFix, additionalArgs);

      results.push({
        success: result.success,
        message: result.output,
        filePath,
        formatter: selectedFormatter,
      });
    }

    // Return aggregated results
    if (results.length === 0) {
      return { success: true };
    }

    const allSuccess = results.every((r) => r.success);
    const messages = results
      .map((r) => `${r.filePath}: ${r.message}`)
      .join('\n');

    return {
      success: allSuccess,
      message: messages,
      metadata: {
        timestamp: new Date().toISOString(),
      },
      data: {
        formatter: results[0]?.formatter,
        filesProcessed: results.length,
        autoFix,
        results,
      },
    };
  };
}

/**
 * Default markdown formatter hook instance
 */
export const markdownFormatterHook = createMarkdownFormatterHook();
