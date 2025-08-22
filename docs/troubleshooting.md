# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when working with Carabiner hooks.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Hook Execution Problems](#hook-execution-problems)
- [Configuration Issues](#configuration-issues)
- [Performance Problems](#performance-problems)
- [Development Issues](#development-issues)
- [Environment-Specific Issues](#environment-specific-issues)
- [Advanced Debugging](#advanced-debugging)

## Quick Diagnostics

Start here for a quick health check of your Carabiner setup:

### Basic Health Check

```bash
# Check CLI installation
claude-hooks --version

# Validate configuration
claude-hooks validate

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
4. **Configuration**: `claude-hooks config validate`

## Installation Issues

### CLI Not Found

**Problem**: `claude-hooks: command not found`

**Solutions**:

```bash
# Option 1: Install globally
npm install -g @outfitter/hooks-cli

# Option 2: Use npx
npx @outfitter/hooks-cli --help

# Option 3: Check PATH
echo $PATH
npm config get prefix  # Should be in PATH

# Option 4: Use local installation
./node_modules/.bin/claude-hooks --help
```

### Binary Installation Issues

**Problem**: Binary installer fails or binary doesn't work

**Solutions**:

```bash
# Check platform compatibility
uname -a

# Manual download
curl -L https://github.com/outfitter-dev/carabiner/releases/latest/download/claude-hooks-linux -o claude-hooks
chmod +x claude-hooks

# Verify binary
./claude-hooks --version

# Check dependencies (Linux)
ldd claude-hooks

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
claude-hooks test --hook ./hooks/problematic-hook.ts --verbose

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
   import { runClaudeHook } from '@outfitter/hooks-core';
   // not: from '@outfitter/hooks-core/src/index'
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
claude-hooks config get PreToolUse.Bash.timeout

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

## Configuration Issues

### Invalid Configuration

**Problem**: Configuration validation fails

**Diagnostics**:

```bash
# Validate configuration
claude-hooks config validate

# Check configuration structure
claude-hooks config list

# Test configuration build
claude-hooks build --check
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
NODE_ENV=production claude-hooks build
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
   claude-hooks build --environment production --output .claude/settings.prod.json
   ```

## Performance Problems

### Slow Hook Execution

**Problem**: Hooks take too long to execute

**Diagnostics**:

```bash
# Measure execution time
time echo '{...}' | bun hooks/slow-hook.ts

# Performance analysis
claude-hooks validate --performance

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
   import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
   import type { HookContext } from '@outfitter/hooks-core';
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

**Problem**: `claude-hooks dev` doesn't work

**Diagnostics**:

```bash
# Check port availability
lsof -i :3000

# Start with verbose logging
claude-hooks dev --verbose

# Check file watching
claude-hooks dev --watch --verbose
```

**Solutions**:

1. **Use Different Port**:

   ```bash
   claude-hooks dev --port 3001
   ```

2. **Fix File Watching**:

   ```bash
   # Check file permissions
   ls -la hooks/

   # Restart development server
   claude-hooks dev --no-hot-reload
   ```

### Testing Issues

**Problem**: Hook tests fail

**Diagnostics**:

```bash
# Run tests with verbose output
claude-hooks test --verbose

# Test specific hook
claude-hooks test --hook ./hooks/failing-hook.ts

# Check test configuration
cat package.json  # Look for test scripts
```

**Solutions**:

1. **Fix Test Data**:

   ```typescript
   import { createMockContext } from '@outfitter/hooks-testing';

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
NODE_ENV=production claude-hooks test

# Compare configurations
diff .claude/settings.json .claude/settings.prod.json

# Check production-specific settings
claude-hooks config get environments.production
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
DEBUG=claude-hooks:* claude-hooks dev

# Enable hook debug logs
DEBUG=hooks:* bun hooks/your-hook.ts

# Verbose output
claude-hooks test --verbose --hook ./hooks/debug-hook.ts
```

### Hook Debugging

Add debugging to your hooks:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

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
echo "CLI: $(claude-hooks --version)"

# Configuration
claude-hooks config list

# Error reproduction
claude-hooks test --verbose --hook ./problematic-hook.ts
```

### Before Asking for Help

1. **Check this guide**: Look for similar issues and solutions
2. **Validate configuration**: Run `claude-hooks validate`
3. **Test manually**: Try running hooks directly with sample input
4. **Check logs**: Look for error messages in console output
5. **Minimal reproduction**: Create the smallest possible example that demonstrates the issue

---

**Troubleshoot issues and get back to building!** 🔧

Need more help?

- [Configuration Guide](configuration.md) - Verify your setup
- [Architecture Guide](architecture.md) - Understand the system
- [CLI Reference](cli-reference.md) - Master the tools
