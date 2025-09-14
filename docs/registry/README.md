# 🪝 Carabiner Hook Ecosystem

> Discover, install, and share hooks like components with shadcn/ui

## Overview

Carabiner provides a rich ecosystem for discovering, installing, and sharing hooks - similar to how shadcn/ui revolutionized component sharing. Hooks can be published to npm, shared via GitHub, or distributed through our registry.

## 🎯 Hook Discovery & Installation

### Browse Available Hooks

```bash
# Interactive browser
carabiner browse

# Search for specific hooks
carabiner search authentication

# Get hook details
carabiner info bash-validator
```

### Install Hooks

```bash
# Install from official registry
carabiner add bash-validator

# Install from npm (community)
carabiner add @username/carabiner-hook-logger

# Install from GitHub
carabiner add github.com/user/my-hook

# Install globally
carabiner add bash-validator --global

# Install with dependencies
carabiner add complex-hook --with-deps
```

### Hook Resolution Order

When you run `carabiner add hook-name`, the CLI searches in this order:

1. **Official Registry** (`@carabiner/hook-*`)
2. **Community Packages** (npm search)
3. **GitHub URLs** (if URL provided)
4. **Local Registry** (future)

## 📦 Publishing Hooks

### Three Distribution Tiers

#### 1. Official Hooks (`@carabiner/hook-*`)

- Published under the `@carabiner/` npm scope
- Reviewed and vetted by maintainers
- Installed with: `carabiner add hook-name`
- Examples: `bash-validator`, `commit-helper`, `test-runner`

#### 2. Community Hooks (`@user/carabiner-hook-*`)

- Published by community members
- Under personal/org npm scopes
- Installed with: `carabiner add @user/carabiner-hook-name`
- Discoverable via search

#### 3. Private/Local Hooks

- Project-specific in `.carabiner/hooks/`
- Private npm packages
- GitHub repositories

### Publishing Your Hook

#### Step 1: Create Your Hook

```typescript
// my-awesome-hook/index.ts
import { defineHook } from '@carabiner/hooks-core';

export default defineHook({
  name: 'my-awesome-hook',
  events: ['PreToolUse'],
  async handler(context) {
    // Your hook logic
    return {
      status: 'success',
      message: 'Hook executed',
    };
  },
});
```

#### Step 2: Create Manifest

```json
// my-awesome-hook/manifest.json
{
  "name": "my-awesome-hook",
  "version": "1.0.0",
  "description": "An awesome hook that does cool things",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "config": {
    "events": ["PreToolUse", "PostToolUse"],
    "tools": ["Bash", "Write"],
    "blocking": true,
    "timeout": 5
  },
  "dependencies": [],
  "tags": ["utility", "validation"],
  "repository": {
    "type": "git",
    "url": "https://github.com/you/my-awesome-hook"
  }
}
```

#### Step 3: Validate Your Hook

```bash
# The publish command validates automatically
carabiner publish --dry-run

# Manual validation
node my-awesome-hook/index.js < test-input.json
```

#### Step 4: Publish

```bash
# Publish to npm as community hook
carabiner publish --npm
# Creates: @yourscope/carabiner-hook-awesome

# Create GitHub release
carabiner publish --github

# Submit to official registry (create PR)
# Fork the carabiner repo and add your hook
```

### Publishing Options

#### Option 1: Official Registry (Recommended for quality hooks)

