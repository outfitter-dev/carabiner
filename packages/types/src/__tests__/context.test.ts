/**
 * Tests for hook context types and utilities
 */

import { describe, expect, test } from 'bun:test';
import {
  createDirectoryPath,
  createSessionId,
  createTranscriptPath,
} from '../brands.js';
import {
  type BashHookContext,
  createNotificationContext,
  createToolHookContext,
  createUserPromptContext,
  type HookContext,
  isBashHookContext,
  isFileHookContext,
  isNotificationContext,
  isPostToolUseContext,
  isPreToolUseContext,
  isSearchHookContext,
  isToolHookContext,
  isUserPromptContext,
  type NotificationHookContext,
  type PostToolUseContext,
  type PreToolUseContext,
  type ToolHookContext,
  type UserPromptHookContext,
} from '../context.js';

// Helper function to create base options
const createBaseOptions = () => ({
  sessionId: createSessionId('test-session'),
  transcriptPath: createTranscriptPath('/tmp/transcript.md'),
  cwd: createDirectoryPath('/tmp'),
  environment: { CLAUDE_PROJECT_DIR: '/project' },
});

describe('Context type guards', () => {
  describe('isToolHookContext', () => {
    test('identifies tool hook contexts', () => {
      const preContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      );

      const postContext: ToolHookContext = createToolHookContext(
        'PostToolUse',
        'Write',
        { file_path: '/test.txt', content: 'hello' },
        createBaseOptions(),
        { success: true }
      );

      expect(isToolHookContext(preContext)).toBe(true);
      expect(isToolHookContext(postContext)).toBe(true);
    });

    test('rejects non-tool hook contexts', () => {
      const userContext: UserPromptHookContext = createUserPromptContext(
        'What is TypeScript?',
        createBaseOptions()
      );

      const notificationContext: NotificationHookContext =
        createNotificationContext('SessionStart', createBaseOptions());

      expect(isToolHookContext(userContext)).toBe(false);
      expect(isToolHookContext(notificationContext)).toBe(false);
    });
  });

  describe('isBashHookContext', () => {
    test('identifies Bash hook contexts', () => {
      const bashContext: BashHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'echo hello' },
        createBaseOptions()
      ) as BashHookContext;

      expect(isBashHookContext(bashContext)).toBe(true);
    });

    test('rejects non-Bash tool contexts', () => {
      const writeContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Write',
        { file_path: '/test.txt', content: 'hello' },
        createBaseOptions()
      );

      expect(isBashHookContext(writeContext)).toBe(false);
    });
  });

  describe('isFileHookContext', () => {
    test('identifies file tool contexts', () => {
      const writeContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Write',
        { file_path: '/test.txt', content: 'hello' },
        createBaseOptions()
      );

      const editContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Edit',
        { file_path: '/test.txt', old_string: 'old', new_string: 'new' },
        createBaseOptions()
      );

      const readContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Read',
        { file_path: '/test.txt' },
        createBaseOptions()
      );

      expect(isFileHookContext(writeContext)).toBe(true);
      expect(isFileHookContext(editContext)).toBe(true);
      expect(isFileHookContext(readContext)).toBe(true);
    });

    test('rejects non-file tool contexts', () => {
      const bashContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      );

      expect(isFileHookContext(bashContext)).toBe(false);
    });
  });

  describe('isSearchHookContext', () => {
    test('identifies search tool contexts', () => {
      const globContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Glob',
        { pattern: '*.ts' },
        createBaseOptions()
      );

      const grepContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Grep',
        { pattern: 'function' },
        createBaseOptions()
      );

      expect(isSearchHookContext(globContext)).toBe(true);
      expect(isSearchHookContext(grepContext)).toBe(true);
    });

    test('rejects non-search tool contexts', () => {
      const bashContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      );

      expect(isSearchHookContext(bashContext)).toBe(false);
    });
  });

  describe('isUserPromptContext', () => {
    test('identifies user prompt contexts', () => {
      const userContext: UserPromptHookContext = createUserPromptContext(
        'Help me with TypeScript',
        createBaseOptions()
      );

      expect(isUserPromptContext(userContext)).toBe(true);
    });

    test('rejects non-user prompt contexts', () => {
      const toolContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      );

      expect(isUserPromptContext(toolContext)).toBe(false);
    });
  });

  describe('isNotificationContext', () => {
    test('identifies notification contexts', () => {
      const sessionStartContext: NotificationHookContext =
        createNotificationContext('SessionStart', createBaseOptions());

      const stopContext: NotificationHookContext = createNotificationContext(
        'Stop',
        createBaseOptions(),
        'Session ended'
      );

      const subagentStopContext: NotificationHookContext =
        createNotificationContext('SubagentStop', createBaseOptions());

      expect(isNotificationContext(sessionStartContext)).toBe(true);
      expect(isNotificationContext(stopContext)).toBe(true);
      expect(isNotificationContext(subagentStopContext)).toBe(true);
    });

    test('rejects non-notification contexts', () => {
      const toolContext: ToolHookContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      );

      expect(isNotificationContext(toolContext)).toBe(false);
    });
  });

  describe('isPreToolUseContext', () => {
    test('identifies PreToolUse contexts', () => {
      const preContext: PreToolUseContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      ) as PreToolUseContext;

      expect(isPreToolUseContext(preContext)).toBe(true);
    });

    test('rejects non-PreToolUse contexts', () => {
      const postContext: PostToolUseContext = createToolHookContext(
        'PostToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions(),
        { success: true }
      ) as PostToolUseContext;

      expect(isPreToolUseContext(postContext)).toBe(false);
    });
  });

  describe('isPostToolUseContext', () => {
    test('identifies PostToolUse contexts', () => {
      const postContext: PostToolUseContext = createToolHookContext(
        'PostToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions(),
        { success: true }
      ) as PostToolUseContext;

      expect(isPostToolUseContext(postContext)).toBe(true);
    });

    test('rejects non-PostToolUse contexts', () => {
      const preContext: PreToolUseContext = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions()
      ) as PreToolUseContext;

      expect(isPostToolUseContext(preContext)).toBe(false);
    });
  });
});

