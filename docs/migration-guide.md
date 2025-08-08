# Migration Guide: Environment Variables → JSON Stdin Runtime

This guide helps you migrate from the old environment variable-based runtime to the new JSON stdin-based runtime for Claude Code hooks.

## 🚨 Breaking Changes Overview

The Claude Code hooks runtime has been completely redesigned for better reliability, type safety, and integration. **All existing hooks using the old runtime will need to be updated.**

### Key Changes

1. **Input Method**: Environment variables → JSON via stdin
2. **Context Properties**: `workspacePath` → `cwd`, `toolOutput` → `toolResponse`
3. **Tool Scoping**: Fixed to actually work with composite registry keys
4. **Runtime API**: New `runClaudeHook()` function with automatic JSON parsing

## 📋 Quick Migration Checklist

- [ ] Update import statements to use `@/` prefix
- [ ] Replace `createHookContext()` + manual execution with `runClaudeHook()`
- [ ] Change `context.workspacePath` to `context.cwd`
- [ ] Change `context.toolOutput` to `context.toolResponse`
- [ ] Remove references to `context.metadata` (metadata is on results)
- [ ] Update environment variable usage to use context properties
- [ ] Test tool scoping behavior (it now works correctly)

## 🔄 Step-by-Step Migration

### 1. Import Statements

**Before (Old)**:
```typescript
import {
  createHookContext,
  executeHooksAndCombine,
  exitWithResult,
  HookResults
} from '@claude-code/hooks-core';
```

**After (New)**:
```typescript
import {
  runClaudeHook,
  HookResults
} from '@/hooks-core';
```

### 2. Runtime Execution Pattern

**Before (Old - Environment Variables)**:
```typescript
#!/usr/bin/env bun

import { createHookContext, exitWithResult } from '@claude-code/hooks-core';

async function main() {
  // ❌ Used environment variables
  const context = createHookContext('PreToolUse');
  const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');
  
  console.log(`Tool: ${context.toolName}`);
  console.log(`Input:`, toolInput);
  
  const result = await myHookHandler(context);
  exitWithResult(result);
}

if (import.meta.main) {
  main();
}
```

**After (New - JSON Stdin)**:
```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@/hooks-core';

// ✅ Uses JSON stdin automatically
runClaudeHook(async (context) => {
  console.log(`Tool: ${context.toolName}`);
  console.log(`Input:`, context.toolInput);
  console.log(`Session: ${context.sessionId}`);
  console.log(`Working Dir: ${context.cwd}`);
  
  return await myHookHandler(context);
});

async function myHookHandler(context: HookContext): Promise<HookResult> {
  // Your hook logic here
  return HookResults.success('Hook executed successfully');
}
```

### 3. Context Property Changes

**Before (Old Properties)**:
```typescript
async function handleHook(context: HookContext) {
  // ❌ Old property names
  console.log(`Workspace: ${context.workspacePath}`);
  console.log(`Output: ${context.toolOutput}`);
  console.log(`Duration: ${context.metadata?.duration}ms`); // metadata was on context
}
```

**After (New Properties)**:
```typescript
async function handleHook(context: HookContext): Promise<HookResult> {
  // ✅ New property names
  console.log(`Working Directory: ${context.cwd}`);
  console.log(`Tool Response: ${context.toolResponse}`); // for PostToolUse
  
  const result = HookResults.success('Processing completed');
  
  // ✅ metadata is on the result, not context
  return {
    ...result,
    metadata: {
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  };
}
```

### 4. Tool Scoping Fixes

**Before (Broken Tool Scoping)**:
```typescript
// ❌ This ran for ALL tools despite .forTool('Bash')
const bashHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash')  // This was ignored!
  .withHandler(handler)
  .build();
```

