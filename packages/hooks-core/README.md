# @outfitter/hooks-core

Core types, runtime utilities, and execution engine for Claude Code hooks TypeScript library.

## Installation

```bash
bun add @outfitter/hooks-core

```

## Usage

### Function-Based API

The simplest way to create hooks using the new stdin-based runtime:

```typescript

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

// Universal hook - runs for all tools
runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} usage`);
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

### Builder Pattern API

Fluent interface for complex hooks with middleware and tool scoping:

```typescript

#!/usr/bin/env bun

import { HookBuilder, middleware, runClaudeHook, HookResults } from '@outfitter/hooks-core';

// Tool-specific hook - ONLY runs for Bash commands
const bashSecurityHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // 🎯 Tool scoping works!
  .withPriority(100)
  .withTimeout(10000)
  .withMiddleware(middleware.logging('info'))
  .withMiddleware(middleware.timing())
  .withHandler(async (context) => {
    const { command } = context.toolInput as { command: string };

    // Bash-specific security checks
    const dangerousPatterns = [/rm\s+-rf\s+\//, /sudo.*rm/, /curl.*\|\s*sh/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(`Blocked dangerous command: ${pattern.source}`);
      }
    }

    return HookResults.success('Bash security check passed');
  })
  .build();

// Universal hook - runs for ALL tools
const universalAuditHook = HookBuilder.forPostToolUse()
  // No .forTool() call = universal
  .withHandler(async (context) => {
    console.log(`📝 Audit: ${context.toolName} executed successfully`);
    return HookResults.success('Audit logged');
  })
  .build();

// Use the stdin-based runtime
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

### Declarative Configuration

Configuration-driven approach for managing hooks:

```typescript
import { defineHook, HookResults, middleware } from '@outfitter/hooks-core';

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
    middleware: [middleware.logging('info')],
  }),

  // Bash-specific monitoring
  defineHook({
    event: 'PreToolUse',
    tool: 'Bash', // Only for Bash
    handler: async (context) => {
      console.log(`🐚 Bash command monitoring`);
      return HookResults.success('Bash monitoring completed');
    },
    condition: (ctx) => Bun.env.NODE_ENV === 'production',
  }),

  // File formatting after writes
  defineHook({
    event: 'PostToolUse',
    tool: 'Write', // Only for Write operations
    handler: async (context) => {
      const { file_path } = context.toolInput as { file_path: string };
      console.log(`🎨 Auto-formatting: ${file_path}`);

      return HookResults.success(`Formatted ${file_path}`);
    },
    timeout: 30000,
  }),
];
```

## API Reference

### Core Functions

#### `runClaudeHook(handler: HookHandler): void`

Main runtime function that reads JSON from stdin and executes your hook handler.

**Parameters:**

- `handler` - Async function that processes the hook context and returns a result

**Example:**

```typescript
runClaudeHook(async (context) => {
  // Your hook logic here
  return HookResults.success('Hook executed successfully');
});
```

#### `HookResults`

Static factory methods for creating hook results:

- `HookResults.success(message: string, data?: any)` - Successful execution
- `HookResults.failure(message: string, error?: any)` - Failed execution
- `HookResults.block(message: string, reason?: string)` - Block tool execution (PreToolUse only)

### Builder Pattern

#### `HookBuilder`

Fluent interface for building complex hooks:

- `.forPreToolUse()` - Hook runs before tool execution
- `.forPostToolUse()` - Hook runs after tool execution
- `.forTool(toolName)` - Scope hook to specific tool
- `.withHandler(handler)` - Set the hook handler function
- `.withMiddleware(middleware)` - Add middleware
- `.withPriority(priority)` - Set execution priority
- `.withTimeout(timeout)` - Set timeout in milliseconds
- `.withCondition(condition)` - Add conditional execution
- `.build()` - Create the hook instance

### Middleware

#### `middleware.logging(level?: LogLevel)`

Adds request/response logging:

```typescript
.withMiddleware(middleware.logging('info'))

```

#### `middleware.timing()`

Adds execution timing:

```typescript
.withMiddleware(middleware.timing())

```

#### `middleware.errorHandling(options?)`

Adds comprehensive error handling:

```typescript
.withMiddleware(middleware.errorHandling({
  logErrors: true,
  throwOnError: false
}))

