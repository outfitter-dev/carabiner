/**
 * Immutable factory functions for hook creation
 * Replaces the mutable builder pattern with functional composition
 */

import type {
  HookContext,
  HookEvent,
  HookHandler,
  HookMiddleware,
  HookRegistryEntry,
  HookResult,
  ToolName,
} from './types';

/**
 * Immutable hook configuration interface
 */
export type HookConfig<TEvent extends HookEvent = HookEvent> = {
  readonly event: TEvent;
  readonly handler: HookHandler<TEvent>;
  readonly tool?: ToolName;
  readonly timeout?: number;
  readonly condition?: (context: HookContext<TEvent>) => boolean;
  readonly priority?: number;
  readonly enabled?: boolean;
  readonly middleware?: readonly HookMiddleware<HookContext<TEvent>>[];
};

/**
 * Validate hook configuration
 */
function validateHookConfig<TEvent extends HookEvent>(
  config: HookConfig<TEvent>
): void {
  if (!config.event) {
    throw new Error('Hook event is required');
  }
  if (!config.handler) {
    throw new Error('Hook handler is required');
  }
  if (config.timeout !== undefined && config.timeout < 0) {
    throw new Error('Timeout must be non-negative');
  }
  if (config.priority !== undefined && !Number.isFinite(config.priority)) {
    throw new Error('Priority must be a finite number');
  }
}

/**
 * Apply conditional wrapper to handler if condition is provided
 */
function applyCondition<TEvent extends HookEvent>(
  handler: HookHandler<TEvent>,
  condition: (context: HookContext<TEvent>) => boolean
): HookHandler<TEvent> {
  return async (context: HookContext<TEvent>): Promise<HookResult> => {
    const shouldExecute = await Promise.resolve(condition(context));
    if (!shouldExecute) {
      return { success: true, message: 'Hook skipped due to condition' };
    }
    return Promise.resolve(handler(context));
  };
}

/**
 * Apply middleware stack to handler
 */
function applyMiddleware<TEvent extends HookEvent>(
  handler: HookHandler<TEvent>,
  middleware: readonly HookMiddleware<HookContext<TEvent>>[]
): HookHandler<TEvent> {
  if (middleware.length === 0) {
    return handler;
  }

  return middleware.reduceRight(
    (nextHandler, middlewareFunc) => async (context: HookContext<TEvent>) =>
      middlewareFunc(context, async (ctx) => Promise.resolve(nextHandler(ctx))),
    handler
  );
}

/**
 * Create hook registry entry from immutable configuration
 */
export function createHook<TEvent extends HookEvent>(
  config: HookConfig<TEvent>
): HookRegistryEntry<TEvent> {
  validateHookConfig(config);

  let finalHandler = config.handler;

  // Apply condition wrapper if provided
  if (config.condition) {
    finalHandler = applyCondition(finalHandler, config.condition);
  }

  // Apply middleware stack if provided
  if (config.middleware && config.middleware.length > 0) {
    finalHandler = applyMiddleware(finalHandler, config.middleware);
  }

  return {
    event: config.event,
    handler: finalHandler,
    priority: config.priority ?? 0,
    enabled: config.enabled ?? true,
    tool: config.tool,
  };
}

/**
 * Factory functions for specific hook types with enhanced type safety
 */
export const hookFactories = {
  /**
   * Create PreToolUse hook with tool-specific typing
   */
  preToolUse<TTool extends ToolName>(
    config: Omit<HookConfig<'PreToolUse'>, 'event'> & { tool?: TTool }
  ): HookRegistryEntry<'PreToolUse'> {
    return createHook({
      ...config,
      event: 'PreToolUse',
    });
  },

  /**
   * Create PostToolUse hook with tool-specific typing
   */
  postToolUse<TTool extends ToolName>(
    config: Omit<HookConfig<'PostToolUse'>, 'event'> & { tool?: TTool }
  ): HookRegistryEntry<'PostToolUse'> {
    return createHook({
      ...config,
      event: 'PostToolUse',
    });
  },

  /**
   * Create UserPromptSubmit hook
   */
  userPromptSubmit(
    config: Omit<HookConfig<'UserPromptSubmit'>, 'event'>
  ): HookRegistryEntry<'UserPromptSubmit'> {
    return createHook({
      ...config,
      event: 'UserPromptSubmit',
    });
  },

  /**
   * Create SessionStart hook
   */
  sessionStart(
    config: Omit<HookConfig<'SessionStart'>, 'event'>
  ): HookRegistryEntry<'SessionStart'> {
    return createHook({
      ...config,
      event: 'SessionStart',
    });
  },

  /**
   * Create conditional hook with proper type inference
   */
  conditional<TEvent extends HookEvent>(
    event: TEvent,
    condition: (context: HookContext<TEvent>) => boolean,
    handler: HookHandler<TEvent>,
    options?: Partial<
      Omit<HookConfig<TEvent>, 'event' | 'condition' | 'handler'>
    >
  ): HookRegistryEntry<TEvent> {
    return createHook({
      event,
      handler,
      condition,
      ...options,
    });
  },
} as const;

