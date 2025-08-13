/**
 * Validator template
 */

import { pascalCase } from '../../utils/case-conversion.js';

export const validatorTypeScript = (name: string): string => `/**
 * Custom validator: ${name}
 */

import type { HookContext, ValidationResult } from '@outfitter/hooks-core';
import { ValidationError } from '@outfitter/hooks-validators';

const SESSION_ID_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * ${pascalCase(name)} validator
 */
export class ${pascalCase(name)}Validator {
  /**
   * Validate hook context
   */
  static async validate(context: HookContext): Promise<ValidationResult> {
    const errors: Array<{ field?: string; message: string; code?: string }> = [];
    const warnings: Array<{ field?: string; message: string; code?: string }> = [];

    try {
      // Add your validation logic here
      await this.performValidation(context, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Validation error',
        code: 'VALIDATION_ERROR'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Perform the actual validation
   */
  private static async performValidation(
    context: HookContext,
    errors: Array<{ field?: string; message: string; code?: string }>,
    warnings: Array<{ field?: string; message: string; code?: string }>
  ): Promise<void> {
    // Example validation: Check session ID format
    if (!SESSION_ID_REGEX.test(context.sessionId)) {
      errors.push({
        field: 'sessionId',
        message: 'Session ID must be alphanumeric with dashes only',
        code: 'INVALID_SESSION_ID'
      });
    }

    // Example warning: Check workspace path length
    if (context.workspacePath.length > 200) {
      warnings.push({
        field: 'workspacePath',
        message: 'Workspace path is very long',
        code: 'LONG_WORKSPACE_PATH'
      });
    }

    // Add more validation logic as needed
  }

  /**
   * Quick validation that throws on error
   */
  static async validateOrThrow(context: HookContext): Promise<void> {
    const result = await this.validate(context);
    if (!result.valid) {
      throw new ValidationError(
        result.errors.map(e => e.message).join(', ')
      );
    }
  }
}

export default ${pascalCase(name)}Validator;
`;

export const validatorJavaScript = (name: string): string => `/**
 * Custom validator: ${name}
 */

const { ValidationError } = require('@outfitter/hooks-validators');

const SESSION_ID_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * ${pascalCase(name)} validator
 */
class ${pascalCase(name)}Validator {
  /**
   * Validate hook context
   */
  static async validate(context) {
    const errors = [];
    const warnings = [];

    try {
      // Add your validation logic here
      await this.performValidation(context, errors, warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Validation error',
        code: 'VALIDATION_ERROR'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Perform the actual validation
   */
  static async performValidation(context, errors, warnings) {
    // Example validation: Check session ID format
    if (!SESSION_ID_REGEX.test(context.sessionId)) {
      errors.push({
        field: 'sessionId',
        message: 'Session ID must be alphanumeric with dashes only',
        code: 'INVALID_SESSION_ID'
      });
    }

    // Example warning: Check workspace path length
    if (context.workspacePath.length > 200) {
      warnings.push({
        field: 'workspacePath',
        message: 'Workspace path is very long',
        code: 'LONG_WORKSPACE_PATH'
      });
    }

    // Add more validation logic as needed
  }

  /**
   * Quick validation that throws on error
   */
  static async validateOrThrow(context) {
    const result = await this.validate(context);
    if (!result.valid) {
      throw new ValidationError(
        result.errors.map(e => e.message).join(', ')
      );
    }
  }
}

module.exports = { ${pascalCase(name)}Validator };
`;