```

### Type Guards

Tool input type guards for safe type narrowing:

- `isBashToolInput(input)` - Check if input is for Bash tool
- `isWriteToolInput(input)` - Check if input is for Write tool
- `isEditToolInput(input)` - Check if input is for Edit tool
- `isReadToolInput(input)` - Check if input is for Read tool
- `isMultiEditToolInput(input)` - Check if input is for MultiEdit tool
- `isGlobToolInput(input)` - Check if input is for Glob tool
- `isGrepToolInput(input)` - Check if input is for Grep tool

**Example:**

```typescript
if (isBashToolInput(context.toolInput)) {
  // context.toolInput is now typed as BashToolInput
  const { command, timeout } = context.toolInput;
}
```

## TypeScript

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  HookContext,
  HookEvent,
  HookResult,
  ToolName,
  ToolInput,
  GetToolInput,
  HookHandler,
  HookConfig,
} from '@outfitter/hooks-core';

// Type-safe hook handler
const handler: HookHandler = async (context) => {
  // context is fully typed based on event and tool
  return HookResults.success('Typed handler');
};

// Tool-specific context types
type BashContext = HookContext<'PreToolUse', 'Bash'>;
type WriteContext = HookContext<'PostToolUse', 'Write'>;
```

## Input Structure

Your hooks receive JSON via stdin with this structure:

### PreToolUse / PostToolUse

```json
{
  "session_id": "unique-session-id",
  "transcript_path": "/path/to/transcript.md",
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

### Other Events

```json
{
  "session_id": "unique-session-id",
  "transcript_path": "/path/to/transcript.md",
  "cwd": "/current/working/directory",
  "hook_event_name": "SessionStart",
  "message": "Session started"
}
```

## Hook Events

- **`PreToolUse`**: Before tool execution (can block with non-zero exit)
- **`PostToolUse`**: After tool execution (processing/cleanup)
- **`SessionStart`**: New Claude Code session begins
- **`UserPromptSubmit`**: User submits a prompt
- **`Stop`**: Session ends
- **`SubagentStop`**: Subagent workflow ends

## Tool Scoping

### Universal Hooks

Run for all tools when no tool is specified:

```typescript
const universalHook = HookBuilder.forPreToolUse()
  // No .forTool() call = universal
  .withHandler(async (context) => {
    // Runs for Bash, Write, Edit, Read, etc.
    return HookResults.success(`Universal validation for ${context.toolName}`);
  });
```

### Tool-Specific Hooks

Target specific tools only:

```typescript
const bashHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // Scoped to Bash only
  .withHandler(async (context) => {
    // Only runs when context.toolName === 'Bash'
    return HookResults.success('Bash-specific validation');
  });
```

## Available Tools

- `Bash` - Shell command execution
- `Edit` - Single file editing
- `Write` - File creation/writing
- `Read` - File reading
- `MultiEdit` - Multiple file edits
- `NotebookEdit` - Jupyter notebook editing
- `Glob` - File pattern matching
- `Grep` - Text searching
- `LS` - Directory listing
- `Task` - Subagent task execution
- `WebFetch` - Web content fetching
- `WebSearch` - Web searching

## Runtime Changes

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
  console.log(context.sessionId); // From session_id
  console.log(context.cwd); // From cwd
  console.log(context.toolInput); // From tool_input
  console.log(context.toolResponse); // From tool_response

  return HookResults.success('Processed stdin input');
});
```

### ✅ Tool Scoping Fixed

**Previously**: All hooks ran for all tools regardless of configuration.

**Now**: Proper tool targeting:

```typescript
// Only runs for Bash commands
HookBuilder.forPreToolUse().forTool('Bash').withHandler(handler);

// Runs for all tools
HookBuilder.forPreToolUse().withHandler(handler);
```

### ✅ Corrected Context Properties

**Changed Properties**:

- `context.workspacePath` → `context.cwd` (matches Claude Code's JSON structure)
- `context.toolOutput` → `context.toolResponse` (consistent with tool_response field)
- Metadata is on the **result**, not context: `result.metadata.duration`

## Examples

See the [examples package](../examples/README.md) for comprehensive working examples demonstrating all patterns and APIs.

## License

MIT
