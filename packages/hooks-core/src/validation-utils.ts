/**
 * Type-safe validation utilities for Claude Code hooks
 * Centralized validation logic using Zod schemas from @outfitter/schemas
 *
 * This module provides:
 * - Runtime type validation that eliminates 'as' assertions
 * - Deep validation beyond property existence checking
 * - Integration with existing Zod schemas
 * - Clear error messages for validation failures
 * - Type guards with actual validation logic
 */

// Import schemas from the local schemas package
import { safeValidateToolInput, toolInputSchemas } from '@outfitter/schemas';
import type { GetToolInput, ToolInputMap, ToolName } from './types';

/**
 * Validation result type for detailed error reporting
 */
export type ToolInputValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
      issues?: string[];
    };

/**
 * Type-safe tool input parsing using Zod schemas
 * Eliminates unsafe 'as' assertions with proper runtime validation
 */
export function parseToolInput<T extends ToolName>(
  toolName: T,
  toolInput: Record<string, unknown>
): GetToolInput<T> {
  // Check if we have a schema for this tool
  if (!(toolName in toolInputSchemas)) {
    // Fallback to unsafe parsing if schema not available
    // This maintains backward compatibility
    return toolInput as GetToolInput<T>;
  }

  // Use the safe validation function from the schemas package
  const result = safeValidateToolInput(
    toolName as keyof typeof toolInputSchemas,
    toolInput
  );

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid ${toolName} tool input: ${errorDetails}`);
  }

  return result.data as GetToolInput<T>;
}

/**
 * Generic tool input validator factory using Zod schemas
 * Eliminates repetitive type guard patterns with a unified approach
 */
export function createToolInputValidator<T extends keyof ToolInputMap>(
  toolName: T
): (input: unknown) => input is ToolInputMap[T] {
  return (input: unknown): input is ToolInputMap[T] => {
    if (!(toolName in toolInputSchemas)) {
      return false;
    }

    const result = safeValidateToolInput(
      toolName as keyof typeof toolInputSchemas,
      input
    );
    return result.success;
  };
}

/**
 * Enhanced type guards using actual Zod validation
 * These replace the basic property existence checks
 */

export const isBashToolInput = createToolInputValidator('Bash');
export const isWriteToolInput = createToolInputValidator('Write');
export const isEditToolInput = createToolInputValidator('Edit');
export const isReadToolInput = createToolInputValidator('Read');
export const isMultiEditToolInput = createToolInputValidator('MultiEdit');
export const isGlobToolInput = createToolInputValidator('Glob');
export const isGrepToolInput = createToolInputValidator('Grep');
export const isLSToolInput = createToolInputValidator('LS');
export const isTodoWriteToolInput = createToolInputValidator('TodoWrite');
export const isWebFetchToolInput = createToolInputValidator('WebFetch');
export const isWebSearchToolInput = createToolInputValidator('WebSearch');
export const isNotebookEditToolInput = createToolInputValidator('NotebookEdit');

/**
 * Generic validation function for any tool
 */
export function isValidToolInput<T extends ToolName>(
  toolName: T,
  input: unknown
): input is T extends keyof ToolInputMap ? ToolInputMap[T] : unknown {
  if (!(toolName in toolInputSchemas)) {
    return false;
  }

  const result = safeValidateToolInput(
    toolName as keyof typeof toolInputSchemas,
    input
  );
  return result.success;
}

/**
 * Detailed validation with comprehensive error reporting
 */
export function validateToolInputWithDetails<T extends ToolName>(
  toolName: T,
  input: unknown
): ToolInputValidationResult<GetToolInput<T>> {
  if (!(toolName in toolInputSchemas)) {
    return {
      success: false,
      error: `No validation schema found for tool: ${toolName}`,
    };
  }

  const result = safeValidateToolInput(
    toolName as keyof typeof toolInputSchemas,
    input
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', '),
      issues: result.error.issues.map((issue) => issue.message),
    };
  }

  return {
    success: true,
    data: result.data as GetToolInput<T>,
  };
}

/**
 * Assertion-style validation that throws on failure
 */
export function assertValidToolInput<T extends ToolName>(
  toolName: T,
  input: unknown
): asserts input is GetToolInput<T> {
  const result = validateToolInputWithDetails(toolName, input);

  if (!result.success) {
    throw new Error(`Invalid ${toolName} tool input: ${result.error}`);
  }
}

/**
 * Batch validation for multiple tool inputs
 */
export function validateMultipleToolInputs(
  validations: Array<{ toolName: ToolName; input: unknown }>
): ToolInputValidationResult<unknown>[] {
  return validations.map(({ toolName, input }) =>
    validateToolInputWithDetails(toolName, input)
  );
}

/**
 * Feature detection utilities
 */

/**
 * Check if validation schema is available for a tool
 */
export function hasValidationSchemaForTool(toolName: ToolName): boolean {
  return toolName in toolInputSchemas;
}

/**
 * Get list of tools with validation schemas
 */
export function getSupportedToolNames(): ToolName[] {
  return Object.keys(toolInputSchemas) as ToolName[];
}

/**
 * Get validation schema for a specific tool
 */
export function getValidationSchemaForTool(toolName: ToolName) {
  return toolInputSchemas[toolName as keyof typeof toolInputSchemas];
}

/**
 * Performance optimization: cached validators
 */
const validatorCache = new Map<ToolName, (input: unknown) => boolean>();

/**
 * Get cached validator for better performance in hot paths
 */
export function getCachedValidator(
  toolName: ToolName
): (input: unknown) => boolean {
  const cached = validatorCache.get(toolName);
  if (cached) {
    return cached;
  }

  const validator = (input: unknown): boolean => {
    return isValidToolInput(toolName, input);
  };

  validatorCache.set(toolName, validator);
  return validator;
}

/**
 * Clear validator cache (useful for testing)
 */
export function clearValidatorCache(): void {
  validatorCache.clear();
}

/**
 * Utility for safe parsing with result objects
 */
export function safeParseToolInput<T extends ToolName>(
  toolName: T,
  input: unknown
):
  | { success: true; data: GetToolInput<T> }
  | { success: false; error: string } {
  try {
    const data = parseToolInput(toolName, input as Record<string, unknown>);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}
