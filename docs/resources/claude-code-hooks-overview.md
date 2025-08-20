# Claude Code Hooks: Complete Guide

> **Sources**:
>
> - [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
> - [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)

Claude Code hooks are a powerful configuration mechanism that allows you to execute custom commands at specific events during Claude Code's operation. This document provides comprehensive coverage of how hooks work, their types, configuration, and implementation.

## Quick Start

> ⚠️ **SECURITY WARNING**: Hooks execute shell commands automatically and can modify/delete files. Use extreme caution in production environments.

**Minimal setup in 3 steps:**

1. **Create hook directory**: `mkdir -p hooks`
2. **Create a simple hook script** (`hooks/my-hook.ts`):

   ```typescript
   #!/usr/bin/env bun
   console.log(`Hook triggered for: ${process.env.CLAUDE_TOOL_NAME}`);
   process.exit(0); // Success
   ```

3. **Add to settings** (`.claude/settings.json`):

   ```json
   {
     "hooks": {
       "PreToolUse": {
         "Bash": "bun run hooks/my-hook.ts"
       }
     }
   }
   ```

## Table of Contents

1. [What are Claude Code Hooks?](#what-are-claude-code-hooks)
2. [Hook Types and Events](#hook-types-and-events)
3. [Configuration](#configuration)
4. [TypeScript Implementation](#typescript-implementation)
5. [Security Considerations](#security-considerations)
6. [Common Use Cases](#common-use-cases)

## What are Claude Code Hooks?

Claude Code hooks are event-driven commands that execute automatically at specific points in Claude Code's workflow. They provide a way to:

- **Extend functionality**: Add custom behavior without modifying Claude Code itself
- **Validate operations**: Check inputs before tools execute
- **Add context**: Inject project-specific information into conversations
- **Control permissions**: Block or modify tool usage based on conditions
- **Automate workflows**: Execute related tasks when certain events occur

## Hook Types and Events

### Available Hook Events

1. **PreToolUse**: Executes before a tool is used
   - **Purpose**: Validate inputs, add context, or prevent execution
   - **Common use**: Input validation, security checks
   - **Exit behavior**: Exit code 2 blocks the tool and shows stderr to Claude

2. **PostToolUse**: Executes after a tool completes successfully
   - **Purpose**: Process outputs, trigger follow-up actions
   - **Common use**: Code formatting, file processing
   - **Exit behavior**: Non-zero exits mark hook as failed but don't block

3. **UserPromptSubmit**: Executes when a user submits a prompt
   - **Purpose**: Add context or validate user inputs
   - **Common use**: Timestamp injection, prompt preprocessing
   - **Note**: `USER_PROMPT` environment variable is only available in this context

4. **SessionStart**: Executes when starting a new session
   - **Purpose**: Initialize session-specific state
   - **Common use**: Environment setup, context loading
   - **Note**: `CLAUDE_TOOL_NAME` is not available in this context

5. **Stop**: Executes when Claude Code finishes responding
   - **Purpose**: Clean up or trigger post-response actions
   - **Common use**: Logging, state persistence

6. **SubagentStop**: Executes when a subagent finishes responding
   - **Purpose**: Handle subagent completion
   - **Common use**: Subagent result processing

7. **Notification**: Executes on certain system notifications
   - **Purpose**: Handle system-level events
   - **Common use**: Status monitoring, alerts

8. **PreCompact**: Executes before context compaction
   - **Purpose**: Prepare for context reduction
   - **Common use**: Save important state before compaction

> **Note**: All matching hooks run **in parallel** by default.

## Configuration

### Settings File Structure

Hooks are configured in JSON settings files with hierarchical precedence (higher numbers override lower):

1. **Enterprise managed**: Platform-specific managed policy files
2. **Command line arguments**: Direct CLI overrides
3. **User global**: `~/.claude/settings.json`
4. **Project shared**: `.claude/settings.json`
5. **Project local**: `.claude/settings.local.json` (highest precedence)

### Basic Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": "echo 'About to run bash command'"
    },
    "PostToolUse": {
      "Write": "echo 'File written successfully'"
    },
    "UserPromptSubmit": "echo 'User submitted: $USER_PROMPT'"
  }
}
```

### Advanced Configuration with Matchers

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "validate_command.sh \"$TOOL_INPUT\"",
        "timeout": 5000
      },
      "Write": {
        "command": "check_file_permissions.sh \"$FILE_PATH\"",
        "matcher": {
          "file_path": "*.production.*"
        }
      }
    }
  }
}
```

### Hook Configuration Options

- **command**: The shell command to execute
- **timeoutMs**: Maximum execution time in milliseconds (default: 60000ms per hook invocation)
- **detached**: Whether to run asynchronously without waiting (default: false)
- **filters**: Conditions for when the hook should run

> **Important**: The timeout is per hook invocation, not per command. When `detached: true`, Claude Code doesn't wait for completion and `TOOL_OUTPUT` may not be available.

## TypeScript Implementation

### Hook Environment Variables

Claude Code provides environment variables to hooks:

```typescript
// Available in most hooks (context-dependent)
process.env.CLAUDE_SESSION_ID; // Current session identifier
process.env.CLAUDE_TOOL_NAME; // Name of the tool (empty in SessionStart)
process.env.CLAUDE_PROJECT_DIR; // Current workspace path

// Tool-specific variables
process.env.TOOL_INPUT; // Tool input parameters (JSON)
process.env.TOOL_OUTPUT; // Tool output (PostToolUse only, not in async hooks)
process.env.USER_PROMPT; // User's prompt text (UserPromptSubmit only)
process.env.FILE_PATH; // File path for file operations
```

> **Variable Availability**: Not all variables are available in all hook contexts. For example, `CLAUDE_TOOL_NAME` is empty during `SessionStart` and `USER_PROMPT` is only available in `UserPromptSubmit` hooks.

### TypeScript Hook Script Example

Create a TypeScript hook script (`hooks/pre-tool-use.ts`):

```typescript

#!/usr/bin/env bun

interface ToolInput {
  command?: string;
  file_path?: string;
  content?: string;
  [key: string]: any;
}

interface HookContext {
  sessionId: string;
  toolName: string;
  workspacePath: string;
  toolInput: ToolInput;
}

function parseHookContext(): HookContext {
  const toolInputRaw = process.env.TOOL_INPUT;
  let toolInput: ToolInput = {};

  if (toolInputRaw) {
    try {
      toolInput = JSON.parse(toolInputRaw);
    } catch (error) {
      console.error('Failed to parse TOOL_INPUT:', error);
    }
  }

  return {
    sessionId: process.env.CLAUDE_SESSION_ID || '',
    toolName: process.env.CLAUDE_TOOL_NAME || '',
    workspacePath: process.env.CLAUDE_PROJECT_DIR || '',
    toolInput,
  };
}

async function validateBashCommand(command: string): Promise<boolean> {
  // Example: Block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /sudo\s+rm/, // sudo rm
    />\s*\/dev\/sda/, // Write to disk
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(command));
}

async function main() {
  const context = parseHookContext();

  console.log(`Hook triggered for tool: ${context.toolName}`);

  if (context.toolName === 'Bash') {
    const command = context.toolInput.command;
    if (command) {
      const isValid = await validateBashCommand(command);
      if (!isValid) {
        console.error('BLOCKED: Dangerous command detected');
        process.exit(2); // Block the tool execution (PreToolUse specific)
      }
      console.log('Command validation passed');
    }
  }

  // Hook succeeded, tool will proceed
  process.exit(0);
}

main().catch((error) => {
  console.error('Hook failed:', error);
  process.exit(1);
});

```

### Configuration for TypeScript Hook

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run hooks/pre-tool-use.ts",
        "timeout": 5000
      }
    }
  }
}
```

### Post-Tool Hook with File Processing

```typescript

