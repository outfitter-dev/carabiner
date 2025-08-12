# Claude Code Hooks TypeScript Library

A comprehensive TypeScript library for building type-safe, maintainable Claude Code hooks with modern development practices.

## 🚀 Overview

Transform Claude Code hook development from manual shell scripting to **type-safe, testable, maintainable TypeScript applications**. This library provides everything you need to build production-ready hooks with confidence.

### ✨ Key Benefits

- **🛡️ Type Safety**: Compile-time validation with full IntelliSense support
- **🔧 Multiple APIs**: Function-based, Builder pattern, and Declarative approaches
- **🔐 Security**: Built-in validators and environment-specific protections
- **🧪 Testing**: Complete mock framework and testing utilities
- **⚡ Performance**: Fast, efficient hook execution with proper error handling
- **🎯 Tool Scoping**: Hooks can target specific tools or run universally

## 📦 Installation

```bash

# Install the core library

npm install @claude-code/hooks-core

# Or install the full suite

npm install @claude-code/hooks-core @claude-code/hooks-validators @claude-code/hooks-testing @claude-code/hooks-cli

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

## 🎯 Quick Start

### 1. Simple Function-Based Hook

```typescript

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@claude-code/hooks-core';

// This hook runs for ALL tools (universal)
runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} usage`);

  // Access the actual JSON input from Claude Code
  console.log(`Session: ${context.sessionId}`);
  console.log(`Working Directory: ${context.cwd}`);
  console.log(`Tool Input:`, context.toolInput);

  // Tool-specific validation
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    if (command.includes('rm -rf /')) {
      return HookResults.block('Dangerous command blocked!');
    }
  }

  return HookResults.success('Validation passed');
});

```

### 2. Builder Pattern with Tool Scoping

```typescript

#!/usr/bin/env bun

import { HookBuilder, middleware, runClaudeHook } from '@claude-code/hooks-core';

// Tool-specific hook - ONLY runs for Bash commands
const bashSecurityHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash')  // 🎯 Tool scoping works!
  .withPriority(100)
  .withTimeout(10000)
  .withMiddleware(middleware.logging('info'))
  .withMiddleware(middleware.timing())
  .withHandler(async (context) => {
    const { command } = context.toolInput as { command: string };

    // Bash-specific security checks
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /sudo.*rm/,
      /curl.*\|\s*sh/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(`Blocked dangerous command: ${pattern.source}`);
      }
    }

    return HookResults.success('Bash security check passed');
  })
  .build();

// Universal hook - runs for ALL tools
const universalAuditHook = HookBuilder
  .forPostToolUse()
  // No .forTool() call = universal
  .withHandler(async (context) => {
    console.log(`📝 Audit: ${context.toolName} executed successfully`);
    return HookResults.success('Audit logged');
  })
  .build();

// Use the new stdin-based runtime
if (import.meta.main) {
  runClaudeHook(async (context) => {
    // Run appropriate hooks based on tool and event
    if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
      return await bashSecurityHook.handler(context);
    } else if (context.event === 'PostToolUse') {
      return await universalAuditHook.handler(context);
    }

    return HookResults.success('No applicable hooks');
  });
}

```

### 3. Declarative Configuration

```typescript
// hooks-config.ts
import { defineHook } from '@claude-code/hooks-core';

export const projectHooks = [
  // Universal security check (all tools)
  defineHook({
    event: 'PreToolUse',
    // No tool specified = universal
    handler: async (context) => {
      console.log(`🛡️ Universal security check for ${context.toolName}`);
      return HookResults.success('Universal check passed');
    },
    priority: 100,
    middleware: [middleware.logging('info')]
  }),

  // Bash-specific monitoring
  defineHook({
    event: 'PreToolUse',
    tool: 'Bash', // Only for Bash
    handler: async (context) => {
      console.log(`🐚 Bash command monitoring`);
      // Bash-specific logic here
      return HookResults.success('Bash monitoring completed');
    },
    condition: (ctx) => Bun.env.NODE_ENV === 'production'
  }),

  // File formatting after writes
  defineHook({
    event: 'PostToolUse',
    tool: 'Write', // Only for Write operations
    handler: async (context) => {
      const { file_path } = context.toolInput as { file_path: string };
      console.log(`🎨 Auto-formatting: ${file_path}`);

      // Format the file
      await formatFile(file_path);
      return HookResults.success(`Formatted ${file_path}`);
    },
    timeout: 30000
  })
];

```

## 🔧 Claude Code Integration

### Input Structure

Your hooks receive JSON via stdin with this structure:

```json
{
  "session_id": "unique-session-identifier",
  "transcript_path": "/path/to/conversation.md",
  "cwd": "/current/working/directory",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la",
    "timeout": 30000
  },
  "tool_response": "..." // Only present for PostToolUse
}

```

### Hook Events

- **`PreToolUse`**: Before tool execution (can block)
- **`PostToolUse`**: After tool execution (processing/cleanup)
- **`SessionStart`**: New Claude Code session begins
- **`UserPromptSubmit`**: User submits a prompt
- **`Stop`**: Session ends
- **`SubagentStop`**: Subagent workflow ends

