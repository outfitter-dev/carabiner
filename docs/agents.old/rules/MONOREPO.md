# Monorepo Rules

## Monorepo Structure

- **Bun Workspaces**: Native monorepo support with `workspaces` in package.json
- **Turbo Pipelines**: Task orchestration with dependency graph awareness
- **Shared Configuration**: TypeScript, Biome, and other configs at root level

## Build Pipeline (turbo.json)

- `build`: Depends on upstream builds and typecheck, outputs to dist/build/.next
- `dev`: Non-cached, persistent development servers
- `test`: Depends on upstream builds, outputs coverage reports
- `typecheck`: Depends on upstream builds, validates all TypeScript files

## Package Development

- Place shared libraries in `packages/`
- Place applications in `apps/`
- Use workspace protocol for internal dependencies: `"@/package-name": "workspace:*"`
- Each package should have its own `package.json` and `tsconfig.json`

## Important Patterns

### Internal Package References

- **Path Mapping**: `@/*` maps to `packages/*` for internal package imports
- Always use the `@/` prefix when importing from internal packages:

```typescript
import { someUtil } from '@/utils';
import { Component } from '@/ui';
```

## Dependency Management

- Use Bun for all package management (`bun add`, `bun remove`)
- Syncpack ensures consistent versions across packages
- Publint validates packages before publishing
