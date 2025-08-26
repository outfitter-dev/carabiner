# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Base instructions: @.agent/prompts/CORE.md

## Repository Overview

Carabiner is a modern TypeScript monorepo for building type-safe Carabiner hooks. Built with Bun, Turbo, and Ultracite, it provides a foundation for scalable development with strict type safety and automated quality gates.

## Important Rules

@.agent/rules/IMPORTANT.md

## Important Patterns

### Internal Package References

Always use the `@/` prefix for internal packages:

```typescript
import { someUtil } from '@/utils';
import { Component } from '@/ui';

```

### Quality Gates

1. **Pre-commit**: Formatting, linting, and type checking
2. **Pre-push**: Test execution
3. **CI Pipeline**: Full validation (lint → typecheck → test → build)
