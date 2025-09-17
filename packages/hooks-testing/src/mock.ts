/**
 * Mock utilities for testing Claude Code hooks
 * Provides environment mocking and context creation for tests
 */

import type {
  GetToolInput,
  HookEnvironment,
  HookInput,
  PostToolUseHookInput,
  PreToolUseHookInput,
  SessionStartHookInput,
  ToolInput,
  ToolName,
  UserPromptSubmitHookInput,
} from "@carabiner/hooks-core";

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
 * Mock hook input options - creates HookInput objects instead of HookContext
 */
export type MockInputOptions<
  TInput extends HookInput = HookInput,
  TTool extends ToolName = ToolName,
> = {
  event: TInput["hook_event_name"];
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
      sessionId = "test-session-123",
      toolName = "Bash",
      workspacePath = process.cwd(),
      toolInput = { command: "echo test" },
      toolOutput,
      userPrompt,
      additionalEnv = {},
    } = config;

    // Store original environment
    const envVars = [
      "CLAUDE_SESSION_ID",
      "CLAUDE_TOOL_NAME",
      "CLAUDE_PROJECT_DIR",
      "TOOL_INPUT",
      "TOOL_OUTPUT",
      "USER_PROMPT",
      ...Object.keys(additionalEnv),
    ];

    for (const varName of envVars) {
      this.originalEnv[varName] = Bun.env[varName];
      this.mockVars.add(varName);
    }

    // Set mock values
    Bun.env.CLAUDE_SESSION_ID = sessionId;
    Bun.env.CLAUDE_TOOL_NAME = toolName;
    Bun.env.CLAUDE_PROJECT_DIR = workspacePath;
    Bun.env.TOOL_INPUT =
      typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput);

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
 * Create mock hook input
 */
export function createMockInput<TInput extends HookInput = HookInput>(
  options: MockInputOptions<TInput>
): TInput {
  const {
    event,
    toolName = "Bash",
    sessionId = "test-session-123",
    workspacePath = process.cwd(),
    toolInput = {},
    toolOutput,
    userPrompt,
  } = options;

  // Base fields for all hook inputs
  const baseInput = {
    session_id: sessionId,
    transcript_path: "/tmp/test-transcript.txt",
    cwd: workspacePath,
  };

  // Create the appropriate hook input based on event type
  if (event === "PreToolUse") {
    return {
      ...baseInput,
      hook_event_name: "PreToolUse",
      tool_name: toolName,
      tool_input: toolInput as Record<string, unknown>,
    } as TInput;
  }
  if (event === "PostToolUse") {
    return {
      ...baseInput,
      hook_event_name: "PostToolUse",
      tool_name: toolName,
      tool_input: toolInput as Record<string, unknown>,
      tool_response: toolOutput || "Mock tool response",
    } as TInput;
  }
  if (event === "UserPromptSubmit") {
    return {
      ...baseInput,
      hook_event_name: "UserPromptSubmit",
      prompt: userPrompt || "test prompt",
    } as TInput;
  }
  if (event === "SessionStart") {
    return {
      ...baseInput,
      hook_event_name: "SessionStart",
    } as TInput;
  }
  if (event === "SessionEnd") {
    return {
      ...baseInput,
      hook_event_name: "SessionEnd",
    } as TInput;
  }
  if (event === "Stop") {
    return {
      ...baseInput,
      hook_event_name: "Stop",
    } as TInput;
  }
  if (event === "SubagentStop") {
    return {
      ...baseInput,
      hook_event_name: "SubagentStop",
    } as TInput;
  }
  if (event === "PreCompact") {
    return {
      ...baseInput,
      hook_event_name: "PreCompact",
    } as TInput;
  }
  return {
    ...baseInput,
    hook_event_name: "Notification",
  } as TInput;
}

/**
 * Create mock hook inputs for specific tools and events
 */
