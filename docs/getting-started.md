# Getting Started with Carabiner

Welcome to Carabiner, the production-ready TypeScript library for building Claude Code hooks. This guide will get you up and running with your first hook in minutes.

## Table of Contents

- [Installation](#installation)
- [Your First Hook](#your-first-hook)
- [Understanding Hook Events](#understanding-hook-events)
- [Tool Scoping](#tool-scoping)
- [Testing Your Hooks](#testing-your-hooks)
- [Next Steps](#next-steps)

## Installation

Carabiner provides multiple installation methods to suit different needs:

### 🚀 Binary Installation (Recommended)

The fastest way to get started is with our standalone binary:

```bash
# Install latest version globally
curl -fsSL https://raw.githubusercontent.com/outfitter-dev/carabiner/main/scripts/install.sh | bash

# Verify installation
claude-hooks --version
```

### 📚 Library Installation

For TypeScript development and custom hooks:

```bash
# Install core library
npm install @outfitter/hooks-core

# Install additional packages as needed
npm install @outfitter/hooks-validators @outfitter/hooks-testing @outfitter/hooks-cli
```

### 🛠️ Development Setup

For contributing or advanced development:

```bash
# Clone the repository
git clone https://github.com/outfitter-dev/carabiner.git
cd carabiner

# Install dependencies with Bun
bun install

# Build all packages
bun run build

# Run tests
bun run test
```

## Your First Hook

Let's create a simple security hook that validates Bash commands.

### 1. Initialize Your Project

```bash
# Create a new directory for your hooks
mkdir my-claude-hooks
cd my-claude-hooks

# Initialize with the CLI (creates project structure)
claude-hooks init --template security

# Or manually create a hook file
touch pre-tool-security.ts
```

### 2. Create a Security Hook

Create a file called `pre-tool-security.ts`:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

// This hook runs before any tool is executed
runClaudeHook(async (context) => {
  console.log(`🔍 Security check for ${context.toolName}`);

  // Log basic context information
  console.log(`Session ID: ${context.sessionId}`);
  console.log(`Working Directory: ${context.cwd}`);

  // Tool-specific security checks
  if (context.toolName === 'Bash') {
    // Type-safe access to command property
    const toolInput = context.toolInput as Record<string, unknown>;
    const command = toolInput?.command;
    
    if (typeof command !== 'string') {
      return HookResults.failure('Invalid command input');
    }

    // Block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /sudo\s+rm/, // sudo rm
      /curl.*\|\s*sh/, // curl | sh
      /wget.*\|\s*sh/, // wget | sh
      /dd\s+if=/, // dd if=
      /:\(\)\{.*\}/, // fork bombs
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(
          `Blocked potentially dangerous command: ${command}`,
          `Pattern matched: ${pattern.source}`,
        );
      }
    }

    console.log(`✅ Bash command approved: ${command}`);
  }

  // Allow all other tools and safe commands
  return HookResults.success(`Security check passed for ${context.toolName}`);
});
```

### 3. Make It Executable

```bash
# Make the hook executable
chmod +x pre-tool-security.ts

# Test it manually with sample input
echo '{
  "session_id": "test-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "ls -la"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun pre-tool-security.ts
```

### 4. Configure Claude Code

Add the hook to your Claude Code settings. Create or edit `.claude/settings.json`:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun pre-tool-security.ts",
      "timeout": 10000
    }
  }
}
```

## Understanding Hook Events

Carabiner supports several hook events that let you intercept different parts of the Claude Code lifecycle:

### PreToolUse

Runs **before** any tool is executed. Can block tool execution.

```typescript
runClaudeHook(async (context) => {
  if (context.toolName === 'Bash') {
    // Validate command before execution
    const { command } = context.toolInput as { command: string };

    if (command.includes('dangerous-operation')) {
      return HookResults.block('Command blocked for safety');
    }
  }

  return HookResults.success('Validation passed');
});
```

### PostToolUse

Runs **after** tool execution. Good for cleanup, formatting, or logging.

```typescript
runClaudeHook(async (context) => {
  console.log(`Tool ${context.toolName} completed`);

  if (context.toolName === 'Write') {
    const { file_path } = context.toolInput as { file_path: string };

    // Auto-format TypeScript files
    if (file_path.endsWith('.ts')) {
      console.log(`Auto-formatting ${file_path}`);
      // Format the file here
    }
  }

  return HookResults.success('Post-processing completed');
});
```

### Session Events

Handle session lifecycle:

```typescript
// SessionStart - when a new Claude session begins
runClaudeHook(async (context) => {
  console.log('🚀 New Claude session started');
  console.log(`Working directory: ${context.cwd}`);

  // Initialize project-specific settings
  return HookResults.success('Session initialized');
});
```

## Tool Scoping

You can create hooks that target specific tools or run universally:

### Universal Hooks

Run for **all** tools when no tool is specified:

```typescript
import { HookBuilder, middleware } from '@outfitter/hooks-core';

const universalAuditHook = HookBuilder.forPreToolUse()
  // No .forTool() call = runs for ALL tools
  .withMiddleware(middleware.logging('info'))
  .withHandler(async (context) => {
    console.log(`📝 Auditing ${context.toolName} usage`);
    return HookResults.success('Audit completed');
  })
  .build();
```

### Tool-Specific Hooks

Target specific tools only:

```typescript
const bashSecurityHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // ONLY runs for Bash commands
  .withPriority(100)
  .withTimeout(5000)
  .withHandler(async (context) => {
    // This only executes when context.toolName === 'Bash'
    const { command } = context.toolInput as { command: string };

    // Bash-specific validation logic
    return HookResults.success('Bash validation passed');
  })
  .build();
```

### Multiple Tool Hooks

You can also create separate hooks for different tools:

```typescript
// File formatting hook (Write tool)
const writeFormattingHook = HookBuilder.forPostToolUse()
  .forTool('Write')
  .withHandler(async (context) => {
    const { file_path } = context.toolInput as { file_path: string };
    console.log(`🎨 Formatting ${file_path}`);
    return HookResults.success('File formatted');
  })
  .build();

// Edit validation hook (Edit tool)
const editValidationHook = HookBuilder.forPreToolUse()
  .forTool('Edit')
  .withHandler(async (context) => {
    const { file_path } = context.toolInput as { file_path: string };
    console.log(`✏️ Validating edit to ${file_path}`);
    return HookResults.success('Edit validated');
  })
  .build();
```

## Testing Your Hooks

### Manual Testing

Test hooks with sample JSON input:

```bash
# Test PreToolUse hook
echo '{
  "session_id": "test-123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo hello"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun your-hook.ts

# Test PostToolUse hook
echo '{
  "session_id": "test-123",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {"file_path": "test.txt", "content": "Hello World"},
  "tool_response": "File written successfully",
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun your-hook.ts
```

### Using the CLI

```bash
# Test all hooks
claude-hooks test

# Test specific hook
claude-hooks test --hook ./pre-tool-security.ts

# Test with custom input
claude-hooks test --hook ./pre-tool-security.ts --tool Bash --input '{"command":"ls -la"}'
```

### Unit Testing

```typescript
import { createMockContext, testHook } from '@outfitter/hooks-testing';

describe('Security Hook', () => {
  test('blocks dangerous commands', async () => {
    const context = createMockContext('PreToolUse', {
      toolName: 'Bash',
      toolInput: { command: 'rm -rf /' },
    });

    const result = await yourSecurityHook.handler(context);

    expect(result.success).toBe(false);
    expect(result.block).toBe(true);
    expect(result.message).toContain('dangerous command');
  });

  test('allows safe commands', async () => {
    const context = createMockContext('PreToolUse', {
      toolName: 'Bash',
      toolInput: { command: 'ls -la' },
    });

    const result = await yourSecurityHook.handler(context);

    expect(result.success).toBe(true);
    expect(result.block).toBe(false);
  });
});
```

## Next Steps

Now that you have your first hook working, here's what to explore next:

### 🔐 Security & Validation

- Read the [Security Best Practices Guide](security.md)
- Learn about [Built-in Validators](../packages/hooks-validators/README.md)
- Explore environment-specific security rules

### 🏗️ Advanced Patterns

- Check out the [Builder Pattern API](../packages/hooks-core/README.md#builder-pattern-api)
- Learn [Declarative Configuration](../packages/hooks-core/README.md#declarative-configuration)
- Understand [Middleware](../packages/hooks-core/README.md#middleware)

### 🧪 Testing & Quality

- Set up [Comprehensive Testing](../packages/hooks-testing/README.md)
- Learn about [Performance Monitoring](../packages/plugins/README.md)
- Implement [Audit Logging](../packages/plugins/README.md#audit-logger)

### 📦 Project Organization

- Explore [Configuration Management](configuration.md)
- Learn about [CLI Tools](cli-reference.md)
- Review [Architecture Patterns](architecture.md)

### 💡 Real Examples

- Browse [Working Examples](../packages/examples/README.md)
- Study [Production Patterns](examples/)
- Join the community discussions

## Common Patterns

### Environment-Specific Hooks

```typescript
runClaudeHook(async (context) => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      // Strict security in production
      return await productionSecurityCheck(context);

    case 'development':
      // Lenient rules in development
      return await developmentCheck(context);

    default:
      // Safe defaults
      return await defaultSecurityCheck(context);
  }
});
```

### Conditional Execution

```typescript
const conditionalHook = HookBuilder.forPreToolUse()
  .withCondition((context) => {
    // Only run in CI environments
    return process.env.CI === 'true';
  })
  .withHandler(async (context) => {
    return HookResults.success('CI validation passed');
  })
  .build();
```

### Error Handling

```typescript
runClaudeHook(async (context) => {
  try {
    // Your hook logic here
    const result = await validateTool(context);
    return HookResults.success('Validation passed');
  } catch (error) {
    console.error('Hook error:', error);

    // In development, fail fast
    if (process.env.NODE_ENV === 'development') {
      return HookResults.failure('Validation failed', error);
    }

    // In production, log and continue
    console.warn('Continuing despite validation error');
    return HookResults.success('Validation skipped due to error');
  }
});
```

## Troubleshooting

### Hook Not Executing

1. Check file permissions: `chmod +x your-hook.ts`
2. Verify Claude Code configuration in `.claude/settings.json`
3. Test manually with sample JSON input
4. Check for syntax errors: `bun check your-hook.ts`

### Import Errors

```bash
# Ensure dependencies are installed
bun install @outfitter/hooks-core

# Verify TypeScript configuration
bun run typecheck
```

### Performance Issues

```typescript
// Add timing middleware to identify slow operations
.withMiddleware(middleware.timing())
.withTimeout(5000) // Set appropriate timeouts
```

For more detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).

---

**Ready to build production-ready Claude Code hooks!** 🚀

Continue with:

- [Configuration Guide](configuration.md) - Configure hooks for different environments
- [CLI Reference](cli-reference.md) - Master the command-line tools
- [API Reference](api-reference/) - Explore the full API
- [Architecture Guide](architecture.md) - Understand the system design
