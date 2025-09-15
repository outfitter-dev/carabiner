# Carabiner Sandbox

A safe testing environment for developing and testing Carabiner hooks.

## Purpose

This sandbox provides:
- Isolated environment for hook development
- Real Claude Code integration testing
- Mock tool inputs for testing hooks
- Performance benchmarking
- Hook validation and debugging

## Structure

```
.sandbox/
├── README.md
├── hooks/               # Test hooks directory
│   └── example-hook/
│       └── index.ts
├── fixtures/            # Test fixtures and mock data
│   ├── tool-inputs/     # Sample tool inputs
│   └── hook-outputs/    # Expected outputs
├── logs/                # Hook execution logs
├── claude-session/      # Claude Code test session
│   └── settings.json    # Test configuration
└── runner.ts            # Sandbox test runner
```

## Usage

### Running the sandbox

```bash
# Run sandbox with a specific hook
bun run sandbox test-hook

# Run all sandbox tests
bun run sandbox:test

# Watch mode for development
bun run sandbox:watch

# Benchmark a hook
bun run sandbox:bench test-hook
```

### Testing with Claude Code

1. The sandbox can simulate a Claude Code session
2. Configure hooks in `claude-session/settings.json`
3. Run `bun run sandbox:claude` to start monitoring

### Creating test hooks

```typescript
// .sandbox/hooks/my-test/index.ts
import { defineHook } from "@carabiner/hooks-core";

export default defineHook({
  name: "my-test",
  events: ["PreToolUse"],
  async handler(context) {
    // Your test logic here
    return {
      status: "success",
      message: "Test passed"
    };
  }
});
```

## Integration with Testing

This sandbox integrates with the main test suite:

```typescript
import { runSandbox } from ".sandbox/runner";

test("hook handles bash commands", async () => {
  const result = await runSandbox("bash-validator", {
    tool: "Bash",
    input: { command: "rm -rf /" }
  });

  expect(result.blocking).toBe(true);
});
```