export const createMockInputFor = {
  /**
   * Create Bash tool input for PreToolUse/PostToolUse
   */
  bash(
    event: "PreToolUse" | "PostToolUse",
    command = "echo test",
    options: Omit<
      Partial<MockInputOptions>,
      "event" | "toolName" | "toolInput"
    > = {}
  ): PreToolUseHookInput | PostToolUseHookInput {
    return createMockInput({
      event,
      toolName: "Bash" as const,
      toolInput: { command },
      ...options,
    }) as PreToolUseHookInput | PostToolUseHookInput;
  },

  /**
   * Create Write tool input for PreToolUse/PostToolUse
   */
  write(
    event: "PreToolUse" | "PostToolUse",
    filePath = "test.txt",
    content = "test content",
    options: Omit<
      Partial<MockInputOptions>,
      "event" | "toolName" | "toolInput"
    > = {}
  ): PreToolUseHookInput | PostToolUseHookInput {
    return createMockInput({
      event,
      toolName: "Write" as const,
      toolInput: { file_path: filePath, content },
      ...options,
    }) as PreToolUseHookInput | PostToolUseHookInput;
  },

  /**
   * Create Edit tool input for PreToolUse/PostToolUse
   */
  edit(
    event: "PreToolUse" | "PostToolUse",
    filePath = "test.txt",
    oldString = "old",
    newString = "new",
    options: Omit<
      Partial<MockInputOptions>,
      "event" | "toolName" | "toolInput"
    > = {}
  ): PreToolUseHookInput | PostToolUseHookInput {
    return createMockInput({
      event,
      toolName: "Edit" as const,
      toolInput: {
        file_path: filePath,
        old_string: oldString,
        new_string: newString,
      },
      ...options,
    }) as PreToolUseHookInput | PostToolUseHookInput;
  },

  /**
   * Create Read tool input for PreToolUse/PostToolUse
   */
  read(
    event: "PreToolUse" | "PostToolUse",
    filePath = "test.txt",
    options: Omit<
      Partial<MockInputOptions>,
      "event" | "toolName" | "toolInput"
    > = {}
  ): PreToolUseHookInput | PostToolUseHookInput {
    return createMockInput({
      event,
      toolName: "Read" as const,
      toolInput: { file_path: filePath },
      ...options,
    }) as PreToolUseHookInput | PostToolUseHookInput;
  },

  /**
   * Create SessionStart input
   */
  sessionStart(
    options: Omit<Partial<MockInputOptions>, "event"> = {}
  ): SessionStartHookInput {
    return createMockInput({
      event: "SessionStart" as const,
      ...options,
    }) as SessionStartHookInput;
  },

  /**
   * Create UserPromptSubmit input
   */
  userPromptSubmit(
    userPrompt = "test prompt",
    options: Omit<Partial<MockInputOptions>, "event"> = {}
  ): UserPromptSubmitHookInput {
    return createMockInput({
      event: "UserPromptSubmit" as const,
      userPrompt,
      ...options,
    }) as UserPromptSubmitHookInput;
  },
};

/**
 * Mock tool input builders
 */
export const mockToolInputs = {
  bash: (command = "echo test", timeout?: number) => ({
    command,
    ...(timeout && { timeout }),
  }),

  write: (filePath = "test.txt", content = "test content") => ({
    file_path: filePath,
    content,
  }),

  edit: (
    filePath = "test.txt",
    oldString = "old",
    newString = "new",
    replaceAll?: boolean
  ) => ({
    file_path: filePath,
    old_string: oldString,
    new_string: newString,
    ...(replaceAll !== undefined && { replace_all: replaceAll }),
  }),

  read: (filePath = "test.txt", limit?: number, offset?: number) => ({
    file_path: filePath,
    ...(limit && { limit }),
    ...(offset !== undefined && { offset }),
  }),

  glob: (pattern = "*.ts", path?: string) => ({
    pattern,
    ...(path && { path }),
  }),

  grep: (
    pattern = "test",
    options: {
      path?: string;
      glob?: string;
      outputMode?: "content" | "files_with_matches" | "count";
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
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const tempDir = mkdtempSync(join(tmpdir(), "carabiner-test-"));

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
      return typeof value === "object" && value !== null;
    }

    if (!isValidResult(result)) {
      throw new Error("Result must be an object");
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
