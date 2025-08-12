/**
 * Path resolution utilities
 */

import { join } from 'node:path';

/**
 * Get hooks directory path
 */
export function getHooksDir(workspacePath: string): string {
  return join(workspacePath, 'hooks');
}

/**
 * Get hooks lib directory path
 */
export function getHooksLibDir(workspacePath: string): string {
  return join(workspacePath, 'hooks', 'lib');
}

/**
 * Get hooks test directory path
 */
export function getHooksTestDir(workspacePath: string): string {
  return join(workspacePath, 'hooks', 'test');
}

/**
 * Get file path with extension
 */
export function getFilePath(
  directory: string,
  name: string,
  extension: string,
  suffix?: string
): string {
  const fileName = suffix ? `${name}.${suffix}.${extension}` : `${name}.${extension}`;
  return join(directory, fileName);
}