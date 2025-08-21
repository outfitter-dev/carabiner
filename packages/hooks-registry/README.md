# @outfitter/hooks-registry

Official registry of production-ready Claude Code hooks for common development workflows.

## Installation

```bash
bun add @outfitter/hooks-registry
```

## Available Hooks

### Markdown Formatter Hook

Automatically formats markdown files when they are edited using either `markdownlint-cli2` or `prettier`.

#### Features

- **Auto-detection**: Automatically detects available formatters (markdownlint-cli2 or prettier)
- **Configurable**: Choose your preferred formatter or let it auto-detect
- **Fix or Check**: Can auto-fix issues or just check for problems
- **Custom Patterns**: Configure which file patterns to process
- **Tool Integration**: Works with Edit, Write, MultiEdit, and NotebookEdit tools

#### Basic Usage

```typescript
import { createMarkdownFormatterHook } from '@outfitter/hooks-registry';

// Create hook with default settings
const hook = createMarkdownFormatterHook();
```

#### Configuration Options

```typescript
type MarkdownFormatterConfig = {
  // Preferred formatter ('markdownlint' | 'prettier' | 'auto')
  formatter?: 'markdownlint' | 'prettier' | 'auto';
  
  // Additional arguments to pass to the formatter
  additionalArgs?: string[];
  
  // Whether to fix issues automatically (default: true)
  autoFix?: boolean;
  
  // File patterns to include (default: ['*.md', '*.mdx'])
  patterns?: string[];
};
```

#### Examples

##### Auto-detect formatter (default)

```typescript
const hook = createMarkdownFormatterHook();
```

##### Use specific formatter with config

```typescript
const hook = createMarkdownFormatterHook({
  formatter: 'markdownlint',
  additionalArgs: ['--config', '.markdownlint.json'],
  autoFix: true
});
```

##### Check-only mode (no auto-fix)

```typescript
const hook = createMarkdownFormatterHook({
  autoFix: false
});
```

##### Custom file patterns

```typescript
const hook = createMarkdownFormatterHook({
  patterns: ['*.md', '*.mdx', '*.markdown', 'README*']
});
```

#### Integration with Claude Code

Create a PostToolUse hook file at `.claude/hooks/PostToolUse.js`:

```javascript
#!/usr/bin/env bun

import { HookExecutor } from '@outfitter/executor';
import { StdinProtocol } from '@outfitter/protocol';
import { createMarkdownFormatterHook } from '@outfitter/hooks-registry';

async function main() {
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);
  
  await executor.execute(createMarkdownFormatterHook({
    formatter: 'auto',
    autoFix: true
  }));
}

main().catch(console.error);
```

Make the hook executable:

```bash
chmod +x .claude/hooks/PostToolUse.js
```

#### Prerequisites

The hook requires at least one markdown formatter to be installed:

##### Option 1: markdownlint-cli2

```bash
npm install -g markdownlint-cli2
# or
bun add -g markdownlint-cli2
```

##### Option 2: prettier

```bash
npm install -g prettier
# or
bun add -g prettier
```

## Development

### Testing

```bash
bun test
```

### Building

```bash
bun run build
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT
