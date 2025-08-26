/**
 * Security module for Claude Code hooks
 * Provides comprehensive security validation and protection mechanisms
 */

import { CommandValidator } from './command-validator';
// Local imports for use in this module's implementations
import { createWorkspaceValidator } from './workspace-validator';

// Re-export security validation error for convenience
export { SecurityValidationError } from '@carabiner/hooks-validators';

// Command validation
export {
  type CommandSecurityConfig,
  CommandValidator,
  createSecureCommand,
  DEFAULT_COMMAND_CONFIG,
  validateCommand,
  validateHookCommand,
} from './command-validator';
// Workspace validation
export {
  createWorkspaceValidator,
  DEFAULT_WORKSPACE_CONFIG,
  sanitizeUserPath,
  validateWorkspacePath,
  type WorkspaceSecurityConfig,
  WorkspaceValidator,
} from './workspace-validator';

/**
 * Security utilities for common operations
 */
export const Security = {
  /**
   * Create a secure workspace validator with production defaults
   */
  createProductionValidator(workspacePath: string) {
    return createWorkspaceValidator(workspacePath, {
      strictMode: true,
      maxDepth: 8,
      maxFileSize: 5 * 1024 * 1024, // 5MB
    });
  },

  /**
   * Create a secure command validator for production
   */
  createProductionCommandValidator() {
    return CommandValidator.forEnvironment('production', true);
  },

  /**
   * Validate both workspace path and command for complete security
   */
  validateOperation(
    workspacePath: string,
    filePath: string | undefined,
    command: string | undefined
  ): { validatedWorkspace: string; validatedFile?: string } {
    // Validate workspace
    const workspaceValidator = this.createProductionValidator(workspacePath);
    const validatedWorkspace = workspaceValidator.getWorkspaceRoot();

    // Validate file path if provided
    let validatedFile: string | undefined;
    if (filePath) {
      validatedFile = workspaceValidator.validateFilePath(filePath);
    }

    // Validate command if provided
    if (command) {
      const commandValidator = this.createProductionCommandValidator();
      commandValidator.validateCommand(command);
    }

    return { validatedWorkspace, validatedFile };
  },

  /**
   * Security audit function for checking current configuration
   */
  auditConfiguration(config: unknown): {
    passed: boolean;
    issues: Array<{ severity: string; rule: string; message: string }>;
  } {
    const issues: Array<{ severity: string; rule: string; message: string }> =
      [];

    if (typeof config === 'object' && config !== null) {
      // Check for dangerous patterns in configuration
      const configStr = JSON.stringify(config);

      // Check for eval patterns
      if (/\beval\s*\(/i.test(configStr)) {
        issues.push({
          severity: 'critical',
          rule: 'no-eval',
          message: 'Configuration contains eval() calls',
        });
      }

      // Check for shell metacharacters
      if (/[;&|`$()]/.test(configStr)) {
        issues.push({
          severity: 'high',
          rule: 'no-shell-metacharacters',
          message: 'Configuration contains shell metacharacters',
        });
      }

      // Check for potential path traversal
      if (/\.\.[/\\]/.test(configStr)) {
        issues.push({
          severity: 'high',
          rule: 'no-path-traversal',
          message: 'Configuration contains potential path traversal sequences',
        });
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    };
  },
};

/**
 * Default security configuration for production environments
 */
export const PRODUCTION_SECURITY_CONFIG = {
  workspace: {
    strictMode: true,
    maxDepth: 8,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedDirectories: new Set([
      '.claude',
      'hooks',
      'src',
      'lib',
      'docs',
      'test',
      'tests',
      '__tests__',
    ]),
  },
  command: {
    strictMode: true,
    environmentMode: 'production' as const,
    maxLength: 1024,
    allowedExecutables: new Set([
      'bun',
      'node',
      'npm',
      'git',
      'echo',
      'cat',
      'ls',
      'grep',
    ]),
  },
};

/**
 * Security best practices and recommendations
 */
export const SECURITY_BEST_PRACTICES = {
  workspace: [
    'Always validate file paths before operations',
    'Use absolute paths internally after validation',
    'Implement workspace boundary enforcement',
    'Limit file access to approved directories only',
    'Set reasonable file size limits',
    'Block access to sensitive file patterns',
  ],
  commands: [
    'Whitelist allowed executables',
    'Block dangerous command patterns',
    'Implement command length limits',
    'Prevent shell metacharacter injection',
    'Use environment-specific restrictions',
    'Log security violations for monitoring',
  ],
  configuration: [
    'Validate all configuration sources',
    'Sanitize dynamic configuration loading',
    'Implement configuration schema validation',
    'Block code injection in config files',
    'Use secure defaults for all options',
    'Audit configurations regularly',
  ],
  runtime: [
    'Validate all input from external sources',
    'Implement timeout limits for operations',
    'Use secure environment variable handling',
    'Implement proper error boundaries',
    'Log security events for monitoring',
    'Follow principle of least privilege',
  ],
} as const;
