# Carabiner Project Handoff Document

**Date**: August 27, 2025  
**Author**: Claude (via Claude Code)  
**Status**: Pre-MVP Release

## 🎯 Project State Overview

### Current Status

- **Core Framework**: ✅ Complete and functional
- **Test Coverage**: ✅ 748/752 tests passing (4 failing in hooks-cli)
- **Documentation**: 🟡 Basic README exists, needs quickstart guide
- **Examples**: ✅ 4 comprehensive example hooks implemented
- **CI/CD**: 🔴 Failing due to 4 test failures
- **NPM Publishing**: 🔴 Not yet configured
- **Version**: 0.1.0-beta (ready for alpha/beta release)

### Recent Work Completed

1. **Namespace Migration**: Successfully migrated from `@claude-code` to `@carabiner`
2. **Example Hooks**: Added 4 production-ready examples:
   - Bash command validator (ported from Anthropic's Python example)
   - Security guard hook
   - Git safety hook
   - Auto-formatter hook
3. **Bug Fixes**:
   - Fixed Buffer handling in markdown formatter
   - Implemented proper timeout cleanup in executor
   - Fixed glob pattern matching for nested files
4. **Code Quality**: Addressed all CodeRabbit review feedback across multiple rounds

## 📊 Current Branch Structure

```
main (258cf63) - Last stable release
├── feat/add-examples (PR #20) - Ready to merge, has CI failures
│   └── 08-27-fix_implement_proper_timeout_cleanup (PR #23) - Fixes Issue #21
├── devin/1735052574-update-claude-code-scope-references - Can be closed
└── 08-25-refactor_migrate_package_scope - Already merged, can be deleted
```

## 🐛 Known Issues

### Critical (Blocking MVP)

1. **Issue #22**: 4 failing tests in `@carabiner/hooks-cli`
   - WorkspaceValidator Security Tests (2 tests)
   - Integration Security Tests (1 test)
   - Performance and Resource Limits (1 test)
   - **Impact**: Blocking CI/CD pipeline

### Non-Critical (Post-MVP)

2. **Issue #13**: Type safety improvements (remaining `any` types)
3. **Issue #14**: Missing repository metadata in some packages

## 📝 Outstanding Tasks for MVP

### Must Have (Ship Blockers)

- [ ] Fix Issue #22 (4 failing tests)
- [ ] Create Hello World quickstart example
- [ ] Setup NPM publishing configuration
- [ ] Add basic getting started documentation

### Nice to Have (Can Ship Without)

- [ ] Complete package metadata (keywords, descriptions)
- [ ] Comprehensive API documentation
- [ ] More example hooks
- [ ] Performance benchmarks

## 🚀 Deployment Checklist

### Pre-Release

1. Fix failing tests (Issue #22)
2. Merge PR #20 (example hooks)
3. Merge PR #23 (timeout cleanup)
4. Create quickstart guide
5. Configure NPM publishing
6. Update version to 0.1.0-alpha

### Release Steps

```bash
# 1. Ensure all tests pass
bun test

# 2. Build all packages
bun run build:packages

# 3. Run changeset version
bun run changeset:version

# 4. Publish to NPM
bun run changeset:publish

# 5. Create GitHub release
gh release create v0.1.0-alpha --title "v0.1.0-alpha" --notes "Initial alpha release"

# 6. Update documentation site (if applicable)
```

## 🔧 Technical Debt & Improvements

### High Priority

- Security test failures need investigation (may be environment-specific)
- Linting violations in executor.ts (functions with 5+ parameters)
- Missing proper error handling in some edge cases

### Medium Priority

- Improve test isolation (some tests may have interdependencies)
- Add integration tests for the full hook lifecycle
- Implement proper logging throughout the codebase

### Low Priority

- Remove remaining `any` types
- Add performance benchmarks
- Implement hook composition patterns

## 📚 Key Files & Locations

### Core Implementation

- `/packages/hooks-core/` - Core hook interfaces and types
- `/packages/execution/` - Hook executor and runtime
- `/packages/hooks-cli/` - CLI tool for running hooks
- `/packages/hooks-registry/` - Registry of official hooks

### Examples & Tests

- `/packages/examples/src/` - Example hook implementations
- `/tests/production/` - Production scenario tests
- `/tests/comprehensive/` - Comprehensive test suite

### Configuration

- `/turbo.json` - Turbo build configuration
- `/biome.json` - Linter configuration (Ultracite)
- `/.github/workflows/` - CI/CD workflows

## 🎓 Architectural Decisions

### Key Design Choices

1. **TypeScript-First**: Full type safety with strict mode
2. **Monorepo Structure**: Managed with Bun workspaces + Turbo
3. **Multiple APIs**: Function, Builder, and Declarative patterns
4. **Security by Default**: Built-in validators and sandboxing
5. **Protocol-Based**: StdinProtocol for Claude Code integration

### Technology Stack

- **Runtime**: Bun (primary), Node.js compatible
- **Build**: Turbo for monorepo orchestration
- **Testing**: Bun test + custom test framework
- **Linting**: Biome with Ultracite preset
- **Package Management**: Bun workspaces

## 🤝 Collaboration Notes

### Git Workflow

- Using Graphite for stacked PRs
- Conventional commits enforced
- Pre-commit hooks for formatting/linting
- Pre-push hooks for tests (currently failing)

### Code Review Process

- CodeRabbit AI reviews enabled
- Multiple review rounds implemented
- All feedback tracked and addressed
- Issues created for deferred items

### Communication Patterns

- Issues created for all known problems
- PR descriptions include test plans
- Commits reference related issues
- Clear documentation of decisions

## 📞 Next Steps (Priority Order)

1. **Fix Issue #22** - Investigate and fix the 4 failing CLI tests
2. **Create Quickstart** - Simple "Hello World" hook example
3. **NPM Setup** - Configure publishing and verify package names
4. **Documentation** - Basic getting started guide
5. **Release** - Tag v0.1.0-alpha and publish

## 🔑 Important Commands

```bash
# Development
bun install          # Install dependencies
bun test            # Run all tests
bun run build       # Build all packages
bun run lint        # Run linter
bun run typecheck   # Type checking

# Testing specific packages
bun test packages/hooks-cli  # Test CLI package

# Git/Graphite
gt log              # View stack
gt submit --no-interactive  # Submit stack

# Release
bun run changeset   # Create changeset
bun run changeset:version  # Version packages
bun run changeset:publish  # Publish to NPM
```

## 📌 Repository Links

- **GitHub**: https://github.com/outfitter-dev/carabiner
- **Issues**: https://github.com/outfitter-dev/carabiner/issues
- **PR #20**: https://github.com/outfitter-dev/carabiner/pull/20 (Examples)
- **PR #23**: https://github.com/outfitter-dev/carabiner/pull/23 (Timeout fix)

## 💡 Lessons Learned

### What Worked Well

- Incremental migration from @claude-code to @carabiner
- Comprehensive test coverage caught many issues
- CodeRabbit reviews improved code quality
- Stacked PRs kept changes manageable

### Challenges Encountered

- Test failures in CI but not locally (environment-specific)
- Linter strictness causing commit friction
- Complex monorepo build dependencies
- Buffer handling in error messages needed special care

### Recommendations

- Consider relaxing some linting rules for MVP
- Add more integration tests for real-world scenarios
- Document hook development patterns clearly
- Create video tutorials for common use cases

---

**End of Handoff Document**

_This document provides context for continuing development on the Carabiner project. For questions or clarifications, refer to the issue tracker or PR discussions._
