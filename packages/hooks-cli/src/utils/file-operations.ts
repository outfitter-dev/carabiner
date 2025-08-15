/**
 * File operation utilities
 * Enhanced with security validation for safe file operations
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createWorkspaceValidator } from '../security/workspace-validator';

export interface FileWriteOptions {
  force?: boolean;
  createDirs?: boolean;
  workspacePath?: string;
}

/**
 * Write file with safety checks and directory creation
 * Enhanced with security validation
 */
export async function writeFileWithChecks(
  filePath: string,
  content: string,
  options: FileWriteOptions = {}
): Promise<void> {
  const { force = false, createDirs = true, workspacePath } = options;

  // Security: Validate file path if workspace is provided
  let validatedPath = filePath;
  if (workspacePath) {
    const validator = createWorkspaceValidator(workspacePath);
    validatedPath = validator.validateFilePath(filePath);
  }

  // Check if file exists and force flag
  if (existsSync(validatedPath) && !force) {
    throw new Error(
      `File already exists: ${filePath}. Use --force to overwrite.`
    );
  }

  // Create directories if needed
  if (createDirs) {
    const dir = dirname(validatedPath);
    
    // Security: Validate directory path
    if (workspacePath) {
      const validator = createWorkspaceValidator(workspacePath);
      validator.validateDirectoryPath(dir);
    }
    
    await mkdir(dir, { recursive: true });
  }

  // Write the file
  await writeFile(validatedPath, content);
}

/**
 * Check if file exists
 * Enhanced with security validation
 */
export function fileExists(filePath: string, workspacePath?: string): boolean {
  let validatedPath = filePath;
  
  // Security: Validate file path if workspace is provided
  if (workspacePath) {
    try {
      const validator = createWorkspaceValidator(workspacePath);
      validatedPath = validator.validateFilePath(filePath);
    } catch {
      // If validation fails, file is considered not to exist
      return false;
    }
  }
  
  return existsSync(validatedPath);
}

/**
 * Secure file path resolver
 */
export function resolveSecurePath(filePath: string, workspacePath: string): string {
  const validator = createWorkspaceValidator(workspacePath);
  return validator.validateFilePath(filePath);
}
