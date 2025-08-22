# Type-Safe Refactoring Plan for @outfitter/carabiner

## Core Type Safety Principles

1. **Eliminate all `any` and `unknown` types**
2. **Replace runtime guards with compile-time + Zod validation**
3. **Use branded types for domain modeling**
4. **Leverage TypeScript 5.7+ features**
5. **Make illegal states unrepresentable**

## Package Architecture

### 1. `@carabiner/types` - Core Type System

```typescript
// Branded types for type safety
export type SessionId = string & { readonly __brand: 'SessionId' };
export type FilePath = string & { readonly __brand: 'FilePath' };
export type CommandString = string & { readonly __brand: 'CommandString' };
export type ToolName =
  | 'Bash'
  | 'Edit'
  | 'MultiEdit'
  | 'Write'
  | 'Read'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch'
  | 'NotebookEdit';

// Discriminated unions for events
export type HookEvent =
  | { readonly type: 'PreToolUse'; readonly tool: ToolName }
  | { readonly type: 'PostToolUse'; readonly tool: ToolName }
  | { readonly type: 'UserPromptSubmit' }
  | { readonly type: 'SessionStart' }
  | { readonly type: 'Stop' }
  | { readonly type: 'SubagentStop' };

// Tool input types with strict mapping
export interface ToolInputs {
  readonly Bash: { readonly command: CommandString; readonly timeout?: number };
  readonly Write: { readonly file_path: FilePath; readonly content: string };
  // ... other tools
}

// Context types become simple and predictable
export interface HookContext<T extends HookEvent> {
  readonly event: T;
  readonly sessionId: SessionId;
  readonly cwd: FilePath;
  readonly toolInput: T extends { tool: infer Tool extends ToolName } ? ToolInputs[Tool] : never;
}
```

### 2. `@carabiner/schemas` - Zod Validation

```typescript
import { z } from 'zod';
import type { SessionId, FilePath, CommandString } from '@carabiner/types';

// Branded type constructors
const SessionIdSchema = z.string().min(1).brand<'SessionId'>();
const FilePathSchema = z.string().min(1).brand<'FilePath'>();
const CommandStringSchema = z.string().min(1).max(10000).brand<'CommandString'>();

// Tool schemas with compile-time + runtime safety
export const BashInputSchema = z
  .object({
    command: CommandStringSchema,
    timeout: z.number().min(100).max(300000).optional(),
  })
  .readonly();

export const WriteInputSchema = z
  .object({
    file_path: FilePathSchema,
    content: z.string().max(1000000),
  })
  .readonly();

// Hook event schemas
export const PreToolUseEventSchema = z
  .object({
    type: z.literal('PreToolUse'),
    tool: z.enum(['Bash', 'Write', 'Edit' /*...*/]),
  })
  .readonly();

// Context validation with perfect type inference
export function validateHookContext<T extends HookEvent>(
  input: unknown,
  eventSchema: z.ZodSchema<T>,
): { success: true; data: HookContext<T> } | { success: false; error: z.ZodError } {
  // Implementation with full type safety
}
```

### 3. `@carabiner/protocols` - Protocol Abstraction

```typescript
// Protocol interface with phantom types
export interface Protocol<TInput, TOutput> {
  readonly __protocolInput: TInput;
  readonly __protocolOutput: TOutput;
  readonly name: string;
  readonly version: SemVer;
}

// Concrete protocols
export interface ClaudeHookProtocol extends Protocol<ClaudeHookInput, HookResult> {
  readonly name: 'claude-hook';
  readonly version: '1.0.0';
}

// Type-safe protocol implementation
export class ProtocolHandler<P extends Protocol<any, any>> {
  constructor(private readonly protocol: P) {}

  async handle(input: P['__protocolInput']): Promise<P['__protocolOutput']> {
    // Implementation with perfect type safety
  }
}
```

### 4. `@carabiner/builders` - Simplified Builder Pattern

