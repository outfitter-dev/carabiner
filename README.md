# Carabiner - Type-Safe Hooks Framework for AI Assistants

A comprehensive, production-ready TypeScript monorepo for building type-safe, maintainable hooks with modern development practices and enterprise-grade tooling.

## 🚀 Overview

Transform AI assistant hook development from manual shell scripting to **type-safe, testable, maintainable TypeScript applications**. This framework provides everything you need to build production-ready hooks with confidence.

### ✨ Key Benefits

- **🛡️ Type Safety**: Compile-time validation with full IntelliSense support
- **🔧 Multiple APIs**: Function-based, Builder pattern, and Declarative approaches
- **🔐 Security**: Built-in validators and environment-specific protections
- **🧪 Testing**: Complete mock framework and testing utilities
- **⚡ Performance**: Fast, efficient hook execution with proper error handling
- **🎯 Tool Scoping**: Hooks can target specific tools or run universally

## 📦 Installation

### Quick Start with NPM

```bash
# Install core packages
bun add @carabiner/hooks-core @carabiner/types @carabiner/execution

# For development
bun add -d @carabiner/hooks-testing @carabiner/hooks-validators
```

### Available Packages

All packages are available on npm under the `@carabiner` scope:

<<<<<<< HEAD
- **Core**: `@carabiner/hooks-core` - Core hook functionality  
- **Types**: `@carabiner/types` - TypeScript type definitions
- **Execution**: `@carabiner/execution` - Hook execution engine
- **Testing**: `@carabiner/hooks-testing` - Testing utilities
- **Validators**: `@carabiner/hooks-validators` - Security validators
- **Registry**: `@carabiner/hooks-registry` - Pre-built hooks collection
=======
- **Linux x64**: `carabiner-linux`  
- **macOS ARM64**: `carabiner-macos-arm64`
- **macOS Intel**: `carabiner-macos-x64`
- **Windows x64**: `carabiner-windows.exe`

```bash
# Make executable (Unix/macOS)
chmod +x carabiner-*

# Test installation
./carabiner-linux --version
```

### 📚 Library Installation

**For Development with TypeScript**

```bash
# Install the core library
npm install @outfitter/hooks-core

# Or install the full suite
npm install @outfitter/hooks-core @outfitter/hooks-validators @outfitter/hooks-testing @outfitter/hooks-cli
```

## 🏗️ Architecture

### Monorepo Structure

