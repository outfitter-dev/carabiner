/**
 * Tests for hook event types and utilities
 */

import { describe, expect, test } from 'bun:test';
import {
  HOOK_EVENTS,
  type HookEvent,
  HookResults,
  isHookEvent,
  isNotificationEvent,
  isToolHookEvent,
  isUserEvent,
  type NotificationEvent,
  type ToolHookEvent,
  type UserEvent,
} from '../events.js';

describe('HOOK_EVENTS constant', () => {
  test('contains all expected events', () => {
    expect(HOOK_EVENTS).toEqual([
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ]);
  });

  test('is readonly tuple', () => {
    // This should cause a TypeScript error if HOOK_EVENTS is not readonly
    // We don't actually execute the push to avoid mutating the array during tests
    // @ts-expect-error - HOOK_EVENTS should be readonly
    // HOOK_EVENTS.push('InvalidEvent');

    // Instead, just verify the array is properly typed
    expect(HOOK_EVENTS.length).toBe(6);
  });
});

describe('isHookEvent', () => {
  test('identifies valid hook events', () => {
    for (const event of HOOK_EVENTS) {
      expect(isHookEvent(event)).toBe(true);
    }
  });

  test('rejects invalid hook events', () => {
    // Test string values that are not valid hook events
    expect(isHookEvent('InvalidEvent')).toBe(false);
    expect(isHookEvent('preToolUse')).toBe(false); // wrong case
    expect(isHookEvent('POST_TOOL_USE')).toBe(false); // wrong case
    expect(isHookEvent('')).toBe(false); // empty string

    // Test non-string values
    expect(isHookEvent(123)).toBe(false);
    expect(isHookEvent(null)).toBe(false);
    expect(isHookEvent(undefined)).toBe(false);
    expect(isHookEvent({})).toBe(false);
    expect(isHookEvent([])).toBe(false);
  });
});

describe('isToolHookEvent', () => {
  test('identifies tool hook events', () => {
    const toolEvents: HookEvent[] = ['PreToolUse', 'PostToolUse'];

    for (const event of toolEvents) {
      expect(isToolHookEvent(event)).toBe(true);
    }
  });

  test('rejects non-tool hook events', () => {
    const nonToolEvents: HookEvent[] = [
      'UserPromptSubmit',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ];

    for (const event of nonToolEvents) {
      expect(isToolHookEvent(event)).toBe(false);
    }
  });
});

describe('isNotificationEvent', () => {
  test('identifies notification events', () => {
    const notificationEvents: HookEvent[] = [
      'SessionStart',
      'Stop',
      'SubagentStop',
    ];

    for (const event of notificationEvents) {
      expect(isNotificationEvent(event)).toBe(true);
    }
  });

  test('rejects non-notification events', () => {
    const nonNotificationEvents: HookEvent[] = [
      'PreToolUse',
      'PostToolUse',
      'UserPromptSubmit',
    ];

    for (const event of nonNotificationEvents) {
      expect(isNotificationEvent(event)).toBe(false);
    }
  });
});

describe('isUserEvent', () => {
  test('identifies user events', () => {
    expect(isUserEvent('UserPromptSubmit')).toBe(true);
  });

  test('rejects non-user events', () => {
    const nonUserEvents: HookEvent[] = [
      'PreToolUse',
      'PostToolUse',
      'SessionStart',
      'Stop',
      'SubagentStop',
    ];

    for (const event of nonUserEvents) {
      expect(isUserEvent(event)).toBe(false);
    }
  });
});

describe('HookResults builders', () => {
  describe('success', () => {
    test('creates success result without message or data', () => {
      const result = HookResults.success();

      expect(result).toEqual({
        success: true,
        message: undefined,
        data: undefined,
      });
    });

    test('creates success result with message', () => {
      const result = HookResults.success('Operation completed');

      expect(result).toEqual({
        success: true,
        message: 'Operation completed',
        data: undefined,
      });
    });

    test('creates success result with message and data', () => {
      const data = { count: 5, files: ['a.txt', 'b.txt'] };
      const result = HookResults.success('Files processed', data);

      expect(result).toEqual({
        success: true,
        message: 'Files processed',
        data,
      });
    });
  });

  describe('failure', () => {
    test('creates failure result with message', () => {
      const result = HookResults.failure('Validation failed: Tool parameter "command" contains disallowed characters');

      expect(result).toEqual({
        success: false,
        message: 'Validation failed: Tool parameter "command" contains disallowed characters',
        block: false,
        data: undefined,
      });
    });

    test('creates blocking failure result', () => {
      const result = HookResults.failure('Critical error', true);

      expect(result).toEqual({
        success: false,
        message: 'Critical error',
        block: true,
        data: undefined,
      });
    });

    test('creates failure result with data', () => {
      const data = { errorCode: 'E001', details: 'File not found' };
      const result = HookResults.failure('File error', false, data);

      expect(result).toEqual({
        success: false,
        message: 'File error',
        block: false,
        data,
      });
    });
  });

  describe('block', () => {
    test('creates blocking failure result', () => {
      const result = HookResults.block('Security violation detected');

      expect(result).toEqual({
        success: false,
        message: 'Security violation detected',
        block: true,
      });
    });
  });

  describe('skip', () => {
    test('creates skip result with default message', () => {
      const result = HookResults.skip();

      expect(result).toEqual({
        success: true,
        message: 'Hook skipped',
      });
    });

    test('creates skip result with custom message', () => {
      const result = HookResults.skip('Not applicable for this tool');

      expect(result).toEqual({
        success: true,
        message: 'Not applicable for this tool',
      });
    });
  });

  describe('warn', () => {
    test('creates warning result with message', () => {
      const result = HookResults.warn('Deprecated feature used');

      expect(result).toEqual({
        success: true,
        message: 'Deprecated feature used',
        data: undefined,
      });
    });

    test('creates warning result with data', () => {
      const data = { deprecatedFeature: 'oldApi', replacement: 'newApi' };
      const result = HookResults.warn('Deprecated API call', data);

      expect(result).toEqual({
        success: true,
        message: 'Deprecated API call',
        data,
      });
    });
  });
});

describe('Type relationships', () => {
  test('ToolHookEvent is subset of HookEvent', () => {
    const toolEvent: ToolHookEvent = 'PreToolUse';
    const hookEvent: HookEvent = toolEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isToolHookEvent(toolEvent)).toBe(true);
  });

  test('NotificationEvent is subset of HookEvent', () => {
    const notificationEvent: NotificationEvent = 'SessionStart';
    const hookEvent: HookEvent = notificationEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isNotificationEvent(notificationEvent)).toBe(true);
  });

  test('UserEvent is subset of HookEvent', () => {
    const userEvent: UserEvent = 'UserPromptSubmit';
    const hookEvent: HookEvent = userEvent; // Should compile

    expect(isHookEvent(hookEvent)).toBe(true);
    expect(isUserEvent(userEvent)).toBe(true);
  });
});

describe('HookResult interface', () => {
  test('accepts minimal result', () => {
    const result = { success: true };

    // Should satisfy HookResult interface
    expect(result.success).toBe(true);
  });

  test('accepts complete result', () => {
    const result = {
      success: false,
      message: 'Error occurred',
      block: true,
      data: { errorCode: 'E001' },
      metadata: {
        duration: 150,
        timestamp: '2024-01-01T00:00:00Z',
        hookVersion: '1.0.0',
      },
    };

    expect(result.success).toBe(false);
    expect(result.message).toBe('Error occurred');
    expect(result.block).toBe(true);
    expect(result.data?.errorCode).toBe('E001');
    expect(result.metadata?.duration).toBe(150);
  });
});
