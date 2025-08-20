# API Reference

Complete API documentation for all Grapple packages with types, examples, and usage patterns.

## Table of Contents

- [Core Package](#core-package)
- [CLI Package](#cli-package)
- [Validators Package](#validators-package)
- [Testing Package](#testing-package)
- [Configuration Package](#configuration-package)
- [Types Reference](#types-reference)

## Core Package

### @outfitter/hooks-core

The foundation package providing runtime, types, and core APIs.

#### Core Functions

##### `runClaudeHook(handler: HookHandler): void`

Main runtime function that reads JSON from stdin and executes your hook handler.

**Parameters:**

- `handler: HookHandler` - Async function that processes the hook context and returns a result

**Example:**

```typescript
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  console.log(`Processing ${context.toolName} with event ${context.event}`);

  // Your hook logic here
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    if (command.includes('dangerous-operation')) {
      return HookResults.block('Operation blocked for security');
    }
  }

  return HookResults.success('Hook executed successfully');
});
```

##### `HookResults`

Static factory methods for creating hook results:

**Methods:**

- `HookResults.success(message: string, data?: any): HookResult`
- `HookResults.failure(message: string, error?: any): HookResult`
- `HookResults.block(message: string, reason?: string): HookResult` (PreToolUse only)

**Examples:**

```typescript
// Success result
return HookResults.success('Validation passed', {
  checks: ['security', 'syntax'],
  duration: 150,
});

// Failure result
return HookResults.failure('Validation failed', new Error('Invalid syntax'));

// Block result (PreToolUse only)
return HookResults.block('Dangerous command detected', 'Contains rm -rf pattern');
```

#### Builder Pattern API

##### `HookBuilder`

Fluent interface for building complex hooks with middleware and conditions.

**Methods:**

###### `.forPreToolUse(): HookBuilder`

Configure hook to run before tool execution.

###### `.forPostToolUse(): HookBuilder`

Configure hook to run after tool execution.

###### `.forTool(toolName: ToolName): HookBuilder`

Scope hook to specific tool. Omit for universal hooks.

**Parameters:**

- `toolName: ToolName` - Tool to target ('Bash', 'Write', 'Edit', etc.)

###### `.withHandler(handler: HookHandler): HookBuilder`

Set the main hook handler function.

**Parameters:**

- `handler: HookHandler` - Async function that processes the context

###### `.withMiddleware(middleware: Middleware): HookBuilder`

Add middleware to the execution chain.

**Parameters:**

- `middleware: Middleware` - Middleware function

###### `.withPriority(priority: number): HookBuilder`

Set execution priority (higher priority executes first).

**Parameters:**

- `priority: number` - Priority value (default: 0)

###### `.withTimeout(timeout: number): HookBuilder`

Set execution timeout in milliseconds.

**Parameters:**

- `timeout: number` - Timeout in milliseconds

###### `.withCondition(condition: (context: HookContext) => boolean): HookBuilder`

Add conditional execution logic.

**Parameters:**

- `condition: Function` - Function that returns true if hook should execute

###### `.build(): Hook`

Create the hook instance.

**Example:**

```typescript
import { HookBuilder, middleware } from '@outfitter/hooks-core';

const bashSecurityHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // Only runs for Bash commands
  .withPriority(100)
  .withTimeout(10000)
  .withMiddleware(middleware.logging('info'))
  .withMiddleware(middleware.timing())
  .withCondition((context) => process.env.NODE_ENV === 'production')
  .withHandler(async (context) => {
    const { command } = context.toolInput as { command: string };

    const dangerousPatterns = [/rm\s+-rf\s+\//, /sudo.*rm/, /curl.*\|\s*sh/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(`Blocked dangerous command: ${pattern.source}`);
      }
    }

    return HookResults.success('Bash security check passed');
  })
  .build();
```

#### Middleware

Built-in middleware for common functionality.

##### `middleware.logging(level?: LogLevel): Middleware`

Adds request/response logging.

**Parameters:**

- `level?: LogLevel` - Log level ('debug', 'info', 'warn', 'error')

**Example:**

```typescript
.withMiddleware(middleware.logging('info'))
```

##### `middleware.timing(): Middleware`

Adds execution timing to hook results.

**Example:**

```typescript
.withMiddleware(middleware.timing())
// Result will include metadata.duration
```

##### `middleware.errorHandling(options?: ErrorHandlingOptions): Middleware`

Adds comprehensive error handling.

**Parameters:**

- `options?.logErrors: boolean` - Log errors to console (default: true)
- `options?.throwOnError: boolean` - Re-throw errors (default: false)

**Example:**

```typescript
.withMiddleware(middleware.errorHandling({
  logErrors: true,
  throwOnError: false
}))
```

#### Type Guards

Type guards for safe tool input type narrowing.

##### Tool Input Type Guards

- `isBashToolInput(input: unknown): input is BashToolInput`
- `isWriteToolInput(input: unknown): input is WriteToolInput`
- `isEditToolInput(input: unknown): input is EditToolInput`
- `isReadToolInput(input: unknown): input is ReadToolInput`
- `isMultiEditToolInput(input: unknown): input is MultiEditToolInput`
- `isGlobToolInput(input: unknown): input is GlobToolInput`
- `isGrepToolInput(input: unknown): input is GrepToolInput`

**Example:**

```typescript
if (context.toolName === 'Bash' && isBashToolInput(context.toolInput)) {
  // context.toolInput is now typed as BashToolInput
  const { command, timeout, description } = context.toolInput;
  console.log(`Executing: ${command}`);
}
```

#### Declarative Configuration

##### `defineHook(config: HookConfig): Hook`

Create hooks using declarative configuration.

**Parameters:**

- `config: HookConfig` - Hook configuration object

**Example:**

```typescript
import { defineHook, HookResults, middleware } from '@outfitter/hooks-core';

export const projectHooks = [
  // Universal security check
  defineHook({
    event: 'PreToolUse',
    // No tool specified = universal
    handler: async (context) => {
      console.log(`Security check for ${context.toolName}`);
      return HookResults.success('Universal check passed');
    },
    priority: 100,
    middleware: [middleware.logging('info')],
  }),

  // Bash-specific monitoring
  defineHook({
    event: 'PreToolUse',
    tool: 'Bash', // Only for Bash
    handler: async (context) => {
      console.log('Bash command monitoring');
      return HookResults.success('Bash monitoring completed');
    },
    condition: (ctx) => process.env.NODE_ENV === 'production',
  }),

  // File formatting after writes
  defineHook({
    event: 'PostToolUse',
    tool: 'Write', // Only for Write operations
    handler: async (context) => {
      const { file_path } = context.toolInput as { file_path: string };
      console.log(`Auto-formatting: ${file_path}`);
      return HookResults.success(`Formatted ${file_path}`);
    },
    timeout: 30000,
  }),
];
```

## CLI Package

### @outfitter/hooks-cli

Command-line tools for hook development and management.

#### Programmatic API

##### `CLI` Class

```typescript
import { CLI } from '@outfitter/hooks-cli';

const cli = new CLI();

// Initialize project
await cli.init({
  typescript: true,
  template: 'security',
  strict: true,
});

// Generate hook
await cli.generate({
  type: 'PreToolUse',
  tool: 'Bash',
  name: 'security-check',
});

// Build configuration
await cli.build({
  environment: 'production',
  output: '.claude/settings.prod.json',
});

// Test hooks
await cli.test({
  hook: './hooks/security.ts',
  verbose: true,
});
```

##### `ConfigManager` Class

```typescript
import { ConfigManager } from '@outfitter/hooks-cli';

const config = new ConfigManager('./project');

// Initialize configuration
await config.initialize();

// Set hook configuration
config.setHook('PreToolUse', 'Bash', {
  command: 'bun run security.ts',
  timeout: 10000,
});

// Save configuration
await config.save();

// Validate configuration
const isValid = await config.validate();
```

##### `TemplateEngine` Class

```typescript
import { TemplateEngine } from '@outfitter/hooks-cli';

const templates = new TemplateEngine();

// Load template
const template = await templates.load('security');

// Generate from template
await templates.generate(template, {
  runtime: 'bun',
  typescript: true,
});

// Create custom template
const customTemplate = templates.create({
  name: 'custom-security',
  hooks: {
    PreToolUse: {
      '*': {
        command: 'bun hooks/custom-security.ts',
      },
    },
  },
});
```

## Validators Package

### @outfitter/hooks-validators

Security validation and environment-specific rules.

#### Security Validators

##### `SecurityValidators` Class

```typescript
import { SecurityValidators } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  // Environment-specific validation
  switch (process.env.NODE_ENV) {
    case 'production':
      await SecurityValidators.production(context);
      break;
    case 'development':
      await SecurityValidators.development(context);
      break;
    default:
      await SecurityValidators.strict(context);
  }

  return HookResults.success('Security validation passed');
});
```

**Methods:**

###### `SecurityValidators.production(context: HookContext): Promise<ValidationResult>`

Strict security validation for production environments.

###### `SecurityValidators.development(context: HookContext): Promise<ValidationResult>`

Lenient validation for development environments.

###### `SecurityValidators.strict(context: HookContext): Promise<ValidationResult>`

Maximum security validation for unknown environments.

###### `SecurityValidators.custom(rules: SecurityRule[]): Validator`

Create custom validator with specific rules.

**Example:**

```typescript
const customValidator = SecurityValidators.custom([
  {
    name: 'no-sudo',
    pattern: /sudo/,
    severity: 'error',
    message: 'Sudo commands not allowed',
  },
  {
    name: 'safe-curl',
    pattern: /curl.*\|\s*sh/,
    severity: 'warning',
    message: 'Piping curl to shell is dangerous',
  },
]);
```

#### Validation Rules

##### Built-in Security Rules

```typescript
interface SecurityRule {
  name: string;
  pattern: RegExp;
  severity: 'error' | 'warning' | 'info';
  message: string;
  tools?: ToolName[];
}

// Built-in rules
const SECURITY_RULES = [
  {
    name: 'dangerous-rm',
    pattern: /rm\s+-rf\s+\//,
    severity: 'error',
    message: 'Dangerous rm -rf / command',
    tools: ['Bash'],
  },
  {
    name: 'sudo-rm',
    pattern: /sudo\s+rm/,
    severity: 'error',
    message: 'Dangerous sudo rm command',
    tools: ['Bash'],
  },
  {
    name: 'pipe-to-shell',
    pattern: /curl.*\|\s*sh/,
    severity: 'warning',
    message: 'Piping to shell is risky',
    tools: ['Bash'],
  },
];
```

## Testing Package

### @outfitter/hooks-testing

Testing framework and utilities for hook development.

#### Mock Utilities

##### `createMockContext<TEvent, TTool>(event: TEvent, options: MockOptions<TTool>): HookContext<TEvent, TTool>`

Create mock hook contexts for testing.

**Parameters:**

- `event: HookEvent` - Hook event type
- `options: MockOptions` - Context options

**Example:**

```typescript
import { createMockContext } from '@outfitter/hooks-testing';

const context = createMockContext('PreToolUse', {
  toolName: 'Bash',
  toolInput: { command: 'ls -la' },
  sessionId: 'test-session',
  cwd: '/tmp',
});
```

##### `testHook(event: HookEvent): TestBuilder`

Fluent API for testing hooks.

**Example:**

```typescript
import { testHook } from '@outfitter/hooks-testing';

await testHook('PreToolUse')
  .withContext({
    toolName: 'Bash',
    toolInput: { command: 'rm -rf /' },
  })
  .expect((result) => {
    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
  })
  .run(securityHook);
```

#### Test Framework

##### `describe` and `test` Integration

```typescript
import { createMockContext, testHook } from '@outfitter/hooks-testing';

describe('Security Hook', () => {
  test('blocks dangerous commands', async () => {
    const context = createMockContext('PreToolUse', {
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /' },
    });

    const result = await securityHook.handler(context);

    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
    expect(result.message).toContain('dangerous command');
  });

  test('allows safe commands', async () => {
    await testHook('PreToolUse')
      .withContext({
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
      })
      .expect((result) => {
        expect(result.success).toBe(true);
        expect(result.block).toBe(false);
      })
      .run(securityHook);
  });
});
```

## Configuration Package

### @outfitter/hooks-config

Configuration management and template system.

#### Configuration API

##### `defineConfig(config: GrappleConfig): GrappleConfig`

Define comprehensive hook configuration.

**Example:**

```typescript
import { defineConfig } from '@outfitter/hooks-config';

export default defineConfig({
  runtime: 'bun',
  typescript: true,
  strict: true,

  hooks: {
    PreToolUse: {
      '*': {
        command: 'bun hooks/universal-security.ts',
        timeout: 5000,
        enabled: true,
      },
      Bash: {
        command: 'bun hooks/bash-security.ts',
        timeout: 10000,
        enabled: process.env.NODE_ENV === 'production',
      },
    },
  },

  environments: {
    development: {
      hooks: {
        PreToolUse: {
          '*': { timeout: 2000 },
        },
      },
    },
  },
});
```

##### `defineTemplate(template: TemplateConfig): TemplateConfig`

Create custom hook templates.

**Example:**

```typescript
import { defineTemplate } from '@outfitter/hooks-config';

export default defineTemplate({
  name: 'custom-security',
  description: 'Custom security template',

  hooks: {
    PreToolUse: {
      '*': {
        command: 'bun hooks/security.ts',
        timeout: 5000,
      },
    },
  },

  files: [
    {
      path: 'hooks/security.ts',
      content: securityHookTemplate,
    },
  ],

  dependencies: ['@outfitter/hooks-core'],

  postInstall: async (context) => {
    console.log('Security template installed!');
  },
});
```

## Types Reference

### Core Types

#### `HookContext<TEvent, TTool>`

```typescript
interface HookContext<TEvent extends HookEvent, TTool extends ToolName> {
  sessionId: string;
  cwd: string;
  transcriptPath: string;
  event: TEvent;
  toolName: TTool;
  toolInput: GetToolInput<TTool>;
  toolResponse?: string; // Only for PostToolUse
}
```

#### `HookResult`

```typescript
interface HookResult {
  success: boolean;
  block?: boolean; // PreToolUse only
  message: string;
  data?: any;
  metadata?: {
    duration?: number;
    timestamp?: string;
    [key: string]: any;
  };
}
```

#### `HookHandler`

```typescript
type HookHandler<TEvent = HookEvent, TTool = ToolName> = (
  context: HookContext<TEvent, TTool>,
) => Promise<HookResult>;
```

#### Tool Input Types

##### `BashToolInput`

```typescript
interface BashToolInput {
  command: string;
  timeout?: number;
  description?: string;
}
```

##### `WriteToolInput`

```typescript
interface WriteToolInput {
  file_path: string;
  content: string;
}
```

##### `EditToolInput`

```typescript
interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}
```

##### `ReadToolInput`

```typescript
interface ReadToolInput {
  file_path: string;
  limit?: number;
  offset?: number;
}
```

#### Event Types

```typescript
type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop';
```

#### Tool Types

```typescript
type ToolName =
  | 'Bash'
  | 'Edit'
  | 'Write'
  | 'Read'
  | 'MultiEdit'
  | 'NotebookEdit'
  | 'Glob'
  | 'Grep'
  | 'LS'
  | 'Task'
  | 'WebFetch'
  | 'WebSearch';
```

### Generic Type Utilities

#### `GetToolInput<TTool>`

Extract tool input type for a specific tool:

```typescript
type BashInput = GetToolInput<'Bash'>; // BashToolInput
type WriteInput = GetToolInput<'Write'>; // WriteToolInput
```

#### `HookContext` Utilities

```typescript
// Pre-tool context
type PreToolUseContext<TTool> = HookContext<'PreToolUse', TTool>;

// Post-tool context
type PostToolUseContext<TTool> = HookContext<'PostToolUse', TTool>;

// Specific tool contexts
type BashPreContext = HookContext<'PreToolUse', 'Bash'>;
type WritePostContext = HookContext<'PostToolUse', 'Write'>;
```

---

**Complete API reference for building robust hooks!** 📚

For practical examples, see:

- [Getting Started](../getting-started.md) - Basic usage patterns
- [Examples](../examples/) - Real-world implementations
- [Architecture Guide](../architecture.md) - System design details