**After (Working Tool Scoping)**:
```typescript
// ✅ This now ONLY runs for Bash commands
const bashOnlyHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash')  // Actually works now!
  .withHandler(async (context) => {
    // Only executes when context.toolName === 'Bash'
    return HookResults.success('Bash-specific logic');
  })
  .build();

// ✅ Universal hook (runs for all tools)
const universalHook = HookBuilder
  .forPreToolUse()
  // No .forTool() call = universal
  .withHandler(async (context) => {
    // Runs for ALL tools
    return HookResults.success(`Universal logic for ${context.toolName}`);
  })
  .build();
```

### 5. Input/Output Structure

**Before (Environment Variables)**:
```typescript
// ❌ Parsed environment variables manually
const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');
const sessionId = process.env.CLAUDE_SESSION_ID || '';
const workspacePath = process.env.CLAUDE_WORKSPACE_PATH || '';
```

**After (Structured JSON Input)**:
```typescript
// ✅ Receives structured JSON automatically
runClaudeHook(async (context) => {
  // All data available directly from context
  const toolInput = context.toolInput;          // From tool_input
  const sessionId = context.sessionId;          // From session_id  
  const cwd = context.cwd;                     // From cwd
  const toolResponse = context.toolResponse;   // From tool_response (PostToolUse)
  
  return HookResults.success('Data accessed from context');
});
```

## 📊 JSON Input Format

Your hooks now receive JSON via stdin with this structure:

### PreToolUse Example
```json
{
  "session_id": "abc123-session-id",
  "transcript_path": "/path/to/transcript.md",
  "cwd": "/current/working/directory", 
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la",
    "timeout": 30000
  }
}
```

### PostToolUse Example
```json
{
  "session_id": "abc123-session-id",
  "transcript_path": "/path/to/transcript.md",
  "cwd": "/current/working/directory",
  "hook_event_name": "PostToolUse", 
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/file.txt",
    "content": "Hello World"
  },
  "tool_response": {
    "success": true,
    "message": "File written successfully"
  }
}
```

## 🔧 Complete Migration Examples

### Example 1: Simple Validation Hook

**Before**:
```typescript
#!/usr/bin/env bun
import { createHookContext, exitWithResult, HookResults } from '@claude-code/hooks-core';

async function main() {
  const context = createHookContext('PreToolUse');
  
  if (context.toolName === 'Bash') {
    const command = JSON.parse(process.env.TOOL_INPUT || '{}').command;
    
    if (command?.includes('rm -rf')) {
      exitWithResult(HookResults.block('Dangerous command blocked'));
    }
  }
  
  exitWithResult(HookResults.success('Validation passed'));
}

if (import.meta.main) main();
```

**After**:
```typescript
#!/usr/bin/env bun
import { runClaudeHook, HookResults, isBashToolInput } from '@/hooks-core';

runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} in session ${context.sessionId}`);
  
  if (context.toolName === 'Bash' && isBashToolInput(context.toolInput)) {
    const { command } = context.toolInput;
    
    if (command.includes('rm -rf')) {
      return HookResults.block('Dangerous command blocked');
    }
  }
  
  return HookResults.success('Validation passed');
});
```

### Example 2: Builder Pattern Hook

**Before**:
```typescript
#!/usr/bin/env bun
import { HookBuilder, registerHook, createHookContext, executeHooksAndCombine, exitWithResult } from '@claude-code/hooks-core';

const securityHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash') // This didn't work
  .withHandler(async (context) => {
    // Logic here
    return HookResults.success('Security check passed');
  })
  .build();

async function main() {
  registerHook(securityHook);
  const context = createHookContext('PreToolUse');
  const result = await executeHooksAndCombine(context);
  exitWithResult(result);
}

if (import.meta.main) main();
```

**After**:
```typescript
#!/usr/bin/env bun  
import { HookBuilder, runClaudeHook, HookResults } from '@/hooks-core';

const bashSecurityHook = HookBuilder
  .forPreToolUse()
  .forTool('Bash') // Now works correctly!
  .withHandler(async (context) => {
    console.log(`🔐 Bash security check for: ${context.cwd}`);
    // Logic here
    return HookResults.success('Security check passed');
  })
  .build();

