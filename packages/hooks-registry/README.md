# @carabiner/hooks-registry

Official registry of production-ready AI assistant hooks for common development workflows.

## Installation

```bash
bun add @carabiner/hooks-registry
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
import { createMarkdownFormatterHook } from '@carabiner/hooks-registry';

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
  autoFix: true,
});
```

##### Check-only mode (no auto-fix)

```typescript
const hook = createMarkdownFormatterHook({
  autoFix: false,
});
```

##### Custom file patterns

```typescript
const hook = createMarkdownFormatterHook({
  patterns: ['*.md', '*.mdx', '*.markdown', 'README*'],
});
```

#### Integration with AI assistant

Create a PostToolUse hook file at `.claude/hooks/PostToolUse.js`:

```javascript
#!/usr/bin/env bun

import { HookExecutor } from '@carabiner/execution';
import { StdinProtocol } from '@carabiner/protocol';
import { createMarkdownFormatterHook } from '@carabiner/hooks-registry';

async function main() {
  const protocol = new StdinProtocol();
  const executor = new HookExecutor(protocol);

  await executor.execute(
    createMarkdownFormatterHook({
      formatter: 'auto',
      autoFix: true,
    }),
  );
}

main().catch(console.error);
```

Make the hook executable:

```bash
chmod +x .claude/hooks/PostToolUse.js
```

#### Prerequisites

The hook requires at least one markdown formatter to be available (globally or locally):

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

##### Option 3: use project-local CLIs (no global install)

```bash
# if installed locally (devDependency)
npx markdownlint-cli2 --version
npx prettier --version
# or with Bun
bunx markdownlint-cli2 --version
bunx prettier --version
```

**Note about check-only behavior**: When `autoFix` is `false`, both `markdownlint-cli2` and `prettier --check` return non-zero exits if changes are needed. The hook will report `success: false` in that case - this is an intentional signal that formatting issues were found, not a crash.

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
