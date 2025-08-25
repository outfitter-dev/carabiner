# @outfitter/execution

Simplified execution engine for Carabiner hooks with predictable error handling, comprehensive metrics, and excellent developer experience.

## Features

- **Simple Execution Model**: No complex middleware chains, just straightforward hook execution
- **Result Pattern**: Type-safe error handling without exceptions
- **Comprehensive Metrics**: Performance monitoring, timing, and memory usage tracking
- **Protocol Abstraction**: Works with any I/O protocol (stdin, HTTP, test)
- **Timeout Support**: Configurable execution timeouts with graceful handling
- **Memory Tracking**: Monitor memory usage to detect leaks and optimize performance
- **Developer-Friendly**: Easy testing, debugging, and development workflows

## Installation

```bash
bun add @outfitter/execution

```

## Quick Start

### Basic Hook

```typescript
import { runHook } from '@outfitter/execution';

await runHook(async (context) => {
  if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
    const command = context.toolInput.command;

    // Block dangerous commands
    if (command.includes('rm -rf')) {
      return {
        success: false,
        block: true,
        message: 'Dangerous command blocked',
      };
    }
  }

  return { success: true };
});
```

### Testing Hooks

```typescript
import { runTestHook } from '@outfitter/execution';

const mockInput = {
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'ls -la' },
  session_id: 'test-123',
  cwd: '/tmp',
  environment: {},
};

await runTestHook(
  async (context) => {
    // Your hook logic here
    return { success: true, message: 'Test passed' };
  },
  mockInput,
  { timeout: 5000, collectMetrics: true },
);
```

## API Reference

### Core Execution

#### `runHook(handler, options?)`

Execute a hook with stdin protocol (most common usage).

```typescript
import { runHook } from '@outfitter/execution';

await runHook(
  async (context) => {
    // Hook logic
    return { success: true };
  },
  {
    timeout: 30000,
    collectMetrics: true,
    validateResults: true,
  },
);
```

#### `runTestHook(handler, testInput, options?)`

Execute a hook with mock input for testing.

```typescript
import { runTestHook } from '@outfitter/execution';

await runTestHook(
  async (context) => ({ success: true }),
  { hook_event_name: 'PreToolUse', session_id: 'test', cwd: '/tmp', environment: {} },
  { exitProcess: false },
);
```

### HookExecutor Class

For advanced usage with custom protocols and configuration.

```typescript
import { HookExecutor } from '@outfitter/execution';
import { createProtocol } from '@outfitter/protocol';

const protocol = createProtocol('stdin');
const executor = new HookExecutor(protocol, {
  timeout: 10000,
  collectMetrics: true,
  validateResults: true,
});

await executor.execute(async (context) => {
  return { success: true };
});
```

### Result Pattern

Type-safe error handling without exceptions.

```typescript
import { success, failure, isSuccess, mapResult, chainResult } from '@outfitter/execution';

// Create results
const successResult = success('value');
const failureResult = failure(new Error('Something went wrong'));

// Check results
if (isSuccess(result)) {
  console.log(result.value);
} else {
  console.error(result.error.message);
}

// Transform results
const doubled = mapResult(successResult, (x) => x * 2);

// Chain operations
const chained = chainResult(successResult, (x) => success(x.toUpperCase()));
```

### Metrics Collection

Monitor execution performance and detect issues.

```typescript
import {
  getExecutionMetrics,
  getExecutionStats,
  clearExecutionMetrics,
} from '@outfitter/execution';

// Get all metrics
const metrics = getExecutionMetrics();

// Get metrics in time range
const recentMetrics = getExecutionMetrics({
  start: Date.now() - 60000, // Last minute
  end: Date.now(),
});

// Get aggregate statistics
const stats = getExecutionStats();
console.log(`Success rate: ${stats.successRate}%`);
console.log(`Average duration: ${stats.averageDuration}ms`);
console.log(`P95 duration: ${stats.p95Duration}ms`);

// Clear metrics
clearExecutionMetrics();
```

## Configuration Options

### ExecutionOptions

```typescript
interface ExecutionOptions {
  /** Maximum execution time in milliseconds (default: 30000) */
  timeout?: number;

  /** Whether to collect detailed metrics (default: true) */
  collectMetrics?: boolean;

  /** Whether to validate hook results (default: true) */
  validateResults?: boolean;

  /** Custom metrics collector (uses global if not provided) */
  metricsCollector?: MetricsCollector;

  /** Additional context to include in metrics */
  additionalContext?: Record<string, unknown>;

  /** Exit process on completion (default: true for CLI usage) */
  exitProcess?: boolean;

  /** Success exit code (default: 0) */
  successExitCode?: number;

  /** Failure exit code (default: 1) */
  failureExitCode?: number;
}
```

