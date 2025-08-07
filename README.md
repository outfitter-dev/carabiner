# @outfitter/grapple

A monorepo dedicated to tooling for Claude Code hooks.

## Overview

Grapple provides utilities, tools, and libraries for building and managing Claude Code hooks - from simple pre-commit formatters to complex multi-agent workflows.

## Features

- 🔧 **TypeScript** strict mode with comprehensive type safety
- 🧪 **Biome** + Ultracite for lightning-fast linting
- 🐛 **Lefthook** for git hooks
- 📦 **Bun** for fast package management and builds
- ⚡ **Turbo** for efficient monorepo management
- 🎯 **Claude Code** hook utilities and patterns

## Getting Started

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Build all packages
bun run build

# Run tests
bun run test
```

## Development

- **Format code**: `bun run format`
- **Lint code**: `bun run lint`
- **Type check**: `bun run typecheck`

## Monorepo Structure

- **apps/**: Applications and examples
- **packages/**: Reusable libraries and utilities for Claude Code hooks

## Contributing

1. Create feature branches for all changes
2. Follow conventional commit messages
3. Run linting and type checking before committing
4. Use PRs for code review

Built from [bun-monorepo-template](https://github.com/galligan/bun-monorepo-template).