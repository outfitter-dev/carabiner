/**
 * Legacy logger interface for backward compatibility
 *
 * @deprecated Use the new logging system from './logging' instead
 * This file provides backward compatibility for existing code
 */

import {
  createLogger,
  createCliLogger as createNewCliLogger,
  builderLogger as newBuilderLogger,
  coreLogger as newCoreLogger,
  registryLogger as newRegistryLogger,
  runtimeLogger as newRuntimeLogger,
} from './logging';
import type { HookEvent, ToolName } from './types';

/**
 * Legacy base logger - now uses the new system
 */
export const logger = createLogger('hooks-core-legacy');

/**
 * Hook-specific logger factory (legacy)
 */
export function createHookLogger(event: HookEvent, toolName?: ToolName) {
  return logger.child({
    event,
    toolName,
    sessionId: Bun.env.CLAUDE_SESSION_ID,
    projectDir: Bun.env.CLAUDE_PROJECT_DIR,
  });
}

/**
 * CLI-specific logger factory (legacy)
 */
export function createCliLogger(command?: string) {
  return createNewCliLogger(command);
}

/**
 * Exported logger instances for different components (legacy)
 */
export const coreLogger = newCoreLogger;
export const runtimeLogger = newRuntimeLogger;
export const registryLogger = newRegistryLogger;
export const builderLogger = newBuilderLogger;

/**
 * Type-safe logging utilities (legacy)
 */
export const HookLogger = {
  info(event: HookEvent, toolName: ToolName, message: string): void {
    const logger = createLogger('hook-legacy');
    logger.info(message, { event, toolName });
  },

  warn(event: HookEvent, toolName: ToolName, message: string): void {
    const logger = createLogger('hook-legacy');
    logger.warn(message, { event, toolName });
  },

  error(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    error?: Error
  ): void {
    const logger = createLogger('hook-legacy');
    if (error) {
      logger.error(error, message, { event, toolName });
    } else {
      logger.error(message, { event, toolName });
    }
  },

  debug(
    event: HookEvent,
    toolName: ToolName,
    message: string,
    data?: unknown
  ): void {
    const logger = createLogger('hook-legacy');
    logger.debug(message, { event, toolName, data });
  },
};