## Error Handling

The execution engine uses the Result pattern for predictable error handling:

```typescript
import { tryAsyncResult, isSuccess } from '@outfitter/execution';

const result = await tryAsyncResult(async () => {
  // Operation that might fail
  return await riskyOperation();
});

if (isSuccess(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.message);
}
```

### Custom Errors

```typescript
import { ExecutionError, TimeoutError, ValidationError } from '@outfitter/execution';

// Execution-specific errors
throw new ExecutionError('Custom execution error', 'CUSTOM_ERROR', { context: 'data' });

// Timeout errors
throw new TimeoutError(5000, { operation: 'hook execution' });

// Validation errors
throw new ValidationError('Invalid result format', { field: 'success' });
```

## Performance Monitoring

### Execution Metrics

Every execution is automatically tracked with:

- **Timing**: Start time, end time, duration, and phase breakdown
- **Memory**: Heap usage, RSS, external memory before/after execution
- **Success**: Success/failure rates and error categorization
- **Context**: Hook event, tool name, and custom metadata

### Aggregate Statistics

```typescript
import { getExecutionStats } from '@outfitter/execution';

const stats = getExecutionStats();
console.log({
  totalExecutions: stats.totalExecutions,
  successRate: `${stats.successRate.toFixed(2)}%`,
  averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
  p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
  topErrors: stats.topErrors.map((e) => `${e.code}: ${e.count}`).join(', '),
});
```

## Testing

### Unit Testing

```typescript
import { describe, test, expect } from 'bun:test';
import { runTestHook } from '@outfitter/execution';

describe('My Hook', () => {
  test('should validate bash commands', async () => {
    const handler = async (context) => {
      if (context.toolName === 'Bash' && context.toolInput.command.includes('sudo')) {
        return { success: false, block: true, message: 'sudo not allowed' };
      }
      return { success: true };
    };

    await runTestHook(handler, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'sudo rm -rf /' },
      session_id: 'test',
      cwd: '/tmp',
      environment: {},
    });

    // Hook should have blocked the dangerous command
  });
});
```

### Integration Testing

```typescript
import { HookRunner, getExecutionMetrics } from '@outfitter/execution';

const runner = new HookRunner({
  protocol: 'test',
  testInput: mockData,
  collectMetrics: true,
  exitProcess: false,
});

await runner.run(myHandler);

const metrics = getExecutionMetrics();
expect(metrics[0].success).toBe(true);
```

## Best Practices

1. **Use Result Pattern**: Prefer Result types over throwing exceptions for predictable error handling
2. **Enable Metrics**: Keep metrics enabled during development for debugging and optimization
3. **Set Appropriate Timeouts**: Configure timeouts based on your hook's expected execution time
4. **Validate Results**: Enable result validation during development to catch issues early
5. **Test Thoroughly**: Use `runTestHook` for comprehensive testing with various input scenarios
6. **Monitor Performance**: Regularly check execution metrics to identify performance regressions

## Examples

### Security Hook

```typescript
import { runHook } from '@outfitter/execution';

await runHook(async (context) => {
  if (context.event === 'PreToolUse' && context.toolName === 'Bash') {
    const command = context.toolInput.command;

    const dangerousPatterns = [/rm\s+-rf\s+\//, /sudo\s+/, /\|\s*sh/, /curl.*\|\s*bash/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          success: false,
          block: true,
          message: `Dangerous command pattern blocked: ${pattern}`,
        };
      }
    }
  }

  return { success: true };
});
```

### Logging Hook

```typescript
import { runHook, getExecutionMetrics } from '@outfitter/execution';
import { writeFile } from 'node:fs/promises';

await runHook(
  async (context) => {
    // Log all tool usage
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: context.event,
      toolName: context.toolName,
      sessionId: context.sessionId,
    };

    await writeFile('/tmp/hook-log.json', JSON.stringify(logEntry) + '\n', { flag: 'a' });

    return { success: true, message: 'Activity logged' };
  },
  {
    collectMetrics: true,
    timeout: 5000,
  },
);

// Periodically check performance
const stats = getExecutionStats();
if (stats.averageDuration > 1000) {
  console.warn('Hook execution is getting slow:', stats.averageDuration + 'ms');
}
```

## License

MIT