runClaudeHook(async (context) => {
  // Hook only runs if context.toolName === 'Bash'
  if (context.toolName === 'Bash') {
    return await bashSecurityHook.handler(context);
  }
  
  return HookResults.success('No applicable security checks');
});
```

## 🧪 Testing Your Migration

### Test with Mock Input

Create a test JSON file:

```json
// test-input.json
{
  "session_id": "test-session-123",
  "transcript_path": "/tmp/test-transcript.md",
  "cwd": "/tmp/test-workspace",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash", 
  "tool_input": {
    "command": "echo 'Hello World'"
  }
}
```

Test your migrated hook:

```bash
# Test the hook with mock input
cat test-input.json | bun your-migrated-hook.ts

# Should output something like:
# 🔍 Validating Bash in session test-session-123
# Hook succeeded: Validation passed
```

### Validate All Properties

Add temporary logging to ensure all properties are accessible:

```typescript
runClaudeHook(async (context) => {
  console.log('📊 Context validation:');
  console.log(`  Session ID: ${context.sessionId}`);
  console.log(`  Event: ${context.event}`);
  console.log(`  Tool: ${context.toolName}`);
  console.log(`  CWD: ${context.cwd}`);
  console.log(`  Tool Input:`, context.toolInput);
  console.log(`  Tool Response:`, context.toolResponse || 'N/A');
  
  return HookResults.success('Context validation complete');
});
```

## ⚠️ Common Migration Pitfalls

### 1. Property Name Confusion

```typescript
// ❌ Wrong - old property names
console.log(context.workspacePath); // undefined!
console.log(context.toolOutput);    // undefined!

// ✅ Correct - new property names  
console.log(context.cwd);          // Working directory
console.log(context.toolResponse); // Tool execution result
```

### 2. Metadata Location

```typescript
// ❌ Wrong - metadata not on context
console.log(context.metadata?.duration);

// ✅ Correct - metadata on result
const result = HookResults.success('Done');
return {
  ...result,
  metadata: {
    duration: executionTime,
    timestamp: new Date().toISOString()
  }
};
```

### 3. Tool Scoping Expectations

```typescript
// ❌ Old behavior - this ran for ALL tools
const hook = HookBuilder.forPreToolUse().forTool('Bash').withHandler(handler);

// ✅ New behavior - this ONLY runs for Bash
// Make sure your logic accounts for this!
```

### 4. Exit Handling

```typescript
// ❌ Old way - manual exit
exitWithResult(result);

// ✅ New way - return result
return HookResults.success('Completed');
```

## 🎯 Migration Strategy

### For Large Codebases

1. **Inventory**: List all existing hooks and their functionality
2. **Test Setup**: Create JSON test inputs for each hook type
3. **Migrate One by One**: Update hooks individually and test thoroughly
4. **Batch Update**: Update common patterns across multiple hooks
5. **Validation**: Run comprehensive tests with real Claude Code integration

### For Individual Hooks

1. **Backup**: Save the original hook file
2. **Update Imports**: Change to `@/` imports and new runtime functions
3. **Replace Runtime**: Switch to `runClaudeHook()`
4. **Fix Properties**: Update context property names
5. **Test**: Validate with mock JSON input
6. **Deploy**: Update in your Claude Code configuration

## 🚀 Benefits After Migration

- **Reliability**: No more environment variable parsing issues
- **Type Safety**: Full TypeScript validation of input structure
- **Tool Scoping**: Hooks actually target specific tools correctly
- **Performance**: More efficient JSON parsing and context creation
- **Debugging**: Better error messages and structured logging
- **Testing**: Easier to test with structured JSON inputs

## 💡 Need Help?

- Check the [Examples Package](../packages/examples/README.md) for working implementations
- Review [Core Package Documentation](../packages/hooks-core/README.md) for API details
- Run hooks with mock JSON inputs to debug issues
- Compare old vs new patterns in the examples

The migration ensures your hooks work reliably with Claude Code and provides a foundation for building more sophisticated hook behaviors.