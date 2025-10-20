/**
 * Environment variable injection for Claude Code compliance
 * Handles the required CLAUDE_* environment variables per specification
 */

/**
 * Hook environment variables - Claude Code compliant
 */
export type HookEnvironmentVariables = {
  CLAUDE_PROJECT_DIR: string;
  CLAUDE_SESSION_ID: string;
  CLAUDE_HOOK_EVENT: string;
};

function unsetEnv(key: keyof HookEnvironmentVariables): void {
  Reflect.deleteProperty(process.env, key);
}

/**
 * Inject Claude Code environment variables
 * These variables are available to hook commands during execution
 */
export function injectEnvironmentVariables(
  eventType: string,
  sessionId: string,
  projectDir: string
): void {
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  process.env.CLAUDE_SESSION_ID = sessionId;
  process.env.CLAUDE_HOOK_EVENT = eventType;
}

/**
 * Get current hook environment variables
 */
export function getHookEnvironment(): Partial<HookEnvironmentVariables> {
  return {
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    CLAUDE_HOOK_EVENT: process.env.CLAUDE_HOOK_EVENT,
  };
}

/**
 * Validate that required environment variables are set
 */
export function validateHookEnvironment(): boolean {
  return !!(
    process.env.CLAUDE_PROJECT_DIR &&
    process.env.CLAUDE_SESSION_ID &&
    process.env.CLAUDE_HOOK_EVENT
  );
}

/**
 * Clear hook environment variables (for testing)
 */
export function clearHookEnvironment(): void {
  unsetEnv("CLAUDE_PROJECT_DIR");
  unsetEnv("CLAUDE_SESSION_ID");
  unsetEnv("CLAUDE_HOOK_EVENT");
}
