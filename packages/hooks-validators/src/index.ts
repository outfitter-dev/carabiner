/**
 * @claude-code/hooks-validators
 * Security and validation utilities for Claude Code hooks
 */

export type {
  SecurityOptions,
  SecurityRuleConfig,
} from './security';
// Export security validation
export {
  createSecurityValidator,
  SecurityValidationError,
  SecurityValidators,
  validateBashCommand,
  validateFileContent,
  validateFilePath,
  validateHookSecurity,
} from './security';
export type {
  ValidationResult,
  ValidationRule,
  ValidationSchema,
} from './validation';
// Export general validation
export {
  createToolValidator,
  ToolSchemas,
  ValidationError,
  ValidationRules,
  validateHookContext,
  validateRule,
  validateSchema,
  validateToolInput,
} from './validation';

// Version export
export const VERSION = '0.1.0';
