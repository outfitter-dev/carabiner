/**
 * Type-safe test helpers for Claude Code hooks
 * Replaces unsafe `any` types with proper branded types and utilities
 */

import {
  createDirectoryPath,
  createSessionId,
  createTranscriptPath,
  type DirectoryPath,
  type SessionId,
  type TranscriptPath,
  UnsafeBrands,
} from './brands';

/**
 * Safe test context creation with proper types
 */
export type TestContextOptions = {
  sessionId?: string;
  transcriptPath?: string;
  cwd?: string;
  hookEventName?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: Record<string, unknown>;
  userPrompt?: string;
  message?: string;
  matcher?: string;
};

/**
 * Create a basic test context with validated brands
 */
export function createTestContext(options: TestContextOptions = {}) {
  const sessionId = options.sessionId
    ? createSessionId(options.sessionId)
    : createSessionId('test-session-123');

  const transcriptPath = options.transcriptPath
    ? createTranscriptPath(options.transcriptPath)
    : createTranscriptPath('/tmp/test-transcript.md');

  const cwd = options.cwd
    ? createDirectoryPath(options.cwd)
    : createDirectoryPath('/test/workspace');

  return {
    event: options.hookEventName ?? 'PreToolUse',
    sessionId,
    transcriptPath,
    cwd,
    matcher: options.matcher,
    toolName: options.toolName ?? 'Bash',
    toolInput: options.toolInput ?? {},
    ...(options.toolResponse && { toolResponse: options.toolResponse }),
    ...(options.userPrompt && { userPrompt: options.userPrompt }),
    ...(options.message && { message: options.message }),
    environment: {
      CLAUDE_PROJECT_DIR: cwd,
    },
  };
}

/**
 * Type-safe mock creation utilities
 */
export const TestMocks = {
  /**
   * Create a minimal readable stream mock for stdin tests
   */
  stdin: (data = '{}') => ({
    setEncoding: () => {},
    on: (event: string, callback: (chunk: string) => void) => {
      if (event === 'data') {
        // Simulate async data arrival
        setTimeout(() => callback(data), 0);
      }
      if (event === 'end') {
        setTimeout(() => callback, 0);
      }
    },
    removeAllListeners: () => {},
  }),

  /**
   * Create a minimal writable stream mock for stdout/stderr tests
   */
  stdout: (captured: string[] = []) => ({
    write: (data: string) => {
      captured.push(data);
      return true;
    },
  }),

  /**
   * Create a minimal timer mock
   */
  timer: () => {
    const timers = new Set<number>();
    return {
      setTimeout: (callback: () => void, delay: number) => {
        const id = Math.random();
        timers.add(id);
        setTimeout(() => {
          if (timers.has(id)) {
            callback();
            timers.delete(id);
          }
        }, delay);
        return id;
      },
      clearTimeout: (id: number) => {
        timers.delete(id);
      },
    };
  },

  /**
   * Create a safe process environment mock
   */
  env: (overrides: Record<string, string> = {}) => ({
    NODE_ENV: 'test',
    CLAUDE_PROJECT_DIR: '/test/workspace',
    ...overrides,
  }),
} as const;

/**
 * Test data factories with proper validation
 */
export const TestFactories = {
  sessionId: (suffix = '123'): SessionId =>
    createSessionId(`test-session-${suffix}`),
  transcriptPath: (name = 'test'): TranscriptPath =>
    createTranscriptPath(`/tmp/${name}-transcript.md`),
  directoryPath: (path = 'workspace'): DirectoryPath =>
    createDirectoryPath(`/test/${path}`),

  /**
   * Create unsafe brands for performance-critical tests where validation is handled elsewhere
   */
  unsafe: {
    sessionId: (value: string): SessionId => UnsafeBrands.sessionId(value),
    transcriptPath: (value: string): TranscriptPath =>
      UnsafeBrands.transcriptPath(value),
    directoryPath: (value: string): DirectoryPath =>
      UnsafeBrands.directoryPath(value),
  },
} as const;

/**
 * Type assertion utilities for test scenarios
 */
export const TestAssertions = {
  /**
   * Assert that a value matches the expected hook context structure
   */
  isValidTestContext(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const ctx = value as Record<string, unknown>;

    return (
      typeof ctx.event === 'string' &&
      typeof ctx.sessionId === 'string' &&
      typeof ctx.transcriptPath === 'string' &&
      typeof ctx.cwd === 'string' &&
      typeof ctx.toolName === 'string' &&
      ctx.toolInput !== null &&
      typeof ctx.toolInput === 'object' &&
      ctx.environment !== null &&
      typeof ctx.environment === 'object'
    );
  },

  /**
   * Assert that a value has the correct tool input structure
   */
  hasValidToolInput(value: unknown, expectedKeys: string[]): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const input = value as Record<string, unknown>;
    return expectedKeys.every((key) => key in input);
  },
} as const;

/**
 * Test error types for better error handling in tests
 */
export class TestSetupError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TestSetupError';
  }
}

export class TestValidationError extends Error {
  constructor(
    message: string,
    public readonly actual?: unknown,
    public readonly expected?: unknown
  ) {
    super(message);
    this.name = 'TestValidationError';
  }
}