describe('Context creation functions', () => {
  describe('createToolHookContext', () => {
    test('creates PreToolUse context', () => {
      const context = createToolHookContext(
        'PreToolUse',
        'Bash',
        { command: 'ls -la', timeout: 5000 },
        createBaseOptions()
      );

      expect(context.event).toBe('PreToolUse');
      expect(context.toolName).toBe('Bash');
      expect(context.toolInput).toEqual({ command: 'ls -la', timeout: 5000 });
      expect(context.toolResponse).toBeUndefined();
      expect(context.sessionId).toBeDefined();
      expect(context.transcriptPath).toBeDefined();
      expect(context.cwd).toBeDefined();
      expect(context.environment).toEqual({ CLAUDE_PROJECT_DIR: '/project' });
    });

    test('creates PostToolUse context with response', () => {
      const toolResponse = {
        success: true,
        output: 'file1.txt\nfile2.txt\n',
      };

      const context = createToolHookContext(
        'PostToolUse',
        'Bash',
        { command: 'ls' },
        createBaseOptions(),
        toolResponse
      );

      expect(context.event).toBe('PostToolUse');
      expect(context.toolName).toBe('Bash');
      expect(context.toolResponse).toEqual(toolResponse);
    });

    test('includes matcher when provided', () => {
      const options = {
        ...createBaseOptions(),
        matcher: 'security-check',
      };

      const context = createToolHookContext(
        'PreToolUse',
        'Write',
        { file_path: '/tmp/secure.txt', content: 'data' },
        options
      );

      expect(context.matcher).toBe('security-check');
    });
  });

  describe('createUserPromptContext', () => {
    test('creates user prompt context', () => {
      const context = createUserPromptContext(
        'Explain TypeScript generics',
        createBaseOptions()
      );

      expect(context.event).toBe('UserPromptSubmit');
      expect(context.userPrompt).toBe('Explain TypeScript generics');
      expect(context.sessionId).toBeDefined();
      expect(context.transcriptPath).toBeDefined();
      expect(context.cwd).toBeDefined();
      expect(context.environment).toEqual({ CLAUDE_PROJECT_DIR: '/project' });
    });

    test('uses default environment when not provided', () => {
      const options = createBaseOptions();
      options.environment = undefined;

      const context = createUserPromptContext('Help with React', options);

      expect(context.environment).toEqual({});
    });
  });

  describe('createNotificationContext', () => {
    test('creates SessionStart context', () => {
      const context = createNotificationContext(
        'SessionStart',
        createBaseOptions()
      );

      expect(context.event).toBe('SessionStart');
      expect(context.message).toBeUndefined();
    });

    test('creates Stop context with message', () => {
      const context = createNotificationContext(
        'Stop',
        createBaseOptions(),
        'User requested stop'
      );

      expect(context.event).toBe('Stop');
      expect(context.message).toBe('User requested stop');
    });

    test('creates SubagentStop context', () => {
      const context = createNotificationContext(
        'SubagentStop',
        createBaseOptions(),
        'Subagent task completed'
      );

      expect(context.event).toBe('SubagentStop');
      expect(context.message).toBe('Subagent task completed');
    });
  });
});

describe('Type system consistency', () => {
  test('HookContext union includes all specific contexts', () => {
    // This test ensures our union type is complete
    const toolContext: ToolHookContext = createToolHookContext(
      'PreToolUse',
      'Bash',
      { command: 'ls' },
      createBaseOptions()
    );

    const userContext: UserPromptHookContext = createUserPromptContext(
      'Help me',
      createBaseOptions()
    );

    const notificationContext: NotificationHookContext =
      createNotificationContext('SessionStart', createBaseOptions());

    // These should all be assignable to HookContext
    const contexts: HookContext[] = [
      toolContext,
      userContext,
      notificationContext,
    ];

    expect(contexts).toHaveLength(3);
  });

  test('branded types are properly used in contexts', () => {
    const options = createBaseOptions();
    const context = createToolHookContext(
      'PreToolUse',
      'Bash',
      { command: 'ls' },
      options
    );

    // These should be branded types
    expect(typeof context.sessionId).toBe('string');
    expect(typeof context.transcriptPath).toBe('string');
    expect(typeof context.cwd).toBe('string');

    // Branded types should maintain their string nature
    expect(context.sessionId.includes('test')).toBe(true);
  });

  test('readonly properties are enforced', () => {
    const context = createToolHookContext(
      'PreToolUse',
      'Bash',
      { command: 'ls' },
      createBaseOptions()
    );

    // These properties should be readonly
    // @ts-expect-error - event should be readonly
    context.event = 'PostToolUse';

    // @ts-expect-error - sessionId should be readonly
    context.sessionId = createSessionId('different');
  });
});
