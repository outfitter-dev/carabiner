# Greenfield Refactoring Plan: @outfitter/carabiner

**Date:** 2025-01-11 **Author:** Claude Code **Status:** In Progress **Timeline:** 8-11 weeks total

## Executive Summary

This document outlines a comprehensive refactoring of the @outfitter/carabiner Claude Code hooks system, leveraging the freedom of having no existing users to implement breaking changes that will significantly improve developer experience, type safety, and maintainability.

## Current State Analysis

### Problems with Current Architecture

1. **Over-engineered Type System**
   - 477 lines of complex generic types in `types.ts`
   - Excessive conditional types causing inference issues
   - Runtime type guards instead of compile-time validation

2. **Monolithic Package Structure**
   - `hooks-core` handles too many responsibilities
   - Tight coupling to stdin/stdout protocol
   - Difficult to test in isolation

3. **Complex Builder Pattern**
   - Unnecessary ceremony for simple hook creation
   - Complex middleware chains that obscure intent
   - Poor developer experience with generic inference

4. **Type Safety Issues**
   - `Record<string, unknown>` for critical inputs
   - Missing branded types for domain modeling
   - `any` types still present in codebase

## Proposed Architecture

### Core Principles

1. **Simplicity over Flexibility** - Concrete types over complex generics
2. **Composition over Configuration** - Small, focused packages
3. **Type Safety First** - Make illegal states unrepresentable
4. **Developer Experience** - Clear, discoverable APIs

### Package Structure

````text

packages/
├── @carabiner/types          # Core type definitions (branded types, domains)
├── @carabiner/schemas         # Zod validation schemas
├── @carabiner/protocol        # I/O abstraction layer
├── @carabiner/context         # Context creation and management
├── @carabiner/execution       # Hook execution engine
├── @carabiner/registry        # Hook registration and discovery
├── @carabiner/testing         # Testing utilities
├── @carabiner/cli            # CLI tools
└── @carabiner/examples       # Example implementations

```text

## Implementation Phases

### Phase 1: Type System Overhaul (Weeks 1-3)

#### Goals

- Replace complex generics with concrete types
- Introduce branded types for domain safety
- Implement Zod schemas for validation
- Eliminate all `any` and `unknown` usage

#### Deliverables

**1.1 Create @carabiner/types Package**

```typescript
// packages/types/src/brands.ts
export type SessionId = string & { __brand: 'SessionId' };
export type FilePath = string & { __brand: 'FilePath' };
export type CommandString = string & { __brand: 'CommandString' };
export type TranscriptPath = string & { __brand: 'TranscriptPath' };

// Brand creators with validation
export function createSessionId(value: string): SessionId {
  if (!value.match(/^[a-zA-Z0-9-]+$/)) {
    throw new Error('Invalid session ID format');
  }
  return value as SessionId;
}

export function createFilePath(value: string): FilePath {
  if (!value.startsWith('/')) {
    throw new Error('File path must be absolute');
  }
  return value as FilePath;
}

export function createCommandString(value: string): CommandString {
  // Basic safety validation
  const dangerous = ['rm -rf /', 'dd if=/dev/zero', ':(){:|:&};:'];
  if (dangerous.some((d) => value.includes(d))) {
    throw new Error('Potentially dangerous command blocked');
  }
  return value as CommandString;
}

```text

**1.2 Create @carabiner/schemas Package**

```typescript
// packages/schemas/src/tool-inputs.ts
import { z } from 'zod';
import { createCommandString, createFilePath } from '@carabiner/types';

export const BashInputSchema = z
  .object({
    command: z.string().transform(createCommandString),
    description: z.string().optional(),
    timeout: z.number().min(100).max(600000).optional(),
    run_in_background: z.boolean().optional(),
  })
  .readonly();

export const WriteInputSchema = z
  .object({
    file_path: z.string().transform(createFilePath),
    content: z.string(),
  })
  .readonly();

export const EditInputSchema = z
  .object({
    file_path: z.string().transform(createFilePath),
    old_string: z.string(),
    new_string: z.string(),
    replace_all: z.boolean().optional(),
  })
  .readonly();

