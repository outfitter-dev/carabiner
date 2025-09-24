# Claude Code Migration Guide

This guide covers migrating from manual shell scripts to Carabiner's type-safe Claude Code hooks, built on the official `@anthropic-ai/claude-code` SDK.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [Permission Decision System](#permission-decision-system)
- [Exit Code Semantics](#exit-code-semantics)
- [Hook Event Documentation](#hook-event-documentation)
- [MCP Tool Support](#mcp-tool-support)
- [Multi-Hook Configuration](#multi-hook-configuration)
- [Migration Checklist](#migration-checklist)
- [Automated Migration](#automated-migration)

## Overview

Carabiner transforms Claude Code hook development from manual shell scripting to **type-safe, testable, maintainable TypeScript applications** built directly on the official Claude Code SDK.

### Benefits of Migration

- **🛡️ SDK Compliance**: Built on `@anthropic-ai/claude-code` for guaranteed compatibility
- **📘 Full Type Safety**: Complete TypeScript types for all hooks and tools
- **🔐 Security**: Built-in validators and permission controls
- **🧪 Testing**: Complete mock framework and testing utilities
- **⚡ Performance**: Fast, efficient hook execution with proper error handling
- **🎯 Tool Scoping**: Hooks can target specific tools or run universally

## Breaking Changes

### 1. Input Processing Method

**Before (Manual Shell Script)**:

```bash
#!/bin/bash
# Unreliable environment variable access
COMMAND="$TOOL_INPUT_COMMAND"
TOOL_NAME="$HOOK_TOOL_NAME"

if [[ "$TOOL_NAME" == "Bash" && "$COMMAND" == *"rm -rf"* ]]; then
  echo "Dangerous command blocked!"
  exit 1
fi

echo "Command validated"
exit 0
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

### 2. Context Structure

**Before (Limited Context)**:

```bash
# Only basic environment variables available
SESSION_ID="$CLAUDE_SESSION_ID"
WORKSPACE_PATH="$PWD"
```

**After (Rich Context)**:

```typescript
runClaudeHook(async (context) => {
  console.log({
    sessionId: context.sessionId, // From session_id
    hookEvent: context.hookEvent, // Hook event type
    toolName: context.toolName, // Tool being executed
    toolInput: context.toolInput, // Tool parameters
    cwd: context.cwd, // Current working directory
    transcriptPath: context.transcriptPath, // Transcript file path
    toolResponse: context.toolResponse, // Response (PostToolUse only)
  });
});
```

### 3. Result Handling

**Before (Exit Codes)**:

```bash
# Limited result communication
exit 0  # Success
exit 1  # Failure - blocks execution
```

**After (Rich Result Types)**:

```typescript
// Success - allow execution to continue
return HookResults.success('Validation passed');

// Block - prevent tool execution
return HookResults.block('Dangerous command detected');

// Failure - hook failed but allow execution
return HookResults.failure('Validation error', error);

// Custom result with system message
return HookResults.custom({
  continue: true,
  systemMessage: 'Added security validation',
});
```

## Permission Decision System

Carabiner provides a sophisticated permission system for controlling tool access:

### Before/After: Permission Control

**Before (Basic Blocking)**:

```bash
#!/bin/bash
if [[ "$COMMAND" == *"sensitive"* ]]; then
  exit 1  # Block execution
fi
exit 0  # Allow execution
```

**After (Rich Permission Control)**:

```typescript
import { runClaudeHook, HookResults, PermissionDecision } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  if (context.toolName === 'Write') {
    const { file_path } = context.toolInput as { file_path: string };

    // Check for sensitive files
    if (file_path.includes('.env') || file_path.includes('.key')) {
      return HookResults.block(
        'Access denied to sensitive file',
        'This file contains sensitive information',
      );
    }

    // Conditional permission
    if (file_path.endsWith('.config.json')) {
      return HookResults.custom({
        continue: true,
        systemMessage: '⚠️ Modifying configuration file - please review carefully',
      });
    }
  }

  return HookResults.success('Permission granted');
});
```

### Permission Decision Types

```typescript
// Block execution completely
return HookResults.block('Reason for blocking');

// Allow with warning
return HookResults.success('Allowed', '⚠️ Warning message');

// Allow with system message
return HookResults.custom({
  continue: true,
  systemMessage: 'Additional context for Claude',
});

// Conditional permission with timeout
return HookResults.custom({
  continue: true,
  systemMessage: 'Temporary access granted',
  metadata: { expiresAt: Date.now() + 300000 }, // 5 minutes
});
```

## Exit Code Semantics

| Exit Code | Carabiner Equivalent | Meaning | Claude Behavior |
| --- | --- | --- | --- |
| `0` | `HookResults.success()` | Hook succeeded, allow tool | Tool executes normally |
| `1` | `HookResults.block()` | Hook blocked tool execution | Tool is prevented from running |
| `2` | `HookResults.failure()` | Hook failed, but allow tool | Tool executes, hook error logged |
| Custom | `HookResults.custom()` | Custom behavior with metadata | Configurable behavior |

### Exit Code Migration Examples

**Before (Limited Exit Codes)**:

```bash
#!/bin/bash

# Success
echo "Validation passed"
exit 0

# Block execution
echo "Dangerous command detected"
exit 1

# No way to indicate hook failure vs blocking
```

**After (Rich Result System)**:

```typescript
runClaudeHook(async (context) => {
  try {
    const isValid = await validateCommand(context);

    if (!isValid) {
      // Block tool execution
      return HookResults.block('Command validation failed');
    }

    // Success - allow execution
    return HookResults.success('Validation passed');
  } catch (error) {
    // Hook failed, but allow tool to run
    return HookResults.failure('Validation hook error', error);
  }
});
```

## Hook Event Documentation

Carabiner supports all 9 Claude Code hook events with full type safety:

### 1. PreToolUse - Before Tool Execution

**Before/After Example**:

```typescript
// Validate and potentially block tool execution
runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} execution`);

  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    // Security validation
    if (isDangerousCommand(command)) {
      return HookResults.block('Dangerous command blocked');
    }
  }

  return HookResults.success('Tool validated');
});
```

### 2. PostToolUse - After Tool Completion

```typescript
runClaudeHook(async (context) => {
  console.log(`✅ ${context.toolName} completed`);

  // Access tool response
  if (context.toolResponse) {
    const response = context.toolResponse;

    // Log tool execution
    await logToolExecution(context.toolName, context.toolInput, response);

    // Format output if needed
    if (context.toolName === 'Write' && response.success) {
      return HookResults.success('File written and logged');
    }
  }

  return HookResults.success('Tool execution logged');
});
```

### 3. SessionStart - Session Initialization

```typescript
runClaudeHook(async (context) => {
  console.log(`🚀 Session ${context.sessionId} started`);

  // Initialize session-specific resources
  await setupSessionEnvironment(context.sessionId);

  // Inject context
  return HookResults.custom({
    continue: true,
    systemMessage: `Session initialized with security policies active`,
  });
});
```

### 4. SessionEnd - Session Cleanup

```typescript
runClaudeHook(async (context) => {
  console.log(`🏁 Session ${context.sessionId} ended`);

  // Cleanup session resources
  await cleanupSessionEnvironment(context.sessionId);

  return HookResults.success('Session cleaned up');
});
```

### 5. UserPromptSubmit - User Input Processing

```typescript
runClaudeHook(async (context) => {
  const { prompt } = context.eventData as { prompt: string };

  // Validate user input
  if (containsSensitiveData(prompt)) {
    return HookResults.custom({
      continue: true,
      systemMessage: '⚠️ User prompt contains sensitive data - handle carefully',
    });
  }

  return HookResults.success('User prompt validated');
});
```

### 6. Stop - Execution Stop

```typescript
runClaudeHook(async (context) => {
  console.log('🛑 Execution stopped');

  // Cleanup any running processes
  await cleanupRunningProcesses();

  return HookResults.success('Stop handled');
});
```

### 7. SubagentStop - Subagent Termination

```typescript
runClaudeHook(async (context) => {
  const { reason } = context.eventData as { reason?: string };

  console.log(`🤖 Subagent stopped: ${reason || 'unknown'}`);

  return HookResults.success('Subagent stop handled');
});
```

### 8. PreCompact - History Compaction

```typescript
runClaudeHook(async (context) => {
  const { trigger } = context.eventData as { trigger: string };

  console.log(`📚 Compacting history: ${trigger}`);

  // Archive important data before compaction
  await archiveSessionData(context.sessionId);

  return HookResults.success('Pre-compact archival complete');
});
```

### 9. Notification - System Notifications

```typescript
runClaudeHook(async (context) => {
  const { type, message } = context.eventData as {
    type: string;
    message: string;
  };

  console.log(`🔔 Notification: ${type} - ${message}`);

  // Handle different notification types
  if (type === 'error') {
    await logError(message);
  }

  return HookResults.success('Notification processed');
});
```

## MCP Tool Support

Carabiner provides built-in support for MCP (Model Context Protocol) tools:

### MCP Tool Pattern Recognition

```typescript
import { isMCPToolName, validateMCPToolName } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  // Detect MCP tools
  if (isMCPToolName(context.toolName)) {
    console.log(`🔌 MCP Tool detected: ${context.toolName}`);

    // Extract MCP provider and tool name
    const { provider, toolName } = validateMCPToolName(context.toolName);

    console.log(`Provider: ${provider}, Tool: ${toolName}`);

    // Apply MCP-specific validation
    return await validateMCPTool(provider, toolName, context.toolInput);
  }

  // Handle standard Claude tools
  return HookResults.success('Standard tool validated');
});
```

### MCP Integration Examples

**File System MCP Tools**:

```typescript
runClaudeHook(async (context) => {
  // Handle file system MCP tools
  if (context.toolName.startsWith('mcp__filesystem__')) {
    const { path } = context.toolInput as { path: string };

    // Apply file system security policies
    if (isRestrictedPath(path)) {
      return HookResults.block('Access denied to restricted path');
    }
  }

  return HookResults.success('MCP tool validated');
});
```

**Database MCP Tools**:

```typescript
runClaudeHook(async (context) => {
  // Handle database MCP tools
  if (context.toolName.startsWith('mcp__database__')) {
    const { query } = context.toolInput as { query: string };

    // Validate SQL queries
    if (isDangerousSQL(query)) {
      return HookResults.block('Dangerous SQL query blocked');
    }

    // Log database access
    await logDatabaseAccess(context.sessionId, query);
  }

  return HookResults.success('Database MCP tool validated');
});
```

## Multi-Hook Configuration

Configure multiple hooks for different events and tools:

### Before/After: Configuration

**Before (Single Script)**:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bash hooks/security.sh",
      "timeout": 10000
    }
  }
}
```

**After (Multi-Hook Configuration)**:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/universal-security.ts",
      "timeout": 5000
    },
    "Bash": {
      "command": "bun hooks/bash-validator.ts",
      "timeout": 3000
    },
    "Write": {
      "command": "bun hooks/file-security.ts",
      "timeout": 2000
    }
  },
  "postToolUseHooks": {
    "*": {
      "command": "bun hooks/logger.ts",
      "timeout": 2000
    }
  },
  "sessionStartHooks": {
    "*": {
      "command": "bun hooks/session-init.ts",
      "timeout": 5000
    }
  }
}
```

