/**
 * Type Safety Enhancement Demonstration
 * Shows before/after patterns and the improvements achieved
 */

import type { ToolInput, ToolInputMap, ToolName } from '../types';
import {
  assertValidToolInput,
  isBashToolInput,
  isValidToolInput,
  parseToolInput,
  validateToolInputWithDetails,
} from '../validation-utils';

/**
 * BEFORE: Unsafe patterns that were problematic
 */
namespace UnsafePatterns {
  // ❌ Problem 1: Unsafe 'as' assertions
  export function oldParseToolInput<T extends ToolName>(
    _toolName: T,
    toolInput: Record<string, unknown>
  ) {
    // This was unsafe - no runtime validation!
    return toolInput as any;
  }

  // ❌ Problem 2: Weak type guards (property existence only)
  export function oldIsBashToolInput(
    input: ToolInput
  ): input is ToolInputMap['Bash'] {
    // Only checked property existence, not actual types
    return typeof input === 'object' && input !== null && 'command' in input;
  }

  // ❌ Problem 3: No validation of actual data types
  export function demonstrateUnsafeUsage() {
    const maliciousInput = {
      command: '', // Empty command - should fail
      timeout: 'not-a-number', // Wrong type
      maliciousScript: 'rm -rf /', // Dangerous content
    };

    // Old type guard would incorrectly pass
    const oldResult = oldIsBashToolInput(maliciousInput); // returns true!

    // Old parser would unsafely cast
    const oldParsed = oldParseToolInput('Bash', maliciousInput); // unsafe cast!

    return { oldResult, oldParsed };
  }
}

/**
 * AFTER: Type-safe patterns with comprehensive validation
 */
namespace SafePatterns {
  // ✅ Solution 1: Proper validation with runtime type checking
  export function demonstrateSafeToolInputParsing() {
    const toolInput = {
      command: 'echo "Hello, World!"',
      description: 'Safe test command',
      timeout: 5000,
    };
    // This now validates the input structure at runtime
    const validatedInput = parseToolInput('Bash', toolInput);

    return validatedInput;
  }

  // ✅ Solution 2: Deep validation in type guards
  export function demonstrateEnhancedTypeGuards() {
    const testInputs = [
      { command: 'echo test' }, // Valid
      { command: '' }, // Invalid - empty command
      { command: 123 }, // Invalid - wrong type
      { notACommand: 'test' }, // Invalid - missing required field
    ];

    const results = testInputs.map((input) => ({
      input,
      isValid: isBashToolInput(input),
    }));
    return results;
  }

  // ✅ Solution 3: Comprehensive error reporting
  export function demonstrateDetailedValidation() {
    const invalidInputs = [
      {
        toolName: 'Write' as const,
        input: {
          file_path: 'relative/path.txt', // Should be absolute
          content: 'test',
        },
      },
      {
        toolName: 'Edit' as const,
        input: {
          file_path: '/tmp/test.txt',
          old_string: '',
          new_string: 'new',
        },
      },
    ];

    const validationResults = invalidInputs.map(({ toolName, input }) => {
      const result = validateToolInputWithDetails(toolName, input);
      return {
        toolName,
        input,
        result,
      };
    });

    // Each result contains detailed error information
    validationResults.forEach(({ toolName, result }) => {
      if (!result.success) {
      }
    });

    return validationResults;
  }

  // ✅ Solution 4: Fail-fast validation with assertions
  export function demonstrateAssertionValidation() {
    const inputs = [
      { toolName: 'Bash' as const, input: { command: 'echo test' } },
      {
        toolName: 'Write' as const,
        input: { file_path: '/tmp/test.txt', content: 'test' },
      },
    ];

    inputs.forEach(({ toolName, input }) => {
      try {
        // This will throw if validation fails
        assertValidToolInput(toolName, input);
      } catch (_error) {}
    });
  }

  // ✅ Solution 5: Generic validation for any tool
  export function demonstrateGenericValidation() {
    const toolInputPairs: Array<{ toolName: ToolName; input: unknown }> = [
      { toolName: 'Bash', input: { command: 'ls -la' } },
      {
        toolName: 'Write',
        input: { file_path: '/tmp/test.txt', content: 'hello' },
      },
      { toolName: 'CustomTool', input: { customProperty: 'value' } },
      { toolName: 'Bash', input: { invalidProperty: 'wrong' } },
    ];

    const results = toolInputPairs.map(({ toolName, input }) => ({
      toolName,
      input,
      isValid: isValidToolInput(toolName, input),
    }));
    return results;
  }
}

