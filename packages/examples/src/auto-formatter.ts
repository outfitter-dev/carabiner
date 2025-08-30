#!/usr/bin/env bun

/**
 * Claude Code Hook: Auto Formatter
 * =================================
 *
 * Automatically formats code files after they are edited or created.
 * Supports multiple formatters and languages.
 *
 * Features:
 * - Auto-detects appropriate formatter based on file extension
 * - Supports: Prettier, Biome, Black, Ruff, gofmt, rustfmt, and more
 * - Configurable formatter preferences
 * - Respects project configuration files
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { HookExecutor } from '@carabiner/execution';
import { StdinProtocol } from '@carabiner/protocol';
import type { HookHandler, HookResult } from '@carabiner/types';

// Formatter configurations by file extension
const FORMATTERS: Record<
  string,
  Array<{
    command: string;
    args: (file: string) => string[];
    checkCommand: string;
  }>
> = {
  // JavaScript/TypeScript
  '.js': [
    {
      command: 'biome',
      args: (f) => ['check', '--write', f],
      checkCommand: 'biome --version',
    },
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
    {
      command: 'eslint',
      args: (f) => ['--fix', f],
      checkCommand: 'eslint --version',
    },
  ],
  '.jsx': [
    {
      command: 'biome',
      args: (f) => ['check', '--write', f],
      checkCommand: 'biome --version',
    },
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],
  '.ts': [
    {
      command: 'biome',
      args: (f) => ['check', '--write', f],
      checkCommand: 'biome --version',
    },
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
    {
      command: 'eslint',
      args: (f) => ['--fix', f],
      checkCommand: 'eslint --version',
    },
  ],
  '.tsx': [
    {
      command: 'biome',
      args: (f) => ['check', '--write', f],
      checkCommand: 'biome --version',
    },
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],

  // Python
  '.py': [
    {
      command: 'ruff',
      args: (f) => ['format', f],
      checkCommand: 'ruff --version',
    },
    { command: 'black', args: (f) => [f], checkCommand: 'black --version' },
    {
      command: 'autopep8',
      args: (f) => ['--in-place', f],
      checkCommand: 'autopep8 --version',
    },
  ],

  // Rust
  '.rs': [
    { command: 'rustfmt', args: (f) => [f], checkCommand: 'rustfmt --version' },
  ],

  // Go
  '.go': [
    { command: 'gofmt', args: (f) => ['-w', f], checkCommand: 'gofmt -?' },
    {
      command: 'goimports',
      args: (f) => ['-w', f],
      checkCommand: 'goimports -?',
    },
  ],

  // JSON
  '.json': [
    {
      command: 'biome',
      args: (f) => ['check', '--write', f],
      checkCommand: 'biome --version',
    },
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],

  // Markdown
  '.md': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
    {
      command: 'markdownlint-cli2',
      args: (f) => ['--fix', f],
      checkCommand: 'markdownlint-cli2 --version',
    },
  ],

  // CSS/SCSS
  '.css': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
    {
      command: 'stylelint',
      args: (f) => ['--fix', f],
      checkCommand: 'stylelint --version',
    },
  ],
  '.scss': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
    {
      command: 'stylelint',
      args: (f) => ['--fix', f],
      checkCommand: 'stylelint --version',
    },
  ],

  // HTML
  '.html': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],

  // YAML
  '.yml': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],
  '.yaml': [
    {
      command: 'prettier',
      args: (f) => ['--write', f],
      checkCommand: 'prettier --version',
    },
  ],
};

/**
 * Checks if a formatter is available
 */
function isFormatterAvailable(checkCommand: string): boolean {
  try {
    const [command, ...args] = checkCommand.split(' ');
    execFileSync(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the best available formatter for a file
 */
function findFormatter(filePath: string): {
  command: string;
  args: string[];
} | null {
  const ext = extname(filePath).toLowerCase();
  const formatters = FORMATTERS[ext];

  if (!formatters) {
    return null;
  }

  // Try each formatter in order of preference
  for (const formatter of formatters) {
    if (isFormatterAvailable(formatter.checkCommand)) {
      return {
        command: formatter.command,
        args: formatter.args(filePath),
      };
    }
  }

  return null;
}

/**
 * Formats a file using the appropriate formatter
 */
function formatFile(filePath: string): { success: boolean; message: string } {
  // Skip if file doesn't exist (might be deleted)
  if (!existsSync(filePath)) {
    return { success: true, message: 'File does not exist, skipping' };
  }

  const formatter = findFormatter(filePath);
  if (!formatter) {
    return {
      success: true,
      message: 'No formatter available for this file type',
    };
  }

  try {
    // Run formatter
    const cwd = dirname(filePath);
    execFileSync(formatter.command, formatter.args, {
      cwd,
      stdio: 'pipe',
    });

    return {
      success: true,
      message: `Formatted with ${formatter.command}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Formatting failed: ${error}`,
    };
  }
}

/**
 * Main auto-formatter hook
 */
const autoFormatterHook: HookHandler = (context): HookResult => {
  const { toolName, toolInput } = context;
  
  // Only process file modification tools
  const fileTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
  if (!toolName || !fileTools.includes(toolName)) {
    return {
      success: true,
    };
  }

  // Extract file path based on tool
  let filePath: string | undefined;

  switch (toolName) {
    case 'Edit':
    case 'Write':
      filePath = toolInput?.file_path as string;
      break;
    case 'MultiEdit':
      filePath = toolInput?.file_path as string;
      break;
    case 'NotebookEdit':
      filePath = toolInput?.notebook_path as string;
      break;
    default:
      // Other tools don't have file paths
      break;
  }

  if (!filePath) {
    return {
      success: true,
    };
  }

  // This is a PostToolUse hook, so the file has already been modified
  // Now we format it
  const result = formatFile(filePath);

  if (result.success) {
    if (
      result.message !== 'File does not exist, skipping' &&
      result.message !== 'No formatter available for this file type'
    ) {
      // Log successful formatting if needed
    }
  } else {
    // Handle formatting failures if needed
  }

  return {
    success: true,
  };
};

// Main execution
async function main() {
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);

  await executor.execute(autoFormatterHook);
}

// Run if executed directly
if (import.meta.main) {
  main().catch((_error) => {
    process.exit(1);
  });
}

export {
  autoFormatterHook,
  formatFile,
  findFormatter,
  isFormatterAvailable,
  FORMATTERS,
};
