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
} from "./auto-formatter";
// Command validation and optimization
export {
  bashCommandValidatorHook,
  VALIDATION_RULES,
  validateCommand,
} from "./bash-command-validator";
// Legacy examples (kept for backward compatibility)
// Legacy example exports removed in TS build (kept only for JS bundles)
// Git safety
export {
  GIT_DANGERS,
  GIT_WARNINGS,
  getCurrentBranch,
  gitSafetyHook,
  isProtectedBranch,
  PROTECTED_BRANCHES,
  validateGitCommand,
} from "./git-safety";
// Security enforcement
export {
  DANGEROUS_COMMANDS,
  isSensitivePath,
  PROTECTED_PATHS,
  SENSITIVE_FILES,
  securityGuardHook,
  validateBashCommand,
  validateFileOperation,
} from "./security-guard";
