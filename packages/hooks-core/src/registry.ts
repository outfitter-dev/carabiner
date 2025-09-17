/**
 * Hook registry for managing and executing hooks
 * Provides centralized hook registration and execution
 * Updated to work with new stdin-based runtime system
 */

import type {
  HookEvent,
  HookExecutionStats,
  HookInput,
  HookJSONOutput,
  HookRegistryEntry,
  ToolName,
} from "./types";

/**
 * Central hook registry with composite key system for tool scoping
 */
export class HookRegistry {
  private readonly hooks = new Map<string, HookRegistryEntry<HookInput>[]>();
  private readonly stats = new Map<string, HookExecutionStats>();

  /**
   * Generate registry key: universal hooks use "{event}", tool-specific use "{event}:{tool}"
   */
  private getRegistryKey(event: HookEvent, tool?: ToolName): string {
    return tool ? `${event}:${tool}` : event;
  }

  /**
   * Register hook with proper key generation based on matcher field
   */
  register<TInput extends HookInput>(entry: HookRegistryEntry<TInput>): void {
    const key = this.getRegistryKey(entry.event, entry.matcher as ToolName);

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
      hooks.push(entry as unknown as HookRegistryEntry<HookInput>);
    } else {
      hooks.splice(
        insertIndex,
        0,
        entry as unknown as HookRegistryEntry<HookInput>
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
  getHooks<TInput extends HookInput>(
    event: TInput["hook_event_name"],
    toolName?: ToolName
  ): HookRegistryEntry<TInput>[] {
    const hooks: HookRegistryEntry<TInput>[] = [];

    // Always include universal hooks
    const universalKey = this.getRegistryKey(event);
    const universalHooks = this.hooks.get(universalKey) || [];
    hooks.push(...(universalHooks as unknown as HookRegistryEntry<TInput>[]));

    // Include tool-specific hooks if tool specified
    if (toolName) {
      const toolKey = this.getRegistryKey(event, toolName);
      const toolHooks = this.hooks.get(toolKey) || [];
      hooks.push(...(toolHooks as unknown as HookRegistryEntry<TInput>[]));
    }

    // Re-sort by priority (higher priority first)
    return hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Execute hooks with proper tool filtering
   */
  async execute<TInput extends HookInput>(
    input: TInput
  ): Promise<HookJSONOutput[]> {
    const toolName =
      "tool_name" in input ? (input as any).tool_name : undefined;
    const hooks = this.getHooks(input.hook_event_name, toolName);
    const results: HookJSONOutput[] = [];

    for (const hookEntry of hooks) {
      if (hookEntry.enabled === false) {
        continue;
      }

      const start = Date.now();

      try {
        const result = await hookEntry.handler(input, undefined, {
          signal: new AbortController().signal,
        });
        results.push(result);

        // Update stats
        this.updateStats(
          input.hook_event_name,
          toolName,
          true,
          Date.now() - start
        );

        // For PreToolUse, stop on blocking failures
        if (
          input.hook_event_name === "PreToolUse" &&
          (result as any).continue === false
        ) {
          break;
        }
      } catch (error) {
        const failureResult: HookJSONOutput = {
          continue: false,
          systemMessage:
            error instanceof Error ? error.message : "Hook execution failed",
        };

        results.push(failureResult);
        this.updateStats(
          input.hook_event_name,
          toolName,
          false,
          Date.now() - start
        );

        if (
          input.hook_event_name === "PreToolUse" &&
          (failureResult as any).continue === false
        ) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute hooks and return combined result
   */
  async executeAndCombine<TInput extends HookInput>(
    input: TInput
  ): Promise<HookJSONOutput> {
    const results = await this.execute(input);

    if (results.length === 0) {
      return { continue: true, systemMessage: "No hooks executed" };
    }

    // Check for any failures that should stop execution
    const failure = results.find((r) => (r as any).continue === false);
    if (failure) {
      return failure;
    }

    // All successful or continuing
    const messages = results
      .map((r) => (r as any).systemMessage)
      .filter(Boolean);
    return {
      continue: true,
      systemMessage:
        messages.length > 0
          ? messages.join("; ")
          : "All hooks executed successfully",
    };
  }

  /**
   * Check if any hooks are registered for an event
   */
  hasHooks(event: HookEvent): boolean {
    const hooks = this.getHooks(event as any);
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
      if (event && !key.includes(event)) {
        continue;
      }
      if (toolName && !key.includes(toolName)) {
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
      if (event === "PreToolUse") {
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
export const registerHook = <TInput extends HookInput>(
  entry: HookRegistryEntry<TInput>
): void => {
  globalRegistry.register(entry);
};

export const registerHooks = (entries: HookRegistryEntry[]): void => {
  globalRegistry.registerAll(entries);
};

export const executeHooks = <TInput extends HookInput>(
  input: TInput
): Promise<HookJSONOutput[]> => {
  return globalRegistry.execute(input);
};

export const executeHooksAndCombine = <TInput extends HookInput>(
  input: TInput
): Promise<HookJSONOutput> => {
  return globalRegistry.executeAndCombine(input);
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