```text
packages/
├── hooks-core/           # Core types, runtime utilities, execution engine
├── hooks-validators/     # Security validators, environment-specific rules
├── hooks-config/         # Configuration management, settings generation
├── hooks-testing/        # Testing framework, mocks, utilities
├── hooks-cli/           # CLI tools, scaffolding, project management
└── examples/            # Real-world hook implementations

```
>>>>>>> 5c6accd (fix: rename all claude-hooks references to carabiner (fixes #38))

## 🎯 Quick Start

### Function-Based API (Simple & Clean)

```typescript
import { createHook } from '@carabiner/hooks-core';

const myHook = createHook('PreToolUse', async (context) => {
  const { toolName, toolInput } = context;
  
  // Block dangerous operations
  if (toolName === 'Bash' && toolInput.command?.includes('rm -rf')) {
    return { 
      success: false, 
      message: 'Dangerous command blocked' 
    };
  }
  
  return { success: true };
});

// Register and use
registry.register(myHook);
```

### Builder API (Fluent & Chainable)

```typescript
import { HookBuilder } from '@carabiner/hooks-core';

const securityHook = new HookBuilder()
  .event('PreToolUse')
  .name('security-validator')
  .description('Validates file operations for security')
  .timeout(3000)
  .handler(async (context) => {
    // Security validation logic
    return { success: true };
  })
  .build();
```

### Declarative API (Configuration-Driven)

```typescript
import { defineHooks } from '@carabiner/hooks-core';

const hooks = defineHooks({
  'pre-tool-use': [
    {
      name: 'rate-limiter',
      handler: './hooks/rate-limiter.ts',
      config: { maxRequests: 100 }
    }
  ],
  'post-tool-use': [
    {
      name: 'markdown-formatter',
      handler: '@carabiner/hooks-registry/markdown-formatter'
    }
  ]
});
```

## 🔐 Security Features

### File Access Validator

```typescript
import { createFileAccessValidator } from '@carabiner/hooks-validators';

const protectSensitive = createFileAccessValidator({
  protectedPaths: ['.env', '**/*.key', '**/*.pem'],
  protectedPatterns: [/password/i, /secret/i],
  allowedOperations: ['read'],
  environments: ['production']
});

registry.register('PreToolUse', protectSensitive);
```

### Git Safety Validator  

```typescript
import { createGitSafetyValidator } from '@carabiner/hooks-validators';

const gitSafety = createGitSafetyValidator({
  protectMainBranch: true,
  requireConventionalCommits: true,
  blockForceCommands: true
});
```

## 🧪 Testing

### Complete Testing Framework

```typescript
import { test, expect } from 'bun:test';
import { createMockContext, MockRegistry } from '@carabiner/hooks-testing';

test('security hook blocks dangerous commands', async () => {
  const context = createMockContext({
    event: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command: 'rm -rf /' }
  });

  const result = await securityHook(context);
  
  expect(result.success).toBe(false);
  expect(result.message).toContain('blocked');
});
```

### Mock Registry for Testing

```typescript
const mockRegistry = new MockRegistry();
mockRegistry.register('PreToolUse', myHook);

// Test with deterministic execution
const results = await mockRegistry.execute('PreToolUse', context);
expect(results.all()).toHaveLength(1);
```

## 📋 Configuration

### JSON Configuration

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

### Environment-Specific Configuration

```typescript
const config = {
  development: {
    hooks: ['debug-logger', 'performance-monitor']
  },
  production: {
    hooks: ['security-validator', 'audit-logger']
  }
};
```

## 🎨 Pre-Built Hooks

The `@carabiner/hooks-registry` package includes ready-to-use hooks:

### Markdown Formatter
Automatically formats markdown files using markdownlint or prettier.

```typescript
import { markdownFormatterHook } from '@carabiner/hooks-registry';

registry.register('PostToolUse', markdownFormatterHook);
```

### Security Scanner
Validates file operations and prevents access to sensitive files.

```typescript
import { securityScannerHook } from '@carabiner/hooks-registry';

registry.register('PreToolUse', securityScannerHook);
```

### Test Runner
Automatically runs tests after code changes.

```typescript
import { testRunnerHook } from '@carabiner/hooks-registry';

registry.register('PostToolUse', testRunnerHook);
```

## 🏗️ Architecture

### Type-Safe Foundation

```typescript
import type { HookHandler, HookContext, HookResult } from '@carabiner/types';

// Full type safety and IntelliSense
const typedHook: HookHandler<'PreToolUse'> = async (context) => {
  // TypeScript knows context structure
  const { toolName, toolInput } = context;
  return { success: true };
};
```

### Event Types

- **PreToolUse**: Before tool execution
- **PostToolUse**: After tool completion  
- **PreResponse**: Before sending response
- **PostResponse**: After response sent
- **OnError**: Error handling

## 📚 Documentation

- [Getting Started Guide](./GETTING-STARTED.md)
- [API Reference](./docs/api-reference/)
- [Configuration Guide](./docs/configuration.md)
- [Testing Guide](./docs/testing.md)
- [Example Hooks](./packages/examples/)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/outfitter-dev/carabiner.git
cd carabiner

# Install dependencies
bun install

# Run tests
bun test

# Build all packages
turbo build
```

## 📄 License

MIT © [Outfitter](https://github.com/outfitter-dev)

## 🙏 Acknowledgments

Built with modern tools and best practices:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Turbo](https://turbo.build/) - Monorepo management
- [Ultracite](https://github.com/ultracite/ultracite) - Code quality