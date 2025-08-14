# Package Strategy: Outfitter Ecosystem Organization

**Date**: 2025-08-14 14:42  
**Status**: Proposal  
**Context**: Analysis of @outfitter namespace conflicts and reorganization strategy

## Current State Analysis

### Existing Packages by Repository

**Main Monorepo** (`~/Developer/outfitter/monorepo`)
- `@outfitter/baselayer` - UI component foundation
- `@outfitter/contracts` - Type definitions and interfaces
- `@outfitter/fieldguides` - Documentation system
- `@outfitter/types` - Core type definitions

**Rulesets** (`~/Developer/outfitter/rulesets`)
- `@rulesets/core` - Rule orchestration
- `@rulesets/compiler` - Rule compilation
- `@rulesets/linter` - Rule validation
- `@rulesets/parser` - Rule parsing
- `@rulesets/types` - Rule type definitions

**Carabiner** (`~/Developer/outfitter/grapple` → `@outfitter/carabiner`)
- `@outfitter/hooks-core` - Hook execution engine
- `@outfitter/hooks-validators` - Input validation
- `@outfitter/hooks-config` - Configuration management
- `@outfitter/hooks-testing` - Testing utilities
- `@outfitter/hooks-cli` - CLI interface
- `@outfitter/types` - Hook type definitions ⚠️ **CONFLICT**
- `@outfitter/protocol` - Communication protocols

## Identified Conflicts

### Direct Namespace Conflicts
- **`@outfitter/types`**: Both main monorepo and carabiner define this package
  - Main: Core Outfitter type definitions
  - Carabiner: Claude Code hooks type definitions

### Semantic Overlap Concerns
- Generic package names in carabiner (`hooks-core`, `hooks-validators`) could conflict with future non-Claude Code hook systems
- Protocol implementations are currently Claude Code specific but named generically

## Recommended Strategy: Mixed Approach

### Phase 1: Immediate Conflict Resolution

**Rename Carabiner Packages to Claude Code Specific**
```
@outfitter/hooks-core       → @outfitter/carabiner-hooks
@outfitter/hooks-validators → @outfitter/carabiner-validators  
@outfitter/hooks-config     → @outfitter/carabiner-config
@outfitter/hooks-testing    → @outfitter/carabiner-testing
@outfitter/hooks-cli        → @outfitter/carabiner-cli
@outfitter/types           → @outfitter/carabiner-types
@outfitter/protocol        → @outfitter/carabiner-protocol
```

**Rationale**: 
- Eliminates all namespace conflicts
- Clearly identifies Claude Code specific functionality
- Maintains carabiner branding for the ecosystem
- Allows future generic hook systems without collision

### Phase 2: Strategic Package Placement

**Truly Generic Packages → Main Monorepo**
- Consider moving genuinely reusable utilities to main monorepo
- Evaluate if any carabiner functionality has broader Outfitter applications

**Domain-Specific Packages → Dedicated Repos**
- Keep Claude Code specific packages in carabiner
- Maintain rulesets packages in dedicated repo
- Preserve clear domain boundaries

## Implementation Impact

### Breaking Changes Required
- All import statements need updating across codebase
- Package.json dependencies require modification
- Documentation and README updates
- Changeset configuration updates

### Files Requiring Updates
```
packages/*/package.json          # Package names
packages/*/src/**/*.ts           # Import statements  
packages/*/README.md            # Documentation
examples/**/*.ts                # Example code
.changeset/config.json          # Changeset package names
turbo.json                      # Build pipeline references
```

### Migration Strategy
1. **Update package.json names** in all packages
2. **Global find/replace** for import statements
3. **Update build configuration** (turbo.json, tsconfig paths)
4. **Regenerate type definitions** with new package names
5. **Update changeset configuration** 
6. **Test full build pipeline** end-to-end

## Alternative Approaches Considered

### Option A: Full Generic Naming
- **Pros**: Broader reusability, simpler names
- **Cons**: High conflict risk, unclear ownership, namespace pollution

### Option B: Move Everything to Main Monorepo
- **Pros**: Single source of truth, unified versioning
- **Cons**: Couples Claude Code tooling to main product, bloats monorepo

### Option C: Separate @carabiner Namespace
- **Pros**: Complete isolation, no conflicts
- **Cons**: Fragments Outfitter ecosystem, requires new npm org

## Recommended Next Steps

1. **Get stakeholder approval** for mixed strategy approach
2. **Create migration script** to automate package renames
3. **Update all import statements** using find/replace
4. **Test build pipeline** thoroughly after changes  
5. **Update documentation** to reflect new package structure
6. **Plan gradual rollout** to minimize disruption

## Success Metrics

- ✅ Zero namespace conflicts across all repos
- ✅ Clear package ownership and purpose
- ✅ Successful CI/CD pipeline after migration
- ✅ All imports resolve correctly
- ✅ Preserved functionality with new names

## Risk Mitigation

- **Backup current state** before starting migration
- **Incremental testing** after each package rename
- **Rollback plan** documented if issues arise
- **Communication plan** for any external consumers

---

**Next Review**: After stakeholder feedback and implementation planning