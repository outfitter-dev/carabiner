/**
 * Mock utilities for testing Claude Code hooks
 * Provides environment mocking and context creation for tests
 */

import type {
  ClaudeHookInputVariant,
  ClaudeToolHookInput,
  GetToolInput,
  HookContext,
  HookEnvironment,
  HookEvent,
  ToolInput,
  ToolName,
} from '@outfitter/hooks-core';

/**
 * Mock environment configuration
 */
export type MockEnvironmentConfig = {
  sessionId?: string;
  toolName?: ToolName;
  workspacePath?: string;
  toolInput?: ToolInput;
  toolOutput?: string;
  userPrompt?: string;
  additionalEnv?: Record<string, string>;
};

/**
 * Mock hook context options
 */
export type MockContextOptions<
  TEvent extends HookEvent = HookEvent,
  TTool extends ToolName = ToolName,
> = {
  event: TEvent;
  toolName?: TTool;
  sessionId?: string;
  workspacePath?: string;
  toolInput?: GetToolInput<TTool>;
  toolOutput?: string;
  userPrompt?: string;
  environment?: Partial<HookEnvironment>;
};

/**
 * Environment variable storage for restoration
 */
type EnvironmentSnapshot = {
  [key: string]: string | undefined;
};

/**
 * Mock environment manager
 */
export class MockEnvironment {
  private originalEnv: EnvironmentSnapshot = {};
  private readonly mockVars: Set<string> = new Set();

  /**
   * Set up mock environment variables
   */
  setup(config: MockEnvironmentConfig = {}): void {
    const {
      sessionId = 'test-session-123',
      toolName = 'Bash',
      workspacePath = process.cwd(),
      toolInput = { command: 'echo test' },
      toolOutput,
      userPrompt,
      additionalEnv = {},
    } = config;

    // Store original environment
    const envVars = [
      'CLAUDE_SESSION_ID',
      'CLAUDE_TOOL_NAME',
      'CLAUDE_WORKSPACE_PATH',
      'TOOL_INPUT',
      'TOOL_OUTPUT',
      'USER_PROMPT',
      ...Object.keys(additionalEnv),
    ];

    for (const varName of envVars) {
      this.originalEnv[varName] = Bun.env[varName];
      this.mockVars.add(varName);
    }

    // Set mock values
    Bun.env.CLAUDE_SESSION_ID = sessionId;
    Bun.env.CLAUDE_TOOL_NAME = toolName;
    Bun.env.CLAUDE_WORKSPACE_PATH = workspacePath;
    Bun.env.TOOL_INPUT =
      typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput);

    if (toolOutput !== undefined) {
      Bun.env.TOOL_OUTPUT = toolOutput;
    }

    if (userPrompt !== undefined) {
      Bun.env.USER_PROMPT = userPrompt;
    }

    // Set additional environment variables
    for (const [key, value] of Object.entries(additionalEnv)) {
      Bun.env[key] = value;
    }
  }

  /**
   * Update specific environment variable
   */
  set(key: string, value: string): void {
    if (!this.mockVars.has(key)) {
      this.originalEnv[key] = Bun.env[key];
      this.mockVars.add(key);
    }
    Bun.env[key] = value;
  }

  /**
   * Get environment variable
   */
  get(key: string): string | undefined {
    return Bun.env[key];
  }

  /**
   * Restore original environment
   */
  restore(): void {
    for (const varName of this.mockVars) {
      const originalValue = this.originalEnv[varName];
      if (originalValue === undefined) {
        delete Bun.env[varName];
      } else {
        Bun.env[varName] = originalValue;
      }
    }

    this.originalEnv = {};
    this.mockVars.clear();
  }

  /**
   * Clear all mock environment variables
   */
  clear(): void {
    for (const varName of this.mockVars) {
      delete Bun.env[varName];
    }
  }
}

/**
 * Create mock hook context
 */
export function createMockContext<
  TEvent extends HookEvent = HookEvent,
  TTool extends ToolName = ToolName,
>(options: MockContextOptions<TEvent, TTool>): HookContext<TEvent, TTool> {
  const {
    event,
    toolName = 'Bash' as TTool,
    sessionId = 'test-session-123',
    workspacePath = process.cwd(),
    toolInput = {} as GetToolInput<TTool>,
    toolOutput: _toolOutput,
    userPrompt,
    environment = {},
  } = options;

  const mockEnvironment: HookEnvironment = {
    CLAUDE_PROJECT_DIR: workspacePath,
    ...environment,
  };

  const rawInput: ClaudeHookInputVariant = {
    hook_event_name: event === 'PreToolUse' ? 'PreToolUse' : 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput as Record<string, unknown>,
    session_id: sessionId,
    transcript_path: '/tmp/test-transcript.txt',
    cwd: workspacePath,
    user_prompt: userPrompt,
  } as ClaudeToolHookInput;

  return {
    event,
    sessionId,
    transcriptPath: '/tmp/test-transcript.txt',
    toolName,
    cwd: workspacePath,
    toolInput,
    userPrompt,
    environment: mockEnvironment,
    rawInput,
  };
}

/**
 * Create mock contexts for specific tools
 */
