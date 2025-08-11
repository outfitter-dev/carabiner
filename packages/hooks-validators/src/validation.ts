/**
 * General validation utilities for Claude Code hooks
 * Provides input validation, schema validation, and business rules
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import type { HookContext, ToolInput, ToolName } from '@claude-code/hooks-core';
import {
  isBashToolInput,
  isEditToolInput,
  isMultiEditToolInput,
  isWriteToolInput,
} from '@claude-code/hooks-core';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation rule interface
 */
export interface ValidationRule<T = unknown> {
  name: string;
  description: string;
  validate: (value: T, context?: HookContext) => boolean | Promise<boolean>;
  message: string | ((value: T, context?: HookContext) => string);
  required?: boolean;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Schema validation interface
 */
export interface ValidationSchema {
  [key: string]: ValidationRule<unknown> | ValidationRule<unknown>[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field?: string;
    message: string;
    code?: string;
    severity?: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  /**
   * Required field validation
   */
  required(fieldName: string): ValidationRule<unknown> {
    return {
      name: 'required',
      description: `${fieldName} is required`,
      validate: (value) =>
        value !== null && value !== undefined && value !== '',
      message: `${fieldName} is required`,
      required: true,
      severity: 'error',
    };
  },

  /**
   * String length validation
   */
  minLength(min: number): ValidationRule<unknown> {
    return {
      name: 'minLength',
      description: `Minimum length of ${min}`,
      validate: (value) => typeof value === 'string' && value.length >= min,
      message: `Must be at least ${min} characters long`,
      severity: 'error',
    };
  },

  maxLength(max: number): ValidationRule<unknown> {
    return {
      name: 'maxLength',
      description: `Maximum length of ${max}`,
      validate: (value) => typeof value === 'string' && value.length <= max,
      message: `Must be no more than ${max} characters long`,
      severity: 'error',
    };
  },

  /**
   * Pattern validation
   */
  pattern(regex: RegExp, message?: string): ValidationRule<unknown> {
    return {
      name: 'pattern',
      description: `Must match pattern ${regex}`,
      validate: (value) => typeof value === 'string' && regex.test(value),
      message: message || 'Must match required pattern',
      severity: 'error',
    };
  },

  /**
   * File path validation
   */
  validFilePath(allowNonExistent = false): ValidationRule<unknown> {
    return {
      name: 'validFilePath',
      description: 'Must be a valid file path',
      validate: (value, context) => {
        if (typeof value !== 'string') {
          return false;
        }

        try {
          const fullPath = context
            ? resolve(context.cwd, value)
            : resolve(value);
          return allowNonExistent || existsSync(fullPath);
        } catch {
          return false;
        }
      },
      message: allowNonExistent ? 'Invalid file path' : 'File does not exist',
      severity: 'error',
    };
  },

  /**
   * File extension validation
   */
  fileExtension(extensions: string[]): ValidationRule<unknown> {
    return {
      name: 'fileExtension',
      description: `Must have extension: ${extensions.join(', ')}`,
      validate: (value) => {
        if (typeof value !== 'string') {
          return false;
        }
        const ext = extname(value);
        return extensions.includes(ext);
      },
      message: `File must have one of these extensions: ${extensions.join(', ')}`,
      severity: 'error',
    };
  },

  /**
   * Number validation
   */
  number(min?: number, max?: number): ValidationRule<unknown> {
    return {
      name: 'number',
      description: `Must be a number${min !== undefined ? ` >= ${min}` : ''}${max !== undefined ? ` <= ${max}` : ''}`,
      validate: (value) => {
        const num = typeof value === 'string' ? Number(value) : value;
        if (typeof num !== 'number' || Number.isNaN(num)) {
          return false;
        }
        if (min !== undefined && num < min) {
          return false;
        }
        if (max !== undefined && num > max) {
          return false;
        }
        return true;
      },
      message: (value) => {
        const num = typeof value === 'string' ? Number(value) : value;
        if (typeof num !== 'number' || Number.isNaN(num)) {
          return 'Must be a valid number';
        }
        if (min !== undefined && num < min) {
          return `Must be at least ${min}`;
        }
        if (max !== undefined && num > max) {
          return `Must be at most ${max}`;
        }
        return 'Invalid number';
      },
      severity: 'error',
    };
  },

  /**
   * Array validation
   */
  array(minItems?: number, maxItems?: number): ValidationRule<unknown> {
    return {
      name: 'array',
      description: `Must be an array${minItems ? ` with at least ${minItems} items` : ''}${maxItems ? ` with at most ${maxItems} items` : ''}`,
      validate: (value) => {
        if (!Array.isArray(value)) {
          return false;
        }
        if (minItems !== undefined && value.length < minItems) {
          return false;
        }
        if (maxItems !== undefined && value.length > maxItems) {
          return false;
        }
        return true;
      },
      message: (value) => {
        if (!Array.isArray(value)) {
          return 'Must be an array';
        }
        if (minItems !== undefined && value.length < minItems) {
          return `Must have at least ${minItems} items`;
        }
        if (maxItems !== undefined && value.length > maxItems) {
          return `Must have at most ${maxItems} items`;
        }
        return 'Invalid array';
      },
      severity: 'error',
    };
  },

  /**
   * Boolean validation
   */
  boolean(): ValidationRule<unknown> {
    return {
      name: 'boolean',
      description: 'Must be a boolean value',
      validate: (value) => typeof value === 'boolean',
      message: 'Must be true or false',
      severity: 'error',
    };
  },

  /**
   * Custom validation rule
   */
  custom<T = unknown>(
    validate: (value: T, context?: HookContext) => boolean | Promise<boolean>,
    message: string | ((value: T, context?: HookContext) => string)
  ): ValidationRule<T> {
    return {
      name: 'custom',
      description: 'Custom validation rule',
      validate,
      message,
      severity: 'error',
    };
  },
};

/**
 * Tool-specific validation schemas
 */
export const ToolSchemas = {
  Bash: {
    command: [
      ValidationRules.required('command'),
      ValidationRules.minLength(1),
      ValidationRules.maxLength(10_000),
    ],
    timeout: ValidationRules.number(100, 300_000),
    description: ValidationRules.maxLength(500),
  } satisfies ValidationSchema,

  Write: {
    file_path: [
      ValidationRules.required('file_path'),
      ValidationRules.validFilePath(true),
    ],
    content: [
      ValidationRules.required('content'),
      ValidationRules.maxLength(1_000_000), // 1MB limit
    ],
  } satisfies ValidationSchema,

  Edit: {
    file_path: [
      ValidationRules.required('file_path'),
      ValidationRules.validFilePath(),
    ],
    old_string: [
      ValidationRules.required('old_string'),
      ValidationRules.minLength(1),
    ],
    new_string: ValidationRules.required('new_string'),
    replace_all: ValidationRules.boolean(),
  } satisfies ValidationSchema,

  MultiEdit: {
    file_path: [
      ValidationRules.required('file_path'),
      ValidationRules.validFilePath(),
    ],
    edits: [ValidationRules.required('edits'), ValidationRules.array(1, 50)],
  } satisfies ValidationSchema,

  Read: {
    file_path: [
      ValidationRules.required('file_path'),
      ValidationRules.validFilePath(),
    ],
    limit: ValidationRules.number(1, 10_000),
    offset: ValidationRules.number(0),
  } satisfies ValidationSchema,

  Glob: {
    pattern: [
      ValidationRules.required('pattern'),
      ValidationRules.minLength(1),
    ],
    path: ValidationRules.validFilePath(),
  } satisfies ValidationSchema,

  Grep: {
    pattern: [
      ValidationRules.required('pattern'),
      ValidationRules.minLength(1),
    ],
    path: ValidationRules.validFilePath(),
    glob: ValidationRules.minLength(1),
    output_mode: ValidationRules.custom(
      (value) =>
        !value ||
        ['content', 'files_with_matches', 'count'].includes(value as string),
      'Must be one of: content, files_with_matches, count'
    ),
    head_limit: ValidationRules.number(1, 10_000),
    multiline: ValidationRules.boolean(),
  } satisfies ValidationSchema,
};

/**
 * Validate a single value against a rule
 */
export async function validateRule<T>(
  rule: ValidationRule<T>,
  value: T,
  context?: HookContext
): Promise<{ valid: boolean; message?: string }> {
  try {
    const isValid = await Promise.resolve(rule.validate(value, context));

    if (!isValid) {
      const message =
        typeof rule.message === 'function'
          ? rule.message(value, context)
          : rule.message;

      return { valid: false, message };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate an object against a schema
 */
/**
 * Validate a single field against its rules
 */
async function validateSingleField(
  fieldName: string,
  fieldValue: unknown,
  rules: ValidationRule | ValidationRule[],
  context?: HookContext
): Promise<{
  errors: ValidationResult['errors'];
  warnings: ValidationResult['warnings'];
}> {
  const fieldRules = Array.isArray(rules) ? rules : [rules];
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  for (const rule of fieldRules) {
    const result = await validateRule(rule, fieldValue, context);

    if (!result.valid) {
      const error = createValidationError(fieldName, rule, result.message);

      if (error.severity === 'warning') {
        warnings.push(error);
      } else {
        errors.push(error);
      }

      // Early exit for required field errors
      if (rule.required && error.severity === 'error') {
        break;
      }
    }
  }

  return { errors, warnings };
}

/**
 * Create a validation error object
 */
function createValidationError(
  fieldName: string,
  rule: ValidationRule<unknown>,
  message?: string
): ValidationResult['errors'][0] {
  return {
    field: fieldName,
    message: message || 'Validation failed',
    code: rule.name,
    severity: rule.severity || 'error',
  };
}

/**
 * Validate an object against a schema
 */
export async function validateSchema(
  data: Record<string, unknown>,
  schema: ValidationSchema,
  context?: HookContext
): Promise<ValidationResult> {
  const allErrors: ValidationResult['errors'] = [];
  const allWarnings: ValidationResult['warnings'] = [];

  for (const [fieldName, rules] of Object.entries(schema)) {
    const fieldValue = data[fieldName];
    const { errors, warnings } = await validateSingleField(
      fieldName,
      fieldValue,
      rules,
      context
    );

    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Validate tool input based on tool name
 */
export async function validateToolInput(
  toolName: ToolName,
  input: ToolInput,
  context?: HookContext
): Promise<ValidationResult> {
  // Get schema for the tool
  const schema = ToolSchemas[toolName as keyof typeof ToolSchemas];

  if (!schema) {
    return {
      valid: true,
      errors: [],
      warnings: [
        {
          message: `No validation schema available for tool: ${toolName}`,
          code: 'no_schema',
        },
      ],
    };
  }

  // Validate input against schema
  const result = await validateSchema(
    input as Record<string, unknown>,
    schema,
    context
  );

  // Additional tool-specific validation
  await performToolSpecificValidation(toolName, input, result, context);

  return result;
}

/**
 * Perform additional tool-specific validation
 */
async function performToolSpecificValidation(
  toolName: ToolName,
  input: ToolInput,
  result: ValidationResult,
  context?: HookContext
): Promise<void> {
  switch (toolName) {
    case 'Write':
      if (isWriteToolInput(input)) {
        await validateWriteOperation(input, result, context);
      }
      break;

    case 'Edit':
      if (isEditToolInput(input)) {
        await validateEditOperation(input, result, context);
      }
      break;

    case 'MultiEdit':
      if (isMultiEditToolInput(input)) {
        await validateMultiEditOperation(input, result, context);
      }
      break;

    case 'Bash':
      if (isBashToolInput(input)) {
        await validateBashOperation(input, result, context);
      }
      break;

    default: {
      // Exhaustive check to ensure all tool types are handled
      const _exhaustiveCheck: never = toolName;
      throw new Error(`Unhandled tool type: ${String(_exhaustiveCheck)}`);
    }
  }
}

/**
 * Validate Write tool operation
 */
async function validateWriteOperation(
  input: { file_path: string; content: string },
  result: ValidationResult,
  context?: HookContext
): Promise<void> {
  const { file_path, content } = input;

  // Check if overwriting existing file
  try {
    const fullPath = context
      ? resolve(context.cwd, file_path)
      : resolve(file_path);

    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        result.errors.push({
          field: 'file_path',
          message: 'Cannot write to a directory',
          code: 'is_directory',
          severity: 'error',
        });
      }

      // Warn about overwriting large files
      if (stats.size > 100_000) {
        // 100KB
        result.warnings.push({
          field: 'file_path',
          message: 'Overwriting large file (>100KB)',
          code: 'large_file_overwrite',
        });
      }
    }

    // Check parent directory exists
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      result.errors.push({
        field: 'file_path',
        message: 'Parent directory does not exist',
        code: 'parent_missing',
        severity: 'error',
      });
    }

    // Validate file extension matches content type
    const ext = extname(file_path);
    if (ext === '.json') {
      try {
        JSON.parse(content);
      } catch {
        result.warnings.push({
          field: 'content',
          message: 'Content is not valid JSON for .json file',
          code: 'invalid_json',
        });
      }
    }
  } catch (error) {
    result.errors.push({
      field: 'file_path',
      message: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'validation_error',
      severity: 'error',
    });
  }
}

/**
 * Validate Edit tool operation
 */
async function validateEditOperation(
  input: {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  },
  result: ValidationResult,
  context?: HookContext
): Promise<void> {
  const { file_path, old_string, new_string } = input;

  // Check if file exists and is readable
  try {
    const fullPath = context
      ? resolve(context.cwd, file_path)
      : resolve(file_path);

    if (!existsSync(fullPath)) {
      result.errors.push({
        field: 'file_path',
        message: 'File does not exist',
        code: 'file_not_found',
        severity: 'error',
      });
      return;
    }

    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      result.errors.push({
        field: 'file_path',
        message: 'Cannot edit a directory',
        code: 'is_directory',
        severity: 'error',
      });
      return;
    }

    // Warn about editing large files
    if (stats.size > 1_000_000) {
      // 1MB
      result.warnings.push({
        field: 'file_path',
        message: 'Editing large file (>1MB)',
        code: 'large_file_edit',
      });
    }

    // Validate strings are not identical (no-op)
    if (old_string === new_string) {
      result.warnings.push({
        message: 'Old and new strings are identical - no change will occur',
        code: 'no_change',
      });
    }

    // Check for potentially problematic replacements
    if (old_string.length > 10_000 || new_string.length > 10_000) {
      result.warnings.push({
        message: 'Very large replacement strings detected',
        code: 'large_replacement',
      });
    }
  } catch (error) {
    result.errors.push({
      field: 'file_path',
      message: `Edit validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'validation_error',
      severity: 'error',
    });
  }
}

/**
 * Validate MultiEdit tool operation
 */
async function validateMultiEditOperation(
  input: {
    file_path: string;
    edits: Array<{
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    }>;
  },
  result: ValidationResult,
  _context?: HookContext
): Promise<void> {
  // Validate each edit
  for (let i = 0; i < input.edits.length; i++) {
    const edit = input.edits[i];

    if (!edit) {
      continue;
    }

    if (!edit.old_string) {
      result.errors.push({
        field: `edits[${i}].old_string`,
        message: 'old_string is required for each edit',
        code: 'required',
        severity: 'error',
      });
    }

    if (
      edit.old_string &&
      edit.new_string &&
      edit.old_string === edit.new_string
    ) {
      result.warnings.push({
        field: `edits[${i}]`,
        message: `Edit ${i}: old and new strings are identical`,
        code: 'no_change',
      });
    }
  }

  // Check for duplicate edits
  const editStrings = input.edits.map((e) => e.old_string);
  const duplicates = editStrings.filter(
    (item, index) => editStrings.indexOf(item) !== index
  );

  if (duplicates.length > 0) {
    result.warnings.push({
      field: 'edits',
      message:
        'Duplicate edit strings detected - may cause unexpected behavior',
      code: 'duplicate_edits',
    });
  }
}

/**
 * Validate Bash tool operation
 */
async function validateBashOperation(
  input: { command: string; timeout?: number },
  result: ValidationResult,
  _context?: HookContext
): Promise<void> {
  const { command, timeout } = input;

  // Basic command validation
  if (command.trim() !== command) {
    result.warnings.push({
      field: 'command',
      message: 'Command has leading/trailing whitespace',
      code: 'whitespace_command',
    });
  }

  // Check for common command issues
  if (command.includes('&&') && command.includes('||')) {
    result.warnings.push({
      field: 'command',
      message: 'Command contains both && and || operators - verify precedence',
      code: 'complex_logic',
    });
  }

  // Validate timeout
  if (timeout !== undefined && timeout < 1000) {
    result.warnings.push({
      field: 'timeout',
      message: 'Very short timeout (<1s) may cause premature termination',
      code: 'short_timeout',
    });
  }
}

/**
 * Create a validator function for a specific tool
 */
export function createToolValidator(toolName: ToolName) {
  return async (
    input: ToolInput,
    context?: HookContext
  ): Promise<ValidationResult> => {
    return validateToolInput(toolName, input, context);
  };
}

/**
 * Validate hook context comprehensively
 */
export async function validateHookContext(
  context: HookContext
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validate required context fields
  if (!context.event) {
    result.errors.push({
      field: 'event',
      message: 'Hook event is required',
      code: 'required',
      severity: 'error',
    });
  }

  if (!context.sessionId) {
    result.errors.push({
      field: 'sessionId',
      message: 'Session ID is required',
      code: 'required',
      severity: 'error',
    });
  }

  if (!context.cwd) {
    result.errors.push({
      field: 'cwd',
      message: 'Working directory is required',
      code: 'required',
      severity: 'error',
    });
  } else if (!existsSync(context.cwd)) {
    result.warnings.push({
      field: 'cwd',
      message: 'Working directory does not exist',
      code: 'path_missing',
    });
  }

  // Validate tool input if present
  if (context.toolInput && context.toolName) {
    const toolValidation = await validateToolInput(
      context.toolName,
      context.toolInput,
      context
    );

    result.errors.push(...toolValidation.errors);
    result.warnings.push(...toolValidation.warnings);
  }

  result.valid = result.errors.length === 0;
  return result;
}
