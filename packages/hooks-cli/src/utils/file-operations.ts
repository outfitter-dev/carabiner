/**
 * File operation utilities
 */

import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface FileWriteOptions {
  force?: boolean;
  createDirs?: boolean;
}

/**
 * Write file with safety checks and directory creation
 */
export async function writeFileWithChecks(
  filePath: string,
  content: string,
  options: FileWriteOptions = {}
): Promise<void> {
  const { force = false, createDirs = true } = options;

  // Check if file exists and force flag
  if (existsSync(filePath) && !force) {
    throw new Error(
      `File already exists: ${filePath}. Use --force to overwrite.`
    );
  }

  // Create directories if needed
  if (createDirs) {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
  }

  // Write the file
  await writeFile(filePath, content);
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}