export const createMockContextFor = {
  /**
   * Create Bash tool context
   */
  bash<TEvent extends HookEvent>(
    event: TEvent,
    command = 'echo test',
    options: Partial<MockContextOptions<TEvent, 'Bash'>> = {}
  ): HookContext<TEvent, 'Bash'> {
    return createMockContext({
      event,
      toolName: 'Bash',
      toolInput: { command },
      ...options,
    });
  },

  /**
   * Create Write tool context
   */
  write<TEvent extends HookEvent>(
    event: TEvent,
    filePath = 'test.txt',
    content = 'test content',
    options: Partial<MockContextOptions<TEvent, 'Write'>> = {}
  ): HookContext<TEvent, 'Write'> {
    return createMockContext({
      event,
      toolName: 'Write',
      toolInput: { file_path: filePath, content },
      ...options,
    });
  },

  /**
   * Create Edit tool context
   */
  edit<TEvent extends HookEvent>(
    event: TEvent,
    filePath = 'test.txt',
    oldString = 'old',
    newString = 'new',
    options: Partial<MockContextOptions<TEvent, 'Edit'>> = {}
  ): HookContext<TEvent, 'Edit'> {
    return createMockContext({
      event,
      toolName: 'Edit',
      toolInput: {
        file_path: filePath,
        old_string: oldString,
        new_string: newString,
      },
      ...options,
    });
  },

  /**
   * Create Read tool context
   */
  read<TEvent extends HookEvent>(
    event: TEvent,
    filePath = 'test.txt',
    options: Partial<MockContextOptions<TEvent, 'Read'>> = {}
  ): HookContext<TEvent, 'Read'> {
    return createMockContext({
      event,
      toolName: 'Read',
      toolInput: { file_path: filePath },
      ...options,
    });
  },

  /**
   * Create SessionStart context
   */
  sessionStart(
    options: Partial<MockContextOptions<'SessionStart'>> = {}
  ): HookContext<'SessionStart'> {
    return createMockContext({
      event: 'SessionStart',
      ...options,
    });
  },

  /**
   * Create UserPromptSubmit context
   */
  userPromptSubmit(
    userPrompt = 'test prompt',
    options: Partial<MockContextOptions<'UserPromptSubmit'>> = {}
  ): HookContext<'UserPromptSubmit'> {
    return createMockContext({
      event: 'UserPromptSubmit',
      userPrompt,
      ...options,
    });
  },
};

/**
 * Mock tool input builders
 */
export const mockToolInputs = {
  bash: (command = 'echo test', timeout?: number) => ({
    command,
    ...(timeout && { timeout }),
  }),

  write: (filePath = 'test.txt', content = 'test content') => ({
    file_path: filePath,
    content,
  }),

  edit: (
    filePath = 'test.txt',
    oldString = 'old',
    newString = 'new',
    replaceAll?: boolean
  ) => ({
    file_path: filePath,
    old_string: oldString,
    new_string: newString,
    ...(replaceAll !== undefined && { replace_all: replaceAll }),
  }),

  read: (filePath = 'test.txt', limit?: number, offset?: number) => ({
    file_path: filePath,
    ...(limit && { limit }),
    ...(offset !== undefined && { offset }),
  }),

  glob: (pattern = '*.ts', path?: string) => ({
    pattern,
    ...(path && { path }),
  }),

  grep: (
    pattern = 'test',
    options: {
      path?: string;
      glob?: string;
      outputMode?: 'content' | 'files_with_matches' | 'count';
      multiline?: boolean;
    } = {}
  ) => ({
    pattern,
    ...options,
  }),
};

/**
 * Global mock environment instance
 */
export const mockEnv = new MockEnvironment();

/**
 * Test utilities for common scenarios
 */
export const TestUtils = {
  /**
   * Set up test environment with cleanup
   */
  withMockEnvironment<T>(
    config: MockEnvironmentConfig,
    testFn: () => T | Promise<T>
  ): () => Promise<T> {
    return async () => {
      mockEnv.setup(config);
      try {
        return await Promise.resolve(testFn());
      } finally {
        mockEnv.restore();
      }
    };
  },

  /**
   * Create temporary workspace for testing
   */
  async withTempWorkspace<T>(
    testFn: (workspacePath: string) => T | Promise<T>
  ): Promise<T> {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const tempDir = mkdtempSync(join(tmpdir(), 'claude-hooks-test-'));

    try {
      return await Promise.resolve(testFn(tempDir));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  },

  /**
   * Assert hook result properties
   */
  assertHookResult(
    result: unknown,
    expected: {
      success?: boolean;
      message?: string;
      block?: boolean;
      hasData?: boolean;
    }
  ): void {
    // Type guard for result validation
    function isValidResult(value: unknown): value is {
      success?: boolean;
      message?: string;
      block?: boolean;
      data?: unknown;
    } {
      return typeof value === 'object' && value !== null;
    }

    if (!isValidResult(result)) {
      throw new Error('Result must be an object');
    }
    if (expected.success !== undefined && result.success !== expected.success) {
      throw new Error(
        `Expected success to be ${expected.success}, got ${result.success}`
      );
    }

    if (expected.message !== undefined && result.message !== expected.message) {
      throw new Error(
        `Expected message '${expected.message}', got '${result.message}'`
      );
    }

    if (expected.block !== undefined && result.block !== expected.block) {
      throw new Error(
        `Expected block to be ${expected.block}, got ${result.block}`
      );
    }

    if (expected.hasData !== undefined) {
      const hasData = result.data !== undefined && result.data !== null;
      if (hasData !== expected.hasData) {
        throw new Error(
          `Expected hasData to be ${expected.hasData}, got ${hasData}`
        );
      }
    }
  },

  /**
   * Wait for async operation with timeout
   */
  async waitFor<T>(
    operation: () => Promise<T>,
    timeout = 5000,
    interval = 100
  ): Promise<T> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        return await operation();
      } catch (error) {
        if (Date.now() - start >= timeout) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    throw new Error(`Operation timed out after ${timeout}ms`);
  },
};