/**
 * INTEGRATION: Demonstrates integration with existing architecture
 */
namespace IntegrationExamples {
  // ✅ Integration with context factories
  export function demonstrateContextIntegration() {
    const claudeToolInput = {
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript.md',
      cwd: '/project/root',
      hook_event_name: 'PreToolUse' as const,
      tool_name: 'Bash' as const,
      tool_input: {
        command: 'npm test',
        timeout: 30_000,
      },
    };
    const { createHookContext } = require('../context-factories');
    const context = createHookContext(claudeToolInput);

    // TypeScript guarantees proper types
    if (context.toolName === 'Bash' && context.toolInput) {
    }

    return context;
  }

  // ✅ Integration with hook execution
  export function demonstrateHookExecution() {
    // Example hook that uses enhanced validation
    return async function securityHook(context: any) {
      if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
        // Validate the tool input thoroughly
        try {
          assertValidToolInput('Bash', context.toolInput);

          // Additional security checks with validated input
          const command = context.toolInput.command;
          if (command.includes('rm -rf') || command.includes('sudo')) {
            return {
              success: false,
              message: 'Dangerous command blocked',
              block: true,
            };
          }

          return { success: true, message: 'Command approved' };
        } catch (validationError) {
          return {
            success: false,
            message: `Invalid tool input: ${validationError}`,
            block: true,
          };
        }
      }

      return { success: true };
    };
  }

  // ✅ Integration with custom validation rules
  export function demonstrateCustomValidation() {
    const customSecurityRules = {
      validateBashCommand(input: unknown): string[] {
        const errors: string[] = [];

        if (!isBashToolInput(input)) {
          errors.push('Not a valid Bash tool input');
          return errors;
        }

        // Now we can safely access properties
        const command = input.command;

        if (command.includes('rm -rf')) {
          errors.push('Dangerous rm -rf command detected');
        }

        if (command.includes('sudo') && !command.includes('--help')) {
          errors.push('Sudo commands require explicit approval');
        }

        if (input.timeout && input.timeout > 300_000) {
          errors.push('Timeout too high (max 5 minutes)');
        }

        return errors;
      },
    };

    // Test the custom validation
    const testCommands = [
      { command: 'echo hello' },
      { command: 'rm -rf /' },
      { command: 'sudo apt update' },
      { command: 'npm test', timeout: 400_000 },
    ];

    return testCommands.map((input) => ({
      input,
      errors: customSecurityRules.validateBashCommand(input),
    }));
  }
}

/**
 * PERFORMANCE: Demonstrates performance improvements
 */
namespace PerformanceExamples {
  // ✅ Cached validation schemas
  export function demonstrateValidationPerformance() {
    const startTime = performance.now();

    // Validation schemas are cached, so repeated validation is fast
    const inputs = new Array(1000).fill(null).map((_, i) => ({
      command: `echo test-${i}`,
      timeout: 1000 + i,
    }));

    const validResults = inputs.filter((input) => isBashToolInput(input));

    const endTime = performance.now();

    return {
      inputCount: inputs.length,
      validCount: validResults.length,
      duration: endTime - startTime,
    };
  }

  // ✅ Early validation prevents downstream errors
  export function demonstrateEarlyValidation() {
    const malformedInputs = [
      { command: '' }, // Empty command
      { command: 'test', timeout: 'invalid' }, // Wrong type
      { notCommand: 'test' }, // Missing required field
    ];

    const _startTime = performance.now();

    // Early validation prevents processing invalid data
    const results = malformedInputs.map((input) => {
      try {
        assertValidToolInput('Bash', input);
        return { valid: true, input };
      } catch (error) {
        return { valid: false, input, error: String(error) };
      }
    });

    const _endTime = performance.now();

    return results;
  }
}

/**
 * Export demonstration functions for testing
 */
export {
  UnsafePatterns,
  SafePatterns,
  IntegrationExamples,
  PerformanceExamples,
};
