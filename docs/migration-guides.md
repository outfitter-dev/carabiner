# Migration Guides

This guide covers upgrading between versions of Grapple and migrating from other Claude Code hook solutions.

## Table of Contents

- [v2.0 Migration (Current)](#v20-migration-current)
- [Legacy Hook Migration](#legacy-hook-migration)
- [Environment Variable Migration](#environment-variable-migration)
- [Configuration Migration](#configuration-migration)
- [API Changes](#api-changes)
- [Breaking Changes](#breaking-changes)

## v2.0 Migration (Current)

### Overview

Grapple v2.0 introduces significant architectural improvements that fix major issues from v1.x:

- **Fixed Runtime**: Proper stdin-based JSON input processing
- **Fixed Tool Scoping**: Hooks now correctly target specific tools
- **Updated Context**: Properties aligned with Claude Code's actual JSON structure
- **Improved Types**: More precise TypeScript definitions

### Major Changes

#### 1. Runtime Input Method

**Before (v1.x - Broken)**:

```typescript
// ❌ Used environment variables (didn't work properly)
const context = createHookContext('PreToolUse');
const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');
```

**After (v2.0 - Working)**:

```typescript
// ✅ Uses JSON from stdin automatically
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  // All data comes from Claude Code's JSON input via stdin
  console.log(context.sessionId); // From session_id
  console.log(context.cwd); // From cwd
  console.log(context.toolInput); // From tool_input
  console.log(context.toolResponse); // From tool_response (PostToolUse)

  return HookResults.success('Processed stdin input');
});
```

#### 2. Context Property Changes

**Changed Properties**:

- `context.workspacePath` → `context.cwd`
- `context.toolOutput` → `context.toolResponse`
- Metadata moved from context to result: `result.metadata.duration`

**Before**:

```typescript
console.log(context.workspacePath); // ❌ Didn't exist in actual JSON
console.log(context.toolOutput); // ❌ Wrong property name
console.log(context.metadata); // ❌ Wrong location
```

**After**:

```typescript
console.log(context.cwd); // ✅ Matches Claude Code JSON
console.log(context.toolResponse); // ✅ Correct property name
console.log(result.metadata); // ✅ Metadata on result
```

#### 3. Tool Scoping Fixed

**Before (v1.x - Broken)**:

```typescript
// Tool scoping didn't work - all hooks ran for all tools
const bashHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // ❌ This was ignored
  .withHandler(handler);
```

**After (v2.0 - Working)**:

```typescript
// Tool scoping works correctly
const bashHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // ✅ Only runs for Bash commands
  .withHandler(handler);

const universalHook = HookBuilder.forPreToolUse()
  // No .forTool() call = runs for ALL tools
  .withHandler(handler);
```

### Migration Steps

#### Step 1: Update Dependencies

```bash
# Update to latest versions
npm update @outfitter/hooks-core @outfitter/hooks-cli @outfitter/hooks-validators

# Or install fresh
npm install @outfitter/hooks-core@latest
```

#### Step 2: Update Hook Structure

**Old v1.x Hook**:

```typescript
#!/usr/bin/env bun

import { createHookContext, HookResults } from '@outfitter/hooks-core';

// ❌ Old broken pattern
const context = createHookContext('PreToolUse');
const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');

if (context.toolName === 'Bash') {
  const command = toolInput.command;
  // Validation logic
}

// Exit with code
process.exit(0);
```

**New v2.0 Hook**:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

// ✅ New working pattern
runClaudeHook(async (context) => {
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };
    // Validation logic
  }

  return HookResults.success('Validation passed');
});
```

#### Step 3: Update Context Properties

```typescript
// Update property names
runClaudeHook(async (context) => {
  // ❌ Old properties
  // console.log(context.workspacePath);
  // console.log(context.toolOutput);

  // ✅ New properties
  console.log(context.cwd);
  console.log(context.toolResponse); // PostToolUse only

  return HookResults.success('Updated properties');
});
```

#### Step 4: Fix Tool Scoping

```typescript
// ✅ Universal hook (runs for all tools)
const universalHook = HookBuilder.forPreToolUse()
  // No .forTool() call
  .withHandler(async (context) => {
    return HookResults.success(`Universal validation for ${context.toolName}`);
  });

// ✅ Tool-specific hook (only runs for Bash)
const bashHook = HookBuilder.forPreToolUse()
  .forTool('Bash')
  .withHandler(async (context) => {
    // Only executes when context.toolName === 'Bash'
    return HookResults.success('Bash-specific validation');
  });
```

#### Step 5: Update Configuration

No changes needed to `.claude/settings.json` - it uses the same format.

#### Step 6: Test Migration

```bash
# Test your updated hooks
carabiner test

# Test with sample data
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "ls -la"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/your-updated-hook.ts
```

## Legacy Hook Migration

### From Shell Scripts

If you're migrating from shell script hooks to Grapple:

**Old Shell Script**:

```bash
#!/bin/bash

# Read from environment variables (unreliable)
COMMAND="$TOOL_INPUT_COMMAND"

if [[ "$COMMAND" == *"rm -rf"* ]]; then
  echo "Dangerous command blocked!"
  exit 1
fi

echo "Command validated"
exit 0
```

**New Grapple Hook**:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

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

### From Other Hook Libraries

**Common Migration Patterns**:

1. **Input Processing**:

   ```typescript
   // Old: Manual JSON parsing
   const input = JSON.parse(process.stdin.read());

   // New: Automatic parsing
   runClaudeHook(async (context) => {
     // context is already parsed
   });
   ```

2. **Error Handling**:

   ```typescript
   // Old: Exit codes
   process.exit(1);

   // New: Structured results
   return HookResults.block('Validation failed');
   ```

3. **Type Safety**:

   ```typescript
   // Old: Untyped data
   const command = input.tool_input.command;

   // New: Type-safe access
   const { command } = context.toolInput as { command: string };
   ```

## Environment Variable Migration

### v1.x Environment Variables (Deprecated)

These environment variables are no longer used in v2.0:

```bash
# ❌ No longer used
TOOL_INPUT="{...}"
TOOL_NAME="Bash"
SESSION_ID="session-123"
WORKSPACE_PATH="/path/to/workspace"
```

### v2.0 Stdin Input (Current)

All data now comes via stdin as JSON:

```json
{
  "session_id": "session-123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la" },
  "cwd": "/path/to/workspace",
  "transcript_path": "/path/to/transcript.md"
}
```

### Migration Script

Migrate existing hooks that use environment variables:

```typescript
// migration-helper.ts
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

// Legacy environment variable hook function
async function legacyHookLogic() {
  const toolInput = JSON.parse(process.env.TOOL_INPUT || '{}');
  const toolName = process.env.TOOL_NAME;
  const sessionId = process.env.SESSION_ID;

  // Your existing logic here
  return true;
}

// Wrap legacy logic in new runtime
runClaudeHook(async (context) => {
  // Set up environment variables for legacy code
  process.env.TOOL_INPUT = JSON.stringify(context.toolInput);
  process.env.TOOL_NAME = context.toolName;
  process.env.SESSION_ID = context.sessionId;
  process.env.WORKSPACE_PATH = context.cwd; // Note: renamed property

  try {
    const success = await legacyHookLogic();
    return HookResults.success('Legacy hook succeeded');
  } catch (error) {
    return HookResults.failure('Legacy hook failed', error);
  }
});
```

## Configuration Migration

### v1.x Configuration Issues

Some configurations from v1.x may need updates:

#### Timeout Values

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/security.ts",
      "timeout": 5000 // May need adjustment in v2.0
    }
  }
}
```

v2.0 hooks may run faster due to improvements, so you might reduce timeouts:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/security.ts",
      "timeout": 3000 // Reduced timeout
    }
  }
}
```

#### Command Paths

Verify all command paths still work:

```bash
# Test all configured hooks
carabiner validate --config

