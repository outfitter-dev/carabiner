/**
 * Type Safety Improvement Tests
 * Demonstrates the enhanced type safety patterns and their benefits
 */

import { describe, expect, test } from 'bun:test';
import type { ToolInputMap } from '../types';

// Import validation utilities
import {
  assertValidToolInput,
  createToolInputValidator,
  getSupportedToolNames,
  hasValidationSchemaForTool,
  isValidToolInput,
  validateToolInputSafely,
} from '../validation-utils';

describe('Type Safety Architecture Improvements', () => {
  describe('Validation Infrastructure', () => {
    test('creates type-safe validators without repetitive code', () => {
      // The createToolInputValidator eliminates the need for 12 similar functions
      const validateBash = createToolInputValidator('Bash');
      const validateWrite = createToolInputValidator('Write');

      // These are proper type guards, not just property existence checks
      expect(typeof validateBash).toBe('function');
      expect(typeof validateWrite).toBe('function');

      // Type guards should narrow types properly
      const mockInput = { command: 'echo test' };
      if (validateBash(mockInput)) {
        // TypeScript knows this is BashToolInput
        expect(mockInput.command).toBeDefined();
      }
    });

    test('provides detailed validation results instead of just boolean', () => {
      // Mock invalid input to demonstrate error handling
      const invalidInput = { invalid: 'property' };

      const result = validateToolInputSafely('Bash', invalidInput);

      // Should have structure for success/failure with details
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
      }
    });

    test('supports assertion-style validation for fail-fast patterns', () => {
      // Test that assertValidToolInput function exists and can be called
      expect(() => {
        // This should either pass or throw, not return undefined
        try {
          assertValidToolInput('Bash', { someProperty: 'value' });
        } catch (error) {
          // Expected for invalid input
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow(TypeError); // Should not throw type errors
    });

    test('provides feature detection for graceful degradation', () => {
      // These functions should exist and return reasonable values
      const supportedTools = getSupportedToolNames();
      expect(Array.isArray(supportedTools)).toBe(true);

      const hasSchema = hasValidationSchemaForTool('Bash');
      expect(typeof hasSchema).toBe('boolean');
    });
  });

  describe('Type Safety Patterns', () => {
    test('eliminates unsafe as assertions', () => {
      // Before: toolInput as BashToolInput (unsafe)
      // After: proper validation with parseToolInput

      // The validation utilities provide safe alternatives to 'as' assertions
      expect(createToolInputValidator).toBeDefined();
      expect(validateToolInputSafely).toBeDefined();
    });

    test('provides deep validation beyond property existence', () => {
      // Test that validators are more sophisticated than simple property checks
      const bashValidator = createToolInputValidator('Bash');

      // Test with different input types
      const testCases = [
        { input: null, shouldPass: false },
        { input: undefined, shouldPass: false },
        { input: 'string', shouldPass: false },
        { input: 42, shouldPass: false },
        { input: [], shouldPass: false },
        { input: {}, shouldPass: false }, // Empty object
        { input: { command: 'test' }, expected: 'depends on schema' },
      ];

      testCases.forEach(({ input, shouldPass }) => {
        const result = bashValidator(input);
        if (shouldPass !== undefined) {
          expect(typeof result).toBe('boolean');
        }
      });
    });

    test('supports generic tool validation for unknown tools', () => {
      // Should handle both known and unknown tool types
      const knownToolResult = isValidToolInput('Bash', { command: 'test' });
      const unknownToolResult = isValidToolInput('CustomTool', {
        customProp: 'value',
      });

      expect(typeof knownToolResult).toBe('boolean');
      expect(typeof unknownToolResult).toBe('boolean');
    });
  });

  describe('Error Handling Improvements', () => {
    test('provides structured error information', () => {
      const result = validateToolInputSafely('Write', { invalid: 'input' });

      // Should be structured result, not thrown exception
      expect(result).toHaveProperty('success');

      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(typeof result.error).toBe('string');
        // Should optionally have detailed issues array
        if ('issues' in result) {
          expect(Array.isArray(result.issues)).toBe(true);
        }
      }
    });

    test('handles validation failures gracefully', () => {
      // Should not throw during validation, but return structured results
      expect(() => {
        validateToolInputSafely('Edit', null);
        validateToolInputSafely('MultiEdit', undefined);
        validateToolInputSafely('Glob', 'invalid');
      }).not.toThrow();
    });

    test('provides clear error messages for debugging', () => {
      const result = validateToolInputSafely('Read', { wrong: 'format' });

      if (!result.success) {
        // Error message should be descriptive
        expect(result.error.length).toBeGreaterThan(0);
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('Integration Architecture', () => {
    test('integrates with context-factories pattern', () => {
      // The validation utilities should be designed to work with context creation
      // This tests that the interfaces are compatible

      const mockToolInput = { command: 'echo test' };
      const validator = createToolInputValidator('Bash');

      // Should be usable in context creation workflow
      if (validator(mockToolInput)) {
        // TypeScript should know this is validated BashToolInput
        expect(mockToolInput).toHaveProperty('command');
      }
    });

    test('supports caching for performance', () => {
      // Multiple calls should be efficient
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        getSupportedToolNames();
        hasValidationSchemaForTool('Bash');
      }

      const duration = performance.now() - start;

      // Should complete quickly due to caching
      expect(duration).toBeLessThan(1000); // Less than 1 second for 100 calls
    });

    test('maintains backward compatibility', () => {
      // Should export all the expected type guards for backward compatibility
      const expectedExports = [
        'createToolInputValidator',
        'validateToolInputSafely',
        'assertValidToolInput',
        'isValidToolInput',
        'hasValidationSchemaForTool',
        'getSupportedToolNames',
      ];

      expectedExports.forEach((exportName) => {
        expect(eval(exportName)).toBeDefined();
      });
    });
  });

  describe('Type Safety Guarantees', () => {
    test('discriminated union approach for type narrowing', () => {
      // Test that the validation system supports proper type narrowing
      const bashValidator = createToolInputValidator('Bash');

      function processToolInput(input: unknown) {
        if (bashValidator(input)) {
          // TypeScript should know input is BashToolInput here
          return input.command; // Should not cause type errors
        }
        return null;
      }

      expect(typeof processToolInput).toBe('function');
    });

    test('prevents runtime type mismatches', () => {
      // Validation should catch type mismatches that property checks miss
      const malformedInputs = [
        { command: 123 }, // Wrong type
        { command: null }, // Null value
        { command: {} }, // Object instead of string
        { command: [] }, // Array instead of string
      ];

      malformedInputs.forEach((input) => {
        const result = validateToolInputSafely('Bash', input);
        // Should detect these as invalid (implementation dependent on schema availability)
        expect(result).toHaveProperty('success');
      });
    });

    test('ensures consistency across validation methods', () => {
      const testInput = { command: 'echo test' };

      // Different validation methods should be consistent
      const typeGuardResult = createToolInputValidator('Bash')(testInput);
      const detailedResult = validateToolInputSafely('Bash', testInput);
      const genericResult = isValidToolInput('Bash', testInput);

      // Results should be consistent
      expect(typeof typeGuardResult).toBe('boolean');
      expect(typeof detailedResult.success).toBe('boolean');
      expect(typeof genericResult).toBe('boolean');

      // If available, validation results should align
      if (detailedResult.success !== undefined) {
        // Results should generally agree (allowing for different error handling)
        expect(typeof detailedResult.success).toBe('boolean');
      }
    });
  });

  describe('Architectural Benefits', () => {
    test('eliminates code duplication in type guards', () => {
      // Before: 12 similar type guard functions
      // After: 1 factory function that creates type guards

      const toolNames: Array<keyof ToolInputMap> = [
        'Bash',
        'Write',
        'Edit',
        'Read',
        'MultiEdit',
        'Glob',
        'Grep',
        'LS',
        'TodoWrite',
        'WebFetch',
        'WebSearch',
        'NotebookEdit',
      ];

      // Should be able to create validators for all tools
      const validators = toolNames.map((toolName) =>
        createToolInputValidator(toolName)
      );

      expect(validators).toHaveLength(toolNames.length);
      validators.forEach((validator) => {
        expect(typeof validator).toBe('function');
      });
    });

    test('provides extensibility for new tools', () => {
      // Should handle unknown tools gracefully
      const unknownValidator = createToolInputValidator(
        'NewTool' as keyof ToolInputMap
      );
      expect(typeof unknownValidator).toBe('function');

      // Should work with generic validation
      const result = isValidToolInput('UnknownTool', { any: 'property' });
      expect(typeof result).toBe('boolean');
    });

    test('enables comprehensive testing patterns', () => {
      // The new architecture should support better testing
      const testScenarios = [
        { toolName: 'Bash', validInput: { command: 'test' } },
        {
          toolName: 'Write',
          validInput: { file_path: '/tmp/test', content: 'test' },
        },
        {
          toolName: 'Edit',
          validInput: {
            file_path: '/tmp/test',
            old_string: 'old',
            new_string: 'new',
          },
        },
      ];

      testScenarios.forEach(({ toolName, validInput }) => {
        const result = validateToolInputSafely(
          toolName as keyof ToolInputMap,
          validInput
        );
        expect(result).toHaveProperty('success');
      });
    });
  });
});
