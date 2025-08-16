/**
 * Type-Safe Implementation Example
 * Demonstrates strict TypeScript patterns for the refactored architecture
 */

import type { LiteralUnion } from 'type-fest';
import { z } from 'zod';

// ============================================================================
// BRANDED TYPES - Make primitives type-safe
// ============================================================================

export type SessionId = string & { readonly __brand: 'SessionId' };
export type FilePath = string & { readonly __brand: 'FilePath' };
export type CommandString = string & { readonly __brand: 'CommandString' };
export type ToolContent = string & { readonly __brand: 'ToolContent' };

// Brand constructors with validation
export const createSessionId = (value: string): SessionId | never => {
  if (!value || value.length < 1) {
    throw new Error('Invalid session ID');
  }
  return value as SessionId;
};

export const createFilePath = (value: string): FilePath | never => {
  if (!value?.includes('/')) {
    throw new Error('Invalid file path');
  }
  return value as FilePath;
};

export const createCommandString = (value: string): CommandString | never => {
  if (!value || value.length > 10_000) {
    throw new Error('Invalid command');
  }
  return value as CommandString;
};

// ============================================================================
// DISCRIMINATED UNIONS - Make illegal states unrepresentable
// ============================================================================

// Tool names as const assertion (not enum - Ultracite compliant)
export const TOOL_NAMES = [
  'Bash',
  'Edit',
  'MultiEdit',
  'Write',
  'Read',
  'Glob',
  'Grep',
  'LS',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
] as const;

export type ToolName = LiteralUnion<(typeof TOOL_NAMES)[number], string>;

// Event types with discriminated unions
export type HookEvent =
  | { readonly type: 'PreToolUse'; readonly tool: ToolName }
  | { readonly type: 'PostToolUse'; readonly tool: ToolName }
  | { readonly type: 'UserPromptSubmit' }
  | { readonly type: 'SessionStart' }
  | { readonly type: 'Stop' }
  | { readonly type: 'SubagentStop' };

// ============================================================================
// TOOL INPUT TYPES - Strict mapping without Record<string, unknown>
// ============================================================================

export type BashToolInput = {
  readonly command: CommandString;
  readonly timeout?: number;
  readonly description?: string;
};

export type WriteToolInput = {
  readonly file_path: FilePath;
  readonly content: ToolContent;
};

export type EditToolInput = {
  readonly file_path: FilePath;
  readonly old_string: string;
  readonly new_string: string;
  readonly replace_all?: boolean;
};

export type ReadToolInput = {
  readonly file_path: FilePath;
  readonly limit?: number;
  readonly offset?: number;
};

// Strict tool input mapping - no unknown types
export type ToolInputMap = {
  readonly Bash: BashToolInput;
  readonly Write: WriteToolInput;
  readonly Edit: EditToolInput;
  readonly Read: ReadToolInput;
  readonly MultiEdit: {
    readonly file_path: FilePath;
    readonly edits: readonly {
      readonly old_string: string;
      readonly new_string: string;
      readonly replace_all?: boolean;
    }[];
  };
  readonly Glob: { readonly pattern: string; readonly path?: FilePath };
  readonly Grep: {
    readonly pattern: string;
    readonly path?: FilePath;
    readonly glob?: string;
    readonly output_mode?: 'content' | 'files_with_matches' | 'count';
  };
  readonly LS: {
    readonly path: FilePath;
    readonly ignore?: readonly string[];
  };
  readonly TodoWrite: {
    readonly todos: readonly {
      readonly content: string;
      readonly status: 'pending' | 'in_progress' | 'completed';
      readonly id: string;
    }[];
  };
  readonly WebFetch: { readonly url: string; readonly prompt: string };
  readonly WebSearch: {
    readonly query: string;
    readonly allowed_domains?: readonly string[];
    readonly blocked_domains?: readonly string[];
  };
  readonly NotebookEdit: {
    readonly notebook_path: FilePath;
    readonly new_source: string;
    readonly cell_id?: string;
    readonly cell_type?: 'code' | 'markdown';
    readonly edit_mode?: 'replace' | 'insert' | 'delete';
  };
};

// ============================================================================
// CONTEXT TYPES - Perfect type inference without complex generics
// ============================================================================

// Base context shared by all events
type BaseHookContext = {
  readonly sessionId: SessionId;
  readonly transcriptPath: FilePath;
  readonly cwd: FilePath;
  readonly matcher?: string;
  readonly environment: {
    readonly CLAUDE_PROJECT_DIR?: string;
  };
};

