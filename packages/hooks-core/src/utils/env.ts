/**
 * Cross-runtime environment variable access
 * Works in both Bun and Node.js environments
 */

/**
 * Get environment variables safely across runtimes
 */
export function getEnv(): Record<string, string | undefined> {
  // @ts-ignore - Bun global may not exist
  if (globalThis.Bun?.env) {
    // @ts-ignore
    return globalThis.Bun.env;
  }
  return process.env;
}

/**
 * Get a specific environment variable
 */
export function getEnvVar(key: string): string | undefined {
  const env = getEnv();
  return env[key];
}

/**
 * Check if running in Bun runtime
 */
export function isBun(): boolean {
  // @ts-ignore
  return typeof globalThis.Bun !== "undefined";
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  const env = getEnv();
  return env.NODE_ENV === "development" || env.BUN_ENV === "development";
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  const env = getEnv();
  return (
    env.NODE_ENV === "production" ||
    env.NODE_ENV === "prod" ||
    env.BUN_ENV === "production"
  );
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  const env = getEnv();
  return env.NODE_ENV === "test" || env.BUN_ENV === "test";
}

/**
 * Check if debug mode is enabled
 */
export function isDebug(): boolean {
  const env = getEnv();
  return env.DEBUG === "true" || env.DEBUG === "1";
}