// Type exports
export type BashInput = z.infer<typeof BashInputSchema>;
export type WriteInput = z.infer<typeof WriteInputSchema>;
export type EditInput = z.infer<typeof EditInputSchema>;

```text

**1.3 Concrete Context Types**

```typescript
// packages/types/src/contexts.ts
import type { SessionId, FilePath, CommandString } from './brands';
import type { BashInput, WriteInput, EditInput } from '@carabiner/schemas';

interface BaseContext {
  sessionId: SessionId;
  transcriptPath: FilePath;
  cwd: FilePath;
  environment: Record<string, string>;
}

export interface BashPreToolUseContext extends BaseContext {
  event: 'PreToolUse';
  toolName: 'Bash';
  toolInput: BashInput;
}

export interface BashPostToolUseContext extends BashPreToolUseContext {
  event: 'PostToolUse';
  toolResponse: {
    stdout?: string;
    stderr?: string;
    exitCode: number;
  };
}

export interface WritePreToolUseContext extends BaseContext {
  event: 'PreToolUse';
  toolName: 'Write';
  toolInput: WriteInput;
}

export interface WritePostToolUseContext extends WritePreToolUseContext {
  event: 'PostToolUse';
  toolResponse: {
    success: boolean;
    bytesWritten?: number;
  };
}

// Union of all contexts
export type HookContext =
  | BashPreToolUseContext
  | BashPostToolUseContext
  | WritePreToolUseContext
  | WritePostToolUseContext
  | UserPromptContext
  | SessionStartContext;

```text

#### Testing Plan

```typescript
// packages/types/src/__tests__/brands.test.ts
import { describe, expect, test } from 'bun:test';
import { createSessionId, createFilePath, createCommandString } from '../brands';

describe('Brand Types', () => {
  describe('SessionId', () => {
    test('should accept valid session IDs', () => {
      expect(() => createSessionId('test-session-123')).not.toThrow();
    });

    test('should reject invalid session IDs', () => {
      expect(() => createSessionId('test session!')).toThrow();
    });
  });

  describe('CommandString', () => {
    test('should accept safe commands', () => {
      expect(() => createCommandString('ls -la')).not.toThrow();
    });

    test('should reject dangerous commands', () => {
      expect(() => createCommandString('rm -rf /')).toThrow();
    });
  });
});

```text

### Phase 2: Protocol Abstraction (Weeks 4-5)

#### Goals

- Decouple from stdin/stdout
- Enable multiple I/O protocols
- Improve testability

#### Deliverables

**2.1 Create @carabiner/protocol Package**

```typescript
// packages/protocol/src/interface.ts
import type { HookContext, HookResult } from '@carabiner/types';

export interface HookProtocol {
  readInput(): Promise<unknown>;
  parseContext(input: unknown): HookContext;
  writeOutput(result: HookResult): Promise<void>;
  writeError(error: Error): Promise<void>;
}

// packages/protocol/src/stdin.ts
export class StdinProtocol implements HookProtocol {
  async readInput(): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(input);
  }

  parseContext(input: unknown): HookContext {
    // Use Zod schemas to validate and transform input
    const validated = InputSchema.parse(input);
    return createContext(validated);
  }

  async writeOutput(result: HookResult): Promise<void> {
    process.stdout.write(JSON.stringify(result));
  }

  async writeError(error: Error): Promise<void> {
    process.stderr.write(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
    );
  }
}

// packages/protocol/src/http.ts
export class HttpProtocol implements HookProtocol {
  constructor(private request: Request) {}

  async readInput(): Promise<unknown> {
    return await this.request.json();
  }

  parseContext(input: unknown): HookContext {
    const validated = InputSchema.parse(input);
    return createContext(validated);
  }

  async writeOutput(result: HookResult): Promise<void> {
    // Store for later retrieval via Response
    this.result = result;
  }

  async writeError(error: Error): Promise<void> {
    this.error = error;
  }

