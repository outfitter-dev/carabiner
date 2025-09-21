/**
 * Builder pattern implementation for fluent hook creation
 * Provides a chainable API for creating type-safe hooks
 */

import type {
  HookHandler,
  HookInput,
  HookJSONOutput,
  HookMiddleware,
  HookRegistryEntry,
  HookBuilder as IHookBuilder,
  ToolName,
} from "./types.ts";

/**
 * Hook builder implementation with fluent interface
 */
export class HookBuilder<TInput extends HookInput = HookInput>
  implements IHookBuilder<TInput>
{
  private readonly _event?: TInput["hook_event_name"];
  private _toolName?: ToolName;
  private _handler?: HookHandler<TInput>;
  private _timeout?: number;
  private _condition?: (input: TInput) => boolean | Promise<boolean>;
  private _priority = 0;
  private _enabled = true;
  private readonly _middleware: HookMiddleware<TInput>[] = [];

  constructor(params?: {
    event?: TInput["hook_event_name"];
    toolName?: ToolName;
    handler?: HookHandler<TInput>;
    timeout?: number;
    condition?: (input: TInput) => boolean | Promise<boolean>;
    priority?: number;
    enabled?: boolean;
    middleware?: HookMiddleware<TInput>[];
  }) {
    if (params) {
      this._event = params.event;
      this._toolName = params.toolName;
      this._handler = params.handler;
      this._timeout = params.timeout;
      this._condition = params.condition;
      this._priority = params.priority ?? this._priority;
      this._enabled = params.enabled ?? this._enabled;
      if (params.middleware) {
        this._middleware.push(...params.middleware);
      }
    }
  }

  /**
   * Specify the hook event type
   */
  forEvent<E extends HookInput>(event: E["hook_event_name"]): HookBuilder<E> {
    return new HookBuilder<E>({
      event,
      toolName: this._toolName,
      handler: this._handler as unknown as HookHandler<E>,
      timeout: this._timeout,
      condition: this._condition as unknown as (
        input: E
      ) => boolean | Promise<boolean>,
      priority: this._priority,
      enabled: this._enabled,
      middleware: this._middleware as unknown as HookMiddleware<E>[],
    });
  }

  /**
   * Specify the target tool name
   */
  forTool<T extends ToolName>(toolName: T): HookBuilder<TInput> {
    this._toolName = toolName;
    return this;
  }

  /**
   * Set the matcher pattern for hook filtering
   */
  withMatcher(matcher: string): HookBuilder<TInput> {
    this._toolName = matcher as ToolName;
    return this;
  }

  /**
   * Set the hook handler function
   */
  withHandler(handler: HookHandler<TInput>): HookBuilder<TInput> {
    this._handler = handler;
    return this;
  }

  /**
   * Set execution timeout in milliseconds
   */
  withTimeout(timeout: number): HookBuilder<TInput> {
    this._timeout = timeout;
    return this;
  }

  /**
   * Add conditional execution logic
   */
  withCondition(
    condition: (input: TInput) => boolean | Promise<boolean>
  ): HookBuilder<TInput> {
    this._condition = condition;
    return this;
  }

  /**
   * Set hook priority (higher numbers execute first)
   */
  withPriority(priority: number): HookBuilder<TInput> {
    this._priority = priority;
    return this;
  }

  /**
   * Set hook enabled state
   */
  enabled(enabled = true): HookBuilder<TInput> {
    this._enabled = enabled;
    return this;
  }

  /**
   * Add middleware to the hook execution
   */
  withMiddleware(middlewareFunc: HookMiddleware<TInput>): HookBuilder<TInput> {
    this._middleware.push(middlewareFunc);
    return this;
  }

  /**
   * Build the hook registry entry
   */
  build(): HookRegistryEntry<TInput> {
    if (!this._event) {
      throw new Error("Hook event is required");
    }

    if (!this._handler) {
      throw new Error("Hook handler is required");
    }

    let finalHandler = this._handler;

    // Wrap with condition if provided
    if (this._condition) {
      const originalHandler = finalHandler;
      const condition = this._condition;

      finalHandler = async (
        input: TInput,
        toolUseId?: string,
        _options?: { signal?: AbortSignal }
      ) => {
        const shouldExecute = await Promise.resolve(condition(input));
        if (!shouldExecute) {
          return {
            continue: true,
            systemMessage: "Hook skipped due to condition",
          };
        }
        return await Promise.resolve(
          originalHandler(input, toolUseId, {
            signal: new AbortController().signal,
          })
        );
      };
    }

    // Apply middleware
    if (this._middleware.length > 0) {
      finalHandler = this._middleware.reduceRight(
        (nextHandler, middlewareFunc) =>
          async (
            input: TInput,
            toolUseId?: string,
            _options?: { signal?: AbortSignal }
          ) =>
            await middlewareFunc(input, toolUseId, nextHandler),
        finalHandler
      );
    }

    // Apply timeout if specified (including 0 as valid)
    if (this._timeout !== undefined) {
      const originalHandler = finalHandler;
      const timeout = this._timeout;

      finalHandler = async (
        input: TInput,
        toolUseId?: string,
        _options?: { signal?: AbortSignal }
      ) => {
        let timeoutId: NodeJS.Timeout | undefined;

        const timeoutPromise = new Promise<HookJSONOutput>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(new Error(`Hook execution timed out after ${timeout}ms`)),
            timeout
          );
        });

        try {
          const result = await Promise.race([
            originalHandler(input, toolUseId, {
              signal: new AbortController().signal,
            }),
            timeoutPromise,
          ]);

          // Clear the timeout if the handler completes successfully
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          return result;
        } catch (error) {
          // Clear the timeout on error as well
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          if (error instanceof Error && error.message.includes("timed out")) {
            return {
              continue: false,
              systemMessage: error.message,
            };
          }
          throw error;
        }
      };
    }

    return {
      event: this._event,
      handler: finalHandler,
      priority: this._priority,
      enabled: this._enabled,
      matcher: this._toolName, // Tool-specific scoping using matcher
    };
  }

  /**
   * Static factory methods for common patterns
   */
  static forPreToolUse(): HookBuilder<any> {
    return new HookBuilder().forEvent("PreToolUse");
  }

  static forPostToolUse(): HookBuilder<any> {
    return new HookBuilder().forEvent("PostToolUse");
  }

  static forSessionStart(): HookBuilder<any> {
    return new HookBuilder().forEvent("SessionStart");
  }

  static forUserPrompt(): HookBuilder<any> {
    return new HookBuilder().forEvent("UserPromptSubmit");
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
    toolOrHandler: T | HookHandler,
    handler?: HookHandler
  ): HookRegistryEntry<any> {
    if (typeof toolOrHandler === "function") {
      // Universal hook: createHook.preToolUse(handler)
      return {
        event: "PreToolUse",
        handler: toolOrHandler,
        priority: 0,
        enabled: true,
        matcher: undefined, // Universal hook
      };
    }
    // Tool-specific hook: createHook.preToolUse('Bash', handler)
    if (!handler) {
      throw new Error("Handler is required when tool is specified");
    }
    return {
      event: "PreToolUse",
      handler,
      priority: 0,
      enabled: true,
      matcher: toolOrHandler,
    };
  },

  /**
   * Create a PostToolUse hook - supports both universal and tool-specific
   */
  postToolUse<T extends ToolName>(
    toolOrHandler: T | HookHandler,
    handler?: HookHandler
  ): HookRegistryEntry<any> {
    if (typeof toolOrHandler === "function") {
      // Universal hook: createHook.postToolUse(handler)
      return {
        event: "PostToolUse",
        handler: toolOrHandler,
        priority: 0,
        enabled: true,
        matcher: undefined, // Universal hook
      };
    }
    // Tool-specific hook: createHook.postToolUse('Bash', handler)
    if (!handler) {
      throw new Error("Handler is required when tool is specified");
    }
    return {
      event: "PostToolUse",
      handler,
      priority: 0,
      enabled: true,
      matcher: toolOrHandler,
    };
  },

  /**
   * Create a SessionStart hook
   */
  sessionStart(handler: HookHandler): HookRegistryEntry<any> {
    return HookBuilder.forSessionStart().withHandler(handler).build();
  },

  /**
   * Create a UserPromptSubmit hook
   */
  userPromptSubmit(handler: HookHandler): HookRegistryEntry<any> {
    return HookBuilder.forUserPrompt().withHandler(handler).build();
  },

  /**
   * Create a conditional hook
   */
  conditional<TInput extends HookInput>(
    event: TInput["hook_event_name"],
    condition: (input: TInput) => boolean | Promise<boolean>,
    handler: HookHandler<TInput>
  ): HookRegistryEntry<TInput> {
    return new HookBuilder<TInput>()
      .forEvent(event)
      .withCondition(condition)
      .withHandler(handler)
      .build();
  },
};

