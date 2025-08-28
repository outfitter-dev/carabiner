# Getting Started with Carabiner

Carabiner is a TypeScript framework for building type-safe hooks for AI assistant integrations. This guide will help you get started with creating your own hooks.

## Installation

Install the core packages:

```bash
bun add @carabiner/types @carabiner/hooks-core @carabiner/execution
```

For development, also install:

```bash
bun add -d @carabiner/hooks-testing @carabiner/hooks-validators
```

## Quick Start

### 1. Create Your First Hook

```typescript
import { HookHandler } from '@carabiner/types';

export const myFirstHook: HookHandler = async (context) => {
  // Only process PreToolUse events
  if (context.event !== 'PreToolUse') {
    return { success: true };
  }

  // Access tool information
  const { toolName, toolInput } = context;
  
  // Perform your hook logic
  console.log(`About to use tool: ${toolName}`);
  
  return {
    success: true,
    message: 'Hook processed successfully'
  };
};
```

### 2. Register Your Hook

```typescript
import { HookRegistry } from '@carabiner/registry';
import { myFirstHook } from './my-first-hook';

const registry = new HookRegistry();

// Register for PreToolUse events
registry.register('PreToolUse', myFirstHook);
```

### 3. Execute Hooks

```typescript
import { HookExecutor } from '@carabiner/execution';

const executor = new HookExecutor(registry);

// Execute hooks for an event
const result = await executor.execute('PreToolUse', {
  toolName: 'Edit',
  toolInput: { file_path: 'example.ts', content: '...' }
});

if (!result.success) {
  console.error('Hook execution failed:', result.error);
}
```

## Hook Event Types

Carabiner supports the following event types:

- **PreToolUse**: Before a tool is executed
- **PostToolUse**: After a tool completes
- **PreResponse**: Before sending a response
- **PostResponse**: After a response is sent
- **OnError**: When an error occurs

## Advanced Features

### Security Validators

Protect sensitive files with validators:

```typescript
import { createFileAccessValidator } from '@carabiner/hooks-validators';

const protectSecrets = createFileAccessValidator({
  protectedPaths: ['.env', '**/*.key', '**/*.pem'],
  protectedPatterns: [/password/i, /secret/i]
});

registry.register('PreToolUse', protectSecrets);
```

### Testing Your Hooks

```typescript
import { test, expect } from 'bun:test';
import { createMockContext } from '@carabiner/hooks-testing';

test('my hook blocks dangerous operations', async () => {
  const context = createMockContext({
    event: 'PreToolUse',
    toolName: 'Edit',
    toolInput: { file_path: '.env' }
  });

  const result = await myHook(context);
  
  expect(result.success).toBe(false);
  expect(result.message).toContain('blocked');
});
```

## Example Hooks

Check out the `@carabiner/hooks-registry` package for ready-to-use hooks:

- **Markdown Formatter**: Auto-formats markdown files
- **Security Scanner**: Validates file operations
- **Git Validator**: Enforces commit message standards
- **Test Runner**: Runs tests after code changes

```typescript
import { 
  markdownFormatterHook,
  securityScannerHook 
} from '@carabiner/hooks-registry';

registry.register('PostToolUse', markdownFormatterHook);
registry.register('PreToolUse', securityScannerHook);
```

## Configuration

Create a `.carabiner.json` configuration file:

```json
{
  "hooks": {
    "PreToolUse": {
      "timeout": 5000,
      "handlers": ["security-validator", "rate-limiter"]
    },
    "PostToolUse": {
      "handlers": ["markdown-formatter", "test-runner"]
    }
  }
}
```

## TypeScript Support

Carabiner is built with TypeScript and provides full type safety:

```typescript
import type { 
  HookHandler, 
  HookContext, 
  HookResult,
  EventType 
} from '@carabiner/types';

// All types are fully typed and documented
const typedHook: HookHandler<'PreToolUse'> = async (context) => {
  // TypeScript knows context has toolName and toolInput
  const { toolName, toolInput } = context;
  return { success: true };
};
```

## Best Practices

1. **Keep hooks focused**: Each hook should do one thing well
2. **Handle errors gracefully**: Always return proper error messages
3. **Use type safety**: Leverage TypeScript's type system
4. **Test thoroughly**: Use the testing utilities
5. **Document your hooks**: Add JSDoc comments
6. **Performance matters**: Keep hooks fast (<100ms)

## Next Steps

- Explore the [API Documentation](./docs/api.md)
- Browse [Example Hooks](./packages/examples)
- Join our [Community](https://github.com/outfitter-dev/carabiner/discussions)
- Report [Issues](https://github.com/outfitter-dev/carabiner/issues)

## License

MIT © Outfitter