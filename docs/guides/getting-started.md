# Getting Started with Claude Code Hooks

This guide will get you up and running with Claude Code hooks in minutes. You'll learn the basic concepts, create your first hook, and understand the new runtime architecture.

## What are Claude Code Hooks?

Claude Code hooks are TypeScript/JavaScript programs that run at specific points during Claude Code's execution. They allow you to:

- **Validate tool usage** before execution (PreToolUse)
- **Process results** after execution (PostToolUse)
- **Initialize sessions** when Claude Code starts
- **Audit interactions** for security and compliance

## Prerequisites

Before starting, ensure you have:

- **Bun installed** (recommended runtime): `curl -fsSL https://bun.sh/install | bash`
- **Claude Code** installed and configured
- **Basic TypeScript knowledge** (JavaScript works too)

## Installation

### Option 1: Quick Setup with CLI

```bash

# Install the CLI globally

npm install -g @outfitter/hooks-cli

# Initialize hooks in your project

claude-hooks init --template security

```

This creates a complete hook setup with security-focused examples.

### Option 2: Manual Installation

```bash

# Install core library

bun add @outfitter/hooks-core

# Install optional packages

bun add @outfitter/hooks-validators  # Security validation
bun add --dev @outfitter/hooks-testing  # Testing utilities

```

## Your First Hook

Let's create a simple security hook that validates Bash commands:

### 1. Create the Hook File

Create `hooks/security-check.ts`:

```typescript

#!/usr/bin/env bun

import pino from 'pino';
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, pino.destination(2));

runClaudeHook(async (context) => {
  logger.info({ tool: context.toolName }, 'Security check');

  // Only validate Bash commands
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    // Block dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /sudo.*rm/, // sudo rm
      /curl.*\|\s*sh/, // curl | sh
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(`🚨 Blocked dangerous command: ${command}`);
      }
    }

    logger.debug({ command }, 'Bash command allowed');
  }

  return HookResults.success('Security check passed');
});

```

### 2. Make it Executable

```bash
chmod +x hooks/security-check.ts

```

### 3. Configure Claude Code

Create `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": {
      "*": {
        "command": "hooks/security-check.ts",
        "timeout": 5000
      }
    }
  }
}
```

### 4. Test Your Hook

```bash

# Test with safe command

echo '{
  "session_id": "test-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "ls -la"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/security-check.ts

# Test with dangerous command

echo '{
  "session_id": "test-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "rm -rf /"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/security-check.ts

```

You should see the hook allow the first command and block the second.

## Understanding Hook Input

Your hooks receive JSON via stdin with this structure:

### For Tool Events (PreToolUse/PostToolUse)

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
  "tool_response": "..." // Only for PostToolUse
}
```

### For Other Events

```json
{
  "session_id": "unique-session-identifier",
  "transcript_path": "/path/to/conversation.md",
  "cwd": "/current/working/directory",
  "hook_event_name": "SessionStart",
  "message": "Session started"
}
```

## Key Concepts

### Hook Events

| Event              | When it Runs          | Can Block?              |
| ------------------ | --------------------- | ----------------------- |
| `PreToolUse`       | Before tool execution | ✅ Yes (exit non-zero)  |
| `PostToolUse`      | After tool execution  | ❌ No (processing only) |
| `SessionStart`     | New session begins    | ❌ No                   |
| `UserPromptSubmit` | User submits prompt   | ❌ No                   |
| `Stop`             | Session ends          | ❌ No                   |

### Tool Scoping

Hooks can target specific tools or run universally:

```json
{
  "hooks": {
    "PreToolUse": {
      "*": {
        "command": "bun run hooks/universal-check.ts"
      },
      "Bash": {
        "command": "bun run hooks/bash-security.ts"
      },
      "Write": {
        "command": "bun run hooks/file-validation.ts"
      }
    }
  }
}
```

- `"*"` = Universal hook (runs for all tools)
- `"Bash"`, `"Write"`, etc. = Tool-specific hooks

### Hook Results

Your hooks must return one of these results:

```typescript
// Success - allow operation to continue
return HookResults.success('Validation passed');

// Failure - log error but allow operation
return HookResults.failure('Warning: suspicious activity');

