/**
 * Logging configuration management
 *
 * Provides environment-based configuration with security defaults
 */

import type {
  Environment,
  LoggingConfig,
  LogLevel,
  SanitizationOptions,
} from './types';

/**
 * Determine environment from NODE_ENV and other indicators
 */
export function detectEnvironment(): Environment {
  const nodeEnv = Bun.env.NODE_ENV?.toLowerCase();

  // Explicit test environment
  if (nodeEnv === 'test' || Bun.env.BUN_ENV === 'test') {
    return 'test';
  }

  // Production indicators
  if (
    nodeEnv === 'production' ||
    Bun.env.NODE_ENV === 'prod' ||
    Bun.env.BUN_ENV === 'production'
  ) {
    return 'production';
  }

  // Binary distribution indicator (only if not in test environment)
  if (!(Bun.env.DEBUG || nodeEnv || Bun.env.BUN_ENV)) {
    // Check if we're running from a compiled binary or in a test environment
    // In tests, we should default to development unless explicitly set
    if (typeof Bun !== 'undefined' && Bun.main && !Bun.main.includes('test')) {
      return 'production';
    }
  }

  // Default to development
  return 'development';
}

/**
 * Determine log level from environment variables and CLI flags
 */
export function detectLogLevel(): LogLevel {
  // CLI debug flag takes precedence
  if (Bun.env.DEBUG === 'true' || process.argv.includes('--debug')) {
    return 'debug';
  }

  // CLI verbose flag
  if (process.argv.includes('--verbose')) {
    return 'info';
  }

  // Explicit LOG_LEVEL environment variable
  const envLevel = Bun.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && isValidLogLevel(envLevel)) {
    return envLevel as LogLevel;
  }

  // Environment-based defaults
  const env = detectEnvironment();
  switch (env) {
    case 'test':
      return 'error'; // Minimal logging in tests
    case 'production':
      return 'info'; // Info level for production observability
    default:
      return 'debug'; // Verbose development logging
  }
}

/**
 * Check if a string is a valid log level
 */
function isValidLogLevel(level: string): boolean {
  return ['error', 'warn', 'info', 'debug', 'trace'].includes(level);
}

/**
 * Create logging configuration based on environment
 */
export function createLoggingConfig(service: string): LoggingConfig {
  const environment = detectEnvironment();
  const level = detectLogLevel();

  return {
    level,
    environment,
    service,
    // Pretty printing only in development
    pretty:
      environment === 'development' && !process.argv.includes('--no-pretty'),
    // Console output enabled unless explicitly disabled
    console: !process.argv.includes('--no-console'),
    // Silent mode for tests unless explicitly enabled
    silent:
      environment === 'test' && !process.argv.includes('--enable-test-logs'),
    // Additional context from environment
    context: {
      version: Bun.env.CLI_VERSION || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

/**
 * Default sanitization options for security compliance
 */
export const DEFAULT_SANITIZATION: SanitizationOptions = {
  // Fields to completely remove from logs
  removeFields: [
    'password',
    'passwd',
    'secret',
    'token',
    'key',
    'authorization',
    'auth',
    'cookie',
    'session',
    'credentials',
    'credential',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'privateKey',
    'private_key',
    'ssn',
    'social_security_number',
    'credit_card',
    'creditCard',
    'cvv',
    'pin',
  ],

  // Fields to mask with [REDACTED]
  maskFields: [
    'email', // Partially mask emails
    'phone',
    'phoneNumber',
    'phone_number',
    'ipAddress',
    'ip_address',
    'userAgent',
    'user_agent',
    'userId', // Hash user IDs
    'user_id',
  ],

  // Patterns to search for and mask in string values
  sensitivePatterns: [
    // Credit card numbers
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    // Social security numbers
    /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
    // Email addresses (partial masking)
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    // Phone numbers
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    // API keys (base64-like patterns)
    /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
    // JWT tokens
    /eyJ[A-Za-z0-9+/=]+\.eyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+/g,
    // AWS access keys
    /AKIA[A-Z0-9]{16}/g,
    // Generic secrets (long alphanumeric strings)
    /\b[a-zA-Z0-9]{40,}\b/g,
  ],

  // Limits for performance and security
  maxStringLength: 1000,
  maxDepth: 10,
} as const;

/**
 * Production-optimized configuration
 */
export function createProductionConfig(service: string): LoggingConfig {
  return {
    ...createLoggingConfig(service),
    level: 'info',
    environment: 'production',
    pretty: false, // No pretty printing in production
    console: true,
    silent: false,
  };
}

/**
 * Development-optimized configuration
 */
export function createDevelopmentConfig(service: string): LoggingConfig {
  return {
    ...createLoggingConfig(service),
    level: 'debug',
    environment: 'development',
    pretty: true, // Enable pretty printing
    console: true,
    silent: false,
  };
}

/**
 * Test-optimized configuration
 */
export function createTestConfig(service: string): LoggingConfig {
  return {
    ...createLoggingConfig(service),
    level: 'error',
    environment: 'test',
    pretty: false,
    console: false, // Disable console in tests by default
    silent: true, // Silent by default in tests
  };
}
