/**
 * Tests for the enhanced type-safe validation utilities
 * Demonstrates improved type safety and runtime validation
 */

import { describe, expect, test } from 'bun:test';
import {
  assertValidToolInput,
  getSupportedToolNames,
  hasValidationSchemaForTool,
  isBashToolInput,
  isValidToolInput,
  isWriteToolInput,
  parseToolInput,
  validateMultipleToolInputs,
  validateToolInputWithDetails,
} from '../validation-utils';

describe('Type-Safe Tool Input Validation', () => {
  describe('parseToolInput', () => {
    test('validates Bash tool input correctly', () => {
      const validBashInput = {
        command: 'echo "hello world"',
        description: 'Test command',
        timeout: 5000,
      };

      const result = parseToolInput('Bash', validBashInput);

      expect(result.command).toBe('echo "hello world"');
      expect(result.description).toBe('Test command');
      expect(result.timeout).toBe(5000);
    });

    test('throws on invalid Bash tool input', () => {
      const invalidBashInput = {
        command: '', // Empty command should fail
      };

      expect(() => parseToolInput('Bash', invalidBashInput)).toThrow();
    });

    test('validates Write tool input correctly', () => {
      const validWriteInput = {
        file_path: '/tmp/test.txt',
        content: 'Hello, World!',
      };

      const result = parseToolInput('Write', validWriteInput);

      expect(result.file_path).toBe('/tmp/test.txt');
      expect(result.content).toBe('Hello, World!');
    });

    test('throws on invalid Write tool input', () => {
      const invalidWriteInput = {
        file_path: 'relative/path.txt', // Should require absolute path
        content: 'test',
      };

      expect(() => parseToolInput('Write', invalidWriteInput)).toThrow();
    });

    test('handles unknown tool types gracefully', () => {
      const customToolInput = {
        customProperty: 'value',
        anotherProperty: 123,
      };

      const result = parseToolInput('CustomTool', customToolInput);

      expect(result).toEqual(customToolInput);
    });
  });

  describe('Type Guards', () => {
    test('isBashToolInput validates structure deeply', () => {
      const validBash = {
        command: 'ls -la',
        timeout: 1000,
      };
      const invalidBash = {
        command: '', // Empty command
      };
      const nonBash = {
        file_path: '/tmp/test.txt',
        content: 'test',
      };

      expect(isBashToolInput(validBash)).toBe(true);
      expect(isBashToolInput(invalidBash)).toBe(false);
      expect(isBashToolInput(nonBash)).toBe(false);
    });

    test('isWriteToolInput validates file paths', () => {
      const validWrite = {
        file_path: '/absolute/path.txt',
        content: 'test content',
      };
      const invalidWrite = {
        file_path: 'relative/path.txt', // Must be absolute
        content: 'test content',
      };

      expect(isWriteToolInput(validWrite)).toBe(true);
      expect(isWriteToolInput(invalidWrite)).toBe(false);
    });

    test('isValidToolInput works for any tool', () => {
      const bashInput = { command: 'echo test' };
      const writeInput = { file_path: '/tmp/test.txt', content: 'test' };
      const customInput = { customProp: 'value' };

      expect(isValidToolInput('Bash', bashInput)).toBe(true);
      expect(isValidToolInput('Write', writeInput)).toBe(true);
      expect(isValidToolInput('CustomTool' as ToolName, customInput)).toBe(
        false
      );
      expect(isValidToolInput('Bash', writeInput)).toBe(false);
    });
  });

  describe('Detailed Validation', () => {
    test('validateToolInputWithDetails provides comprehensive feedback', () => {
      const invalidEdit = {
        file_path: 'relative/path.txt', // Should be absolute
        old_string: 'old',
        new_string: 'new',
      };

      const result = validateToolInputWithDetails('Edit', invalidEdit);

      expect(result.success).toBe(false);
      expect(result.error).toContain('file_path');
      expect(result.issues).toBeDefined();
      expect(result.issues?.length).toBeGreaterThan(0);
    });

    test('successful validation returns parsed data', () => {
      const validGlob = {
        pattern: '*.ts',
        path: '/src',
      };

      const result = validateToolInputWithDetails('Glob', validGlob);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern).toBe('*.ts');
        expect(result.data.path).toBe('/src');
      }
    });
  });

  describe('Assertion Validation', () => {
    test('assertValidToolInput passes for valid input', () => {
      const validRead = {
        file_path: '/tmp/test.txt',
        limit: 100,
      };

      expect(() => assertValidToolInput('Read', validRead)).not.toThrow();
    });

    test('assertValidToolInput throws for invalid input', () => {
      const invalidRead = {
        file_path: 'relative/path.txt', // Must be absolute
      };

      expect(() => assertValidToolInput('Read', invalidRead)).toThrow();
    });
  });

  describe('Batch Validation', () => {
    test('validateMultipleToolInputs handles multiple validations', () => {
      const validations = [
        { toolName: 'Bash' as const, input: { command: 'echo test' } },
        {
          toolName: 'Write' as const,
          input: { file_path: '/tmp/test.txt', content: 'test' },
        },
        {
          toolName: 'Edit' as const,
          input: { file_path: 'invalid', old_string: 'old', new_string: 'new' },
        },
      ];

      const results = validateMultipleToolInputs(validations);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
    });
  });

  describe('Feature Detection', () => {
    test('hasValidationSchemaForTool detects supported tools', () => {
      expect(hasValidationSchemaForTool('Bash')).toBe(true);
      expect(hasValidationSchemaForTool('Write')).toBe(true);
      expect(hasValidationSchemaForTool('UnknownTool')).toBe(false);
    });

    test('getSupportedToolNames returns known tools', () => {
      const supportedTools = getSupportedToolNames();

      expect(supportedTools).toContain('Bash');
      expect(supportedTools).toContain('Write');
      expect(supportedTools).toContain('Edit');
      expect(supportedTools).toContain('Read');
      expect(supportedTools.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Tool Validation', () => {
    test('validates MultiEdit with nested structure', () => {
      const validMultiEdit = {
        file_path: '/tmp/test.txt',
        edits: [
          { old_string: 'old1', new_string: 'new1' },
          { old_string: 'old2', new_string: 'new2', replace_all: true },
        ],
      };

      expect(isValidToolInput('MultiEdit', validMultiEdit)).toBe(true);

      const result = parseToolInput('MultiEdit', validMultiEdit);
      expect(result.edits).toHaveLength(2);
      expect(result.edits[1].replace_all).toBe(true);
    });

    test('validates TodoWrite with array validation', () => {
      const validTodoWrite = {
        todos: [
          { content: 'Task 1', status: 'pending', id: 'task-1' },
          { content: 'Task 2', status: 'completed', id: 'task-2' },
        ],
      };

      expect(isValidToolInput('TodoWrite', validTodoWrite)).toBe(true);

      const invalidTodoWrite = {
        todos: [], // Empty array should fail
      };

      expect(isValidToolInput('TodoWrite', invalidTodoWrite)).toBe(false);
    });

    test('validates WebFetch with URL validation', () => {
      const validWebFetch = {
        url: 'https://example.com',
        prompt: 'Get the page content',
      };

      expect(isValidToolInput('WebFetch', validWebFetch)).toBe(true);

      const invalidWebFetch = {
        url: 'not-a-url',
        prompt: 'Get the page content',
      };

      expect(isValidToolInput('WebFetch', invalidWebFetch)).toBe(false);
    });
  });

  describe('Error Message Quality', () => {
    test('provides clear error messages for validation failures', () => {
      const invalidInput = {
        file_path: 'relative/path',
        content: 'test',
        extraProperty: 'should not be here',
      };

      const result = validateToolInputWithDetails('Write', invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('file_path');
      expect(result.error).toContain('Must be absolute path');
    });

    test('assertion errors include tool name and specific issues', () => {
      const invalidBash = {
        command: '', // Empty command
        timeout: -1, // Negative timeout
      };

      expect(() => assertValidToolInput('Bash', invalidBash)).toThrow(
        /Invalid Bash tool input/
      );
    });
  });
});

describe('Type Safety Demonstrations', () => {
  test('demonstrates eliminated as assertions', () => {
    // Before: unsafe as assertion
    // const toolInput = unknownInput as BashToolInput; // ❌ Unsafe

    // After: proper validation
    const unknownInput = { command: 'echo test', timeout: 1000 };
    const validatedInput = parseToolInput('Bash', unknownInput); // ✅ Type-safe

    // TypeScript now knows this is properly validated BashToolInput
    expect(validatedInput.command).toBe('echo test');
    expect(validatedInput.timeout).toBe(1000);
  });

  test('demonstrates deep validation vs property existence', () => {
    // Before: only checked property existence
    const malformedInput = {
      command: '', // Empty string - should fail
      timeout: 'not-a-number', // Wrong type - should fail
    };

    // Old type guard would pass (only checked property existence)
    // New validation properly validates types and constraints
    expect(isBashToolInput(malformedInput)).toBe(false);
  });

  test('demonstrates integration with context factories', () => {
    const toolInput = { command: 'echo test' };

    // This now uses proper validation under the hood
    const validatedInput = parseToolInput('Bash', toolInput);

    // Type system guarantees this is a valid BashToolInput
    expect(typeof validatedInput.command).toBe('string');
    expect(validatedInput.command.length).toBeGreaterThan(0);
  });
});
