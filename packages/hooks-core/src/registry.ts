/**
 * Hook registry for managing and executing hooks
 * Provides centralized hook registration and execution
 * Updated to work with new stdin-based runtime system
 */

import { executeHook } from './runtime';
import type {
  HookContext,
  HookEvent,
  HookExecutionStats,
  HookHandler,
  HookRegistryEntry,
  HookResult,
  ToolName,
} from './types';

/**
 * Central hook registry with composite key system for tool scoping
 */
export class HookRegistry {
  private readonly hooks = new Map<string, HookRegistryEntry<HookEvent>[]>();
  private readonly stats = new Map<string, HookExecutionStats>();

  /**
   * Generate registry key: universal hooks use "{event}", tool-specific use "{event}:{tool}"
   */
  private getRegistryKey(event: HookEvent, tool?: ToolName): string {
    return tool ? `${event}:${tool}` : event;
  }

  /**
   * Register hook with proper key generation based on tool field
   */
  register<TEvent extends HookEvent>(entry: HookRegistryEntry<TEvent>): void {
    const key = this.getRegistryKey(entry.event, entry.tool);

    if (!this.hooks.has(key)) {
      this.hooks.set(key, []);
    }

    const hooks = this.hooks.get(key);
    if (!hooks) {
      throw new Error(`No hooks found for key: ${key}`);
    }

    // Insert in priority order (higher priority first)
    const insertIndex = hooks.findIndex(
      (h) => (h.priority || 0) < (entry.priority || 0)
    );
    if (insertIndex === -1) {
      hooks.push(entry as unknown as HookRegistryEntry<HookEvent>);
    } else {
      hooks.splice(
        insertIndex,
        0,
        entry as unknown as HookRegistryEntry<HookEvent>
      );
    }
  }

