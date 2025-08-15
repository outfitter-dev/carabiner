/**
 * @file analyzers/tool-analyzer.ts
 * @description Tool-specific security analysis
 */

import { readFile } from 'node:fs/promises';

/**
 * Tool input interface for analysis
 */
export type ToolInput = {
  command?: string;
  file_path?: string;
  content?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  edits?: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;
};

/**
 * Extract content from Write tool input
 */
export function extractWriteContent(toolInput: ToolInput): string {
  return toolInput.content || '';
}

/**
 * Extract content from Edit tool input
 */
export async function extractEditContent(
  toolInput: ToolInput,
  filePath: string
): Promise<string> {
  try {
    const existingContent = await readFile(filePath, 'utf-8');

    const oldString = toolInput.old_string;
    const newString = toolInput.new_string;
    const replaceAll = toolInput.replace_all;

    if (oldString && newString !== undefined) {
      if (replaceAll) {
        return existingContent.replaceAll(oldString, newString);
      }
      return existingContent.replace(oldString, newString);
    }

    return existingContent;
  } catch {
    // File doesn't exist or can't be read
    return toolInput.content || '';
  }
}

/**
 * Extract content from MultiEdit tool input
 */
export async function extractMultiEditContent(
  toolInput: ToolInput,
  filePath: string
): Promise<string> {
  try {
    const existingContent = await readFile(filePath, 'utf-8');
    return existingContent;
  } catch {
    return toolInput.content || '';
  }
}

/**
 * Extract command from Bash tool input
 */
export function extractBashCommand(toolInput: ToolInput): string {
  return toolInput.command || '';
}