### Advanced Multi-Hook Configuration

```json
{
  "preToolUseHooks": {
    "*": [
      {
        "command": "bun hooks/security/universal-security.ts",
        "timeout": 3000,
        "description": "Universal security validation"
      },
      {
        "command": "bun hooks/logging/audit-logger.ts",
        "timeout": 1000,
        "description": "Audit logging"
      }
    ],
    "Bash": [
      {
        "command": "bun hooks/security/bash-security.ts",
        "timeout": 5000,
        "description": "Bash-specific security"
      },
      {
        "command": "bun hooks/performance/bash-optimizer.ts",
        "timeout": 2000,
        "description": "Bash command optimization"
      }
    ],
    "mcp__*": {
      "command": "bun hooks/mcp/mcp-validator.ts",
      "timeout": 4000,
      "description": "MCP tool validation"
    }
  },
  "postToolUseHooks": {
    "*": {
      "command": "bun hooks/logging/execution-logger.ts",
      "timeout": 2000
    },
    "Write": {
      "command": "bun hooks/formatting/markdown-formatter.ts",
      "timeout": 3000
    }
  },
  "sessionStartHooks": {
    "*": {
      "command": "bun hooks/session/session-initializer.ts",
      "timeout": 10000
    }
  },
  "sessionEndHooks": {
    "*": {
      "command": "bun hooks/session/session-cleanup.ts",
      "timeout": 5000
    }
  },
  "notificationHooks": {
    "*": {
      "command": "bun hooks/notifications/notification-handler.ts",
      "timeout": 1000
    }
  }
}
```

