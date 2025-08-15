/**
 * Builder pattern implementation for fluent hook creation
 * @deprecated Use hook-factories module for immutable, type-safe hook creation
 * Provides a chainable API for creating type-safe hooks with immutable state
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

// Re-export the new immutable factories for backward compatibility
export { hookFactories, hookPresets, hookUtils } from './hook-factories';

/**
 * Immutable builder state - makes illegal states unrepresentable
 */
type BuilderState<TEvent extends HookEvent = HookEvent> = {
  readonly event?: TEvent;
  readonly toolName?: ToolName;
  readonly handler?: HookHandler<TEvent>;
  readonly timeout?: number;
  readonly condition?: (context: HookContext<TEvent>) => boolean;
  readonly priority: number;
  readonly enabled: boolean;
  readonly middleware: readonly HookMiddleware<HookContext<TEvent>>[];
};

/**
 * Type-safe builder states for compile-time validation
 */
type PartialBuilderState<TEvent extends HookEvent> = BuilderState<TEvent> & {
  readonly event?: TEvent;
  readonly handler?: HookHandler<TEvent>;
};

type CompleteBuilderState<TEvent extends HookEvent> = BuilderState<TEvent> & {
  readonly event: TEvent;
  readonly handler: HookHandler<TEvent>;
};

/**
 * Type predicate to ensure complete state at build time
 */
function isCompleteState<TEvent extends HookEvent>(
  state: PartialBuilderState<TEvent>
): state is CompleteBuilderState<TEvent> {
  return state.event !== undefined && state.handler !== undefined;
}

/**
 * Hook builder implementation with fluent interface and immutable state
 */
export class HookBuilder<TEvent extends HookEvent = HookEvent> {
  private readonly state: PartialBuilderState<TEvent>;

  constructor(state?: Partial<BuilderState<TEvent>>) {
    this.state = {
      priority: 0,
      enabled: true,
      middleware: [],
      ...state,
    };
  }

  /**
   * Specify the hook event type
   */
  forEvent<E extends HookEvent>(event: E): HookBuilder<E> {
    return new HookBuilder<E>({
      event,
      toolName: this.state.toolName,
      timeout: this.state.timeout,
      priority: this.state.priority,
      enabled: this.state.enabled,
      // Reset handler and middleware when changing event type for type safety
      handler: undefined,
      condition: undefined,
      middleware: [],
    });
  }

