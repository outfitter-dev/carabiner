# Development Commands

## Essential Commands

```bash

# Install dependencies

bun install

# Start development servers for all packages/apps

bun run dev

# Build all packages and apps

bun run build

# Run tests across the monorepo

bun run test

# Run tests in CI mode (sequential)

bun run test:ci

# Run a single test file

bun test path/to/file.test.ts

# Run tests in watch mode

bun test --watch

```

See @use-bun.md for more Bun commands.

## Code Quality Commands

```bash

# Format code using Ultracite (Biome)

bun run format

# Check formatting without fixing

bun run format:check

# Lint code using Ultracite (Biome)

bun run lint

# Lint and auto-fix issues

bun run lint:fix

# Type check all packages

bun run typecheck

# Type check entire monorepo at once

bun run typecheck:all

# Run full CI pipeline locally

bun run ci:full

```

## Git Hooks (via Lefthook)

```bash

# Manually run pre-commit hooks

bun run lefthook:run

# Hooks run automatically on:

# - pre-commit: format check, lint, typecheck

# - pre-push: run tests

```