## Migration Checklist

### ✅ Pre-Migration Setup

- [ ] Install Carabiner packages: `bun add @carabiner/hooks-core @carabiner/types @carabiner/execution`
- [ ] Install development tools: `bun add -d @carabiner/hooks-testing @carabiner/hooks-validators`
- [ ] Verify Bun installation: `bun --version` (should be >= 1.2.20)
- [ ] Create TypeScript configuration
- [ ] Set up project structure

### ✅ Migration Process

- [ ] **Audit existing shell scripts** - Document current hook behavior
- [ ] **Create equivalent TypeScript hooks** - Start with 1:1 functional migration
- [ ] **Update Claude Code configuration** - Point to new TypeScript hooks
- [ ] **Add type safety** - Use proper types and validation
- [ ] **Implement proper error handling** - Replace exit codes with HookResults
- [ ] **Add comprehensive testing** - Test all hook scenarios
- [ ] **Add security enhancements** - Use built-in validators
- [ ] **Performance optimization** - Profile and optimize hook execution

### ✅ Post-Migration Validation

- [ ] **Test all hook events** - Verify each hook type works correctly
- [ ] **Validate tool scoping** - Ensure tool-specific hooks only run for target tools
- [ ] **Test error scenarios** - Verify error handling works properly
- [ ] **Performance testing** - Confirm hooks execute within timeout limits
- [ ] **Security validation** - Test security controls work as expected
- [ ] **Integration testing** - Test with actual Claude Code usage
- [ ] **Documentation update** - Document new hooks and configurations