1. Fork [github.com/outfitter-dev/carabiner](https://github.com/outfitter-dev/carabiner)
2. Add your hook to `packages/examples/src/`
3. Submit a PR with tests and documentation
4. After review, it's published as `@carabiner/hook-yourname`

#### Option 2: Community Package (Quick & independent)

```bash
# Initialize npm package
npm init

# Set package name
# name: @yourscope/carabiner-hook-awesome

# Add keywords for discovery
# keywords: ["carabiner-hook", "carabiner", "your-category"]

# Add carabiner config to package.json
{
  "carabiner": {
    "manifest": { /* your manifest */ }
  }
}

# Publish
npm publish --access public
```

#### Option 3: GitHub Repository

```bash
# Create repository with hook files
git init my-hook
# Add index.js, manifest.json, README.md

# Push to GitHub
git remote add origin github.com/you/my-hook
git push

# Users can install directly
carabiner add github.com/you/my-hook
```

## 🔍 Hook Manifest Format

The manifest provides metadata and configuration for hooks:

```typescript
interface HookManifest {
  // Required fields
  name: string; // Hook identifier
  version: string; // Semantic version
  description: string; // What the hook does
  author:
    | string
    | {
        // Author info
        name: string;
        email?: string;
        url?: string;
      };

  // Source and installation
  source: string; // npm package or GitHub URL
  installedAt?: string; // ISO timestamp

  // Dependencies
  dependencies?: string[]; // Required hooks
  peerDependencies?: string[]; // Optional companions

  // Configuration
  config?: {
    timeout?: number; // Default timeout (seconds)
    events?: HookEvent[]; // Events to handle
    tools?: string[]; // Tools to target
    blocking?: boolean; // Can block operations
  };

  // Files
  files?: {
    main: string; // Entry point
    types?: string; // TypeScript definitions
    schema?: string; // JSON schema
  };

  // Discovery
  tags?: string[]; // Keywords for search
  license?: string; // License identifier

  // Repository
  repository?: {
    type: string;
    url: string;
  };

  // Examples
  examples?: Array<{
    name: string;
    description: string;
    config: Record<string, any>;
  }>;
}
```

## 🌟 Featured Hooks

### Security & Validation

- `bash-validator` - Validates bash commands for safety
- `security-scanner` - Scans for vulnerabilities
- `secret-detector` - Prevents committing secrets

### Development Workflow

- `commit-helper` - Improves commit messages
- `test-runner` - Runs tests before changes
- `formatter` - Auto-formats code

### Code Quality

- `linter` - Runs linting checks
- `type-checker` - Ensures type safety
- `dependency-checker` - Checks for outdated packages

### Documentation

- `doc-generator` - Generates documentation
- `readme-updater` - Keeps README current
- `changelog-writer` - Maintains changelog

## 🔧 Creating Hook Collections

You can create collections of related hooks:

```json
// collection.json
{
  "name": "security-suite",
  "description": "Complete security toolkit",
  "hooks": [
    "@carabiner/hook-bash-validator",
    "@carabiner/hook-security-scanner",
    "@carabiner/hook-secret-detector"
  ]
}
```

Install collections:

```bash
carabiner add-collection security-suite
```

## 🎮 Hook Categories

Hooks are organized into categories for easy discovery:

- **security** - Security validation and scanning
- **git** - Version control helpers
- **testing** - Test runners and validators
- **code-quality** - Linters and formatters
- **dependencies** - Package management
- **documentation** - Doc generation
- **performance** - Optimization tools
- **deployment** - CI/CD helpers
- **custom** - Experimental hooks

## 📊 Hook Analytics

Track hook usage and performance:

```bash
# View hook statistics
carabiner stats

# Show most used hooks
carabiner popular

# Benchmark hook performance
carabiner bench bash-validator
```

## 🤝 Community

### Contributing Hooks

1. **Quality Standards**
   - Type-safe TypeScript
   - Comprehensive tests
   - Clear documentation
   - Follows conventions

2. **Review Process**
   - Submit PR to main repo
   - Code review by maintainers
   - Testing in sandbox
   - Community feedback

3. **Maintenance**
   - Regular updates
   - Security patches
   - Version compatibility

### Hook Ideas

Looking for hook ideas? Check our [wanted hooks list](https://github.com/outfitter-dev/carabiner/issues?q=label:hook-request).

## 🔗 Resources

- [Hook Development Guide](./hook-development.md)
- [Publishing Guide](./publishing.md)
- [API Reference](./api.md)
- [Best Practices](./best-practices.md)
- [Community Forum](https://github.com/outfitter-dev/carabiner/discussions)
