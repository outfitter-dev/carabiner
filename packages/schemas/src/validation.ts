/**
 * Main validation utilities for Claude Code hooks
 * Combines Zod schemas with branded type validation
 */

import type { ToolName } from '@outfitter/types';
import {
  BrandValidationError,
  createDirectoryPath,
  createSessionId,
  createTranscriptPath,
} from '@outfitter/types';
import type { z } from 'zod';
import { type ClaudeHookInput, safeParseClaudeHookInput } from './input.js';
import { safeValidateToolInput, toolInputSchemas } from './tools.js';

/**
 * Validation error with detailed information
 */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly issues: string[],
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  static fromZodError(error: z.ZodError, context = 'input'): ValidationError {
    const issues = error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });

    return new ValidationError(
      context,
      undefined, // ZodError doesn't have input property
      issues,
      `Validation failed for ${context}: ${issues.join('; ')}`
    );
  }
}

/**
 * Complete input validation result
 */
export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ValidationError | BrandValidationError;
}

/**
 * Validated and branded Claude hook input
 */
export interface ValidatedClaudeInput {
  readonly original: ClaudeHookInput;
  readonly sessionId: import('@outfitter/types').SessionId;
  readonly transcriptPath: import('@outfitter/types').TranscriptPath;
  readonly cwd: import('@outfitter/types').DirectoryPath;
  readonly event: import('@outfitter/types').HookEvent;
  readonly matcher?: string;
}

/**
 * Main validation function - validates and brands input
 */
export function validateClaudeInput(
  input: unknown
): ValidationResult<ValidatedClaudeInput> {
  try {
    // First validate the schema
    const schemaResult = safeParseClaudeHookInput(input);
    if (!schemaResult.success) {
      return {
        success: false,
        error: ValidationError.fromZodError(
          schemaResult.error,
          'Claude hook input'
        ),
      };
    }

    const parsed = schemaResult.data;

    // Then create branded types
    const sessionId = createSessionId(parsed.session_id);
    const transcriptPath = createTranscriptPath(parsed.transcript_path);
    const cwd = createDirectoryPath(parsed.cwd);

    return {
      success: true,
      data: {
        original: parsed,
        sessionId,
        transcriptPath,
        cwd,
        event: parsed.hook_event_name,
        matcher: parsed.matcher,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof BrandValidationError
          ? error
          : new ValidationError(
              'unknown',
              input,
              [String(error)],
              'Unknown validation error'
            ),
    };
  }
}

/**
 * Validate tool input for specific tool
 */
export function validateToolInputForTool<
  T extends keyof typeof toolInputSchemas,
>(
  toolName: T,
  input: unknown
): ValidationResult<(typeof toolInputSchemas)[T]['_output']> {
  try {
    const result = safeValidateToolInput(toolName, input);
    if (!result.success) {
      return {
        success: false,
        error: ValidationError.fromZodError(
          result.error,
          `${toolName} tool input`
        ),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: new ValidationError(
        'tool_input',
        input,
        [String(error)],
        `Failed to validate ${toolName} tool input`
      ),
    };
  }
}

/**
 * Generic tool input validation (for unknown tools)
 */
export function validateGenericToolInput(
  input: unknown
): ValidationResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null) {
    return {
      success: false,
      error: new ValidationError(
        'tool_input',
        input,
        ['Must be an object'],
        'Tool input must be an object'
      ),
    };
  }

  return {
    success: true,
    data: input as Record<string, unknown>,
  };
}

/**
 * Combined validation for complete hook input
 */
export interface CompleteValidationResult {
  readonly success: boolean;
  readonly claudeInput?: ValidatedClaudeInput;
  readonly toolInput?: unknown;
  readonly errors: (ValidationError | BrandValidationError)[];
}

export function validateCompleteHookInput(
  input: unknown
): CompleteValidationResult {
  const errors: (ValidationError | BrandValidationError)[] = [];

  // Validate main input structure
  const mainInputResult = validateMainInput(input);
  if (!mainInputResult.claudeInput) {
    errors.push(mainInputResult.error!);
    return buildCompleteValidationResult(undefined, undefined, errors);
  }

  // Validate tool input if present
  const toolInputResult = validateToolInputIfPresent(
    mainInputResult.claudeInput
  );
  if (toolInputResult.error) {
    errors.push(toolInputResult.error);
  }

  return buildCompleteValidationResult(
    mainInputResult.claudeInput,
    toolInputResult.toolInput,
    errors
  );
}

/**
 * Validate main Claude input
 */
function validateMainInput(input: unknown): {
  claudeInput?: ValidatedClaudeInput;
  error?: ValidationError | BrandValidationError;
} {
  const result = validateClaudeInput(input);
  return {
    claudeInput: result.data,
    error: result.error,
  };
}

/**
 * Validate tool input if present in Claude input
 */
function validateToolInputIfPresent(claudeInput: ValidatedClaudeInput): {
  toolInput?: unknown;
  error?: ValidationError | BrandValidationError;
} {
  const original = claudeInput.original;

  if (!('tool_name' in original && 'tool_input' in original)) {
    return {};
  }

  const toolName = original.tool_name as ToolName;

  if (toolName in toolInputSchemas) {
    return validateKnownToolInput(toolName, original.tool_input);
  }

  return validateUnknownToolInput(original.tool_input);
}

/**
 * Validate input for known tool
 */
function validateKnownToolInput(
  toolName: ToolName,
  toolInput: unknown
): {
  toolInput?: unknown;
  error?: ValidationError | BrandValidationError;
} {
  const result = validateToolInputForTool(
    toolName as keyof typeof toolInputSchemas,
    toolInput
  );
  return {
    toolInput: result.data,
    error: result.error,
  };
}

/**
 * Validate input for unknown tool
 */
function validateUnknownToolInput(toolInput: unknown): {
  toolInput?: unknown;
  error?: ValidationError | BrandValidationError;
} {
  const result = validateGenericToolInput(toolInput);
  return {
    toolInput: result.data,
    error: result.error,
  };
}

/**
 * Build complete validation result
 */
function buildCompleteValidationResult(
  claudeInput?: ValidatedClaudeInput,
  toolInput?: unknown,
  errors: (ValidationError | BrandValidationError)[] = []
): CompleteValidationResult {
  return {
    success: errors.length === 0,
    claudeInput,
    toolInput,
    errors,
  };
}

/**
 * Validation utilities for common patterns
 */
export const ValidationUtils = {
  /**
   * Check if input is valid without throwing
   */
  isValid: (input: unknown): boolean => {
    return validateClaudeInput(input).success;
  },

  /**
   * Get validation errors without throwing
   */
  getErrors: (input: unknown): string[] => {
    const result = validateClaudeInput(input);
    if (result.success) {
      return [];
    }
    if (!result.error) {
      return ['Unknown error'];
    }

    if (result.error instanceof ValidationError) {
      return result.error.issues;
    }
    if (result.error instanceof BrandValidationError) {
      return [result.error.message];
    }
    return ['Unknown error'];
  },

  /**
   * Validate with custom error handler
   */
  validateWithHandler: <T>(
    input: unknown,
    onError: (error: ValidationError | BrandValidationError) => T
  ): ValidatedClaudeInput | T => {
    const result = validateClaudeInput(input);
    if (!result.success) {
      return onError(result.error!);
    }
    return result.data!;
  },

  /**
   * Batch validate multiple inputs
   */
  validateBatch: (
    inputs: unknown[]
  ): ValidationResult<ValidatedClaudeInput>[] => {
    return inputs.map(validateClaudeInput);
  },
} as const;
