# AI assistant Hooks - Examples

This package contains comprehensive examples demonstrating the different approaches to building Carabiner hooks with TypeScript.

## 🚀 Quick Start

All examples use the **new stdin-based runtime** that reads JSON input from AI assistant and provides properly typed contexts.

### Running Examples

```bash

# Function-based pre-tool validation

echo '{"session_id":"test-123","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls -la"},"cwd":"/tmp","transcript_path":"/tmp/transcript.md"}' | bun packages/examples/src/function-based/pre-tool-use.ts

# Builder pattern security hooks

echo '{"session_id":"test-123","hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"test.txt","content":"Hello World"},"cwd":"/tmp","transcript_path":"/tmp/transcript.md"}' | bun packages/examples/src/builder-pattern/security-hooks.ts

# Declarative configuration

echo '{"session_id":"test-123","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"echo hello"},"cwd":"/tmp","transcript_path":"/tmp/transcript.md"}' | bun packages/examples/src/declarative/hook-config.ts

```

### Using the CLI with Built-in Examples

If `@carabiner/hooks-examples` is installed, the `carabiner` CLI can resolve built-in example hooks directly:

```bash
# List hooks from project, global, and built-ins
carabiner list

# Run the Bash command validator example
carabiner bash-command-validator
```

## 📁 Example Categories

### 1. Function-Based API (`src/function-based/`)

Simple, direct approach for straightforward hook logic.

#### [`pre-tool-use.ts`](src/function-based/pre-tool-use.ts)

- ✅ **Correct Runtime**: Uses `runHook()` with JSON stdin input
- ✅ **Tool Validation**: Demonstrates bash command, file write, and edit validation
- ✅ **Security Checks**: Environment-specific security validation
- ✅ **Error Handling**: Proper error handling with `HookResults`
- ✅ **Type Safety**: Full TypeScript type checking for tool inputs

```typescript

#!/usr/bin/env bun

import { runHook, HookResults } from '@/hooks-core';

runHook(async (context) => {
  console.log(`🔍 PreToolUse validation for: ${context.toolName}`);

  if (context.toolName === 'Bash') {
    const { command } = context.toolInput;
    // Validation logic here
    return HookResults.success('Bash validation passed');
  }

  return HookResults.success('Generic validation passed');
});

```

#### [`post-tool-use.ts`](src/function-based/post-tool-use.ts)

- ✅ **Post-Processing**: File formatting, type checking, linting
- ✅ **Tool Response**: Access to tool execution results via `context.toolResponse`
- ✅ **File Operations**: Automated formatting and validation
- ✅ **Logging**: Comprehensive execution logging
- ✅ **Performance**: Execution time tracking and reporting

### 2. Builder Pattern API (`src/builder-pattern/`)

Fluent interface for complex hooks with middleware and conditions.

#### [`security-hooks.ts`](src/builder-pattern/security-hooks.ts)

- ✅ **Tool Scoping**: Demonstrates hooks that target specific tools vs universal hooks
- ✅ **Middleware**: Logging, timing, error handling middleware
- ✅ **Conditions**: Conditional execution based on environment or tool
- ✅ **Priority**: Hook execution ordering
- ✅ **Composition**: Multiple security hooks working together

```typescript
// Tool-specific hook (only runs for Bash)
const bashSecurityHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // 🎯 Now works correctly!
  .withPriority(100)
  .withMiddleware(middleware.logging('info'))
  .withHandler(async (context) => {
    // Bash-specific validation
    return HookResults.success('Bash security check passed');
  })
  .build();

// Universal hook (runs for ALL tools)
const universalHook = HookBuilder.forPreToolUse()
  // No .forTool() call = universal
  .withHandler(async (context) => {
    // Runs for every tool
    return HookResults.success('Universal check passed');
  })
  .build();
```

### 3. Declarative Configuration (`src/declarative/`)

Configuration-driven approach for managing hooks across environments.

#### [`hook-config.ts`](src/declarative/hook-config.ts)

- ✅ **Environment-Specific**: Different hook sets for development/production/test
- ✅ **Universal vs Tool-Specific**: Mix of universal and tool-targeted hooks
- ✅ **Configuration Management**: Centralized hook configuration
- ✅ **Runtime Selection**: Automatic environment detection and hook loading
- ✅ **Audit Logging**: Production-ready audit trail