#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PostHookContext {
  sessionId: string;
  toolName: string;
  toolInput: any;
  toolOutput: string;
  workspacePath: string;
}

function parseContext(): PostHookContext {
  return {
    sessionId: process.env.CLAUDE_SESSION_ID || '',
    toolName: process.env.CLAUDE_TOOL_NAME || '',
    toolInput: JSON.parse(process.env.TOOL_INPUT || '{}'),
    toolOutput: process.env.TOOL_OUTPUT || '',
    workspacePath: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  };
}

async function formatTypeScriptFile(filePath: string): Promise<void> {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return;
  }

  try {
    // Use Biome for formatting (as per project conventions)
    const { spawn } = require('child_process');

    const format = spawn('bunx', ['@biomejs/biome', 'format', '--write', filePath], {
      stdio: 'inherit',
    });

    await new Promise((resolve, reject) => {
      format.on('close', (code) => {
        if (code === 0) resolve(code);
        else reject(new Error(`Formatting failed with code ${code}`));
      });
    });

    console.log(`Formatted TypeScript file: ${filePath}`);
  } catch (error) {
    console.error(`Failed to format ${filePath}:`, error);
  }
}

async function main() {
  const context = parseContext();

  if (context.toolName === 'Write' || context.toolName === 'Edit') {
    const filePath = context.toolInput.file_path;
    if (filePath && existsSync(filePath)) {
      await formatTypeScriptFile(filePath);
    }
  }

  console.log(`Post-hook completed for ${context.toolName}`);
}

