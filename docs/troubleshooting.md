# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when working with Carabiner hooks and Claude Code integration.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Claude Code Compliance Issues](#claude-code-compliance-issues)
- [Installation Issues](#installation-issues)
- [Hook Execution Problems](#hook-execution-problems)
- [Exit Code Issues](#exit-code-issues)
- [MCP Integration Problems](#mcp-integration-problems)
- [Permission Decision Issues](#permission-decision-issues)
- [Configuration Issues](#configuration-issues)
- [Performance Problems](#performance-problems)
- [Development Issues](#development-issues)
- [Environment-Specific Issues](#environment-specific-issues)
- [Debug Mode](#debug-mode)
- [Advanced Debugging](#advanced-debugging)
- [Getting Help](#getting-help)

## Quick Diagnostics

Start here for a quick health check of your Grapple setup:

### Basic Health Check

```bash
# Check CLI installation
carabiner --version

# Validate configuration
carabiner validate

# Test a simple hook
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo hello"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/your-hook.ts
```

### Common Quick Fixes

1. **File Permissions**: `chmod +x hooks/*.ts`
2. **Dependencies**: `bun install`
3. **TypeScript**: `bun run typecheck`
4. **Configuration**: `carabiner config validate`

## Claude Code Compliance Issues

### Hook Not Executing

**Problem**: Hook script doesn't run when expected with Claude Code

**Diagnostics**:

```bash
# Check Claude Code configuration
cat ~/.claude/settings.json

# Test hook manually with Claude Code JSON format
echo '{
  "session_id": "test-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo hello"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/your-hook.ts

# Check file permissions
ls -la hooks/
```

**Solutions**:

1. **Verify Hook Path Configuration**:

   ```json
   {
     "preToolUseHooks": {
       "*": {
         "command": "bun hooks/your-hook.ts",
         "timeout": 5000
       }
     }
   }
   ```

2. **Check Executable Permissions**:

   ```bash
   chmod +x hooks/*.ts
   ```

3. **Test JSON Input Processing**:

   ```typescript
   // Ensure your hook uses runClaudeHook
   import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

   runClaudeHook(async (context) => {
     console.log('Hook executed:', context);
     return HookResults.success('Hook working');
   });
   ```

### SDK Type Compatibility Issues

**Problem**: TypeScript errors with Claude Code SDK types

**Diagnostics**:

```bash
# Check TypeScript compiler errors
bun run typecheck

# Verify SDK installation
bun list | grep "@anthropic-ai/claude-code"

# Check Carabiner version compatibility
bun list | grep "@carabiner"
```

**Solutions**:

1. **Update to Compatible Versions**:

   ```bash
   # Install latest Carabiner with Claude Code SDK support
   bun add @carabiner/hooks-core@latest
   bun add @carabiner/types@latest
   ```

2. **Fix Type Imports**:

   ```typescript
   // Correct imports for SDK compatibility
   import { runClaudeHook, HookResults } from '@carabiner/hooks-core';
   import type { BashToolInput, HookContext } from '@carabiner/hooks-core';
   ```

3. **Use Type Guards**:
   ```typescript
   runClaudeHook(async (context) => {
     if (context.toolName === 'Bash') {
       const { command } = context.toolInput as BashToolInput;
       // Safely use command
     }
   });
   ```

### Context Structure Mismatch

**Problem**: Hook context doesn't match Claude Code's actual JSON structure

**Diagnostics**:

```bash
# Test with real Claude Code input
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "ls"},
  "cwd": "/current/dir",
  "transcript_path": "/path/to/transcript.md"
}' | bun hooks/debug-context.ts
```

**Solutions**:

1. **Use Correct Context Properties**:

   ```typescript
   runClaudeHook(async (context) => {
     // Correct property names
     console.log(context.sessionId); // session_id
     console.log(context.toolName); // tool_name
     console.log(context.toolInput); // tool_input
     console.log(context.cwd); // cwd (not workspacePath)
     console.log(context.transcriptPath); // transcript_path
   });
   ```

2. **Handle PostToolUse Context**:
   ```typescript
   runClaudeHook(async (context) => {
     if (context.hookEvent === 'PostToolUse') {
       console.log(context.toolResponse); // Available in PostToolUse
     }
   });
   ```

## Installation Issues

### CLI Not Found

**Problem**: `carabiner: command not found`

**Solutions**:

```bash
# Option 1: Install globally
npm install -g @carabiner/hooks-cli

# Option 2: Use npx
npx @carabiner/hooks-cli --help

# Option 3: Check PATH
echo $PATH
npm config get prefix  # Should be in PATH

# Option 4: Use local installation
./node_modules/.bin/carabiner --help
```

### Binary Installation Issues

**Problem**: Binary installer fails or binary doesn't work

**Solutions**:

```bash
# Check platform compatibility
uname -a

# Manual download
curl -L https://github.com/outfitter-dev/carabiner/releases/latest/download/carabiner-linux -o carabiner
chmod +x carabiner

# Verify binary
./carabiner --version

# Check dependencies (Linux)
ldd carabiner

# macOS signing issues (avoid using sudo when possible)
# Consider alternative approaches before disabling security:
# 1. Sign the binary properly
# 2. Use Gatekeeper bypass for development
# 3. Only if absolutely necessary:
#    sudo spctl --master-disable
```

### Package Installation Issues

**Problem**: `npm install` or `bun install` fails

**Solutions**:

```bash
# Clear cache
npm cache clean --force
# or
bun clear-cache

# Use different registry
npm install --registry https://registry.npmjs.org/

# Check Node.js version
node --version  # Should be >= 20
bun --version   # Should be >= 1.2.20

# Install with verbose logging
npm install --verbose
```

## Hook Execution Problems

### Hook Not Executing

**Problem**: Hook script doesn't run when expected

**Diagnostics**:

```bash
# Check Claude Code configuration
cat .claude/settings.json

# Test hook manually
echo '{...}' | bun hooks/your-hook.ts

# Check file permissions
ls -la hooks/

# Verify hook syntax
bun check hooks/your-hook.ts
```

**Solutions**:

1. **Fix Permissions**:

   ```bash
   chmod +x hooks/*.ts
   ```

2. **Fix Shebang**:

   ```typescript
   #!/usr/bin/env bun
   ```

3. **Verify Configuration**:

   ```json
   {
     "preToolUseHooks": {
       "*": {
         "command": "bun hooks/your-hook.ts",
         "timeout": 10000
       }
     }
   }
   ```

4. **Check Working Directory**:
   ```bash
   # Make sure command path is relative to project root
   pwd
   ls hooks/
   ```

### Hook Fails with Errors

**Problem**: Hook executes but returns errors

**Diagnostics**:

```bash
# Test with verbose output
carabiner test --hook ./hooks/problematic-hook.ts --verbose

# Check TypeScript errors
bun run typecheck

# Test with sample data
echo '{
  "session_id": "test",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "ls"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | bun hooks/your-hook.ts
```

**Common Error Patterns**:

1. **Import Errors**:

   ```typescript
   // Fix import paths
   import { runClaudeHook } from '@carabiner/hooks-core';
   // not: from '@carabiner/hooks-core/src/index'
   ```

2. **Type Errors**:

   ```typescript
   // Use type guards
   if (context.toolName === 'Bash') {
     const { command } = context.toolInput as { command: string };
   }
   ```

3. **JSON Parsing Errors**:
   ```typescript
   // The runtime handles JSON parsing
   runClaudeHook(async (context) => {
     // context is already parsed
     console.log(context.toolInput);
   });
   ```

### Hook Timeouts

**Problem**: Hooks exceed timeout and get killed

**Diagnostics**:

```bash
# Check timeout settings
carabiner config get PreToolUse.Bash.timeout

# Test hook performance
time echo '{...}' | bun hooks/slow-hook.ts

# Monitor with timing middleware
# Add to your hook:
.withMiddleware(middleware.timing())
```

**Solutions**:

1. **Increase Timeout**:

   ```json
   {
     "preToolUseHooks": {
       "Bash": {
         "command": "bun hooks/security.ts",
         "timeout": 30000 // Increase from default
       }
     }
   }
   ```

2. **Optimize Hook Performance**:

   ```typescript
   // Use async operations efficiently
   await Promise.all([validateCommand(command), checkSecurity(command), logAccess(command)]);
   ```

3. **Add Progress Logging**:
   ```typescript
   console.log('Starting validation...');
   const result = await validateCommand(command);
   console.log('Validation complete');
   return result;
   ```

## Exit Code Issues

### Hook Returns Wrong Exit Code

**Problem**: Hook doesn't return the expected exit code for Claude Code

**Diagnostics**:

```bash
# Test hook exit code manually
echo '{...}' | bun hooks/test-hook.ts; echo "Exit code: $?"

# Check hook result format
echo '{...}' | bun hooks/test-hook.ts | jq .
```

**Exit Code Mapping**:

| Exit Code | HookResults Method      | Meaning                 | Claude Behavior             |
| --------- | ----------------------- | ----------------------- | --------------------------- |
| `0`       | `HookResults.success()` | Success - allow tool    | Tool executes               |
| `1`       | `HookResults.block()`   | Block tool execution    | Tool is prevented           |
| `2`       | `HookResults.failure()` | Hook error - allow tool | Tool executes, error logged |

**Solutions**:

1. **Use Correct HookResults Methods**:

   ```typescript
   runClaudeHook(async (context) => {
     // Allow tool execution
     return HookResults.success('Tool validated');

     // Block tool execution
     return HookResults.block('Dangerous command detected');

     // Hook failed, but allow tool
     return HookResults.failure('Validation error', error);
   });
   ```

2. **Handle Errors Properly**:

   ```typescript
   runClaudeHook(async (context) => {
     try {
       const isValid = await validateTool(context);
       return isValid ? HookResults.success('Valid') : HookResults.block('Invalid');
     } catch (error) {
       // Return failure instead of throwing
       return HookResults.failure('Hook error', error);
     }
   });
   ```

3. **Test Exit Code Behavior**:

   ```bash
   # Test success (exit 0)
   echo '{"tool_name": "Bash", "tool_input": {"command": "echo safe"}}' | bun hooks/test.ts

   # Test block (exit 1)
   echo '{"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}' | bun hooks/test.ts

   # Verify exit codes
   echo $?  # Should be 0 for success, 1 for block, 2 for failure
   ```

## MCP Integration Problems

### MCP Tool Not Recognized

**Problem**: Hook doesn't recognize MCP tools properly

**Diagnostics**:

```bash
# Test MCP tool detection
echo '{
  "tool_name": "mcp__filesystem__read_file",
  "tool_input": {"path": "/tmp/test.txt"}
}' | bun hooks/mcp-test.ts

# Check MCP pattern matching
bun -e "
import { isMCPToolName } from '@carabiner/hooks-core';
console.log(isMCPToolName('mcp__database__query'));
"
```

**Solutions**:

1. **Use MCP Detection Functions**:

   ```typescript
   import { isMCPToolName, validateMCPToolName } from '@carabiner/hooks-core';

   runClaudeHook(async (context) => {
     if (isMCPToolName(context.toolName)) {
       const { provider, toolName } = validateMCPToolName(context.toolName);
       console.log(`MCP: ${provider}::${toolName}`);
     }
   });
   ```

2. **Handle MCP Tool Patterns**:

   ```typescript
   runClaudeHook(async (context) => {
     // MCP tools follow: mcp__<provider>__<tool>
     if (context.toolName.startsWith('mcp__')) {
       const parts = context.toolName.split('__');
       const provider = parts[1];
       const toolName = parts[2];

       // Provider-specific logic
       if (provider === 'filesystem') {
         return handleFilesystemMCP(toolName, context.toolInput);
       }
     }
   });
   ```

3. **Configure MCP-Specific Hooks**:
   ```json
   {
     "preToolUseHooks": {
       "mcp__*": {
         "command": "bun hooks/mcp-validator.ts",
         "timeout": 5000
       },
       "mcp__database__*": {
         "command": "bun hooks/database-security.ts",
         "timeout": 4000
       }
     }
   }
   ```

### MCP Rate Limiting

**Problem**: Too many MCP tool calls causing issues

**Solutions**:

```typescript
// Implement rate limiting for MCP tools
runClaudeHook(async (context) => {
  if (isMCPToolName(context.toolName)) {
    const { provider } = validateMCPToolName(context.toolName);

    const rateLimitKey = `mcp_${provider}_${context.sessionId}`;
    const currentCalls = parseInt(process.env[rateLimitKey] || '0');

    // Different limits per provider
    const limits = {
      database: 20,
      web: 100,
      filesystem: 50,
    };

    if (currentCalls >= (limits[provider] || 30)) {
      return HookResults.block(`Rate limit exceeded for ${provider} MCP tools`);
    }

    process.env[rateLimitKey] = (currentCalls + 1).toString();
  }

  return HookResults.success('MCP tool validated');
});
```

## Permission Decision Issues

### Permission System Not Working

**Problem**: Permission decisions aren't being respected

**Diagnostics**:

```bash
# Test permission decision
echo '{
  "tool_name": "Write",
  "tool_input": {"file_path": ".env"}
}' | bun hooks/permission-test.ts

# Check return format
echo '{...}' | bun hooks/permission-test.ts | jq .continue
```

**Solutions**:

1. **Return Proper Permission Structure**:

   ```typescript
   runClaudeHook(async (context) => {
     // Block execution
     return HookResults.block('Access denied');

     // Allow execution
     return HookResults.success('Access granted');

     // Allow with warning
     return HookResults.custom({
       continue: true,
       systemMessage: '⚠️ Caution: modifying sensitive file',
     });
   });
   ```

2. **Implement Permission Levels**:

   ```typescript
   const checkPermissions = (filePath: string, userRole: string) => {
     const sensitiveFiles = ['.env', '*.key', '*.pem'];

     if (sensitiveFiles.some((pattern) => filePath.includes(pattern))) {
       if (userRole !== 'admin') {
         return HookResults.block('Insufficient permissions');
       }
       return HookResults.custom({
         continue: true,
         systemMessage: 'Admin access to sensitive file - use caution',
       });
     }

     return HookResults.success('Permission granted');
   };
   ```

3. **Test Permission Flow**:

   ```bash
   # Test admin user
   CLAUDE_USER_ROLE=admin echo '{...}' | bun hooks/permission.ts

   # Test regular user
   CLAUDE_USER_ROLE=user echo '{...}' | bun hooks/permission.ts
   ```

### Custom Permission Messages

**Problem**: Permission messages not showing in Claude Code

**Solutions**:

```typescript
runClaudeHook(async (context) => {
  // Message appears in Claude Code UI
  return HookResults.block(
    'File access denied', // User message
    'Security policy violation', // Technical details
  );

  // System message appears as context for Claude
  return HookResults.custom({
    continue: true,
    systemMessage: 'User attempted to access restricted file - monitoring enabled',
  });
});
```

## Configuration Issues

### Invalid Configuration

**Problem**: Configuration validation fails

**Diagnostics**:

```bash
# Validate configuration
carabiner config validate

# Check configuration structure
carabiner config list

# Test configuration build
carabiner build --check
```

**Solutions**:

1. **Fix JSON Syntax**:

   ```bash
   # Validate JSON syntax
   cat .claude/settings.json | jq .
   ```

2. **Fix Missing Commands**:

   ```json
   {
     "preToolUseHooks": {
       "*": {
         "command": "bun hooks/security.ts", // Must exist
         "timeout": 10000
       }
     }
   }
   ```

3. **Fix File Paths**:

   ```bash
   # Verify hook files exist
   ls -la hooks/

   # Use absolute paths if needed
   "command": "/full/path/to/hook.ts"
   ```

### Environment Configuration

**Problem**: Different behavior in different environments

**Diagnostics**:

```bash
# Check current environment
echo $NODE_ENV

# Compare configurations
diff .claude/settings.json .claude/settings.prod.json

# Test specific environment
NODE_ENV=production carabiner build
```

**Solutions**:

1. **Environment-Specific Settings**:

   ```typescript
   // hooks.config.ts
   environments: {
     development: {
       hooks: {
         PreToolUse: {
           '*': { timeout: 2000 }
         }
       }
     },
     production: {
       hooks: {
         PreToolUse: {
           '*': { timeout: 15000 }
         }
       }
     }
   }
   ```

2. **Build for Environment**:
   ```bash
   carabiner build --environment production --output .claude/settings.prod.json
   ```

## Performance Problems

### Slow Hook Execution

**Problem**: Hooks take too long to execute

**Diagnostics**:

```bash
# Measure execution time
time echo '{...}' | bun hooks/slow-hook.ts

# Performance analysis
carabiner validate --performance

# Add timing middleware to hooks
```

**Solutions**:

1. **Profile Hook Performance**:

   ```typescript
   const start = performance.now();
   const result = await expensiveOperation();
   console.log(`Operation took ${performance.now() - start}ms`);
   ```

2. **Optimize Slow Operations**:

   ```typescript
   // Use Promise.all for parallel operations
   const [security, validation, format] = await Promise.all([
     securityCheck(context),
     validateInput(context),
     formatCheck(context),
   ]);
   ```

3. **Cache Results**:

   ```typescript
   const cache = new Map();

   if (cache.has(cacheKey)) {
     return cache.get(cacheKey);
   }

   const result = await expensiveOperation();
   cache.set(cacheKey, result);
   return result;
   ```

### Memory Issues

**Problem**: Hooks consume too much memory

**Diagnostics**:

```bash
# Monitor memory usage
ps aux | grep bun

# Check for memory leaks in hooks
NODE_ENV=development bun --inspect hooks/memory-test.ts
```

**Solutions**:

1. **Clean Up Resources**:

   ```typescript
   try {
     const data = await processLargeFile();
     return HookResults.success('Processed');
   } finally {
     // Clean up
     data = null;
     global.gc?.(); // If --expose-gc flag is used
   }
   ```

2. **Stream Large Data**:

   ```typescript
   // Instead of loading entire file
   const content = await Bun.file(filePath).text();

   // Use streaming
   const file = Bun.file(filePath);
   const stream = file.stream();
   ```

## Development Issues

### TypeScript Errors

**Problem**: TypeScript compilation fails

**Diagnostics**:

```bash
# Check TypeScript errors
bun run typecheck

# Check specific file
bun check hooks/problematic-hook.ts

# Verify TypeScript configuration
cat tsconfig.json
```

**Solutions**:

1. **Fix Import Errors**:

   ```typescript
   // Correct imports
   import { runClaudeHook, HookResults } from '@carabiner/hooks-core';
   import type { HookContext } from '@carabiner/hooks-core';
   ```

2. **Fix Type Issues**:

   ```typescript
   // Use proper type guards
   if (context.toolName === 'Bash') {
     const { command } = context.toolInput as { command: string };
   }

   // Or use type assertions carefully
   const bashInput = context.toolInput as BashToolInput;
   ```

3. **Update TypeScript Configuration**:
   ```json
   {
     "compilerOptions": {
       "target": "ESNext",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "allowImportingTsExtensions": true,
       "strict": true
     }
   }
   ```

### Development Server Issues

**Problem**: `carabiner dev` doesn't work

**Diagnostics**:

```bash
# Check port availability
lsof -i :3000

# Start with verbose logging
carabiner dev --verbose

# Check file watching
carabiner dev --watch --verbose
```

**Solutions**:

1. **Use Different Port**:

   ```bash
   carabiner dev --port 3001
   ```

2. **Fix File Watching**:

   ```bash
   # Check file permissions
   ls -la hooks/

   # Restart development server
   carabiner dev --no-hot-reload
   ```

### Testing Issues

**Problem**: Hook tests fail

**Diagnostics**:

```bash
# Run tests with verbose output
carabiner test --verbose

# Test specific hook
carabiner test --hook ./hooks/failing-hook.ts

# Check test configuration
cat package.json  # Look for test scripts
```

**Solutions**:

1. **Fix Test Data**:

   ```typescript
   import { createMockContext } from '@carabiner/hooks-testing';

   const context = createMockContext('PreToolUse', {
     toolName: 'Bash',
     toolInput: { command: 'ls -la' },
   });
   ```

2. **Fix Async Tests**:
   ```typescript
   test('hook validation', async () => {
     const result = await yourHook.handler(context);
     expect(result.success).toBe(true);
   });
   ```

## Environment-Specific Issues

### Production Issues

**Problem**: Hooks work in development but fail in production

**Diagnostics**:

```bash
# Test with production environment
NODE_ENV=production carabiner test

# Compare configurations
diff .claude/settings.json .claude/settings.prod.json

# Check production-specific settings
carabiner config get environments.production
```

**Solutions**:

1. **Environment Variables**:

   ```typescript
   // Handle missing environment variables
   const apiKey = process.env.API_KEY || 'default-dev-key';

   if (process.env.NODE_ENV === 'production' && !process.env.API_KEY) {
     return HookResults.failure('API_KEY required in production');
   }
   ```

2. **Path Issues**:
   ```typescript
   // Use absolute paths in production
   const hookPath =
     process.env.NODE_ENV === 'production' ? '/app/hooks/security.ts' : './hooks/security.ts';
   ```

### Docker Issues

**Problem**: Hooks don't work in Docker containers

**Diagnostics**:

```bash
# Check container permissions
docker exec -it container-name ls -la /app/hooks/

# Test hooks in container
docker exec -it container-name bun /app/hooks/test-hook.ts

# Check environment variables
docker exec -it container-name env
```

**Solutions**:

1. **Fix Permissions**:

   ```dockerfile
   # In Dockerfile
   COPY hooks/ /app/hooks/
   RUN chmod +x /app/hooks/*.ts
   ```

2. **Install Dependencies**:
   ```dockerfile
   # Install Bun in container
   RUN curl -fsSL https://bun.sh/install | bash
   ENV PATH="/root/.bun/bin:$PATH"
   ```

## Advanced Debugging

### Enable Debug Logging

```bash
# Enable CLI debug logs
DEBUG=carabiner:* carabiner dev

# Enable hook debug logs
DEBUG=hooks:* bun hooks/your-hook.ts

# Verbose output
carabiner test --verbose --hook ./hooks/debug-hook.ts
```

### Hook Debugging

Add debugging to your hooks:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  console.error('DEBUG: Hook started');
  console.error('DEBUG: Context:', JSON.stringify(context, null, 2));

  try {
    // Your hook logic
    const result = await validateTool(context);
    console.error('DEBUG: Validation result:', result);

    return HookResults.success('Validation passed');
  } catch (error) {
    console.error('DEBUG: Hook error:', error);
    return HookResults.failure('Hook failed', error);
  }
});
```

### Performance Profiling

```typescript
// Add performance monitoring
const performanceHook = HookBuilder.forPreToolUse()
  .withMiddleware(async (context, next) => {
    const start = performance.now();
    const result = await next();
    const duration = performance.now() - start;

    console.error(`Hook execution time: ${duration}ms`);

    if (duration > 5000) {
      console.warn('Hook execution is slow!');
    }

    return result;
  })
  .withHandler(yourHandler)
  .build();
```

### Memory Debugging

```bash
# Run with memory monitoring
bun --expose-gc hooks/memory-test.ts

# Check memory usage
ps aux | grep bun
```

```typescript
// Monitor memory in hooks
const memoryUsage = () => {
  const usage = process.memoryUsage();
  console.error('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
  });
};

runClaudeHook(async (context) => {
  memoryUsage();
  const result = await processHook(context);
  memoryUsage();
  return result;
});
```

## Debug Mode

### Enable Debug Logging

**Enable comprehensive debugging for hook development and troubleshooting**:

```bash
# Enable Claude Code debug mode
export CLAUDE_DEBUG=1

# Enable Carabiner hook debugging
export CARABINER_DEBUG=1

# Enable verbose hook output
export HOOK_VERBOSE=1

# Run hook with full debugging
DEBUG=* bun hooks/debug-hook.ts
```

### Debug Hook Template

Create a debug hook to test Claude Code integration:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

const DEBUG = process.env.CARABINER_DEBUG === '1';

function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

runClaudeHook(async (context) => {
  debugLog('Hook started');
  debugLog('Context received', context);

  const startTime = performance.now();

  try {
    debugLog('Processing hook logic...');

    // Your hook logic here
    const result = await processHook(context);

    const duration = performance.now() - startTime;
    debugLog(`Hook completed in ${duration}ms`, result);

    return HookResults.success('Debug hook completed', `Execution time: ${duration}ms`);
  } catch (error) {
    debugLog('Hook error', { error: error.message, stack: error.stack });
    return HookResults.failure('Debug hook failed', error);
  }
});

async function processHook(context: any) {
  debugLog(`Processing ${context.toolName}`);

  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };
    debugLog('Bash command', { command });

    // Add your validation logic here
    return { validated: true, command };
  }

  return { processed: true };
}
```

### Debug Configuration

Add debug settings to your Claude Code configuration:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "CARABINER_DEBUG=1 bun hooks/debug-hook.ts",
      "timeout": 10000
    }
  },
  "debug": {
    "enabled": true,
    "logLevel": "verbose",
    "includeContext": true,
    "includeStackTrace": true
  }
}
```

### Debug Output Analysis

**Analyze debug output for common issues**:

```bash
# Capture debug output
echo '{
  "session_id": "debug-session",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {"command": "echo test"},
  "cwd": "/tmp",
  "transcript_path": "/tmp/transcript.md"
}' | CARABINER_DEBUG=1 bun hooks/debug-hook.ts 2>debug.log

# Analyze the debug log
cat debug.log | grep ERROR
cat debug.log | grep "Hook completed"
cat debug.log | grep "Context received"
```

### Performance Debugging

Monitor hook performance:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

const PERFORMANCE_DEBUG = process.env.PERF_DEBUG === '1';

runClaudeHook(async (context) => {
  const metrics = {
    startTime: performance.now(),
    memoryStart: process.memoryUsage(),
    hookName: context.toolName,
  };

  if (PERFORMANCE_DEBUG) {
    console.error(`[PERF] Hook started: ${metrics.hookName}`);
    console.error(`[PERF] Memory at start:`, metrics.memoryStart);
  }

  try {
    // Your hook logic
    const result = await processHook(context);

    // Performance metrics
    const endTime = performance.now();
    const memoryEnd = process.memoryUsage();
    const duration = endTime - metrics.startTime;

    if (PERFORMANCE_DEBUG) {
      console.error(`[PERF] Hook completed in ${duration.toFixed(2)}ms`);
      console.error(`[PERF] Memory delta:`, {
        rss: memoryEnd.rss - metrics.memoryStart.rss,
        heapUsed: memoryEnd.heapUsed - metrics.memoryStart.heapUsed,
      });
    }

    // Alert if hook is slow
    if (duration > 1000) {
      return HookResults.custom({
        continue: true,
        systemMessage: `⚠️ Slow hook detected: ${duration.toFixed(2)}ms execution time`,
      });
    }

    return HookResults.success('Performance monitored', `Execution: ${duration.toFixed(2)}ms`);
  } catch (error) {
    const errorTime = performance.now() - metrics.startTime;
    console.error(`[PERF] Hook failed after ${errorTime.toFixed(2)}ms:`, error);
    return HookResults.failure('Performance debug hook failed', error);
  }
});
```

### Common Debug Scenarios

**1. Context Not Received**:

```typescript
runClaudeHook(async (context) => {
  if (!context) {
    console.error('ERROR: No context received');
    return HookResults.failure('No context provided');
  }

  console.error('Context keys:', Object.keys(context));
  return HookResults.success('Context debug complete');
});
```

**2. Tool Input Missing**:

```typescript
runClaudeHook(async (context) => {
  console.error('Tool name:', context.toolName);
  console.error('Tool input keys:', Object.keys(context.toolInput || {}));

  if (!context.toolInput) {
    return HookResults.failure('Tool input missing');
  }

  return HookResults.success('Tool input debug complete');
});
```

**3. JSON Parsing Issues**:

```typescript
process.stdin.on('data', (data) => {
  console.error('Raw input received:', data.toString());
});

runClaudeHook(async (context) => {
  console.error('Parsed context:', JSON.stringify(context, null, 2));
  return HookResults.success('JSON parsing debug complete');
});
```

## Getting Help

### Community Resources

1. **GitHub Issues**: [Report bugs and request features](https://github.com/outfitter-dev/carabiner/issues)
2. **Discussions**: [Ask questions and share patterns](https://github.com/outfitter-dev/carabiner/discussions)
3. **Documentation**: [Comprehensive guides](./README.md)

### Creating Bug Reports

Include this information when reporting issues:

```bash
# System information
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "Bun: $(bun --version)"
echo "CLI: $(carabiner --version)"

# Configuration
carabiner config list

# Error reproduction
carabiner test --verbose --hook ./problematic-hook.ts
```

### Before Asking for Help

1. **Check this guide**: Look for similar issues and solutions
2. **Validate configuration**: Run `carabiner validate`
3. **Test manually**: Try running hooks directly with sample input
4. **Check logs**: Look for error messages in console output
5. **Minimal reproduction**: Create the smallest possible example that demonstrates the issue

---

**Troubleshoot issues and get back to building!** 🔧

Need more help?

- [Configuration Guide](configuration.md) - Verify your setup
- [Architecture Guide](architecture.md) - Understand the system
- [CLI Reference](cli-reference.md) - Master the tools