/**
 * Configuration preset functions for common patterns
 */
export const hookPresets = {
  /**
   * Create a high-priority blocking hook
   */
  blocking<TEvent extends HookEvent>(
    event: TEvent,
    handler: HookHandler<TEvent>,
    options?: Partial<
      Omit<HookConfig<TEvent>, 'event' | 'handler' | 'priority'>
    >
  ): HookRegistryEntry<TEvent> {
    return createHook({
      event,
      handler,
      priority: 100, // High priority
      ...options,
    });
  },

  /**
   * Create a low-priority monitoring hook
   */
  monitoring<TEvent extends HookEvent>(
    event: TEvent,
    handler: HookHandler<TEvent>,
    options?: Partial<
      Omit<HookConfig<TEvent>, 'event' | 'handler' | 'priority'>
    >
  ): HookRegistryEntry<TEvent> {
    return createHook({
      event,
      handler,
      priority: -100, // Low priority
      ...options,
    });
  },

  /**
   * Create a timeout-protected hook
   */
  withTimeout<TEvent extends HookEvent>(
    event: TEvent,
    handler: HookHandler<TEvent>,
    timeout: number,
    options?: Partial<Omit<HookConfig<TEvent>, 'event' | 'handler' | 'timeout'>>
  ): HookRegistryEntry<TEvent> {
    return createHook({
      event,
      handler,
      timeout,
      ...options,
    });
  },

  /**
   * Create a tool-specific hook with validation
   */
  forTool<TEvent extends 'PreToolUse' | 'PostToolUse', TTool extends ToolName>(
    event: TEvent,
    tool: TTool,
    handler: HookHandler<TEvent>,
    options?: Partial<Omit<HookConfig<TEvent>, 'event' | 'handler' | 'tool'>>
  ): HookRegistryEntry<TEvent> {
    return createHook({
      event,
      handler,
      tool,
      ...options,
    });
  },
} as const;

/**
 * Utility functions for hook configuration
 */
export const hookUtils = {
  /**
   * Merge multiple hook configurations (for advanced composition)
   */
  merge<TEvent extends HookEvent>(
    base: HookConfig<TEvent>,
    ...overrides: Partial<HookConfig<TEvent>>[]
  ): HookConfig<TEvent> {
    // Type-safe merge that preserves required fields from base
    let result = base;

    for (const override of overrides) {
      result = {
        ...result,
        ...override,
        // Ensure required fields are always present
        event: override.event ?? result.event,
        handler: override.handler ?? result.handler,
      };
    }

    return result;
  },

  /**
   * Create a hook configuration with middleware chain
   */
  withMiddleware<TEvent extends HookEvent>(
    config: HookConfig<TEvent>,
    ...middleware: HookMiddleware<HookContext<TEvent>>[]
  ): HookConfig<TEvent> {
    const existingMiddleware = config.middleware ?? [];
    return {
      ...config,
      middleware: [...existingMiddleware, ...middleware],
    };
  },

  /**
   * Create hook configuration with condition
   */
  withCondition<TEvent extends HookEvent>(
    config: HookConfig<TEvent>,
    condition: (context: HookContext<TEvent>) => boolean
  ): HookConfig<TEvent> {
    return {
      ...config,
      condition,
    };
  },

  /**
   * Clone hook configuration with overrides
   */
  clone<TEvent extends HookEvent>(
    config: HookConfig<TEvent>,
    overrides?: Partial<HookConfig<TEvent>>
  ): HookConfig<TEvent> {
    return {
      ...config,
      ...overrides,
      middleware: config.middleware ? [...config.middleware] : undefined,
    };
  },
} as const;