```typescript
// Builder with phantom types and state tracking
export class HookBuilder<TBuilt extends boolean = false> {
  private constructor(private readonly config: Partial<HookConfig>) {}

  static create(): HookBuilder<false> {
    return new HookBuilder({});
  }

  forEvent<T extends HookEvent['type']>(event: T): HookBuilder<false> {
    return new HookBuilder({ ...this.config, event });
  }

  withHandler<T extends HookEvent>(
    handler: (ctx: HookContext<T>) => Promise<HookResult>,
  ): HookBuilder<true> {
    return new HookBuilder({ ...this.config, handler }) as HookBuilder<true>;
  }

  // Only allow build() when TBuilt = true
  build(this: HookBuilder<true>): HookRegistryEntry {
    // Implementation with compile-time completeness checking
  }
}
```

## TypeScript 5.7+ Features to Leverage

### 1. `const` Type Parameters

```typescript
function createValidator<const T extends ToolName>(tool: T) {
  return (input: ToolInputs[T]) => {
    // Perfect type inference without generics hell
  };
}
```

### 2. Enhanced Template Literal Types

```typescript
type EventToolCombo = `${HookEvent['type']}:${ToolName}`;
// "PreToolUse:Bash" | "PreToolUse:Write" | ...
```

### 3. Better Inference with `satisfies`

```typescript
const toolSchemas = {
  Bash: BashInputSchema,
  Write: WriteInputSchema,
  // ...
} satisfies Record<ToolName, z.ZodSchema>;
```

## Elimination Strategy for `unknown` and `any`

### Before (❌ Type-unsafe):

```typescript
tool_input: Record<string, unknown>
ValidationRule<T = any>

```

### After (✅ Type-safe):

```typescript
// No unknown - everything is strongly typed through Zod + branded types
toolInput: ToolInputs[T['tool']]  // Perfect inference
ValidationRule<T extends z.ZodType>  // No any, constrained to Zod types

```

## Making Illegal States Unrepresentable

### Current Issues:

- Can have PreToolUse without tool
- Can have empty validation rules
- Can have invalid tool/event combinations

### Solutions:

```typescript
// ❌ Current - illegal states possible
interface HookRegistryEntry {
  event: HookEvent;
  tool?: ToolName; // Optional creates illegal combinations
}

// ✅ Fixed - illegal states impossible
type HookRegistryEntry =
  | { readonly event: 'SessionStart'; readonly handler: SessionHandler }
  | { readonly event: 'PreToolUse'; readonly tool: ToolName; readonly handler: ToolHandler }
  | { readonly event: 'PostToolUse'; readonly tool: ToolName; readonly handler: ToolHandler };
```

## Security Through Types

### Branded Types for Sensitive Data

```typescript
export type SecureCommand = string & {
  readonly __brand: 'SecureCommand';
  readonly __validated: true;
};

export function validateCommand(cmd: string): SecureCommand | ValidationError {
  // Runtime validation that produces compile-time guarantees
}
```

### Phantom Types for State Tracking

```typescript
interface ValidationResult<TValid extends boolean> {
  readonly valid: TValid;
  readonly data: TValid extends true ? ValidatedData : never;
  readonly errors: TValid extends false ? ValidationError[] : never;
}
```

## Migration Path

1. **Phase 1**: Introduce `@carabiner/types` with branded types
2. **Phase 2**: Replace runtime guards with `@carabiner/schemas`
3. **Phase 3**: Implement `@carabiner/protocols` abstraction
4. **Phase 4**: Simplify builders with phantom types
5. **Phase 5**: Remove all `any`/`unknown` through strict typing

## Strict Quality Gates

- **Pre-commit**: `tsc --noEmit --strict`
- **CI**: `tsc --noUncheckedIndexedAccess --exactOptionalPropertyTypes`
- **Tests**: 100% type coverage through dtslint
- **Ultracite**: Zero violations, all rules enforced

This refactoring will eliminate all type safety issues while maintaining backwards compatibility through careful migration phases.
