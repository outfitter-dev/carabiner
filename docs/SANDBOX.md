# 🧪 Carabiner Sandbox

> Safe testing environment for developing and benchmarking hooks

## Overview

The Carabiner Sandbox (`.sandbox/`) provides an isolated environment for testing hooks before deploying them to production. It includes tools for debugging, benchmarking, and validating hook behavior without affecting your live Claude Code sessions.

## Quick Start

```bash
# Run a hook in sandbox
bun run sandbox my-hook

# Run with test input
bun run sandbox my-hook --input fixtures/test.json

# Benchmark performance
bun run sandbox:bench my-hook --iterations 1000

# List available sandbox hooks
bun run sandbox:list
```

## Sandbox Structure

```
.sandbox/
├── README.md              # Sandbox documentation
├── runner.ts              # Main sandbox runner
├── hooks/                 # Test hooks directory
│   ├── example-hook/
│   │   └── index.ts
│   └── test-validator/
│       └── index.js
├── fixtures/              # Test data
│   ├── tool-inputs/       # Sample tool inputs
│   │   ├── bash.json
│   │   ├── write.json
│   │   └── edit.json
│   └── hook-outputs/      # Expected outputs
│       └── validator.json
├── logs/                  # Execution logs
│   └── [timestamp].json
└── claude-session/        # Mock Claude session
    └── settings.json
```

## Using the Sandbox

### 1. Creating Test Hooks

Create hooks in `.sandbox/hooks/` for testing:

```typescript
// .sandbox/hooks/my-test/index.ts
import { defineHook } from '@carabiner/hooks-core';

export default defineHook({
  name: 'my-test',
  events: ['PreToolUse'],
  async handler(context) {
    console.error(`[DEBUG] Processing ${context.tool}`);

    // Test logic here
    if (context.tool === 'Bash') {
      const command = context.tool_input?.command;
      if (command?.includes('dangerous')) {
        return {
          status: 'failure',
          blocking: true,
          message: 'Blocked in sandbox test',
        };
      }
    }

    return {
      status: 'success',
      message: 'Sandbox test passed',
    };
  },
});
```

### 2. Creating Test Fixtures

Add test inputs in `.sandbox/fixtures/tool-inputs/`:

```json
// .sandbox/fixtures/tool-inputs/bash-dangerous.json
{
  "hook_event_name": "PreToolUse",
  "tool": "Bash",
  "tool_input": {
    "command": "rm -rf /",
    "description": "Delete everything"
  },
  "session_id": "test-123",
  "timestamp": "2025-01-14T12:00:00Z",
  "working_directory": "/tmp/test"
}
```

### 3. Running Tests

```bash
# Run with default input
bun run sandbox my-test

# Run with specific fixture
bun run sandbox my-test --input fixtures/tool-inputs/bash-dangerous.json

# Run with verbose output
bun run sandbox my-test --verbose

# Run with custom timeout
bun run sandbox my-test --timeout 10000
```

### 4. Benchmarking

```bash
# Benchmark with 100 iterations (default)
bun run sandbox:bench my-test

# Benchmark with 1000 iterations
bun run sandbox:bench my-test --iterations 1000

# Benchmark with specific input
bun run sandbox:bench my-test --input fixtures/tool-inputs/bash.json
```

Output:

```
Benchmarking with 1000 iterations...
  Progress: 1000/1000

Benchmark Results:
  Iterations: 1000
  Average: 2.34ms
  Median: 2.10ms
  Min: 1.80ms
  Max: 5.20ms
```

## Sandbox Runner API

### TypeScript Interface

```typescript
import { runSandbox } from '.sandbox/runner';

// Run a hook programmatically
const result = await runSandbox(
  'my-hook',
  {
    tool: 'Bash',
    tool_input: { command: 'ls -la' },
  },
  {
    verbose: true,
    timeout: 5000,
  },
);

// Benchmark a hook
const benchResult = await runSandbox('my-hook', input, {
  benchmark: true,
  iterations: 1000,
});

console.log(`Average: ${benchResult.averageDuration}ms`);
```

### Options

```typescript
interface SandboxOptions {
  verbose?: boolean; // Show debug output
  benchmark?: boolean; // Run benchmark mode
  iterations?: number; // Benchmark iterations (default: 100)
  timeout?: number; // Hook timeout in ms (default: 5000)
}
```

## Integration with Testing

### Using in Tests

```typescript
// tests/hooks.test.ts
import { test, expect } from 'bun:test';
import { runSandbox } from '../.sandbox/runner';

test('bash validator blocks dangerous commands', async () => {
  const result = await runSandbox('bash-validator', {
    tool: 'Bash',
    tool_input: { command: 'rm -rf /' },
  });

  expect(result.status).toBe('failure');
  expect(result.blocking).toBe(true);
});

test('hook performance', async () => {
  const result = await runSandbox('my-hook', testInput, {
    benchmark: true,
    iterations: 100,
  });

  expect(result.averageDuration).toBeLessThan(10); // < 10ms average
});
```