// Event-specific contexts using discriminated unions
export type HookContext = BaseHookContext &
  (
    | {
        readonly event: {
          readonly type: 'PreToolUse';
          readonly tool: ToolName;
        };
        readonly toolInput: ToolInputMap[ToolName];
        readonly toolResponse?: never;
        readonly userPrompt?: never;
        readonly message?: never;
      }
    | {
        readonly event: {
          readonly type: 'PostToolUse';
          readonly tool: ToolName;
        };
        readonly toolInput: ToolInputMap[ToolName];
        readonly toolResponse: Record<string, unknown>; // Keep for backwards compatibility
        readonly userPrompt?: never;
        readonly message?: never;
      }
    | {
        readonly event: { readonly type: 'UserPromptSubmit' };
        readonly toolInput?: never;
        readonly toolResponse?: never;
        readonly userPrompt: string;
        readonly message?: never;
      }
    | {
        readonly event: {
          readonly type: 'SessionStart' | 'Stop' | 'SubagentStop';
        };
        readonly toolInput?: never;
        readonly toolResponse?: never;
        readonly userPrompt?: never;
        readonly message?: string;
      }
  );

// Type helper for extracting tool-specific context
export type ToolHookContext<T extends ToolName> = Extract<
  HookContext,
  { event: { tool: T } }
>;

// ============================================================================
// ZOD SCHEMAS - Compile-time + Runtime validation
// ============================================================================

// Branded type schemas
const _SessionIdSchema = z
  .string()
  .min(1)
  .transform((val): SessionId => val as SessionId);
const FilePathSchema = z
  .string()
  .min(1)
  .transform((val): FilePath => val as FilePath);
const CommandStringSchema = z
  .string()
  .min(1)
  .max(10_000)
  .transform((val): CommandString => val as CommandString);
const ToolContentSchema = z
  .string()
  .max(1_000_000)
  .transform((val): ToolContent => val as ToolContent);

// Tool input schemas with strict validation
export const BashInputSchema = z
  .object({
    command: CommandStringSchema,
    timeout: z.number().min(100).max(300_000).optional(),
    description: z.string().max(500).optional(),
  })
  .readonly();

export const WriteInputSchema = z
  .object({
    file_path: FilePathSchema,
    content: ToolContentSchema,
  })
  .readonly();

export const EditInputSchema = z
  .object({
    file_path: FilePathSchema,
    old_string: z.string().min(1),
    new_string: z.string(),
    replace_all: z.boolean().optional(),
  })
  .readonly();

// Tool schema map for runtime validation
export const ToolSchemas = {
  Bash: BashInputSchema,
  Write: WriteInputSchema,
  Edit: EditInputSchema,
  // ... other tools
} satisfies Partial<Record<ToolName, z.ZodSchema>>;

// ============================================================================
// HOOK RESULT TYPES - No loose types
// ============================================================================

export type HookResultSuccess = {
  readonly success: true;
  readonly message?: string;
  readonly data?: Record<string, unknown>;
  readonly metadata?: {
    readonly duration?: number;
    readonly timestamp?: string;
    readonly hookVersion?: string;
  };
};

export type HookResultFailure = {
  readonly success: false;
  readonly message: string;
  readonly block?: boolean;
  readonly data?: Record<string, unknown>;
  readonly metadata?: {
    readonly duration?: number;
    readonly timestamp?: string;
    readonly hookVersion?: string;
  };
};

export type HookResult = HookResultSuccess | HookResultFailure;

// Result builders with strict types
export const HookResults = {
  success: (
    message?: string,
    data?: Record<string, unknown>
  ): HookResultSuccess => ({ success: true, message, data }),

  failure: (
    message: string,
    block = false,
    data?: Record<string, unknown>
  ): HookResultFailure => ({ success: false, message, block, data }),

  block: (message: string): HookResultFailure => ({
    success: false,
    message,
    block: true,
  }),
} as const;

// ============================================================================
// HANDLER TYPES - Perfect type inference
// ============================================================================

// Handler type with perfect context inference
export type HookHandler<TContext extends HookContext = HookContext> = (
  context: TContext
) => Promise<HookResult> | HookResult;

// Tool-specific handler helpers
export type BashHandler = HookHandler<ToolHookContext<'Bash'>>;
export type WriteHandler = HookHandler<ToolHookContext<'Write'>>;
export type EditHandler = HookHandler<ToolHookContext<'Edit'>>;

// ============================================================================
// BUILDER PATTERN - Phantom types for state tracking
// ============================================================================

type HookBuilderState = {
  readonly hasEvent: boolean;
  readonly hasHandler: boolean;
};

type BuilderComplete = { hasEvent: true; hasHandler: true };

export class HookBuilder<
  TState extends HookBuilderState = { hasEvent: false; hasHandler: false },
