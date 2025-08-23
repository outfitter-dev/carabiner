# TypeScript Hooks Architecture

## Overview

A developer-friendly system for writing Claude Code hooks in TypeScript with a component library pattern (similar to shadcn/ui), where hooks are authored/tested in TypeScript but executed directly via Bun in Claude Code settings.

## Core Concept

````mermaid
graph LR
    A[Developer writes/imports TypeScript hooks] --> B[Hooks stored in ~/.claude-hooks/]
    B --> C[Claude settings.json references hooks]
    C --> D[Claude executes via 'bun hook.ts']

```text

## Architecture Components

### 1. Developer Experience

```bash

# Install from registry (like shadcn)

claude-hooks add security/bash-validator
claude-hooks add github/pr-checks
claude-hooks add performance/monitor

# Create custom hook

claude-hooks create my-custom-hook

# Test hooks

claude-hooks test my-custom-hook

# List installed hooks

claude-hooks list

```text

### 2. File Structure

```text

~/.claude-hooks/
├── installed/          # Hooks from registry
│   ├── bash-validator.ts
│   ├── pr-checks.ts
│   └── monitor.ts
├── local/             # Custom local hooks
│   └── my-custom-hook.ts
├── node_modules/      # Shared dependencies
├── package.json       # Dependency management
└── hooks.json         # Hook metadata/config

```text

### 3. Claude Settings Integration

What gets written to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "command": "bun",
        "args": ["~/.claude-hooks/installed/bash-validator.ts"],
        "runInBackground": false
      }
    ],
    "PostToolUse": [
      {
        "command": "bun",
        "args": ["~/.claude-hooks/installed/monitor.ts"],
        "runInBackground": false
      }
    ]
  }
}

```text

### 4. Hook Runtime Structure

Each hook is a standalone TypeScript file that can be executed by Bun:

```typescript

#!/usr/bin/env bun

import { parseContext, respond } from '@outfitter/hooks-runtime';
import { z } from 'zod';

// Runtime helper parses stdin
const context = await parseContext(process.stdin);

// Type-safe context processing
const PreToolUseContext = z.object({
  tool: z.string(),
  params: z.record(z.any()),
  timestamp: z.string(),
});

const validated = PreToolUseContext.parse(context);

// Hook logic
if (validated.tool === 'Bash') {
  const command = validated.params.command as string;

  if (command.includes('rm -rf /')) {
    respond({
      action: 'block',
      message: 'Dangerous command blocked',
    });
  }
}

respond({ action: 'allow' });

```text

## Registry Architecture

### Registry Structure

Similar to how shadcn/ui works, the registry would be a GitHub repository with a JSON index:

```json
{
  "hooks": [
    {
      "name": "bash-validator",
      "category": "security",
      "description": "Validates bash commands for safety",
      "events": ["PreToolUse"],
      "dependencies": ["zod"],
      "files": [
        {
          "path": "hooks/security/bash-validator.ts",
          "content": "https://raw.githubusercontent.com/claude-hooks/registry/main/hooks/security/bash-validator.ts"
        }
      ],
      "config": {
        "customizable": true,
        "options": {
          "blockPatterns": ["rm -rf", "dd if=", "chmod 777"],
          "allowSudo": false
        }
      }
    },
    {
      "name": "pr-checks",
      "category": "github",
      "description": "Validates PRs before pushing",
      "events": ["PreToolUse"],
      "dependencies": ["@octokit/rest", "zod"],
      "files": [
        {
          "path": "hooks/github/pr-checks.ts",
          "content": "https://raw.githubusercontent.com/claude-hooks/registry/main/hooks/github/pr-checks.ts"
        }
      ]
    }
  ]
}

```text

### Registry CLI Implementation