### CI Integration

```yaml
# .github/workflows/test.yml
name: Test Hooks

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run sandbox tests
        run: |
          bun run sandbox:test
          bun run sandbox:bench bash-validator
```

## Debugging Hooks

### Console Logging

Use `console.error` for debug output (stdout is reserved for results):

```typescript
export default defineHook({
  async handler(context) {
    console.error('[DEBUG] Input:', JSON.stringify(context, null, 2));
    console.error('[DEBUG] Processing tool:', context.tool);

    // Your logic here

    console.error('[DEBUG] Returning success');
    return { status: 'success' };
  },
});
```

### Execution Logs

All sandbox executions are logged to `.sandbox/logs/`:

```json
// .sandbox/logs/bash-validator-1757872628675.json
{
  "timestamp": "2025-01-14T12:00:00Z",
  "hook": "bash-validator",
  "duration": 3.45,
  "input": {
    /* ... */
  },
  "output": "{\"status\":\"success\"}",
  "error": "",
  "exitCode": 0
}
```

### Viewing Logs

```bash
# View latest log
cat .sandbox/logs/$(ls -t .sandbox/logs/ | head -1)

# View all logs for a hook
cat .sandbox/logs/bash-validator-*.json

# Parse logs with jq
jq '.duration' .sandbox/logs/*.json | sort -n
```

## Mock Claude Session

Test hooks with a mock Claude Code environment:

```json
// .sandbox/claude-session/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun run .sandbox/runner.ts bash-validator",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Run mock session:

```bash
# Simulate Claude Code hook execution
echo '{"tool":"Bash","tool_input":{"command":"ls"}}' | \
  bun run .sandbox/runner.ts bash-validator
```

## Performance Testing

### Memory Profiling

```bash
# Profile memory usage
bun run sandbox my-hook --profile-memory

Output:
  Initial: 20.5 MB
  Peak: 23.2 MB
  Final: 21.1 MB
  Leaked: 0.6 MB
```

### CPU Profiling

```bash
# Generate CPU profile
bun run sandbox my-hook --profile-cpu

# Analyze with Chrome DevTools
open chrome://inspect
# Load .sandbox/profiles/cpu-profile.json
```

## Best Practices

### 1. Test Coverage

Create fixtures for all edge cases:

- Valid inputs
- Invalid inputs
- Malformed JSON
- Large payloads
- Timeout scenarios

### 2. Benchmark Baselines

Establish performance baselines:

- Average < 10ms for simple validation
- Average < 50ms for complex logic
- Average < 100ms for external calls

### 3. Isolation

Keep sandbox hooks separate from production:

- Use `.sandbox/hooks/` for tests
- Use `.carabiner/hooks/` for production
- Never mix test and production code

### 4. Continuous Testing

Run sandbox tests on every change:

```json
// package.json
{
  "scripts": {
    "pre-commit": "bun run sandbox:test",
    "pre-push": "bun run sandbox:bench"
  }
}
```

## Troubleshooting

### Common Issues

**Hook not found:**

```
Error: Hook 'my-hook' not found in sandbox
```

Solution: Ensure hook exists in `.sandbox/hooks/my-hook/index.ts`

**Timeout errors:**

```
Error: Hook timed out after 5000ms
```

Solution: Increase timeout with `--timeout 10000`

**Invalid JSON output:**

```
Error: Failed to parse hook output
```

Solution: Ensure hook returns valid JSON to stdout

**Permission denied:**

```
Error: EACCES: permission denied
```

Solution: Make hook executable: `chmod +x .sandbox/hooks/my-hook/index.js`

## Advanced Usage

### Custom Test Harness

Create a custom test harness for complex scenarios:

```typescript
// .sandbox/harness.ts
import { runSandbox } from './runner';

async function testSuite() {
  const scenarios = [
    { name: 'Valid command', input: { command: 'ls' } },
    { name: 'Dangerous command', input: { command: 'rm -rf /' } },
    // ... more scenarios
  ];

  for (const scenario of scenarios) {
    const result = await runSandbox('validator', {
      tool: 'Bash',
      tool_input: scenario.input,
    });

    console.log(`${scenario.name}: ${result.status}`);
  }
}

testSuite();
```

### Parallel Testing

Run multiple hooks in parallel:

```typescript
const hooks = ['validator', 'formatter', 'logger'];
const results = await Promise.all(hooks.map((hook) => runSandbox(hook, input)));
```

## Resources

- [Hook Development Guide](../hook-development.md)
- [Testing Guide](../testing.md)
- [Performance Guide](../performance.md)
- [Debugging Guide](../troubleshooting.md)
