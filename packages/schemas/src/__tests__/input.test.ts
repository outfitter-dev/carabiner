/**
 * Tests for Claude Code hook input validation schemas
 */

import { describe, test, expect } from 'bun:test';
import { z } from 'zod';
import {
  hookEventSchema,
  toolNameSchema,
  baseClaudeHookInputSchema,
  claudeToolHookInputSchema,
  claudeUserPromptInputSchema,
  claudeNotificationInputSchema,
  claudeHookInputSchema,
  hookEnvironmentSchema,
  hookResultSchema,
  claudeHookOutputSchema,
  hookExecutionOptionsSchema,
  parseClaudeHookInput,
  safeParseClaudeHookInput,
  parseHookEnvironment,
  parseHookResult,
  parseHookExecutionOptions,
  isValidClaudeHookInput,
  isValidToolHookInput,
  isValidUserPromptInput,
  isValidNotificationInput,
  validateAndCreateBrandedInput,
} from '../input.js';

describe('hookEventSchema', () => {
  test('validates all hook events', () => {
    const validEvents = [
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ];

    for (const event of validEvents) {
      expect(() => hookEventSchema.parse(event)).not.toThrow();
    }
  });

  test('rejects invalid hook events', () => {
    const invalidEvents = [
      'preToolUse', // wrong case
      'PRETOOLUSE', // wrong case
      'InvalidEvent',
      '',
      123,
      null,
      undefined,
    ];

    for (const event of invalidEvents) {
      expect(() => hookEventSchema.parse(event)).toThrow(z.ZodError);
    }
  });
});

describe('toolNameSchema', () => {
  test('validates known tool names', () => {
    const knownTools = [
      'Bash',
      'Edit',
      'Write',
      'Read',
      'Glob',
      'Grep',
      'LS',
      'TodoWrite',
      'WebFetch',
      'WebSearch',
      'NotebookEdit',
    ];

    for (const tool of knownTools) {
      expect(() => toolNameSchema.parse(tool)).not.toThrow();
    }
  });

  test('validates custom tool names', () => {
    const customTools = [
      'CustomTool',
      'MySpecialTool',
      'tool-with-dashes',
      'tool_with_underscores',
    ];

    for (const tool of customTools) {
      expect(() => toolNameSchema.parse(tool)).not.toThrow();
    }
  });

  test('rejects invalid tool names', () => {
    const invalidTools = [
      '', // empty string
      123,
      null,
      undefined,
      {},
      [],
    ];

    for (const tool of invalidTools) {
      expect(() => toolNameSchema.parse(tool)).toThrow(z.ZodError);
    }
  });
});

