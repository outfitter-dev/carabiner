/**
 * Logging configuration management
 *
 * Provides environment-based configuration with security defaults
 */

import { getEnvVar, isBun } from "../utils/env";
import type {
  Environment,
  LoggingConfig,
  LogLevel,
  SanitizationOptions,
} from "./types";

/**
 * Determine environment from NODE_ENV and other indicators
 */
export function detectEnvironment(): Environment {
  const nodeEnv = getEnvVar("NODE_ENV")?.toLowerCase();
  const bunEnv = getEnvVar("BUN_ENV")?.toLowerCase();

  // Explicit test environment
  if (nodeEnv === "test" || bunEnv === "test") {
    return "test";
  }

  // Production indicators
  if (
    nodeEnv === "production" ||
    nodeEnv === "prod" ||
    bunEnv === "production"
  ) {
    return "production";
  }

  // Binary distribution indicator (only if not in test environment)
  const hasDebug = getEnvVar("DEBUG") != null;
  if (
    isBun() &&
    typeof globalThis.Bun?.main === "string" &&
    !globalThis.Bun.main.includes("test") &&
    !(hasDebug || nodeEnv || bunEnv)
  ) {
    return "production";
  }

  // Default to development
  return "development";
}

/**
 * Determine log level from environment variables and CLI flags
 */
export function detectLogLevel(): LogLevel {
  // CLI debug flag takes precedence
  const debugEnv = getEnvVar("DEBUG") ?? "";
  if (/^(1|true|yes|on)$/i.test(debugEnv) || process.argv.includes("--debug")) {
    return "debug";
  }

  // CLI verbose flag
  if (process.argv.includes("--verbose")) {
    return "info";
  }

  // Explicit LOG_LEVEL environment variable
  const envLevel = getEnvVar("LOG_LEVEL")?.trim().toLowerCase();
  if (envLevel === "warning") {
    return "warn";
  }
  if (envLevel && isValidLogLevel(envLevel)) {
    return envLevel as LogLevel;
  }

  // Environment-based defaults
  const env = detectEnvironment();
  switch (env) {
    case "test":
      return "error"; // Minimal logging in tests
    case "production":
      return "info"; // Info level for production observability
    default:
      return "debug"; // Verbose development logging
  }
}

/**
 * Check if a string is a valid log level
 */
function isValidLogLevel(level: string): boolean {
  return ["error", "warn", "info", "debug", "trace"].includes(level);
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
      environment === "development" && !process.argv.includes("--no-pretty"),
    // Console output enabled unless explicitly disabled
    console: !process.argv.includes("--no-console"),
    // Silent mode for tests unless explicitly enabled
    silent:
      environment === "test" && !process.argv.includes("--enable-test-logs"),
    // Additional context from environment
    context: {
      version: getEnvVar("CLI_VERSION") || "development",
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
    "password",
    "passwd",
    "secret",
    "token",
    "key",
    "authorization",
    "auth",
    "cookie",
    "session",
    "credentials",
    "credential",
    "apiKey",
    "api_key",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "privateKey",
    "private_key",
    "ssn",
    "social_security_number",
    "credit_card",
    "creditCard",
    "cvv",
    "pin",
  ],

  // Fields to mask with [REDACTED]
  maskFields: [
    "email", // Partially mask emails
    "phone",
    "phoneNumber",
    "phone_number",
    "ipAddress",
    "ip_address",
    "userAgent",
    "user_agent",
    "userId", // Hash user IDs
    "user_id",
  ],

  // Patterns to search for and mask in string values
  sensitivePatterns: [
    // Credit card numbers
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    // Social security numbers
    /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
    // Email addresses (partial masking)
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
    // IPv4 addresses
    /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g,
    // IPv6 addresses (compressed and full)
    /\b([A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi,
    /\b(([A-F0-9]{1,4}:){1,7}:|:((:[A-F0-9]{1,4}){1,7}))\b/gi,
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
    level: "info",
    environment: "production",
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
    level: "debug",
    environment: "development",
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
    level: "error",
    environment: "test",
    pretty: false,
    console: false, // Disable console in tests by default
    silent: true, // Silent by default in tests
  };
}
