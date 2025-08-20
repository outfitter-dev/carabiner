/**
 * Security validation utilities for Claude Code hooks
 * Provides comprehensive security checks for various tool operations
 */

import { extname, relative, resolve } from 'node:path';
import type { HookContext } from '@outfitter/hooks-core';
import {
  isBashToolInput,
  isEditToolInput,
  isWriteToolInput,
} from '@outfitter/hooks-core';

// Regex patterns defined at module level for performance
const DYNAMIC_REQUIRE_PATTERN = /require\s*\(\s*[^"'][^)]*[^"']\s*\)/;

/**
 * Security validation error
 */
export class SecurityValidationError extends Error {
  constructor(
    message: string,
    public readonly rule: string,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

/**
 * Security rule configuration
 */
export type SecurityRuleConfig = {
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockOnViolation: boolean;
  customPatterns?: RegExp[];
  exemptions?: string[];
};

/**
 * Security validation options
 */
export type SecurityOptions = {
  env?: 'development' | 'production' | 'test';
  strictMode?: boolean;
  allowOverrides?: boolean;
  customRules?: Record<string, SecurityRuleConfig>;
};

/**
 * Default security rules
 */
const DEFAULT_SECURITY_RULES: Record<string, SecurityRuleConfig> = {
  dangerousCommands: {
    enabled: true,
    severity: 'critical',
    blockOnViolation: true,
  },
  fileSystemAccess: {
    enabled: true,
    severity: 'high',
    blockOnViolation: true,
  },
  secretsInContent: {
    enabled: true,
    severity: 'high',
    blockOnViolation: true,
  },
  networkAccess: {
    enabled: true,
    severity: 'medium',
    blockOnViolation: false,
  },
  productionSafety: {
    enabled: true,
    severity: 'critical',
    blockOnViolation: true,
  },
};

/**
 * Dangerous command patterns
 */
const DANGEROUS_COMMAND_PATTERNS = [
  // System destruction
  /rm\s+-rf\s+(\/|\$HOME|~|\.)/,
  /sudo\s+(rm|dd|mkfs|fdisk)/,
  />\s*\/dev\/(sda|sdb|hda|null)/,
  /chmod\s+777\s+(\/|\$HOME)/,

  // Network security
  /curl.*\|\s*(sh|bash|zsh)/,
  /wget.*\|\s*(sh|bash|zsh)/,
  /nc\s+.*-e\s*(sh|bash)/,

  // Process manipulation
  /killall\s+-9/,
  /pkill\s+-9/,
  /kill\s+-9\s+1/,

  // System modification
  /chattr\s+\+i/,
  /mount\s+.*\/dev/,
  /umount\s+-f/,

  // Privilege escalation
  /sudo\s+su\s+-/,
  /sudo\s+passwd/,
  /usermod\s+-a\s+-G\s+sudo/,
];

/**
 * Production-blocked command patterns
 */
const PRODUCTION_BLOCKED_PATTERNS = [
  /npm\s+(publish|unpublish)/,
  /yarn\s+publish/,
  /git\s+push.*origin.*(main|master|production)/,
  /docker\s+(push|run.*--privileged)/,
  /kubectl\s+(apply|delete|create).*production/,
  /terraform\s+(apply|destroy).*production/,
  /aws\s+.*delete/,
  /gcloud\s+.*delete/,
];

/**
 * Sensitive file patterns
 */
const SENSITIVE_FILE_PATTERNS = [
  /\.env\.production$/i,
  /\.env\.prod$/i,
  /secrets?\.json$/i,
  /credentials?\.json$/i,
  /\.ssh\/id_rsa$/,
  /\.ssh\/id_ed25519$/,
  /\.p12$/,
  /\.pem$/,
  /\.key$/,
  /\.crt$/,
  /keystore$/,
  /truststore$/,
  /\.pfx$/,
];

/**
 * Secret detection patterns
 */
const SECRET_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,
  /access[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,

  // Passwords
  /password\s*[:=]\s*["']?[^\s"']{8,}["']?/i,
  /passwd\s*[:=]\s*["']?[^\s"']{8,}["']?/i,

  // Secrets
  /secret\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,

  // Tokens
  /token\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,
  /auth[_-]?token\s*[:=]\s*["']?[a-zA-Z0-9]{20,}["']?/i,

  // Database URLs
  /database[_-]?url\s*[:=]\s*["']?[a-z]+:\/\/[^\s"']+["']?/i,
  /db[_-]?url\s*[:=]\s*["']?[a-z]+:\/\/[^\s"']+["']?/i,

  // Connection strings
  /connection[_-]?string\s*[:=]\s*["']?[^\s"']{20,}["']?/i,

  // AWS credentials
  /AKIA[0-9A-Z]{16}/,
  /aws[_-]?secret[_-]?access[_-]?key/i,

  // JWT tokens
  /eyJ[a-zA-Z0-9+/=]+\.[a-zA-Z0-9+/=]+\.[a-zA-Z0-9+/=]+/,

  // Private keys
  /-----BEGIN\s+(PRIVATE|RSA|OPENSSH)\s+KEY-----/,

  // GitHub tokens
  /gh[pousr]_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
];

/**
 * Validate bash commands for security issues
 */
export function validateBashCommand(
  command: string,
  options: SecurityOptions = {}
): void {
  const rules = { ...DEFAULT_SECURITY_RULES, ...(options.customRules || {}) };

  // Check dangerous commands
  if (rules.dangerousCommands?.enabled) {
    const dangerousPattern = DANGEROUS_COMMAND_PATTERNS.find((pattern) =>
      pattern.test(command)
    );

    if (dangerousPattern) {
      throw new SecurityValidationError(
        `Blocked dangerous command pattern: ${dangerousPattern.source}`,
        'dangerousCommands',
        rules.dangerousCommands?.severity || 'critical'
      );
    }
  }

  // Check production safety
  if (rules.productionSafety?.enabled && options.env === 'production') {
    const productionPattern = PRODUCTION_BLOCKED_PATTERNS.find((pattern) =>
      pattern.test(command)
    );

    if (productionPattern) {
      throw new SecurityValidationError(
        `Blocked production command: ${productionPattern.source}`,
        'productionSafety',
        rules.productionSafety?.severity || 'critical'
      );
    }
  }

  // Additional strict mode checks
  if (options.strictMode) {
    // Block any sudo usage in strict mode
    if (/sudo\s+/.test(command)) {
      throw new SecurityValidationError(
        'sudo commands blocked in strict mode',
        'strictMode',
        'high'
      );
    }

    // Block network access in strict mode
    if (/curl|wget|nc|telnet|ssh|ftp|sftp/.test(command)) {
      throw new SecurityValidationError(
        'Network commands blocked in strict mode',
        'strictMode',
        'medium'
      );
    }
  }
}

/**
 * Validate file path access
 */
export function validateFilePath(
  filePath: string,
  workspacePath: string,
  options: SecurityOptions = {}
): void {
  const rules = { ...DEFAULT_SECURITY_RULES, ...(options.customRules || {}) };

  if (!rules.fileSystemAccess?.enabled) {
    return;
  }

  const ws = resolve(workspacePath);
  const resolved = resolve(ws, filePath);

  // Ensure file is within workspace (prevent directory traversal)
  const rel = relative(ws, resolved);
  if (rel === '' || rel === '.' || rel === './') {
    // ok - same directory
  } else if (rel.startsWith('..') || resolve(rel) === rel) {
    throw new SecurityValidationError(
      `File path outside workspace: ${filePath}`,
      'fileSystemAccess',
      'critical'
    );
  }

  // Check for sensitive files
  const sensitivePattern = SENSITIVE_FILE_PATTERNS.find((pattern) =>
    pattern.test(filePath)
  );

  if (sensitivePattern) {
    throw new SecurityValidationError(
      `Cannot access sensitive file: ${filePath}`,
      'fileSystemAccess',
      'high'
    );
  }

  // Production environment checks
  if (options.env === 'production') {
    // Block access to development files in production
    const devPatterns = [
      /\.dev\./,
      /\.local\./,
      /\.test\./,
      /\.spec\./,
      /\.debug\./,
    ];

    const devPattern = devPatterns.find((pattern) => pattern.test(filePath));
    if (devPattern) {
      throw new SecurityValidationError(
        `Development file access blocked in production: ${filePath}`,
        'productionSafety',
        'medium'
      );
    }
  }
}

/**
 * Validate file content for secrets and dangerous patterns
 */
export function validateFileContent(
  content: string,
  filePath: string,
  options: SecurityOptions = {}
): void {
  const rules = { ...DEFAULT_SECURITY_RULES, ...(options.customRules || {}) };

  if (!rules.secretsInContent?.enabled) {
    return;
  }

  const ext = extname(filePath);

  // Check for secrets
  const secretPattern = SECRET_PATTERNS.find((pattern) =>
    pattern.test(content)
  );
  if (secretPattern) {
    throw new SecurityValidationError(
      'Content contains potential secrets',
      'secretsInContent',
      'high'
    );
  }

  // Language-specific validations
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    // Check for dangerous JavaScript patterns
    if (content.includes('eval(') || content.includes('Function(')) {
      throw new SecurityValidationError(
        'Code contains potentially dangerous eval/Function calls',
        'dangerousCode',
        'high'
      );
    }

    // Check for dynamic requires with user input
    if (DYNAMIC_REQUIRE_PATTERN.test(content)) {
      throw new SecurityValidationError(
        'Dynamic require() with potential user input detected',
        'dangerousCode',
        'medium'
      );
    }

    // Check for process execution
    if (
      content.includes('child_process') &&
      (content.includes('exec(') || content.includes('spawn('))
    ) {
      throw new SecurityValidationError(
        'Process execution detected in code',
        'processExecution',
        'medium'
      );
    }
  }

  // Shell script validation
  if (['.sh', '.bash', '.zsh'].includes(ext)) {
    validateBashCommand(content, options);
  }

  // YAML/JSON config validation
  if (['.yml', '.yaml', '.json'].includes(ext)) {
    try {
      const data =
        ext === '.json' ? JSON.parse(content) : content.toLowerCase();

      const configStr = typeof data === 'string' ? data : JSON.stringify(data);

      // Look for credential-like keys
      const credentialKeys = [
        'password',
        'secret',
        'key',
        'token',
        'credential',
        'auth',
        'apikey',
        'access_key',
        'private_key',
      ];

      const hasCredentials = credentialKeys.some((key) =>
        configStr.includes(key.toLowerCase())
      );

      if (hasCredentials && !filePath.includes('.example')) {
        throw new SecurityValidationError(
          'Configuration file may contain credentials',
          'secretsInContent',
          'medium'
        );
      }
    } catch {
      // Ignore parse errors for validation
    }
  }
}

/**
 * Validate Bash tool security
 */
function validateBashToolSecurity(
  context: HookContext,
  options: SecurityOptions
): void {
  if (isBashToolInput(context.toolInput)) {
    validateBashCommand(context.toolInput.command, options);
  }
}

/**
 * Validate Write tool security
 */
function validateWriteToolSecurity(
  context: HookContext,
  options: SecurityOptions
): void {
  if (isWriteToolInput(context.toolInput)) {
    validateFilePath(context.toolInput.file_path, context.cwd, options);
    validateFileContent(
      context.toolInput.content,
      context.toolInput.file_path,
      options
    );
  }
}

/**
 * Validate Edit tool security
 */
function validateEditToolSecurity(
  context: HookContext,
  options: SecurityOptions
): void {
  if (isEditToolInput(context.toolInput)) {
    validateFilePath(context.toolInput.file_path, context.cwd, options);
    validateFileContent(
      context.toolInput.new_string,
      context.toolInput.file_path,
      options
    );
  }
}

/**
 * Validate unknown tool security with generic checks
 */
function validateUnknownToolSecurity(
  context: HookContext,
  options: SecurityOptions
): void {
  if (typeof context.toolInput === 'object' && context.toolInput !== null) {
    const input = context.toolInput as Record<string, unknown>;

    if (input.file_path && typeof input.file_path === 'string') {
      validateFilePath(input.file_path, context.cwd, options);
    }

    if (input.content && typeof input.content === 'string') {
      validateFileContent(
        input.content,
        typeof input.file_path === 'string' ? input.file_path : 'unknown',
        options
      );
    }
  }
}

/**
 * Comprehensive security validation for hook context
 */
export function validateHookSecurity(
  context: HookContext,
  options: SecurityOptions = {}
): void {
  try {
    switch (context.toolName) {
      case 'Bash':
        validateBashToolSecurity(context, options);
        break;
      case 'Write':
        validateWriteToolSecurity(context, options);
        break;
      case 'Edit':
        validateEditToolSecurity(context, options);
        break;
      default:
        validateUnknownToolSecurity(context, options);
    }
  } catch (error) {
    if (error instanceof SecurityValidationError) {
      throw error;
    }

    // Re-throw as security error for consistency
    throw new SecurityValidationError(
      `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'unknown',
      'high'
    );
  }
}

/**
 * Create security validator with custom options
 */
export function createSecurityValidator(options: SecurityOptions = {}) {
  return (context: HookContext): void => {
    validateHookSecurity(context, options);
  };
}

/**
 * Predefined security validators for common scenarios
 */
export const SecurityValidators = {
  /**
   * Strict security validator - blocks most potentially dangerous operations
   */
  strict: createSecurityValidator({
    strictMode: true,
    env: 'production',
  }),

  /**
   * Development security validator - more permissive but still safe
   */
  development: createSecurityValidator({
    env: 'development',
    allowOverrides: true,
  }),

  /**
   * Production security validator - maximum security for production environments
   */
  production: createSecurityValidator({
    env: 'production',
    strictMode: false, // Some tools may be needed in production
  }),

  /**
   * Test security validator - minimal restrictions for testing
   */
  test: createSecurityValidator({
    env: 'test',
    customRules: {
      dangerousCommands: {
        enabled: false,
        severity: 'low',
        blockOnViolation: false,
      },
      fileSystemAccess: {
        enabled: true,
        severity: 'medium',
        blockOnViolation: true,
      },
      secretsInContent: {
        enabled: true,
        severity: 'high',
        blockOnViolation: true,
      },
    },
  }),
};