/**
 * Declarative hook configuration API
 */
export type DeclarativeHookConfig<TInput extends HookInput = HookInput> = {
  event: TInput["hook_event_name"];
  tool?: ToolName;
  handler: HookHandler<TInput>;
  condition?: (input: TInput) => boolean | Promise<boolean>;
  timeout?: number;
  priority?: number;
  enabled?: boolean;
  middleware?: HookMiddleware<TInput>[];
};

/**
 * Create hook from declarative configuration
 */
export function defineHook<TInput extends HookInput>(
  config: DeclarativeHookConfig<TInput>
): HookRegistryEntry<TInput> {
  let builder = new HookBuilder<TInput>().forEvent(config.event);

  if (config.tool) {
    builder = builder.forTool(config.tool);
  }

  builder = builder.withHandler(config.handler);

  if (config.condition) {
    builder = builder.withCondition(config.condition);
  }

  if (config.timeout !== undefined) {
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
  logging<T extends HookInput>(
    logLevel: "debug" | "info" | "warn" | "error" = "info"
  ): HookMiddleware<T> {
    return async (input, toolUseId, next) => {
      // Timing captured but not used - reserved for future logging
      Date.now();

      if (logLevel === "debug" || logLevel === "info") {
        // Logging handled by logger in hook execution
      }

      try {
        const result = await next(input, toolUseId, {
          signal: new AbortController().signal,
        });
        // Duration tracking reserved for future logging

        if (logLevel === "debug" || logLevel === "info") {
          // Success logging handled by logger
        }

        return result;
      } catch (error) {
        // Duration tracking reserved for future logging

        if (logLevel !== "error") {
          // Error logging handled by logger
        }

        throw error;
      }
    };
  },

  /**
   * Timing middleware
   */
  timing<T extends HookInput>(): HookMiddleware<T> {
    return async (input, toolUseId, next) => {
      const start = Date.now();
      const result = await next(input, toolUseId, {
        signal: new AbortController().signal,
      });
      const duration = Date.now() - start;

      // Add timing metadata if result supports it
      return {
        ...result,
        metadata: {
          ...(result as any).metadata,
          duration,
        },
      };
    };
  },

  /**
   * Error handling middleware
   */
  errorHandling<T extends HookInput>(
    onError?: (
      error: Error,
      input: T
    ) => HookJSONOutput | Promise<HookJSONOutput>
  ): HookMiddleware<T> {
    return async (input, toolUseId, next) => {
      try {
        return await next(input, toolUseId, {
          signal: new AbortController().signal,
        });
      } catch (error) {
        if (onError && error instanceof Error) {
          return await onError(error, input);
        }

        return {
          continue: false,
          systemMessage:
            error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },

  /**
   * Validation middleware
   */
  validation<T extends HookInput>(
    validator: (input: T) => boolean | Promise<boolean>,
    errorMessage = "Hook validation failed"
  ): HookMiddleware<T> {
    return async (input, toolUseId, next) => {
      const isValid = await Promise.resolve(validator(input));

      if (!isValid) {
        return {
          continue: false,
          systemMessage: errorMessage,
        };
      }

      return next(input, toolUseId, { signal: new AbortController().signal });
    };
  },
};

/**
 * Export the builder instance for direct use
 */
export const hook = new HookBuilder();