```typescript
// Universal hook configuration (runs for all tools)
{
  event: 'PreToolUse',
  // No tool specified = universal
  handler: async (context) => {
    console.log(`✅ Universal validation for ${context.toolName}`);
    return HookResults.success('Universal validation passed');
  }
}

// Tool-specific hook configuration
{
  event: 'PreToolUse',
  tool: 'Bash', // Only runs for Bash
  handler: async (context) => {
    console.log(`🐚 Bash-specific monitoring`);
    return HookResults.success('Bash monitoring completed');
  }
}

```

## 🔧 Key Architectural Changes

### ✅ New Runtime Pattern

**Old (Broken)**:

```typescript
// ❌ Used environment variables
const context = createHookContext('PreToolUse');
console.log(context.toolInput); // From TOOL_INPUT env var
```

**New (Working)**:

```typescript
// ✅ Uses JSON stdin input
runHook(async (context) => {
  console.log(context.sessionId); // From session_id
  console.log(context.cwd); // From cwd (not workspacePath)
  console.log(context.toolInput); // From tool_input
  console.log(context.toolResponse); // From tool_response (PostToolUse)

  return HookResults.success('Hook executed successfully');
});
```

### ✅ Tool Scoping Now Works

**Previously**: All hooks ran for all tools regardless of `.forTool()` calls.

**Now**: Tool scoping is properly implemented:

```typescript
// This ONLY runs for Bash commands
const bashHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // Actually works now!
  .withHandler(async (context) => {
    // Only executes when context.toolName === 'Bash'
    return HookResults.success('Bash hook executed');
  });

// This runs for ALL tools
const universalHook = HookBuilder.forPreToolUse()
  // No .forTool() call
  .withHandler(async (context) => {
    // Executes for every tool
    return HookResults.success('Universal hook executed');
  });
```

### ✅ Corrected Context Properties

**Changed Properties**:

- `context.workspacePath` → `context.cwd` (matches AI assistant's actual JSON structure)
- `context.toolOutput` → `context.toolResponse` (consistent with tool_response field)
- Metadata is on the **result**, not context: `result.metadata.duration`

### ✅ Import Paths

All examples use the monorepo-friendly import paths:

```typescript
import { runHook, HookResults } from '@/hooks-core';
import { SecurityValidators } from '@/hooks-validators';
```

## 📊 Input Structure

All hooks receive JSON via stdin with this structure:

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

## 🧪 Testing Examples

Each example includes test data generation and can be run standalone:

```bash

# Test with different tool inputs

echo '{
  "session_id": "test-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/test.txt",
    "content": "Hello World"
  },
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun packages/examples/src/function-based/pre-tool-use.ts

```

## 🏆 Best Practices Demonstrated

### 1. **Type Safety**

- Full TypeScript strict mode compliance
- Tool input type validation with type guards
- Proper error handling with typed results

### 2. **Security**

- Environment-specific validation rules
- Command pattern monitoring
- File access controls
- Audit logging

### 3. **Performance**

- Execution timing middleware
- Output size monitoring
- Efficient tool routing

### 4. **Maintainability**

- Clean separation of concerns
- Reusable middleware components
- Configuration-driven behavior
- Comprehensive logging

### 5. **Tool Scoping**

- Universal hooks for all tools
- Tool-specific hooks for targeted behavior
- Conditional execution based on context
- Priority-based execution order

## 🚀 Next Steps

1. **Copy and Modify**: Use these examples as starting points for your own hooks
2. **Environment Setup**: Configure different hook sets for dev/staging/production
3. **Custom Validation**: Add your own security rules and validation logic
4. **Monitoring**: Extend the audit logging for your specific needs
5. **Testing**: Use the test patterns to verify your hook behavior

## 📖 Additional Resources

- [Core Package Documentation](../hooks-core/README.md)
- [Validation Package Documentation](../hooks-validators/README.md)
- [Testing Framework Documentation](../hooks-testing/README.md)
- [CLI Tools Documentation](../hooks-cli/README.md)

All examples are production-ready and demonstrate real-world patterns for building robust, maintainable Carabiner hooks.
