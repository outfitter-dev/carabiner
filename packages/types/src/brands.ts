/**
 * Branded types for Claude Code hooks
 * Provides compile-time safety and runtime validation for core domain values
 */

import type { Opaque } from 'type-fest';

/**
 * Brand types for core domain values
 */
export type SessionId = Opaque<string, 'SessionId'>;
export type FilePath = Opaque<string, 'FilePath'>;
export type CommandString = Opaque<string, 'CommandString'>;
export type TranscriptPath = Opaque<string, 'TranscriptPath'>;
export type DirectoryPath = Opaque<string, 'DirectoryPath'>;

/**
 * Brand validation errors
 */
export class BrandValidationError extends Error {
  constructor(
    public readonly brandType: string,
    public readonly value: unknown,
    message: string
  ) {
    super(`Invalid ${brandType}: ${message}`);
    this.name = 'BrandValidationError';
  }
}

/**
 * Session ID validation and creation
 * Must be non-empty string with reasonable length
 */
export function createSessionId(value: string): SessionId {
  if (!value || typeof value !== 'string') {
    throw new BrandValidationError(
      'SessionId',
      value,
      'must be a non-empty string'
    );
  }

  if (value.length < 3) {
    throw new BrandValidationError(
      'SessionId',
      value,
      'must be at least 3 characters'
    );
  }

  if (value.length > 100) {
    throw new BrandValidationError(
      'SessionId',
      value,
      'must be at most 100 characters'
    );
  }

  // Basic format validation - alphanumeric, dashes, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new BrandValidationError(
      'SessionId',
      value,
      'must contain only alphanumeric characters, dashes, and underscores'
    );
  }

  return value as SessionId;
}

/**
 * File path validation and creation
 * Must be absolute path on Unix systems
 */
export function createFilePath(value: string): FilePath {
  if (!value || typeof value !== 'string') {
    throw new BrandValidationError(
      'FilePath',
      value,
      'must be a non-empty string'
    );
  }

  // Must be absolute path
  if (!value.startsWith('/')) {
    throw new BrandValidationError(
      'FilePath',
      value,
      'must be an absolute path starting with /'
    );
  }

  // Reasonable length limits
  if (value.length > 4096) {
    throw new BrandValidationError(
      'FilePath',
      value,
      'path too long (max 4096 characters)'
    );
  }

  // Prevent path traversal attempts
  if (value.includes('/../') || value.endsWith('/..')) {
    throw new BrandValidationError(
      'FilePath',
      value,
      'path traversal not allowed'
    );
  }

  // Prevent null bytes
  if (value.includes('\0')) {
    throw new BrandValidationError('FilePath', value, 'null bytes not allowed');
  }

  return value as FilePath;
}

/**
 * Command string validation and creation
 * Basic security validation for shell commands
 */
export function createCommandString(value: string): CommandString {
  if (!value || typeof value !== 'string') {
    throw new BrandValidationError(
      'CommandString',
      value,
      'must be a non-empty string'
    );
  }

  if (value.length > 8192) {
    throw new BrandValidationError(
      'CommandString',
      value,
      'command too long (max 8192 characters)'
    );
  }

  // Prevent null bytes
  if (value.includes('\0')) {
    throw new BrandValidationError(
      'CommandString',
      value,
      'null bytes not allowed'
    );
  }

  return value as CommandString;
}

/**
 * Transcript path validation and creation
 * Similar to FilePath but with specific transcript requirements
 */
export function createTranscriptPath(value: string): TranscriptPath {
  if (!value || typeof value !== 'string') {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'must be a non-empty string'
    );
  }

  // Must be absolute path
  if (!value.startsWith('/')) {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'must be an absolute path starting with /'
    );
  }

  // Should typically end with .md
  if (!value.endsWith('.md')) {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'transcript path should end with .md'
    );
  }

  // Reasonable length limits
  if (value.length > 4096) {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'path too long (max 4096 characters)'
    );
  }

  // Prevent path traversal attempts
  if (value.includes('/../') || value.endsWith('/..')) {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'path traversal not allowed'
    );
  }

  // Prevent null bytes
  if (value.includes('\0')) {
    throw new BrandValidationError(
      'TranscriptPath',
      value,
      'null bytes not allowed'
    );
  }

  return value as TranscriptPath;
}

/**
 * Directory path validation and creation
 */
export function createDirectoryPath(value: string): DirectoryPath {
  if (!value || typeof value !== 'string') {
    throw new BrandValidationError(
      'DirectoryPath',
      value,
      'must be a non-empty string'
    );
  }

  // Must be absolute path
  if (!value.startsWith('/')) {
    throw new BrandValidationError(
      'DirectoryPath',
      value,
      'must be an absolute path starting with /'
    );
  }

  // Reasonable length limits
  if (value.length > 4096) {
    throw new BrandValidationError(
      'DirectoryPath',
      value,
      'path too long (max 4096 characters)'
    );
  }

  // Prevent path traversal attempts
  if (value.includes('/../') || value.endsWith('/..')) {
    throw new BrandValidationError(
      'DirectoryPath',
      value,
      'path traversal not allowed'
    );
  }

  // Prevent null bytes
  if (value.includes('\0')) {
    throw new BrandValidationError(
      'DirectoryPath',
      value,
      'null bytes not allowed'
    );
  }

  return value as DirectoryPath;
}

/**
 * Type guards for branded types
 */
export function isSessionId(value: unknown): value is SessionId {
  try {
    if (typeof value !== 'string') {
      return false;
    }
    createSessionId(value);
    return true;
  } catch {
    return false;
  }
}

export function isFilePath(value: unknown): value is FilePath {
  try {
    if (typeof value !== 'string') {
      return false;
    }
    createFilePath(value);
    return true;
  } catch {
    return false;
  }
}

export function isCommandString(value: unknown): value is CommandString {
  try {
    if (typeof value !== 'string') {
      return false;
    }
    createCommandString(value);
    return true;
  } catch {
    return false;
  }
}

export function isTranscriptPath(value: unknown): value is TranscriptPath {
  try {
    if (typeof value !== 'string') {
      return false;
    }
    createTranscriptPath(value);
    return true;
  } catch {
    return false;
  }
}

export function isDirectoryPath(value: unknown): value is DirectoryPath {
  try {
    if (typeof value !== 'string') {
      return false;
    }
    createDirectoryPath(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unsafe brand creators for cases where validation has already occurred
 * Use with extreme caution and only when performance is critical
 */
export const UnsafeBrands = {
  sessionId: (value: string): SessionId => value as SessionId,
  filePath: (value: string): FilePath => value as FilePath,
  commandString: (value: string): CommandString => value as CommandString,
  transcriptPath: (value: string): TranscriptPath => value as TranscriptPath,
  directoryPath: (value: string): DirectoryPath => value as DirectoryPath,
} as const;
