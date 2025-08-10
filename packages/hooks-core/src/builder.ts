/**
 * Builder pattern implementation for fluent hook creation
 * Provides a chainable API for creating type-safe hooks
 */

import type {
  HookContext,
  HookEvent,
  HookHandler,
  HookMiddleware,
  HookRegistryEntry,
  HookResult,
  HookBuilder as IHookBuilder,
  ToolName,
} from './types.ts';

/**
 * Hook builder implementation with fluent interface
 */
export class HookBuilder<TEvent extends HookEvent = HookEvent>
  implements IHookBuilder<TEvent>
{
  private _event?: TEvent;
  private _toolName?: ToolName;
  private _handler?: HookHandler<TEvent>;
  private _timeout?: number;
  private _condition?: (context: HookContext<TEvent>) => boolean;
  private _priority = 0;
  private _enabled = true;
  private _middleware: HookMiddleware<HookContext<TEvent>>[] = [];

  /**
   * Specify the hook event type
   */
  forEvent<E extends HookEvent>(event: E): HookBuilder<E> {
    const builder = new HookBuilder<E>();
    builder._event = event;
    builder._toolName = this._toolName;
    builder._timeout = this._timeout;
    builder._priority = this._priority;
    builder._enabled = this._enabled;
    builder._middleware = this._middleware as unknown as HookMiddleware<HookContext<E>>[];
    return builder;
  }

  /**
   * Specify the target tool name
   */
  forTool<T extends ToolName>(toolName: T): HookBuilder<TEvent> {
    this._toolName = toolName;
    return this;
  }

  /**
   * Set the hook handler function
   */
  withHandler<E extends TEvent>(handler: HookHandler<E>): HookBuilder<E> {
    const builder = this as unknown as HookBuilder<E>;
    builder._handler = handler;
    return builder;
  }

  /**
   * Set execution timeout in milliseconds
   */
  withTimeout(timeout: number): HookBuilder<TEvent> {
    this._timeout = timeout;
    return this;
  }

  /**
   * Add conditional execution logic
   */
  withCondition(
    condition: (context: HookContext<TEvent>) => boolean
  ): HookBuilder<TEvent> {
    this._condition = condition;
    return this;
  }

  /**
   * Set hook priority (higher numbers execute first)
   */
  withPriority(priority: number): HookBuilder<TEvent> {
    this._priority = priority;
    return this;
  }

  /**
   * Set hook enabled state
   */
  enabled(enabled = true): HookBuilder<TEvent> {
    this._enabled = enabled;
    return this;
  }

  /**
   * Add middleware to the hook execution
   */
  withMiddleware(
    middlewareFunc: HookMiddleware<HookContext<TEvent>>
  ): HookBuilder<TEvent> {
    this._middleware.push(middlewareFunc);
    return this;
  }

  /**
   * Build the hook registry entry
   */
  build(): HookRegistryEntry<TEvent> {
    if (!this._event) {
      throw new Error('Hook event is required');
    }

    if (!this._handler) {
      throw new Error('Hook handler is required');
    }

    let finalHandler = this._handler;

    // Wrap with condition if provided
    if (this._condition) {
      const originalHandler = finalHandler;
      const condition = this._condition;

      finalHandler = async (context: HookContext<TEvent>) => {
        const shouldExecute = await Promise.resolve(condition(context));
        if (!shouldExecute) {
          return { success: true, message: 'Hook skipped due to condition' };
        }
        return await Promise.resolve(originalHandler(context));
      };
    }

    // Apply middleware
    if (this._middleware.length > 0) {
      finalHandler = this._middleware.reduceRight(
        (nextHandler, middlewareFunc) => async (context: HookContext<TEvent>) =>
          await middlewareFunc(
            context,
            async (ctx) => await Promise.resolve(nextHandler(ctx))
          ),
        finalHandler
      );
    }

    return {
      event: this._event,
      handler: finalHandler,
      priority: this._priority,
      enabled: this._enabled,
      tool: this._toolName, // FIX: Now properly included
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
export interface DeclarativeHookConfig<TEvent extends HookEvent = HookEvent> {
  event: TEvent;
  tool?: ToolName;
  handler: HookHandler<TEvent>;
  condition?: (context: HookContext<TEvent>) => boolean;
  timeout?: number;
  priority?: number;
  enabled?: boolean;
  middleware?: HookMiddleware<HookContext<TEvent>>[];
}

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
      const start = Date.now();

      if (logLevel === 'debug' || logLevel === 'info') {
        // Logging handled by pino logger in hook execution
      }

      try {
        const result = await next(context);
        const _duration = Date.now() - start;

        if (logLevel === 'debug' || logLevel === 'info') {
          // Success logging handled by pino logger
        }

        return result;
      } catch (error) {
        const _duration = Date.now() - start;

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