### Tool Scoping

Control which tools your hooks target:

```typescript
// Universal hook - runs for ALL tools
const universalHook = HookBuilder
  .forPreToolUse()
  .withHandler(async (context) => {
    // Runs for Bash, Write, Edit, Read, etc.
    return HookResults.success(`Universal validation for ${context.toolName}`);
  });

// Tool-specific hook - ONLY for Bash
const bashHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash')  // Scoped to Bash only
  .withHandler(async (context) => {
    // Only runs when context.toolName === 'Bash'
    return HookResults.success('Bash-specific validation');
  });
```

## 🧪 Testing

```typescript
import { createMockContext, testHook } from '@claude-code/hooks-testing';

describe('Security Hook', () => {
  test('blocks dangerous commands', async () => {
    await testHook('PreToolUse')
      .withContext({
        toolName: 'Bash',
        toolInput: { command: 'rm -rf /' }
      })
      .expect(result => {
        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
      })
      .run(securityHook);
  });

  test('allows safe commands', async () => {
    const context = createMockContext('PreToolUse', {
      toolName: 'Bash',
      toolInput: { command: 'ls -la' }
    });

    const result = await securityHook.handler(context);
    expect(result.success).toBe(true);
  });
});

```

## 🔐 Security & Validation

```typescript
import { SecurityValidators } from '@claude-code/hooks-validators';

runClaudeHook(async (context) => {
  // Environment-specific validation
  switch (Bun.env.NODE_ENV) {
    case 'production':
      SecurityValidators.production(context); // Strict rules
      break;
    case 'development':
      SecurityValidators.development(context); // Lenient rules
      break;
    default:
      SecurityValidators.strict(context); // Maximum security
  }

  return HookResults.success('Security validation passed');
});

```

## 📋 CLI Tools

```bash

# Initialize hooks in your project

npx @claude-code/hooks-cli init

# Generate hook templates

npx @claude-code/hooks-cli generate \
  --type PreToolUse \
  --tool Bash \
  --name security-check

# Build and validate hooks

npx @claude-code/hooks-cli build --output .claude/settings.json
npx @claude-code/hooks-cli test --hook ./hooks/pre-tool-use.ts

# Development mode with watch

npx @claude-code/hooks-cli dev --watch

```

## 📊 Runtime Architecture Changes

### ✅ New Stdin-Based Runtime

**Before (Broken)**:

```typescript
// ❌ Used environment variables
const context = createHookContext('PreToolUse');
const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');

```

**After (Working)**:

```typescript
// ✅ Reads JSON from stdin automatically
runClaudeHook(async (context) => {
  // All data comes from Claude Code's JSON input
  console.log(context.sessionId);    // From session_id
  console.log(context.cwd);          // From cwd
  console.log(context.toolInput);    // From tool_input
  console.log(context.toolResponse); // From tool_response

  return HookResults.success('Processed stdin input');
});

```

### ✅ Tool Scoping Fixed

**Before**: All hooks ran for all tools regardless of configuration.

**After**: Proper tool targeting:

```typescript
// Only runs for Bash commands
HookBuilder.forPreToolUse().forTool('Bash').withHandler(handler);

// Runs for all tools
HookBuilder.forPreToolUse().withHandler(handler);

```

## 🏆 Production Ready

- **Type Safety**: Full TypeScript strict mode with comprehensive type checking
- **Error Handling**: Graceful error handling with detailed error messages
- **Performance**: Optimized execution with timeout controls and middleware
- **Security**: Environment-specific validation and audit logging
- **Monitoring**: Execution metrics, timing, and performance monitoring
- **Testing**: Complete test coverage with mocking framework

## 📖 Documentation

### 🚀 Getting Started

- [📚 Complete Documentation](docs/README.md) - Comprehensive guides and references
- [🏁 Getting Started Guide](docs/guides/getting-started.md) - Your first hook in minutes
- [🧠 Core Concepts](docs/guides/core-concepts.md) - Understanding hook architecture

### 📦 Package Documentation

- [🔧 Core Package](packages/hooks-core/README.md) - Types, runtime, and execution engine
- [⚙️ Configuration](packages/hooks-config/README.md) - Settings and template management
- [🔐 Validators](packages/hooks-validators/README.md) - Security and validation rules
- [🧪 Testing](packages/hooks-testing/README.md) - Testing framework and utilities
- [💻 CLI Tools](packages/hooks-cli/README.md) - Command-line tools and scaffolding
- [📖 Examples](packages/examples/README.md) - Complete working examples

### 📋 Quick References

- [🔌 API Reference](docs/api/) - Complete API documentation
- [🛡️ Security Guide](docs/guides/security.md) - Security best practices
- [🔧 Troubleshooting](docs/troubleshooting/) - Common issues and solutions

## 🚀 Development

```bash

# Install dependencies

bun install

# Start development

bun run dev

# Build all packages

bun run build

# Run tests

bun run test

# Format and lint

bun run format
bun run lint
bun run typecheck

```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following our conventions
4. Run tests: `bun run test`
5. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
6. Push and create a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Transform your Claude Code hooks from shell scripts to production-ready TypeScript applications.** 🚀
