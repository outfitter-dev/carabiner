/**
 * @carabiner/hooks-examples
 *
 * Production-ready example hooks for Claude Code
 *
 * These examples demonstrate best practices for building hooks:
 * - Security validation
 * - Performance optimization
 * - Code quality enforcement
 * - Workflow automation
 */

// Auto formatting
export {
  autoFormatterHook,
  FORMATTERS,
  findFormatter,
  formatFile,
  isFormatterAvailable,
} from './auto-formatter.js';
// Command validation and optimization
export {
  bashCommandValidatorHook,
  VALIDATION_RULES,
  validateCommand,
} from './bash-command-validator.js';
// Legacy examples (kept for backward compatibility)
export * from './builder/simple-security.js';
export * from './declarative/security-rules.js';
export * from './function-based/security-hook.js';
// Git safety
export {
  GIT_DANGERS,
  GIT_WARNINGS,
  getCurrentBranch,
  gitSafetyHook,
  isProtectedBranch,
  PROTECTED_BRANCHES,
  validateGitCommand,
} from './git-safety.js';
// Security enforcement
export {
  DANGEROUS_COMMANDS,
  isSensitivePath,
  PROTECTED_PATHS,
  SENSITIVE_FILES,
  securityGuardHook,
  validateBashCommand,
  validateFileOperation,
} from './security-guard.js';
export * from './testing/hook-tests.test.js';