### ✅ Quality Assurance

- [ ] **Code review** - Review migrated code for correctness
- [ ] **TypeScript validation** - Ensure no type errors: `bun run typecheck`
- [ ] **Linting** - Run linter and fix issues: `bun run lint`
- [ ] **Testing** - Run full test suite: `bun test`
- [ ] **Manual testing** - Test hooks manually with sample data
- [ ] **Performance profiling** - Profile hook execution times

## Automated Migration

### Migration Script

Carabiner provides an automated migration script to help convert shell scripts:

```bash
# Install migration tool
bun add -g @carabiner/migration-tool

# Scan existing hooks
carabiner-migrate scan ./hooks

# Convert shell scripts to TypeScript
carabiner-migrate convert \
  --input ./hooks \
  --output ./hooks-migrated \
  --format typescript \
  --runtime bun

# Validate migrated hooks
carabiner-migrate validate ./hooks-migrated

# Generate configuration
carabiner-migrate config ./hooks-migrated > .claude/settings.json
```

### Manual Migration Helper

For manual migration, use this template:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

/**
 * Migrated from: hooks/original-script.sh
 * Purpose: [Describe the original script's purpose]
 * Changes: [Document what changed during migration]
 */
runClaudeHook(async (context) => {
  console.log(`🔄 Migrated hook: ${context.toolName}`);

  try {
    // TODO: Implement original shell script logic here

    // Original shell script logic:
    // [Copy and adapt the original shell script logic]

    return HookResults.success('Migration completed');
  } catch (error) {
    console.error('Hook execution error:', error);
    return HookResults.failure('Hook failed', error);
  }
});
```

### Configuration Migration

Convert old configurations:

```bash
# Convert old configuration format
carabiner-migrate config-convert \
  --input .claude/settings.json \
  --output .claude/settings.migrated.json \
  --format claude-code-v2
```

### Testing Migration

Test migrated hooks:

```bash
# Test individual hook
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo hello"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/migrated-hook.ts

# Test all hooks
carabiner test --migrated --verbose

# Compare behavior with original scripts
carabiner-migrate test-compare \
  --original ./hooks \
  --migrated ./hooks-migrated
```

---

**Successfully migrate to type-safe Claude Code hooks with Carabiner!** 🚀

For more help:

- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common migration issues
- [Getting Started](./QUICKSTART.md) - Fresh start guide
- [Examples](./examples/) - Real-world hook examples
- [GitHub Discussions](https://github.com/outfitter-dev/carabiner/discussions) - Community support