> {
  private constructor(private readonly config: Partial<HookRegistryEntry>) {}

  static create(): HookBuilder<{ hasEvent: false; hasHandler: false }> {
    return new HookBuilder({});
  }

  forEvent<T extends HookEvent>(
    event: T
  ): HookBuilder<{ hasEvent: true; hasHandler: TState['hasHandler'] }> {
    return new HookBuilder({
      ...this.config,
      event,
    }) as HookBuilder<{ hasEvent: true; hasHandler: TState['hasHandler'] }>;
  }

  withHandler<T extends HookContext>(
    handler: HookHandler<T>
  ): HookBuilder<{ hasEvent: TState['hasEvent']; hasHandler: true }> {
    return new HookBuilder({
      ...this.config,
      handler: handler as HookHandler,
    }) as HookBuilder<{ hasEvent: TState['hasEvent']; hasHandler: true }>;
  }

  withPriority(priority: number): HookBuilder<TState> {
    return new HookBuilder({ ...this.config, priority }) as HookBuilder<TState>;
  }

  // Only allow build when complete
  build(this: HookBuilder<BuilderComplete>): HookRegistryEntry {
    if (!(this.config.event && this.config.handler)) {
      throw new Error('Builder incomplete'); // Should never happen with phantom types
    }

    return {
      event: this.config.event,
      handler: this.config.handler,
      priority: this.config.priority ?? 0,
      enabled: this.config.enabled ?? true,
    };
  }
}

// ============================================================================
// REGISTRY TYPES - Discriminated unions for type safety
// ============================================================================

export type HookRegistryEntry = {
  readonly event: HookEvent;
  readonly handler: HookHandler;
  readonly priority?: number;
  readonly enabled?: boolean;
};

// Registry with type-safe lookup
export class TypeSafeHookRegistry {
  private readonly hooks = new Map<string, HookRegistryEntry[]>();

  register(entry: HookRegistryEntry): void {
    const key = `${entry.event.type}${
      'tool' in entry.event ? `:${entry.event.tool}` : ''
    }`;

    const existing = this.hooks.get(key) || [];
    this.hooks.set(
      key,
      [...existing, entry].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    );
  }

  getHandlers<T extends HookEvent>(
    event: T
  ): HookHandler<HookContext & { event: T }>[] {
    const key = `${event.type}${'tool' in event ? `:${event.tool}` : ''}`;
    const entries = this.hooks.get(key) || [];

    return entries
      .filter((entry) => entry.enabled !== false)
      .map((entry) => entry.handler) as HookHandler<
      HookContext & { event: T }
    >[];
  }
}

// ============================================================================
// VALIDATION - Type-safe input validation
// ============================================================================

export type ValidationResult<T> =
  | {
      readonly success: true;
      readonly data: T;
    }
  | {
      readonly success: false;
      readonly errors: readonly {
        readonly path: string;
        readonly message: string;
        readonly code?: string;
      }[];
    };

export function validateToolInput<T extends ToolName>(
  toolName: T,
  input: unknown
): ValidationResult<ToolInputMap[T]> {
  const schema = ToolSchemas[toolName];
  if (!schema) {
    return {
      success: false,
      errors: [
        {
          path: 'tool',
          message: `No validation schema for tool: ${toolName}`,
          code: 'UNKNOWN_TOOL',
        },
      ],
    };
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  return {
    success: true,
    data: result.data as ToolInputMap[T],
  };
}

// ============================================================================
// EXAMPLE USAGE - Type-safe hook creation
// ============================================================================

// ✅ Type-safe hook creation with perfect inference
const bashHook = HookBuilder.create()
  .forEvent({ type: 'PreToolUse', tool: 'Bash' })
  .withHandler((context): HookResult => {
    // context is perfectly typed as ToolHookContext<'Bash'>
    const { command } = context.toolInput; // command is CommandString

    if (command.includes('rm -rf')) {
      return HookResults.block('Dangerous command detected');
    }

    return HookResults.success('Command validated');
  })
  .withPriority(10)
  .build(); // ✅ Compiles - builder is complete

// ✅ Functional API with perfect type inference
const writeHook: HookRegistryEntry = {
  event: { type: 'PreToolUse', tool: 'Write' },
  handler: (context): HookResult => {
    // context.toolInput is perfectly typed as WriteToolInput
    const { file_path, content } = context.toolInput;

    // file_path is branded FilePath, content is branded ToolContent
    if (content.length > 500_000) {
      return HookResults.failure('File too large', false);
    }

    return HookResults.success();
  },
  priority: 5,
  enabled: true,
};

// ❌ This won't compile - illegal state prevented
// const invalidHook = HookBuilder.create().build(); // Error: Builder incomplete

export { bashHook, writeHook };