main().catch((error) => {
  console.error('Post-hook failed:', error);
  process.exit(1);
});

```

## Security Considerations

**🚨 CRITICAL SECURITY WARNING**:

- Claude Code hooks execute shell commands **automatically** with the same permissions as the Claude Code process
- On macOS, this often includes **full disk access**
- These scripts can **delete files, access sensitive data, and modify your system**
- Use extreme caution, especially in production environments

### Security Best Practices

1. **Input Validation**: Always validate and sanitize inputs
2. **Allow-list Commands**: Only permit specific, safe commands (avoid deny-list approaches)
3. **Path Restrictions**: Limit file system access to workspace only
4. **Timeout Limits**: Set reasonable execution timeouts
5. **Error Handling**: Fail securely when hooks encounter errors
6. **Principle of Least Privilege**: Grant minimal necessary permissions

### Example Security Hook

```typescript
function sanitizeCommand(command: string): boolean {
  // Allow-list approach - only permit specific patterns
  const allowedCommands = [
    /^echo\s+/, // Echo commands
    /^ls\s/, // List commands with args
    /^cat\s+[^;&|`$]+$/, // Cat with simple file paths
  ];

  return allowedCommands.some((pattern) => pattern.test(command));
}
```

## Common Use Cases

### 1. Code Quality Enforcement

```json
{
  "hooks": {
    "PostToolUse": {
      "Write": "bun run hooks/format-and-lint.ts",
      "Edit": "bun run hooks/format-and-lint.ts"
    }
  }
}
```

### 2. Git Integration

```json
{
  "hooks": {
    "PostToolUse": {
      "Write": "git add \"$FILE_PATH\" && echo 'File staged for commit'"
    },
    "Stop": "git status"
  }
}
```

### 3. Environment Context Injection

```json
{
  "hooks": {
    "SessionStart": "bun run hooks/load-project-context.ts",
    "UserPromptSubmit": "echo \"$(date): User prompt received\""
  }
}
```

### 4. Permission Control

```json
{
  "hooks": {
    "PreToolUse": {
      "Write": {
        "command": "bun run hooks/check-file-permissions.ts",
        "matcher": {
          "file_path": "*.production.*"
        }
      }
    }
  }
}
```

## Advanced Patterns

### Wildcard and Multiple Matchers

```json
{
  "hooks": {
    "PreToolUse": {
      "*": "bun run hooks/universal-validator.ts", // Matches any tool not explicitly listed
      "Write": "bun run hooks/write-specific.ts" // Still runs for Write tool
    }
  }
}
```

> **Important**: When multiple matchers match (e.g., both `*` and a specific tool), **all matching hooks execute in parallel**. This differs from most pattern-matching systems that use "first match" or "most specific" rules.

### Conditional Hook Execution

```typescript
// hooks/conditional-hook.ts
const context = parseHookContext();

// Only run in production environment
if (process.env.NODE_ENV === 'production') {
  // Execute production-specific logic
  await runProductionChecks();
}

// Only run for specific file types
if (context.toolInput.file_path?.endsWith('.ts')) {
  await runTypeScriptChecks();
}
```

### Multi-Tool Hook

```typescript
// hooks/universal-pre-hook.ts
const context = parseHookContext();

switch (context.toolName) {
  case 'Bash':
    await validateBashCommand(context.toolInput.command);
    break;
  case 'Write':
    await validateFileWrite(context.toolInput.file_path);
    break;
  case 'Edit':
    await validateFileEdit(context.toolInput.file_path);
    break;
  default:
    console.log(`No specific validation for ${context.toolName}`);
}
```

---

> **Sources**:
>
> - [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
> - [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)