  /**
   * Register multiple hooks
   */
  registerAll(entries: HookRegistryEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /**
   * Get hooks for event and tool - returns both universal and tool-specific hooks
   */
  getHooks<TEvent extends HookEvent>(
    event: TEvent,
    toolName?: ToolName
  ): HookRegistryEntry<TEvent>[] {
    const hooks: HookRegistryEntry<TEvent>[] = [];

    // Always include universal hooks
    const universalKey = this.getRegistryKey(event);
    const universalHooks = this.hooks.get(universalKey) || [];
    hooks.push(...(universalHooks as unknown as HookRegistryEntry<TEvent>[]));

    // Include tool-specific hooks if tool specified
    if (toolName) {
      const toolKey = this.getRegistryKey(event, toolName);
      const toolHooks = this.hooks.get(toolKey) || [];
      hooks.push(...(toolHooks as unknown as HookRegistryEntry<TEvent>[]));
    }

    // Re-sort by priority (higher priority first)
    return hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Execute hooks with proper tool filtering
   */
  async execute<TEvent extends HookEvent>(
    context: HookContext<TEvent>
  ): Promise<HookResult[]> {
    const hooks = this.getHooks(context.event, context.toolName);
    const results: HookResult[] = [];

    for (const hookEntry of hooks) {
      if (hookEntry.enabled === false) {
        continue;
      }

      const start = Date.now();

      try {
        const result = await executeHook(
          hookEntry.handler as HookHandler,
          context
        );
        results.push(result);

        // Update stats
        this.updateStats(
          context.event,
          context.toolName,
          true,
          Date.now() - start
        );

        // For PreToolUse, stop on blocking failures
        if (context.event === 'PreToolUse' && !result.success && result.block) {
          break;
        }
      } catch (error) {
        const failureResult: HookResult = {
          success: false,
          message:
            error instanceof Error ? error.message : 'Hook execution failed',
          block: context.event === 'PreToolUse',
        };

        results.push(failureResult);
        this.updateStats(
          context.event,
          context.toolName,
          false,
          Date.now() - start
        );

        if (context.event === 'PreToolUse' && failureResult.block) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute hooks and return combined result
   */
  async executeAndCombine<TEvent extends HookEvent>(
    context: HookContext<TEvent>
  ): Promise<HookResult> {
    const results = await this.execute(context);

    if (results.length === 0) {
      return { success: true, message: 'No hooks executed' };
    }

    // Check for any blocking failures
    const blockingFailure = results.find((r) => !r.success && r.block);
    if (blockingFailure) {
      return blockingFailure;
    }

    // Check for any failures
    const failure = results.find((r) => !r.success);
    if (failure) {
      return failure;
    }

    // All successful
    const messages = results.map((r) => r.message).filter(Boolean);
    return {
      success: true,
      message:
        messages.length > 0
          ? messages.join('; ')
          : 'All hooks executed successfully',
      data: {
        hookCount: results.length,
        results: results.map((r) => ({
          success: r.success,
          message: r.message,
        })),
      },
    };
  }

  /**
   * Check if any hooks are registered for an event
   */
  hasHooks(event: HookEvent): boolean {
    const hooks = this.getHooks(event);
    return hooks.some((h) => h.enabled);
  }

  /**
   * Unregister hooks for an event
   */
  unregister(event: HookEvent): void {
    this.hooks.delete(this.getRegistryKey(event));
  }

  /**
   * Clear all registered hooks
   */
  clear(): void {
    this.hooks.clear();
    this.stats.clear();
  }

  /**
   * Get execution statistics
   */
  getStats(event?: HookEvent, toolName?: ToolName): HookExecutionStats[] {
    const statsArray: HookExecutionStats[] = [];

    for (const [key, stats] of this.stats.entries()) {
      if (event !== undefined && !key.includes(event)) {
        continue;
      }
      if (toolName !== undefined && !key.includes(toolName)) {
        continue;
      }

      statsArray.push(stats);
    }

    return statsArray;
  }

  /**
   * Update execution statistics
   */
  private updateStats(
    event: HookEvent,
    toolName: ToolName | undefined,
    success: boolean,
    duration: number
  ): void {
    const key = this.getRegistryKey(event, toolName);
    const existing = this.stats.get(key) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      blockedExecutions: 0,
      averageExecutionTime: 0,
    };

    existing.totalExecutions++;

    if (success) {
      existing.successfulExecutions++;
    } else {
      existing.failedExecutions++;
      if (event === 'PreToolUse') {
        existing.blockedExecutions++;
      }
    }

    // Update average execution time
    existing.averageExecutionTime =
      (existing.averageExecutionTime * (existing.totalExecutions - 1) +
        duration) /
      existing.totalExecutions;

    existing.lastExecutionTime = new Date().toISOString();

    this.stats.set(key, existing);
  }
}

/**
 * Global hook registry instance
 */
export const globalRegistry = new HookRegistry();

/**
 * Convenience functions using global registry
 */
export const registerHook = <TEvent extends HookEvent>(
  entry: HookRegistryEntry<TEvent>
): void => {
  globalRegistry.register(entry);
};

export const registerHooks = (entries: HookRegistryEntry[]): void => {
  globalRegistry.registerAll(entries);
};

export const executeHooks = <TEvent extends HookEvent>(
  context: HookContext<TEvent>
): Promise<HookResult[]> => {
  return globalRegistry.execute(context);
};

export const executeHooksAndCombine = <TEvent extends HookEvent>(
  context: HookContext<TEvent>
): Promise<HookResult> => {
  return globalRegistry.executeAndCombine(context);
};

export const hasHooksForEvent = (event: HookEvent): boolean => {
  return globalRegistry.hasHooks(event);
};

export const getHookStats = (
  event?: HookEvent,
  toolName?: ToolName
): HookExecutionStats[] => {
  return globalRegistry.getStats(event, toolName);
};

/**
 * Hook registry factory for creating isolated registries
 */
export function createHookRegistry(): HookRegistry {
  return new HookRegistry();
}