  /**
   * Specify the target tool name
   */
  forTool<T extends ToolName>(toolName: T): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      toolName,
    });
  }

  /**
   * Set the hook handler function
   */
  withHandler<E extends TEvent>(handler: HookHandler<E>): HookBuilder<E> {
    // For type safety with generics, we need to handle different cases
    // If E equals TEvent, we can preserve middleware safely
    // Otherwise, we need to reset it to avoid type conflicts

    // Check if types are the same at runtime - if event hasn't changed, preserve middleware
    const canPreserveMiddleware = this.state.event !== undefined;

    return new HookBuilder<E>({
      event: this.state.event as E,
      toolName: this.state.toolName,
      handler,
      timeout: this.state.timeout,
      condition: this.state.condition as
        | ((context: HookContext<E>) => boolean)
        | undefined,
      priority: this.state.priority,
      enabled: this.state.enabled,
      // Only preserve middleware if event was already set and hasn't changed
      middleware: canPreserveMiddleware
        ? (this.state.middleware as unknown as readonly HookMiddleware<
            HookContext<E>
          >[])
        : [],
    });
  }

  /**
   * Set execution timeout in milliseconds
   */
  withTimeout(timeout: number): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      timeout,
    });
  }

  /**
   * Add conditional execution logic
   */
  withCondition(
    condition: (context: HookContext<TEvent>) => boolean
  ): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      condition,
    });
  }

  /**
   * Set hook priority (higher numbers execute first)
   */
  withPriority(priority: number): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      priority,
    });
  }

  /**
   * Set hook enabled state
   */
  enabled(enabled = true): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      enabled,
    });
  }

  /**
   * Add middleware to the hook execution
   */
  withMiddleware(
    middlewareFunc: HookMiddleware<HookContext<TEvent>>
  ): HookBuilder<TEvent> {
    return new HookBuilder<TEvent>({
      ...this.state,
      middleware: [...this.state.middleware, middlewareFunc],
    });
  }

  /**
   * Build the hook registry entry with compile-time safety
   */
  build(): HookRegistryEntry<TEvent> {
    if (!isCompleteState(this.state)) {
      // Maintain backward compatibility with existing error messages
      if (!this.state.event) {
        throw new Error('Hook event is required');
      }
      if (!this.state.handler) {
        throw new Error('Hook handler is required');
      }

      // Fallback for any other missing fields
      throw new Error('Hook builder is incomplete');
    }

    const completeState = this.state as CompleteBuilderState<TEvent>;
    let finalHandler = completeState.handler;

    // Wrap with condition if provided
    if (completeState.condition) {
      const originalHandler = finalHandler;
      const condition = completeState.condition;

      finalHandler = async (
        context: HookContext<TEvent>
      ): Promise<HookResult> => {
        const shouldExecute = await Promise.resolve(condition(context));
        if (!shouldExecute) {
          return { success: true, message: 'Hook skipped due to condition' };
        }
        return Promise.resolve(originalHandler(context));
      };
    }

    // Apply middleware stack if present
    if (completeState.middleware.length > 0) {
      finalHandler = completeState.middleware.reduceRight(
        (nextHandler, middlewareFunc) =>
          async (context: HookContext<TEvent>): Promise<HookResult> =>
            middlewareFunc(context, async (ctx) =>
              Promise.resolve(nextHandler(ctx))
            ),
        finalHandler
      );
    }

    return {
      event: completeState.event,
      handler: finalHandler,
      priority: completeState.priority,
      enabled: completeState.enabled,
      tool: completeState.toolName,
    };
  }

  /**
   * Static factory methods for common patterns
   */
  static forPreToolUse(): HookBuilder<'PreToolUse'> {
    return new HookBuilder<'PreToolUse'>().forEvent('PreToolUse');
  }

  static forPostToolUse(): HookBuilder<'PostToolUse'> {
    return new HookBuilder<'PostToolUse'>().forEvent('PostToolUse');
  }

  static forSessionStart(): HookBuilder<'SessionStart'> {
    return new HookBuilder<'SessionStart'>().forEvent('SessionStart');
  }

  static forUserPrompt(): HookBuilder<'UserPromptSubmit'> {
    return new HookBuilder<'UserPromptSubmit'>().forEvent('UserPromptSubmit');
  }
}

/**
 * Functional API for creating hooks
 * @deprecated Use hookFactories from ./hook-factories instead
 */
export const createHook = {
  /**
   * Create a PreToolUse hook - supports both universal and tool-specific
   */
  preToolUse<T extends ToolName>(
    toolOrHandler: T | HookHandler<'PreToolUse'>,
    handler?: HookHandler<'PreToolUse'>
  ): HookRegistryEntry<'PreToolUse'> {
    if (typeof toolOrHandler === 'function') {
      // Universal hook: createHook.preToolUse(handler)
      return {
        event: 'PreToolUse',
        handler: toolOrHandler,
        priority: 0,
        enabled: true,
        tool: undefined, // Universal hook
      };
    }
    // Tool-specific hook: createHook.preToolUse('Bash', handler)
    if (!handler) {
      throw new Error('Handler is required when tool is specified');
    }
    return {
      event: 'PreToolUse',
      handler,
      priority: 0,
      enabled: true,
      tool: toolOrHandler,
    };
  },

  /**
   * Create a PostToolUse hook - supports both universal and tool-specific
   */
  postToolUse<T extends ToolName>(
    toolOrHandler: T | HookHandler<'PostToolUse'>,
    handler?: HookHandler<'PostToolUse'>
  ): HookRegistryEntry<'PostToolUse'> {
    if (typeof toolOrHandler === 'function') {
      // Universal hook: createHook.postToolUse(handler)
      return {
        event: 'PostToolUse',
        handler: toolOrHandler,
        priority: 0,
        enabled: true,
        tool: undefined, // Universal hook
      };
    }
    // Tool-specific hook: createHook.postToolUse('Bash', handler)
    if (!handler) {
      throw new Error('Handler is required when tool is specified');
    }
    return {
      event: 'PostToolUse',
      handler,
      priority: 0,
      enabled: true,
      tool: toolOrHandler,
    };
  },

  /**
   * Create a SessionStart hook
   */
  sessionStart(
    handler: HookHandler<'SessionStart'>
  ): HookRegistryEntry<'SessionStart'> {
    return HookBuilder.forSessionStart().withHandler(handler).build();
  },

  /**
   * Create a UserPromptSubmit hook
   */
  userPromptSubmit(
    handler: HookHandler<'UserPromptSubmit'>
  ): HookRegistryEntry<'UserPromptSubmit'> {
    return HookBuilder.forUserPrompt().withHandler(handler).build();
  },

  /**
   * Create a conditional hook
   */
  conditional<TEvent extends HookEvent>(
    event: TEvent,
    condition: (context: HookContext<TEvent>) => boolean,
    handler: HookHandler<TEvent>
  ): HookRegistryEntry<TEvent> {
    return new HookBuilder<TEvent>()
      .forEvent(event)
      .withCondition(condition)
      .withHandler(handler)
      .build();
  },
};