# Test individual hooks
carabiner test --hook ./hooks/security.ts
```

### New Configuration Options

v2.0 adds new configuration capabilities:

```typescript
// hooks.config.ts (new in v2.0)
import { defineConfig } from '@outfitter/hooks-cli';

export default defineConfig({
  runtime: 'bun',
  typescript: true,

  environments: {
    development: {
      hooks: {
        PreToolUse: {
          '*': { timeout: 2000 },
        },
      },
    },
    production: {
      hooks: {
        PreToolUse: {
          '*': { timeout: 15000 },
        },
      },
    },
  },
});
```

## API Changes

### Import Changes

No import changes required - all imports remain the same:

```typescript
// These remain unchanged
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { HookBuilder, middleware } from '@outfitter/hooks-core';
```

### New APIs in v2.0

```typescript
// New: Improved type guards
import { isBashToolInput, isWriteToolInput } from '@outfitter/hooks-core';

if (context.toolName === 'Bash' && isBashToolInput(context.toolInput)) {
  // Fully typed context
  const { command, timeout } = context.toolInput;
}

// New: Enhanced middleware
import { middleware } from '@outfitter/hooks-core';

const hook = HookBuilder.forPreToolUse()
  .withMiddleware(middleware.timing()) // Performance tracking
  .withMiddleware(middleware.logging()) // Enhanced logging
  .withMiddleware(middleware.errorHandling()) // Better error handling
  .withHandler(handler)
  .build();