describe('baseClaudeHookInputSchema', () => {
  test('validates valid base input', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'PreToolUse',
      matcher: 'security-check',
    };

    expect(() => baseClaudeHookInputSchema.parse(validInput)).not.toThrow();
  });

  test('validates input without optional matcher', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'SessionStart',
    };

    expect(() => baseClaudeHookInputSchema.parse(validInput)).not.toThrow();
  });

  test('rejects invalid base input', () => {
    const invalidInputs = [
      {}, // missing all required fields
      { session_id: 'test' }, // missing other required fields
      { session_id: 'ab', transcript_path: '/tmp/transcript.md', cwd: '/project', hook_event_name: 'PreToolUse' }, // session_id too short
      { session_id: 'test-session', transcript_path: 'relative.md', cwd: '/project', hook_event_name: 'PreToolUse' }, // non-absolute transcript_path
      { session_id: 'test-session', transcript_path: '/tmp/file.txt', cwd: '/project', hook_event_name: 'PreToolUse' }, // transcript_path not .md
      { session_id: 'test-session', transcript_path: '/tmp/transcript.md', cwd: 'relative', hook_event_name: 'PreToolUse' }, // non-absolute cwd
      { session_id: 'test session', transcript_path: '/tmp/transcript.md', cwd: '/project', hook_event_name: 'PreToolUse' }, // invalid session_id format
    ];

    for (const input of invalidInputs) {
      expect(() => baseClaudeHookInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('claudeToolHookInputSchema', () => {
  test('validates PreToolUse input', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    };

    expect(() => claudeToolHookInputSchema.parse(validInput)).not.toThrow();
  });

  test('validates PostToolUse input with response', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: { success: true, output: 'file1.txt\nfile2.txt' },
    };

    expect(() => claudeToolHookInputSchema.parse(validInput)).not.toThrow();
  });

  test('rejects invalid tool hook input', () => {
    const invalidInputs = [
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'UserPromptSubmit', // wrong event type
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'PreToolUse',
        // missing tool_name
        tool_input: { command: 'ls' },
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeToolHookInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('claudeUserPromptInputSchema', () => {
  test('validates user prompt input', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Explain TypeScript generics',
    };

    expect(() => claudeUserPromptInputSchema.parse(validInput)).not.toThrow();
  });

  test('rejects invalid user prompt input', () => {
    const invalidInputs = [
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'PreToolUse', // wrong event type
        prompt: 'Test prompt',
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'UserPromptSubmit',
        prompt: '', // empty prompt
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeUserPromptInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('claudeNotificationInputSchema', () => {
  test('validates notification inputs', () => {
    const validInputs = [
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'SessionStart',
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'Stop',
        message: 'User requested stop',
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'SubagentStop',
        message: 'Subagent completed',
      },
    ];

    for (const input of validInputs) {
      expect(() => claudeNotificationInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid notification input', () => {
    const invalidInputs = [
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'PreToolUse', // wrong event type
      },
    ];

    for (const input of invalidInputs) {
      expect(() => claudeNotificationInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('claudeHookInputSchema (discriminated union)', () => {
  test('validates all input types', () => {
    const validInputs = [
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Help me',
      },
      {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'SessionStart',
      },
    ];

    for (const input of validInputs) {
      expect(() => claudeHookInputSchema.parse(input)).not.toThrow();
    }
  });

  test('discriminates based on hook_event_name', () => {
    const toolInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      prompt: 'This should be ignored', // extra field
    };

    const parsed = claudeHookInputSchema.parse(toolInput);
    expect('tool_name' in parsed).toBe(true);
    expect('prompt' in parsed).toBe(false); // extra field stripped
  });
});

describe('hookEnvironmentSchema', () => {
  test('validates environment with CLAUDE_PROJECT_DIR', () => {
    const validEnvs = [
      { CLAUDE_PROJECT_DIR: '/project' },
      {}, // empty environment allowed
    ];

    for (const env of validEnvs) {
      expect(() => hookEnvironmentSchema.parse(env)).not.toThrow();
    }
  });
});

describe('hookResultSchema', () => {
  test('validates hook results', () => {
    const validResults = [
      { success: true },
      { success: false, message: 'Error occurred' },
      { 
        success: true, 
        message: 'Completed', 
        data: { count: 5 },
        metadata: { duration: 150, timestamp: '2024-01-01T00:00:00Z' }
      },
    ];

    for (const result of validResults) {
      expect(() => hookResultSchema.parse(result)).not.toThrow();
    }
  });

  test('requires success field', () => {
    const invalidResults = [
      {}, // missing success
      { message: 'Error' }, // missing success
    ];

    for (const result of invalidResults) {
      expect(() => hookResultSchema.parse(result)).toThrow(z.ZodError);
    }
  });
});

describe('claudeHookOutputSchema', () => {
  test('validates Claude hook outputs', () => {
    const validOutputs = [
      { action: 'continue' },
      { action: 'block', message: 'Security violation' },
      { 
        action: 'modify', 
        message: 'Input modified',
        modified_input: { command: 'safe-command' },
        data: { original: 'dangerous-command' }
      },
    ];

    for (const output of validOutputs) {
      expect(() => claudeHookOutputSchema.parse(output)).not.toThrow();
    }
  });

  test('rejects invalid actions', () => {
    const invalidOutputs = [
      { action: 'invalid' },
      {}, // missing action
    ];

    for (const output of invalidOutputs) {
      expect(() => claudeHookOutputSchema.parse(output)).toThrow(z.ZodError);
    }
  });
});

describe('hookExecutionOptionsSchema', () => {
  test('validates execution options', () => {
    const validOptions = [
      {},
      { timeout: 30000 },
      { 
        timeout: 60000,
        throwOnError: true,
        captureOutput: false,
        logLevel: 'debug',
        outputMode: 'json'
      },
    ];

    for (const options of validOptions) {
      expect(() => hookExecutionOptionsSchema.parse(options)).not.toThrow();
    }
  });

  test('rejects invalid options', () => {
    const invalidOptions = [
      { timeout: -1 }, // negative timeout
      { logLevel: 'invalid' }, // invalid log level
      { outputMode: 'invalid' }, // invalid output mode
    ];

    for (const options of invalidOptions) {
      expect(() => hookExecutionOptionsSchema.parse(options)).toThrow(z.ZodError);
    }
  });
});

describe('parsing functions', () => {
  describe('parseClaudeHookInput', () => {
    test('parses valid input', () => {
      const input = {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      };

      const parsed = parseClaudeHookInput(input);
      expect(parsed).toEqual(input);
    });

    test('throws on invalid input', () => {
      const input = { invalid: 'data' };
      expect(() => parseClaudeHookInput(input)).toThrow(z.ZodError);
    });
  });

  describe('safeParseClaudeHookInput', () => {
    test('returns success for valid input', () => {
      const input = {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/project',
        hook_event_name: 'SessionStart',
      };

      const result = safeParseClaudeHookInput(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    });

    test('returns error for invalid input', () => {
      const input = { invalid: 'data' };
      const result = safeParseClaudeHookInput(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('type guard functions', () => {
  test('isValidClaudeHookInput', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'SessionStart',
    };

    const invalidInput = { invalid: 'data' };

    expect(isValidClaudeHookInput(validInput)).toBe(true);
    expect(isValidClaudeHookInput(invalidInput)).toBe(false);
  });

  test('isValidToolHookInput', () => {
    const validInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    };

    const invalidInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'SessionStart', // not a tool event
    };

    expect(isValidToolHookInput(validInput)).toBe(true);
    expect(isValidToolHookInput(invalidInput)).toBe(false);
  });
});

describe('validateAndCreateBrandedInput', () => {
  test('validates and creates branded types', async () => {
    const input = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'SessionStart',
    };

    const result = await validateAndCreateBrandedInput(input);
    
    expect(result.session_id).toBe('test-session-123');
    expect(result.transcript_path).toBe('/tmp/transcript.md');
    expect(result.cwd).toBe('/project');
    
    // Branded types should be present
    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.transcriptPath).toBe('string');
    expect(typeof result.cwd).toBe('string');
  });

  test('throws on invalid branded input', async () => {
    const input = {
      session_id: 'ab', // too short for SessionId
      transcript_path: '/tmp/transcript.md',
      cwd: '/project',
      hook_event_name: 'SessionStart',
    };

    await expect(validateAndCreateBrandedInput(input)).rejects.toThrow();
  });
});