// Block - prevent operation (PreToolUse only)
return HookResults.block('Dangerous operation blocked');
```

## Runtime Architecture (New in v2.0)

### ✅ What Changed

**Before (v1.x - Broken)**:

- Hooks used environment variables (`process.env.TOOL_INPUT`)
- Tool scoping didn't work properly
- Context used `workspacePath` property

**After (v2.0 - Working)**:

- Hooks read JSON from stdin
- Tool scoping works correctly
- Context uses `cwd` property (matches Claude Code)

### ✅ Migration Impact

If you're upgrading from v1.x:

1. **Runtime**: Use `runClaudeHook()` instead of environment variable parsing
2. **Context**: Use `context.cwd` instead of `context.workspacePath`
3. **Tool Scoping**: Your `.forTool()` calls now work correctly

## Available Tools

Your hooks can target these Claude Code tools:

| Tool        | Purpose                 |
| ----------- | ----------------------- |
| `Bash`      | Shell command execution |
| `Edit`      | Single file editing     |
| `Write`     | File creation/writing   |
| `Read`      | File reading            |
| `MultiEdit` | Multiple file edits     |
| `Glob`      | File pattern matching   |
| `Grep`      | Text searching          |
| `LS`        | Directory listing       |
| `Task`      | Subagent execution      |
| `WebFetch`  | Web content fetching    |

## Next Steps

Now that you have a basic hook working, you can:

### Learn Different APIs

- **[Function-Based API](../examples/function-based.md)**: Simple and direct (what you just used)
- **[Builder Pattern API](../examples/builder-pattern.md)**: Fluent interface with middleware
- **[Declarative API](../examples/declarative.md)**: Configuration-driven hooks

### Add Security Validation

```typescript
import { SecurityValidators } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  // Environment-specific security
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

### Add Testing

```typescript
import { createMockContext, testHook } from '@outfitter/hooks-testing';

test('security hook blocks dangerous commands', async () => {
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
});
```

### Use the CLI for Development

```bash

# Generate more hooks

claude-hooks generate --type PostToolUse --tool Write --name format-after-write

# Test all hooks

claude-hooks test

# Development mode with watching

claude-hooks dev --watch

```

## Common Patterns

### Universal Security Hook

```typescript

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  console.log(`🔍 Universal security check: ${context.toolName}`);

  // Tool-specific validations
  switch (context.toolName) {
    case 'Bash':
      const { command } = context.toolInput as { command: string };
      if (command.includes('sudo')) {
        return HookResults.block('sudo commands not allowed');
      }
      break;

    case 'Write':
      const { file_path } = context.toolInput as { file_path: string };
      if (file_path.startsWith('/etc/')) {
        return HookResults.block('Cannot write to system directories');
      }
      break;
  }

  return HookResults.success('Security check passed');
});

```

### Environment-Specific Hook

```typescript

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  const environment = process.env.NODE_ENV || 'development';

  console.log(`🌍 Environment: ${environment}, Tool: ${context.toolName}`);

  if (environment === 'production') {
    // Strict validation in production
    if (context.toolName === 'Bash') {
      const { command } = context.toolInput as { command: string };

      const blockedPatterns = [
        /rm/, // No file deletion
        /curl/, // No network requests
        /wget/, // No downloads
        /sudo/, // No privilege escalation
      ];

      for (const pattern of blockedPatterns) {
        if (pattern.test(command)) {
          return HookResults.block(`Production: ${pattern.source} commands not allowed`);
        }
      }
    }
  }

  return HookResults.success(`${environment} validation passed`);
});

```

### Post-Processing Hook

```typescript

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  // Only process Write and Edit tools
  if (context.toolName === 'Write' || context.toolName === 'Edit') {
    const { file_path } = context.toolInput as { file_path: string };

    console.log(`🎨 Processing file: ${file_path}`);

    // Auto-format TypeScript files
    if (file_path.endsWith('.ts') || file_path.endsWith('.tsx')) {
      console.log('🔧 Formatting TypeScript file...');
      // Run formatter here (biome, prettier, etc.)
    }

    // Auto-format JSON files
    if (file_path.endsWith('.json')) {
      console.log('📄 Formatting JSON file...');
      // Format JSON here
    }

    return HookResults.success(`Post-processing completed for ${file_path}`);
  }

  return HookResults.success('No post-processing needed');
});

```

## Troubleshooting

### Hook Not Running

1. **Check file permissions**: `chmod +x hooks/your-hook.ts`
2. **Verify settings**: Check `.claude/settings.json` syntax
3. **Test manually**: Run the hook with test JSON input

### Tool Scoping Not Working

1. **Verify v2.0**: Make sure you're using the latest version
2. **Check configuration**: Ensure tool names match exactly (`"Bash"`, not `"bash"`)
3. **Test universal**: Try `"*"` first to verify basic functionality

### Hook Execution Errors

1. **Check runtime**: Ensure `bun` is in your PATH
2. **Verify imports**: Make sure all packages are installed
3. **Test in isolation**: Run the hook script directly

### Performance Issues

1. **Check timeouts**: Increase timeout values in settings
2. **Optimize logic**: Avoid expensive operations in hooks
3. **Use async properly**: Ensure async operations are awaited

## What's Next?

You now have a working hook! Continue with:

1. **[Core Concepts](./core-concepts.md)**: Deeper understanding of hook architecture
2. **[Development Guide](./development-guide.md)**: Advanced patterns and best practices
3. **[Security Guide](./security.md)**: Comprehensive security validation
4. **[API Examples](../examples/)**: Different approaches and patterns
5. **[Troubleshooting](../troubleshooting/)**: Solutions to common issues

Remember: hooks are powerful tools that execute with Claude Code's permissions. Always validate inputs and follow security best practices!
