# Carabiner - Type-Safe Hooks Framework for Claude Code

[![npm version](https://badge.fury.io/js/@carabiner%2Fhooks-core.svg)](https://badge.fury.io/js/@carabiner%2Fhooks-core)
[![npm downloads](https://img.shields.io/npm/dt/@carabiner/hooks-core.svg)](https://www.npmjs.com/package/@carabiner/hooks-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive TypeScript framework for building type-safe Claude Code hooks, built on top of the official `@anthropic-ai/claude-code` SDK for maximum compatibility and type safety.

## 🚀 Overview

Transform Claude Code hook development from manual shell scripting to **type-safe, testable, maintainable TypeScript applications**. Built directly on the official Claude Code SDK, this framework ensures full compatibility with all Claude Code features while providing a superior developer experience.

### ✨ Key Benefits

- **🛡️ SDK Integration**: Built on `@anthropic-ai/claude-code` for guaranteed compatibility
- **📘 Full Type Safety**: Complete TypeScript types for all hooks and tools via the SDK
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

- **Core**: `@carabiner/hooks-core` - Core hook functionality with SDK integration
- **Types**: `@carabiner/types` - TypeScript type definitions
- **Execution**: `@carabiner/execution` - Hook execution engine
- **Testing**: `@carabiner/hooks-testing` - Testing utilities
- **Validators**: `@carabiner/hooks-validators` - Security validators
- **Registry**: `@carabiner/hooks-registry` - Pre-built hooks collection

The core package includes and re-exports all necessary types from `@anthropic-ai/claude-code`, ensuring you have access to the full Claude Code type system.

## 🏗️ Architecture

### Monorepo Structure

```text
packages/
├── types/                # Core type definitions
├── protocol/             # Communication protocol
├── execution/            # Hook executor
├── hooks-core/           # Core functionality
├── hooks-cli/            # CLI tool
├── hooks-config/         # Configuration management
├── hooks-testing/        # Testing utilities
├── hooks-validators/     # Validation utilities
├── plugins/              # Plugin collection
├── registry/             # Hook registry
├── examples/             # Example hooks
└── error-management/     # Error handling
```

## 🎯 Quick Start

> **New to Carabiner?** Start with our [**Hello World Tutorial**](./docs/hello-world.md) - build your first hook in under 5 minutes!

### Your First Hook in 30 Seconds

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';

// Create a simple hook that runs before any tool
const myFirstHook = createHook.preToolUse(async (context) => {
  console.log(`🎯 Tool ${context.tool} is about to run!`);
  return HookResults.success();
});

// That's it! Your hook is ready to use
```

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

### Claude Code SDK Integration

Carabiner is built directly on top of the official `@anthropic-ai/claude-code` SDK, ensuring full compatibility with all Claude Code features:

```typescript
// Import SDK types directly
import type {
  HookInput,
  HookJSONOutput,
  PreToolUseHookInput,
  BashInput
} from '@carabiner/hooks-core';

// All SDK types are re-exported for convenience
const handler: HookCallback = async (input, toolUseID, options) => {
  if (input.hook_event_name === 'PreToolUse') {
    const toolInput = input as PreToolUseHookInput;
    // Full type safety with SDK types
    return {
      continue: true,
      systemMessage: `Processing ${toolInput.tool_name}...`
    };
  }
  return { continue: true };
};
```

### Type-Safe Foundation

```typescript
import type { HookHandler, HookContext, HookResult } from '@carabiner/hooks-core';

// Full type safety and IntelliSense
const typedHook: HookHandler<PreToolUseHookInput> = async (input, toolUseID, options) => {
  // TypeScript knows exact input structure from SDK
  const { tool_name, tool_input } = input;
  return { continue: true };
};
```

### Event Types (from SDK)

All hook events are defined by the Claude Code SDK:

- **PreToolUse**: Before tool execution
- **PostToolUse**: After tool completion
- **UserPromptSubmit**: When user submits a prompt
- **SessionStart**: When session begins
- **SessionEnd**: When session ends
- **Stop**: When execution stops
- **SubagentStop**: When subagent stops
- **PreCompact**: Before compacting history
- **Notification**: For notifications

## 🧰 CLI

Use the Carabiner CLI to discover, install, run, and publish hooks:

```bash
# List and run hooks
carabiner list
carabiner bash-command-validator

# Discover and install
carabiner browse
carabiner add bash-command-validator

# Publish a hook
carabiner publish --npm
```

The CLI is available via Node (ESM) or as a Bun-compiled standalone binary. See Quickstart for setup.

## 🔗 Claude Code Compatibility

Carabiner is designed from the ground up for full Claude Code compatibility, built directly on the official `@anthropic-ai/claude-code` SDK.

### ✅ Compatibility Features

- **🛡️ SDK Foundation**: Built on `@anthropic-ai/claude-code` for guaranteed compatibility
- **📋 All Hook Events**: Supports all 9 Claude Code hook events with full type safety
- **🔧 Tool Integration**: First-class support for all Claude Code tools + MCP tools
- **🎯 Exit Code Semantics**: Proper handling of Claude Code's exit code requirements
- **📡 JSON Protocol**: Native support for Claude Code's stdin/stdout JSON protocol
- **🔍 Permission System**: Rich permission controls with detailed feedback to Claude

### 🚀 Migration from Shell Scripts

Transform manual shell scripts into type-safe TypeScript hooks:

**Before (Shell Script)**:
```bash
#!/bin/bash
# Limited context, error-prone
if [[ "$TOOL_INPUT_COMMAND" == *"rm -rf"* ]]; then
  echo "Dangerous command blocked!"
  exit 1
fi
```

**After (Carabiner Hook)**:
```typescript
#!/usr/bin/env bun
import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    if (command.includes('rm -rf')) {
      return HookResults.block('Dangerous command blocked!');
    }
  }

  return HookResults.success('Command validated');
});
```

### 🔌 MCP Tool Support

Built-in support for Model Context Protocol (MCP) tools:

```typescript
import { isMCPToolName, validateMCPToolName } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  // Detect and handle MCP tools
  if (isMCPToolName(context.toolName)) {
    const { provider, toolName } = validateMCPToolName(context.toolName);
    console.log(`MCP Tool: ${provider}::${toolName}`);

    // Provider-specific validation
    return validateMCPTool(provider, toolName, context.toolInput);
  }

  return HookResults.success('Standard tool validated');
});
```

### 🎯 Claude Code Hook Events

Full support for all Claude Code hook events:

| Event | Purpose | Carabiner Support |
|-------|---------|------------------|
| `PreToolUse` | Validate/block tool execution | ✅ Full support + type safety |
| `PostToolUse` | Process tool results | ✅ Access to tool response |
| `SessionStart` | Initialize session | ✅ Context injection |
| `SessionEnd` | Cleanup session | ✅ Resource management |
| `UserPromptSubmit` | Process user input | ✅ Input validation |
| `Stop` | Handle execution stop | ✅ Graceful shutdown |
| `SubagentStop` | Handle subagent stop | ✅ Subagent management |
| `PreCompact` | Before history compaction | ✅ Data archival |
| `Notification` | Handle notifications | ✅ Event processing |

### 🏃 Quick Migration

1. **Install Carabiner**: `bun add @carabiner/hooks-core`
2. **Convert scripts** to TypeScript using `runClaudeHook()`
3. **Update configuration** to point to new hooks
4. **Test thoroughly** with real Claude Code integration

See our [**Migration Guide**](./docs/CLAUDE_CODE_MIGRATION.md) for detailed instructions.

### 📋 Compatibility Examples

- **[Basic PreToolUse Hook](./examples/claude-code-hooks/basic-pretooluse.json)** - Security validation examples
- **[Permission Control](./examples/claude-code-hooks/permission-control.py)** - Advanced permission system
- **[MCP Integration](./examples/claude-code-hooks/mcp-integration.json)** - MCP tool handling
- **[Context Injection](./examples/claude-code-hooks/context-injection.py)** - SessionStart context setup

## 📚 Documentation

- [Quickstart](./docs/QUICKSTART.md)
- [Claude Code Migration Guide](./docs/CLAUDE_CODE_MIGRATION.md)
- [API Reference](./docs/api-reference/)
- [Configuration Guide](./docs/configuration.md)
- [Testing Guide](./docs/testing.md)
- [Troubleshooting Guide](./docs/troubleshooting.md)
- [Example Hooks](./packages/examples/)
- [Claude Code Examples](./examples/claude-code-hooks/)
- [Registry + CLI Guide](./docs/registry/README.md)

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
