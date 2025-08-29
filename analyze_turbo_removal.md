# Impact Analysis: Removing Turbo in Favor of Bun-Only Approach

## Current Turbo Usage

### 1. **Task Orchestration**
- **Build Pipeline**: `turbo build` manages dependency graph for builds
- **Test Execution**: `turbo test` runs tests with caching
- **Type Checking**: `turbo typecheck` 
- **Development**: `turbo dev` for watch mode

### 2. **Key Benefits We're Using**
- **Dependency Graph**: Builds packages in correct order (^build)
- **Caching**: Turbo caches task outputs (.turbo directory)
- **Parallel Execution**: Runs tasks concurrently where possible
- **CI Optimization**: Reuses cached results in CI

### 3. **Current Problems**
- Tests fail through Turbo but pass with direct `bun test`
- Adds complexity layer between Bun and actual execution
- Cache invalidation issues
- Environment variable handling differences

## Bun-Only Alternative

### 1. **Bun Workspace Features**
```bash
# Run script in all packages
bun run --filter "*" test

# Run in specific packages
bun run --filter "@carabiner/hooks-*" build

# Built-in workspace support
bun install # handles all workspace packages
```

### 2. **What We'd Lose**
- ❌ Smart caching of task outputs
- ❌ Dependency graph visualization
- ❌ Automatic task ordering based on dependencies
- ❌ Remote caching capabilities
- ❌ Pipeline optimizations

### 3. **What We'd Gain**
- ✅ Simpler, more direct execution
- ✅ No environment variable conflicts
- ✅ Faster startup (no Turbo overhead)
- ✅ Consistent test behavior
- ✅ One less tool to maintain

## Migration Impact

### Scripts to Replace
```json
// Current (with Turbo)
"build": "turbo build",
"test": "turbo test",
"typecheck": "turbo typecheck"

// Proposed (Bun-only)
"build": "bun run build:all",
"build:all": "bun --filter '*' run build",
"test": "bun test",
"test:all": "bun --filter '*' test",
"typecheck": "bun --filter '*' run typecheck"
```

### CI/CD Changes
- Remove Turbo cache steps
- Simplify workflow (no cache restore/save)
- Potentially faster CI (no cache overhead)
- Need custom ordering for dependent builds

### Custom Build Script Needed
```bash
#!/usr/bin/env bun
// scripts/build-all.ts
// Would need to handle dependency ordering manually
```

## Recommendations

### Short Term (MVP - Recommended)
1. **Remove Turbo temporarily** to unblock MVP
2. Use Bun's native workspace commands
3. Simple shell scripts for task ordering
4. Get tests passing consistently

### Long Term Options
1. **Reintroduce Turbo** after resolving environment issues
2. **Try Nx** as alternative orchestrator
3. **Stay with Bun-only** if it proves sufficient
4. **Custom orchestration** tailored to our needs

## Effort Estimate

### Removal Tasks (2-3 hours)
1. Update package.json scripts (15 min)
2. Create build ordering script (1 hour)
3. Update CI workflows (30 min)
4. Test all commands work (30 min)
5. Update documentation (15 min)

### Risk Assessment
- **Low Risk**: Can always add Turbo back
- **Main Challenge**: Manual dependency ordering for builds
- **CI Impact**: Slightly slower without caching
- **Developer Experience**: Simpler but less optimized

## Verdict

**Recommended: Temporarily remove Turbo for MVP**

Reasons:
1. Immediate fix for blocking test issues
2. Reduces complexity for initial release
3. Bun workspaces provide basic needed functionality
4. Can optimize with Turbo post-MVP when stable

The test failures are blocking CI/CD and preventing release. Removing Turbo temporarily would:
- Fix the immediate blocking issue
- Simplify the stack for MVP
- Allow focus on core functionality
- Provide option to reintroduce later with lessons learned
