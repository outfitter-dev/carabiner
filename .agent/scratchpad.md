# Scratchpad

## Current Work Session

_Last updated: 2025-08-29_

### Active PR Stack Status

- PR #43 (Draft) - CI failures, needs fixes for rename claude-hooks → carabiner
- PR #37 - Has merge conflicts, needs rebase
- PR #36 - Ready but has CodeRabbit comments about @/ imports
- PR #40 - Waiting on downstack, mergeability check in progress
- PR #39 (Draft) - v0.1 preflight, needs other PRs first
- PR #42 - ✅ MERGED successfully

### Local Changes Status

- Current branch: `08-28-feat_add_cursor_agent_docker_environment_setup`
- Has uncommitted changes to `packages/hooks-registry/tsconfig.json`
- Multiple PRs showing "local changes, need submit"

### Priority Actions

1. Fix PR #43 CI failures immediately (blocking entire stack)
   - ✅ Fixed @carabiner/executor → @carabiner/execution references
   - ✅ Added picomatch to catalog
   - ⚠️ Many linting errors remain (500+ across packages)
   - Need to fix execution package async/await issues
2. Resolve PR #37 merge conflicts
3. Address CodeRabbit feedback on PR #36
4. Submit local changes with `gt submit`

### v0.1.0-alpha Release Blockers

- Issue #38: Binary rename (PR #43 in progress)
- CI pipeline must be green
- All foundation PRs must merge

---

## Quick References

### Common Commands

```bash
# Graphite workflow
gt sync --no-interactive
gt log
gt submit --no-interactive --draft

# Testing
bun test
turbo test
bun run ci:local

# Linting/Formatting
bun run lint
bun run format
bun x ultracite lint
```

### Package Locations

- CLI: `packages/hooks-cli/`
- Core: `packages/hooks-core/`
- Registry: `packages/hooks-registry/`
- Config: `packages/hooks-config/`

---

## Notes & Ideas

### Technical Debt

- Need to configure @/ import aliases in all packages (CodeRabbit feedback)
- Consider simplifying the PR stack depth
- Turbo vs direct Bun execution differences resolved in PR #31

### Architecture Decisions

- Using Carabiner name (not claude-hooks)
- Monorepo with Bun workspaces + Turbo
- TypeScript strict mode everywhere
- Ultracite for linting

---

## Scratch Area

_Use this space for temporary notes, calculations, or thoughts_