/**
 * Declarative hook configuration API
 */
export type DeclarativeHookConfig<TEvent extends HookEvent = HookEvent> = {
  event: TEvent;
  tool?: ToolName;
  handler: HookHandler<TEvent>;
  condition?: (context: HookContext<TEvent>) => boolean;
  timeout?: number;
  priority?: number;
  enabled?: boolean;
  middleware?: HookMiddleware<HookContext<TEvent>>[];
};

/**
 * Create hook from declarative configuration
 */
export function defineHook<TEvent extends HookEvent>(
  config: DeclarativeHookConfig<TEvent>
): HookRegistryEntry<TEvent> {
  let builder = new HookBuilder<TEvent>().forEvent(config.event);

  if (config.tool) {
    builder = builder.forTool(config.tool);
  }

  builder = builder.withHandler(config.handler);

  if (config.condition) {
    builder = builder.withCondition(config.condition);
  }

  if (config.timeout) {
    builder = builder.withTimeout(config.timeout);
  }

  if (config.priority !== undefined) {
    builder = builder.withPriority(config.priority);
  }

  if (config.enabled !== undefined) {
    builder = builder.enabled(config.enabled);
  }

  if (config.middleware) {
    for (const middleware of config.middleware) {
      builder = builder.withMiddleware(middleware);
    }
  }

  return builder.build();
}

/**
 * Common middleware implementations
 */
export const middleware = {
  /**
   * Logging middleware
   */
  logging<T extends HookContext>(
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): HookMiddleware<T> {
    return async (context, next) => {
      // Timing captured but not used - reserved for future logging
      Date.now();

      if (logLevel === 'debug' || logLevel === 'info') {
        // Logging handled by pino logger in hook execution
      }

      try {
        const result = await next(context);
        // Duration tracking reserved for future logging

        if (logLevel === 'debug' || logLevel === 'info') {
          // Success logging handled by pino logger
        }

        return result;
      } catch (error) {
        // Duration tracking reserved for future logging

        if (logLevel !== 'error') {
          // Error logging handled by pino logger
        }

        throw error;
      }
    };
  },

  /**
   * Timing middleware
   */
  timing<T extends HookContext>(): HookMiddleware<T> {
    return async (context, next) => {
      const start = Date.now();
      const result = await next(context);
      const duration = Date.now() - start;

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
        },
      };
    };
  },

  /**
   * Error handling middleware
   */
  errorHandling<T extends HookContext>(
    onError?: (error: Error, context: T) => HookResult
  ): HookMiddleware<T> {
    return async (context, next) => {
      try {
        return await next(context);
      } catch (error) {
        if (onError && error instanceof Error) {
          return onError(error, context);
        }

        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          block: context.event === 'PreToolUse',
        };
      }
    };
  },

  /**
   * Validation middleware
   */
  validation<T extends HookContext>(
    validator: (context: T) => boolean | Promise<boolean>,
    errorMessage = 'Hook validation failed'
  ): HookMiddleware<T> {
    return async (context, next) => {
      const isValid = await Promise.resolve(validator(context));

      if (!isValid) {
        return {
          success: false,
          message: errorMessage,
          block: context.event === 'PreToolUse',
        };
      }

      return next(context);
    };
  },
};

/**
 * Export the builder instance for direct use
 */
export const hook = new HookBuilder();