  getResponse(): Response {
    if (this.error) {
      return new Response(JSON.stringify({ error: this.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(this.result), {
      status: this.result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// packages/protocol/src/test.ts
export class TestProtocol implements HookProtocol {
  constructor(private input: unknown) {}
  output?: HookResult;
  error?: Error;

  async readInput(): Promise<unknown> {
    return this.input;
  }

  parseContext(input: unknown): HookContext {
    return createContext(input);
  }

  async writeOutput(result: HookResult): Promise<void> {
    this.output = result;
  }

  async writeError(error: Error): Promise<void> {
    this.error = error;
  }
}

```text

### Phase 3: Simplified Execution Engine (Weeks 6-7)

#### Goals

- Simple, predictable execution model
- Remove complex middleware chains
- Clear error handling with Result types

#### Deliverables

**3.1 Create @carabiner/execution Package**

```typescript
// packages/execution/src/executor.ts
import type { HookProtocol } from '@carabiner/protocol';
import type { HookHandler, HookContext, HookResult } from '@carabiner/types';

export class HookExecutor {
  constructor(private protocol: HookProtocol) {}

  async execute(handler: HookHandler): Promise<never> {
    try {
      const input = await this.protocol.readInput();
      const context = this.protocol.parseContext(input);
      const result = await this.runHandler(handler, context);
      await this.protocol.writeOutput(result);
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      await this.protocol.writeError(error as Error);
      process.exit(1);
    }
  }

  private async runHandler(handler: HookHandler, context: HookContext): Promise<HookResult> {
    try {
      const result = await handler(context);
      return this.validateResult(result);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        block: context.event === 'PreToolUse',
      };
    }
  }

  private validateResult(result: HookResult): HookResult {
    if (typeof result.success !== 'boolean') {
      throw new Error('Invalid result: missing success field');
    }
    return result;
  }
}

// packages/execution/src/runner.ts
export function createRunner(handler: HookHandler) {
  return async function run() {
    const protocol = new StdinProtocol();
    const executor = new HookExecutor(protocol);
    await executor.execute(handler);
  };
}

```text

### Phase 4: Plugin Architecture (Weeks 8-9)

#### Goals

- Enable composition of small, focused hooks
- Configuration-driven hook assembly
- Support for third-party plugins

#### Deliverables

**4.1 Create Plugin System**

```typescript
// packages/registry/src/plugin.ts
import type { HookContext, HookResult } from '@carabiner/types';

export interface HookPlugin {
  name: string;
  version: string;
  events: string[];
  apply(context: HookContext): Promise<HookResult> | HookResult;
}

export class PluginRegistry {
  private plugins = new Map<string, HookPlugin>();

  register(plugin: HookPlugin): void {
    this.plugins.set(plugin.name, plugin);

    // Log registration
    logger.info(`Registered plugin: ${plugin.name}@${plugin.version}`);
  }

  async execute(context: HookContext): Promise<HookResult[]> {
    const results: HookResult[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.events.includes(context.event)) {
        const result = await plugin.apply(context);
        results.push(result);

        // Stop on blocking failure
        if (!result.success && result.block) {
          break;
        }
      }
    }

    return results;
  }

  getPlugins(): HookPlugin[] {
    return Array.from(this.plugins.values());
  }
}

```text

**4.2 Example Plugins**

```typescript
// packages/examples/src/plugins/git-safety.ts
import type { HookPlugin, BashPreToolUseContext } from '@carabiner/types';

export const gitSafetyPlugin: HookPlugin = {
  name: 'git-safety',
  version: '1.0.0',
  events: ['PreToolUse'],

  apply(context) {
    if (context.toolName !== 'Bash') return { success: true };

    const ctx = context as BashPreToolUseContext;
    const command = ctx.toolInput.command;

    // Block dangerous git operations
    const dangerous = ['git push --force', 'git push -f', 'git reset --hard HEAD~'];

    for (const pattern of dangerous) {
      if (command.includes(pattern)) {
        return {
          success: false,
          block: true,
          message: `Dangerous git operation blocked: ${pattern}`,
        };
      }
    }

    return { success: true };
  },
};

// packages/examples/src/plugins/file-backup.ts
export const fileBackupPlugin: HookPlugin = {
  name: 'file-backup',
  version: '1.0.0',
  events: ['PreToolUse'],

  async apply(context) {
    if (context.toolName !== 'Write' && context.toolName !== 'Edit') {
      return { success: true };
    }

    const filePath = context.toolInput.file_path;

    // Create backup
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await Bun.write(backupPath, await Bun.file(filePath).text());

      return {
        success: true,
        message: `Backup created: ${backupPath}`,
      };
    } catch (error) {
      // File doesn't exist yet, no backup needed
      return { success: true };
    }
  },
};

```text

## Testing Strategy

### Unit Tests

Each package will have comprehensive unit tests:

```typescript
// packages/types/__tests__/contexts.test.ts
describe('Context Types', () => {
  test('should create valid BashPreToolUseContext', () => {
    const context: BashPreToolUseContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      toolInput: {
        command: createCommandString('ls -la'),
      },
      sessionId: createSessionId('test-123'),
      transcriptPath: createFilePath('/tmp/transcript'),
      cwd: createFilePath('/home/user'),
      environment: {},
    };

    expect(context.event).toBe('PreToolUse');
    expect(context.toolName).toBe('Bash');
  });
});

```text

### Integration Tests

```typescript
// packages/execution/__tests__/integration.test.ts
describe('Hook Execution', () => {
  test('should execute hook with test protocol', async () => {
    const input = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      session_id: 'test-123',
      cwd: '/tmp',
    };

    const protocol = new TestProtocol(input);
    const executor = new HookExecutor(protocol);

    const handler = async (context: HookContext) => {
      return { success: true, message: 'Test passed' };
    };

    await executor.execute(handler);

    expect(protocol.output).toEqual({
      success: true,
      message: 'Test passed',
    });
  });
});

```text

### End-to-End Tests

```typescript
// e2e/__tests__/full-flow.test.ts
describe('Full Hook Flow', () => {
  test('should handle complete hook lifecycle', async () => {
    // Create plugin registry
    const registry = new PluginRegistry();
    registry.register(gitSafetyPlugin);
    registry.register(fileBackupPlugin);

    // Create test context
    const context: BashPreToolUseContext = {
      event: 'PreToolUse',
      toolName: 'Bash',
      toolInput: { command: createCommandString('git push --force') },
      // ... other fields
    };

    // Execute plugins
    const results = await registry.execute(context);

    // Verify blocking
    expect(results[0].success).toBe(false);
    expect(results[0].block).toBe(true);
    expect(results[0].message).toContain('Dangerous git operation blocked');
  });
});

```text

## Code Review Process

### Review Checkpoints

1. **Phase 1 Review** (End of Week 3)

   - Type system completeness
   - Zod schema coverage
   - Brand type safety

1. **Phase 2 Review** (End of Week 5)

   - Protocol abstraction completeness
   - Test protocol functionality
   - Error handling

1. **Phase 3 Review** (End of Week 7)

   - Execution engine simplicity
   - Error handling patterns
   - Performance characteristics

1. **Phase 4 Review** (End of Week 9)
   - Plugin architecture flexibility
   - Configuration system usability
   - Example coverage

### Review Criteria

- **Type Safety**: No `any`, minimal `unknown`, branded types used
- **Simplicity**: APIs are discoverable and obvious
- **Testability**: >90% test coverage
- **Performance**: Sub-10ms hook execution
- **Documentation**: All public APIs documented

## Migration Guide

### For Current Codebase

```typescript
// Before: Complex generic builder
const hook = new HookBuilder<'PreToolUse', 'Bash'>()
  .forEvent('PreToolUse')
  .forTool('Bash')
  .withHandler(handler)
  .withCondition(condition)
  .withMiddleware(middleware)
  .build();

// After: Simple function
const hook = createHook('PreToolUse', {
  tool: 'Bash',
  handler,
  condition, // optional
});

```text

### For Hook Authors

```typescript
// Before: Complex types and ceremony
import type { HookContext, HookHandler } from '@outfitter/hooks-core';

export const myHook: HookHandler<'PreToolUse', 'Bash'> = async (
  context: HookContext<'PreToolUse', 'Bash'>,
) => {
  // Complex type inference issues
};

// After: Simple, focused plugins
import type { HookPlugin, BashPreToolUseContext } from '@carabiner/types';

export const myPlugin: HookPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  events: ['PreToolUse'],

  apply(context) {
    if (context.toolName !== 'Bash') return { success: true };

    const ctx = context as BashPreToolUseContext;
    // Simple, type-safe code
    return { success: true };
  },
};

```text

## Success Metrics

1. **Developer Experience**

   - Time to write first hook: <5 minutes (from >30 minutes)
   - Type inference errors: 0 (from dozens)
   - API surface area: 50% reduction

1. **Code Quality**

   - Test coverage: >90%
   - TypeScript strict mode: 100% compliance
   - Bundle size: 30% reduction

1. **Performance**
   - Hook execution: <10ms
   - TypeScript compilation: 50% faster
   - Test suite runtime: <5 seconds

## Risk Mitigation

| Risk                   | Probability | Impact | Mitigation                                 |
| ---------------------- | ----------- | ------ | ------------------------------------------ |
| Scope creep            | Medium      | High   | Strict phase boundaries, regular reviews   |
| Performance regression | Low         | Medium | Benchmark before/after each phase          |
| Over-simplification    | Low         | Medium | Maintain flexibility through plugin system |
| Documentation lag      | High        | Medium | Document as we code, not after             |

## Timeline Summary

```mermaid
gantt
    title Refactoring Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Type System Overhaul :active, p1, 2025-01-11, 21d
    section Phase 2
    Protocol Abstraction :p2, after p1, 14d
    section Phase 3
    Execution Engine :p3, after p2, 14d
    section Phase 4
    Plugin Architecture :p4, after p3, 14d
    section Review
    Final Review :milestone, after p4, 0d

```text

## Next Steps

1. **Immediate** (Today)

   - Create `@carabiner/types` package with branded types
   - Create `@carabiner/schemas` package with Zod schemas
   - Write initial unit tests

1. **Week 1**

   - Complete type system overhaul
   - Migrate one existing hook as proof of concept
   - Update documentation

1. **Week 2-3**
   - Complete Phase 1 deliverables
   - Conduct Phase 1 review
   - Begin Phase 2 implementation

## Appendix: Code Examples

### Complete Hook Example (New Architecture)

```typescript
// my-git-hook.ts
import type { HookPlugin } from '@carabiner/types';
import { BashInputSchema } from '@carabiner/schemas';

export default {
  name: 'git-safety',
  version: '1.0.0',
  events: ['PreToolUse'],

  async apply(context) {
    // Type-safe context check
    if (context.event !== 'PreToolUse' || context.toolName !== 'Bash') {
      return { success: true };
    }

    // Validate with Zod
    const input = BashInputSchema.parse(context.toolInput);

    // Simple, clear logic
    if (input.command.includes('--force')) {
      return {
        success: false,
        block: true,
        message: 'Force operations require confirmation',
      };
    }

    return { success: true };
  },
} satisfies HookPlugin;

```text

### Test Example

```typescript
import { describe, expect, test } from 'bun:test';
import gitSafetyPlugin from './my-git-hook';
import { createMockContext } from '@carabiner/testing';

describe('Git Safety Plugin', () => {
  test('should block force push', async () => {
    const context = createMockContext('PreToolUse', 'Bash', {
      command: 'git push --force',
    });

    const result = await gitSafetyPlugin.apply(context);

    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
    expect(result.message).toContain('Force operations');
  });
});

```text

---

This plan provides a clear path forward for transforming the @outfitter/carabiner hooks system into a simpler, more maintainable, and more developer-friendly architecture.
````
