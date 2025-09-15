# Hello World - Your First Carabiner Hook

This guide walks you through creating your first Carabiner hook in under 5 minutes.

## Quick Start

### Step 1: Create Your Hook File

Create a new file called `hello-world-hook.ts`:

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';

// Create a simple hook that logs a greeting
const helloWorldHook = createHook.preToolUse(async (context) => {
  console.log('🎉 Hello from Carabiner!');
  console.log(`Tool being used: ${context.tool}`);

  // Return success to allow the tool to proceed
  return HookResults.success('Hello World hook executed!');
});

// Export for use
export default helloWorldHook;
```

### Step 2: Test Your Hook Locally

Create a test file `test-hello-world.ts`:

```typescript
import { HookRegistry } from '@carabiner/hooks-core';
import { createToolHookContext } from '@carabiner/types';
import helloWorldHook from './hello-world-hook';

async function testHelloWorld() {
  // Create a registry
  const registry = new HookRegistry();

  // Register your hook
  registry.register(helloWorldHook);

  // Create a test context
  const context = createToolHookContext('PreToolUse', {
    tool: 'Bash',
    parameters: {
      command: 'echo "Testing Hello World"',
    },
  });

  // Execute the hook
  const results = await registry.execute('PreToolUse', context);

  console.log('Hook results:', results);
}

// Run the test
testHelloWorld().catch(console.error);
```

Run the test:

```bash
bun run test-hello-world.ts
```

Expected output:

```
🎉 Hello from Carabiner!
Tool being used: Bash
Hook results: [ { status: 'success', message: 'Hello World hook executed!' } ]
```

## Interactive Example - Add Emojis to Messages

Let's create a more fun hook that adds emojis to Claude's responses:

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';

const emojiHook = createHook.postToolUse(async (context) => {
  // Only process Write and Edit tools
  if (context.tool !== 'Write' && context.tool !== 'Edit') {
    return HookResults.skip();
  }

  // Add a random emoji to the response
  const emojis = ['🚀', '✨', '🎯', '💡', '🔥', '⚡'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

  console.log(`${randomEmoji} File operation completed!`);

  return HookResults.success('Added some fun to your file operation!');
});

export default emojiHook;
```

## Security Example - Block Dangerous Commands

Here's a practical hook that prevents accidental dangerous commands:

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';

const safetyHook = createHook.preToolUse('Bash', async (context) => {
  const command = context.parameters.command;

  // List of dangerous patterns
  const dangerous = [
    'rm -rf /',
    'dd if=/dev/zero',
    ':(){ :|:& };:', // Fork bomb
    'chmod -R 777 /',
  ];

  // Check if command contains dangerous patterns
  for (const pattern of dangerous) {
    if (command.includes(pattern)) {
      return HookResults.block(`🛑 Blocked dangerous command: "${pattern}"`);
    }
  }

  // Command is safe, allow it
  return HookResults.success();
});

export default safetyHook;
```

## Using Hooks with Claude Code

To use your hooks with Claude Code:

1. **Build your hook** into a JavaScript file
2. **Register it** in your Claude Code configuration
3. **Test it** by triggering the relevant tool

### Configuration Example

Create a `.claude/hooks/hello-world.js` file:

```javascript
// Simple hook for Claude Code
module.exports = {
  event: 'PreToolUse',
  handler: async (context) => {
    console.log('🎉 Hello from Carabiner!');
    return { status: 'success' };
  },
};
```

## Try It Now!

1. Copy any of the examples above
2. Save to a `.ts` file
3. Run with `bun run <filename>.ts`
4. See your hook in action!

## What's Next?

- [Learn about different hook events](./QUICKSTART.md#understanding-hook-events)
- [Explore tool-specific hooks](./QUICKSTART.md#tool-scoping)
- [Write tests for your hooks](./QUICKSTART.md#testing-your-hooks)
- [Check out advanced examples](./examples/)

## Troubleshooting

### Common Issues

**"Cannot find module '@carabiner/hooks-core'"**

- Install the package: `npm install @carabiner/hooks-core`

**"Hook not executing"**

- Make sure you've registered the hook with `registry.register()`
- Check that the event name matches (e.g., 'PreToolUse' not 'preToolUse')

**"TypeScript errors"**

- Ensure you have TypeScript installed: `npm install -D typescript`
- Use `bun` which has built-in TypeScript support

## Complete Working Example

Here's a complete, copy-paste ready example:

```typescript
#!/usr/bin/env bun
// Save as: my-first-hook.ts
// Run with: bun run my-first-hook.ts

import { createHook, HookRegistry, HookResults } from '@carabiner/hooks-core';

// Define a hook
const myHook = createHook.preToolUse(async (context) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] 🎯 Hook triggered for tool: ${context.tool}`);

  // Add your logic here
  if (context.tool === 'Bash') {
    console.log('  Command:', context.parameters.command);
  }

  return HookResults.success('Hook completed successfully!');
});

// Test the hook
async function main() {
  const registry = new HookRegistry();
  registry.register(myHook);

  // Simulate a tool use
  const testContext = {
    event: 'PreToolUse' as const,
    tool: 'Bash' as const,
    parameters: { command: 'echo "Hello World"' },
    sessionId: 'test-session',
    timestamp: Date.now(),
  };

  const results = await registry.execute('PreToolUse', testContext);
  console.log('\n✅ Results:', results);
}

// Run it!
main().catch(console.error);
```

Save this file and run:

```bash
bun run my-first-hook.ts
```

You should see:

```
[3:45:12 PM] 🎯 Hook triggered for tool: Bash
  Command: echo "Hello World"

✅ Results: [ { status: 'success', message: 'Hook completed successfully!' } ]
```

Congratulations! You've created your first Carabiner hook! 🎉