```

### Deprecated APIs

These APIs still work but are deprecated:

```typescript
// ❌ Deprecated: Manual context creation
const context = createHookContext('PreToolUse');

// ✅ Use: Automatic context from runtime
runClaudeHook(async (context) => {
  // Context created automatically
});
```

## Breaking Changes

### Required Changes

1. **Runtime Method**: Must use `runClaudeHook()` instead of manual context creation
2. **Context Properties**: Update `workspacePath` → `cwd`, `toolOutput` → `toolResponse`
3. **Exit Handling**: Return `HookResults` instead of calling `process.exit()`

### Optional Changes

1. **Tool Scoping**: Review and fix tool scoping if it wasn't working as expected
2. **Type Guards**: Use new type guards for better type safety
3. **Middleware**: Upgrade to new middleware system
4. **Configuration**: Migrate to new `hooks.config.ts` format

### Compatibility Mode

For gradual migration, you can temporarily wrap old hooks:

```typescript
// compatibility-wrapper.ts
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

async function oldHookLogic(toolName: string, toolInput: any) {
  // Your old hook logic here
  return true;
}

runClaudeHook(async (context) => {
  try {
    const success = await oldHookLogic(context.toolName, context.toolInput);
    return success
      ? HookResults.success('Legacy hook succeeded')
      : HookResults.failure('Legacy hook failed');
  } catch (error) {
    return HookResults.failure('Legacy hook error', error);
  }
});
```

## Verification Checklist

After migration, verify everything works:

### ✅ Runtime Verification

```bash
# Test hooks execute correctly
carabiner test

# Test with real Claude Code input
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo test"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/your-hook.ts
```

### ✅ Tool Scoping Verification

```bash
# Test universal hooks run for all tools
echo '{"tool_name": "Write", ...}' | bun hooks/universal-hook.ts
echo '{"tool_name": "Bash", ...}' | bun hooks/universal-hook.ts

# Test tool-specific hooks only run for their tool
echo '{"tool_name": "Bash", ...}' | bun hooks/bash-specific-hook.ts
echo '{"tool_name": "Write", ...}' | bun hooks/bash-specific-hook.ts  # Should not execute
```

### ✅ Configuration Verification

```bash
# Validate configuration
carabiner config validate

# Build and test configuration
carabiner build --check
```

### ✅ Type Safety Verification

```bash
# Check TypeScript types
bun run typecheck

# Test type guards
bun check hooks/typed-hook.ts
```

---

**Successfully migrate to Grapple v2.0 and enjoy the improved reliability!** 🚀

Need help with migration?

- [Troubleshooting Guide](troubleshooting.md) - Common migration issues
- [Getting Started](getting-started.md) - Fresh start guide
- [Configuration Guide](configuration.md) - Update your settings