```typescript
// claude-hooks add command
export class AddCommand {
  async execute(hookName: string) {
    // 1. Fetch registry index
    const registry = await fetch('https://registry.claude-hooks.dev/index.json');
    const index = await registry.json();

    // 2. Find hook
    const hook = index.hooks.find(
      (h) => h.name === hookName || `${h.category}/${h.name}` === hookName,
    );

    // 3. Download hook files
    for (const file of hook.files) {
      const content = await fetch(file.content).then((r) => r.text());
      await writeFile(`~/.claude-hooks/installed/${file.path}`, content);
    }

    // 4. Install dependencies
    if (hook.dependencies.length > 0) {
      await $`cd ~/.claude-hooks && bun add ${hook.dependencies.join(' ')}`;
    }

    // 5. Update settings.json
    const settings = await readSettings();
    settings.hooks[hook.events[0]] = settings.hooks[hook.events[0]] || [];
    settings.hooks[hook.events[0]].push({
      command: 'bun',
      args: [`~/.claude-hooks/installed/${hook.name}.ts`],
      runInBackground: false,
    });
    await writeSettings(settings);

    // 6. Optional: Run configuration wizard
    if (hook.config?.customizable) {
      await this.configureHook(hook);
    }
  }
}

```text

### Registry Hosting Options

1. **GitHub Repository** (like shadcn/ui)

   - Simple JSON index file
   - Hook files in repo
   - Version control built-in
   - PRs for community contributions

1. **NPM Packages**

   - Each hook as a package
   - Versioning via NPM
   - `@claude-hooks/bash-validator`

1. **Custom Registry**
   - API-based
   - Search functionality
   - Ratings/reviews
   - Usage analytics

## Implementation Phases

### Phase 1: Local Development

- [x] Core packages (hooks-core, hooks-testing, etc.)
- [ ] Basic CLI with `create` and `test` commands
- [ ] Bun runtime execution wrapper
- [ ] Settings.json integration

### Phase 2: Registry MVP

- [ ] GitHub-based registry repository
- [ ] Registry index format
- [ ] `add` command implementation
- [ ] 5-10 starter hooks

### Phase 3: Enhanced DX

- [ ] Hook configuration wizard
- [ ] Update checking
- [ ] Hook composition/chaining
- [ ] VS Code extension

### Phase 4: Community

- [ ] Registry website
- [ ] Contribution guidelines
- [ ] Hook validation/testing CI
- [ ] Community hooks section

## Example Hooks for Registry

### Security Category

- `bash-validator` - Validates bash commands
- `secret-scanner` - Prevents committing secrets
- `dependency-audit` - Checks for vulnerable dependencies

### GitHub Category

- `pr-checks` - Pre-push PR validation
- `commit-lint` - Conventional commit enforcement
- `issue-linker` - Auto-link issues in commits

### Performance Category

- `build-timer` - Track build performance
- `bundle-analyzer` - Monitor bundle size
- `test-performance` - Track test execution time

### AI/Claude Category

- `token-counter` - Track token usage
- `context-manager` - Manage context window
- `prompt-enhancer` - Enhance prompts automatically

## Benefits

1. **Type Safety**: Full TypeScript support during development
2. **No Compilation**: Bun executes TypeScript directly
3. **Shareable**: Registry enables hook sharing like components
4. **Testable**: Existing testing framework works perfectly
5. **Fast**: Bun startup ~3ms, minimal overhead
6. **Familiar**: shadcn-like DX for developers

## Technical Considerations

### Performance

- Bun startup: ~3ms
- TypeScript parsing: ~10-20ms for typical hook
- Total overhead: <30ms per hook execution

### Security

- Hooks run in user context (same as current bash hooks)
- Consider sandboxing options for registry hooks
- Validate registry hooks before publishing
- Sign registry hooks for authenticity

### Compatibility

- Requires Bun installed
- Works with Claude Code's existing hook system
- No changes needed to Claude Code itself

## Next Steps

1. **Proof of Concept**

   - Create example hook that runs via Bun
   - Test with Claude Code settings
   - Measure performance impact

1. **Registry Design**

   - Define registry schema
   - Create initial hook collection
   - Build submission process

1. **CLI Enhancement**

   - Add `add` command
   - Add `remove` command
   - Add `update` command

1. **Documentation**
   - Hook authoring guide
   - Registry contribution guide
   - Migration guide from bash hooks
````
