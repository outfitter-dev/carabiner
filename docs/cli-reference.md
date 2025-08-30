# CLI Reference

The Grapple CLI (`carabiner`) provides comprehensive tools for developing, testing, and managing Carabiner hooks. This reference covers all commands, options, and usage patterns.

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Commands](#commands)
  - [init](#init)
  - [generate](#generate)
  - [build](#build)
  - [test](#test)
  - [dev](#dev)
  - [config](#config)
  - [validate](#validate)
- [Configuration File](#configuration-file)
- [Templates](#templates)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
# Global installation (recommended)
npm install -g @outfitter/hooks-cli

# Or use with npx (no installation required)
npx @outfitter/hooks-cli --help

# Verify installation
carabiner --version
```

## Global Options

These options work with all commands:

```bash
--help, -h          Show help information
--version, -v       Show version number
--verbose           Enable verbose output
--quiet, -q         Suppress non-essential output
--no-color          Disable colored output
--config <path>     Use custom configuration file
```

## Commands

### `init`

Initialize Carabiner hooks in your project.

#### Syntax

```bash
carabiner init [options]
```

#### Options

```bash
--typescript, -t     Generate TypeScript hooks (default: true)
--javascript, -j     Generate JavaScript hooks
--template <name>    Use predefined template (security, formatting, audit, minimal)
--strict             Use strict TypeScript configuration
--runtime <name>     Target runtime (bun, node, deno) (default: bun)
--force              Overwrite existing files
--dry-run            Show what would be created without making changes
--output <dir>       Output directory (default: current directory)
```

#### Examples

```bash
# Basic TypeScript setup with Bun runtime
carabiner init

# JavaScript project with Node.js
carabiner init --javascript --runtime node

# Security-focused setup with strict TypeScript
carabiner init --template security --strict

# See what would be created without making changes
carabiner init --template audit --dry-run

# Force overwrite existing files
carabiner init --template security --force
```

#### Created Structure

```text
.claude/
├── settings.json              # Claude Code configuration
└── settings.local.json        # Local settings (gitignored)

hooks/
├── pre-tool-use.ts           # Universal pre-tool hook
├── post-tool-use.ts          # Universal post-tool hook
├── session-start.ts          # Session initialization
└── utils/                    # Shared utilities
    ├── security.ts
    └── formatting.ts

package.json                  # Updated with dependencies
.gitignore                   # Updated to ignore local settings
README.md                    # Updated with hook documentation
```

### `generate`

Generate new hook scripts from templates.

#### Syntax

```bash
carabiner generate [options]
```

#### Options

```bash
--type <event>       Hook event (PreToolUse, PostToolUse, SessionStart, UserPromptSubmit, Stop, SubagentStop)
--tool <tool>        Target tool (Bash, Write, Edit, Read, MultiEdit, etc.) - omit for universal
--name <name>        Hook name/filename
--template <name>    Template to use (security, formatting, validation, audit)
--output <path>      Output directory (default: ./hooks)
--typescript         Generate TypeScript (default: true)
--javascript         Generate JavaScript
--force              Overwrite existing files
```

#### Examples

```bash
# Universal security hook for all tools
carabiner generate --type PreToolUse --name universal-security

# Bash-specific security hook
carabiner generate --type PreToolUse --tool Bash --name bash-security

# Post-write formatting hook
carabiner generate --type PostToolUse --tool Write --name format-after-write

# Session audit hook
carabiner generate --type SessionStart --name session-audit

# Use specific template
carabiner generate --type PreToolUse --template security --name custom-security

# Generate in specific directory
carabiner generate --type PreToolUse --tool Edit --name edit-validator --output ./custom-hooks

# Force overwrite existing hook
carabiner generate --type PostToolUse --tool Write --name formatter --force
```

#### Generated Files Include

- Hook script with proper imports and structure
- Type-safe tool input handling
- Error handling patterns
- Documentation comments
- Example validation logic
- Unit test template (when applicable)

### `build`

Build and validate hook configuration for Claude Code.

#### Syntax

```bash
carabiner build [options]
```

#### Options

```bash
--config <path>      Configuration file (default: .claude/hooks.config.ts)
--output <path>      Output settings file (default: .claude/settings.json)
--environment <env>  Target environment (development, production, test)
--validate           Validate configuration before building (default: true)
--minify             Minify output JSON
--watch              Watch for changes and rebuild
--check              Check configuration without building
```

#### Examples

```bash
# Build default configuration
carabiner build

# Build for production environment
carabiner build --environment production --output .claude/settings.prod.json

# Build with validation and minification
carabiner build --validate --minify

# Watch mode for development
carabiner build --watch

# Check configuration without building output
carabiner build --check

# Build from custom config file
carabiner build --config ./custom-hooks.config.ts
```

#### Build Process

1. **Parse** configuration file
2. **Validate** hook scripts and settings
3. **Resolve** environment-specific overrides
4. **Generate** Claude Code compatible JSON
5. **Write** output file with proper formatting

### `test`

Test hooks with mock data or run validation checks.

#### Syntax

```bash
carabiner test [options] [hook-file...]
```

#### Options

```bash
--hook <path>        Specific hook file to test
--event <event>      Test specific event (PreToolUse, PostToolUse, etc.)
--tool <tool>        Test specific tool context
--input <json>       Custom tool input JSON
--timeout <ms>       Test timeout (default: 30000)
--verbose            Verbose output with execution details
--dry-run            Validate hooks without executing
--watch              Watch files and rerun tests on changes
--coverage           Generate coverage report
```

#### Examples

```bash
# Test all hooks
carabiner test

# Test specific hook file
carabiner test --hook ./hooks/bash-security.ts

# Test with specific tool context
carabiner test --hook ./hooks/pre-tool-use.ts --tool Bash --input '{"command":"ls -la"}'

# Test PreToolUse event with mock data
carabiner test --event PreToolUse --tool Write --input '{"file_path":"test.txt","content":"hello"}'

# Validate without execution
carabiner test --dry-run --verbose

# Watch mode for development
carabiner test --watch

# Generate coverage report
carabiner test --coverage

# Test multiple hook files
carabiner test ./hooks/security.ts ./hooks/formatting.ts
```

#### Test Features

- **Mock Contexts**: Automatically generate appropriate test contexts
- **Type Validation**: Verify TypeScript types and interfaces
- **Error Simulation**: Test error handling and edge cases
- **Performance Testing**: Measure execution time and resource usage
- **Integration Testing**: Test hooks in realistic scenarios

### `dev`

Development mode with file watching and hot reload.

#### Syntax

```bash
carabiner dev [options]
```

#### Options

```bash
--watch              Watch hook files for changes (default: true)
--port <port>        Development server port (default: 3000)
--open               Open browser to development UI
--verbose            Verbose logging
--test-on-change     Run tests when files change
--build-on-change    Rebuild configuration when files change
--no-hot-reload      Disable hot reloading
```

#### Examples

```bash
# Basic development mode
carabiner dev

# Watch with testing and rebuilding
carabiner dev --test-on-change --build-on-change

# Development server with UI
carabiner dev --port 3001 --open

# Verbose development mode
carabiner dev --verbose

# Development without hot reload
carabiner dev --no-hot-reload
```

#### Development Features

- **File Watching**: Automatically detect changes to hook files
- **Hot Reload**: Instantly update running hooks without restart
- **Web UI**: Browser-based development interface
- **Live Testing**: Run tests automatically when files change
- **Real-time Logs**: Stream hook execution logs in real-time

### `config`

Manage hook configuration settings.

#### Syntax

```bash
carabiner config <command> [options]
```

#### Commands

```bash
get <key>            Get configuration value
set <key> <value>    Set configuration value
remove <key>         Remove configuration key
list                 List all configuration
validate             Validate current configuration
backup               Create configuration backup
restore <file>       Restore from backup
```

#### Examples

```bash
# List all hook configurations
carabiner config list

# Get specific hook configuration
carabiner config get PreToolUse.Bash

# Set hook configuration
carabiner config set PreToolUse.Bash.timeout 10000

# Remove hook
carabiner config remove PostToolUse.Write

# Validate configuration
carabiner config validate

# Create backup
carabiner config backup

# Restore from backup
carabiner config restore .claude/backups/settings-2024-01-15.json
```

#### Configuration Keys

```bash
# Hook-specific settings
PreToolUse.<Tool>.command       # Hook command
PreToolUse.<Tool>.timeout       # Execution timeout
PreToolUse.<Tool>.enabled       # Enable/disable hook

# Global settings
global.runtime                  # Default runtime (bun, node, deno)
global.typescript              # Use TypeScript
global.timeout                 # Default timeout

# Environment settings
environments.<env>.*           # Environment-specific overrides
```

### `validate`

Validate hooks and configuration files.

#### Syntax

```bash
carabiner validate [options]
```

#### Options

```bash
--config             Validate configuration files
--hooks              Validate hook scripts
--syntax             Check syntax only
--types              Type checking (TypeScript only)
--security           Security validation
--performance        Performance analysis
--all                Run all validations (default)
--fix                Automatically fix issues where possible
```

#### Examples

```bash
# Validate everything
carabiner validate

# Validate only configuration
carabiner validate --config

# Syntax and type checking only
carabiner validate --syntax --types

# Security-focused validation
carabiner validate --security

# Performance analysis
carabiner validate --performance

# Auto-fix issues
carabiner validate --fix
```

#### Validation Checks

- **Syntax**: TypeScript/JavaScript syntax validation
- **Types**: TypeScript type checking
- **Security**: Security best practices and vulnerability scanning
- **Performance**: Performance analysis and optimization suggestions
- **Configuration**: Claude Code settings validation
- **Dependencies**: Package version compatibility

## Configuration File

Create `hooks.config.ts` for advanced configuration:

```typescript
import { defineConfig } from '@outfitter/hooks-cli';

export default defineConfig({
  // Runtime configuration
  runtime: 'bun',
  typescript: true,
  strict: true,

  // Hook configuration
  hooks: {
    PreToolUse: {
      // Universal security hook
      '*': {
        command: 'bun run hooks/universal-security.ts',
        timeout: 5000,
        enabled: true,
      },
      // Bash-specific hook
      Bash: {
        command: 'bun run hooks/bash-security.ts',
        timeout: 10000,
        enabled: process.env.NODE_ENV === 'production',
      },
    },

    PostToolUse: {
      Write: {
        command: 'bun run hooks/format-after-write.ts',
        timeout: 30000,
        enabled: true,
      },
      Edit: {
        command: 'bun run hooks/format-after-edit.ts',
        timeout: 30000,
        enabled: true,
      },
    },

    SessionStart: {
      command: 'bun run hooks/session-init.ts',
      timeout: 10000,
    },
  },

  // Environment-specific overrides
  environments: {
    development: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 2000, // Faster timeouts in dev
          },
        },
      },
    },

    production: {
      hooks: {
        PreToolUse: {
          Bash: {
            timeout: 15000, // Longer timeouts in prod
          },
        },
      },
    },
  },

  // Generation settings
  generation: {
    outputDir: './hooks',
    typescript: true,
    includeTypes: true,
    includeTests: true,
    includeDocumentation: true,
  },

  // Development settings
  development: {
    watch: true,
    testOnChange: true,
    buildOnChange: true,
    hotReload: true,
  },
});
```

## Templates

### Built-in Templates

#### Security Template

```bash
carabiner init --template security
```

Creates hooks for:

- Dangerous command detection
- File access validation
- Network request monitoring
- Content filtering

#### Formatting Template

```bash
carabiner init --template formatting
```

Creates hooks for:

- Auto-formatting after writes
- Code style validation
- Import organization
- Linting integration

#### Audit Template

```bash
carabiner init --template audit
```

Creates hooks for:

- Comprehensive logging
- Performance monitoring
- Security auditing
- Usage tracking

#### Minimal Template

```bash
carabiner init --template minimal
```

Creates basic hook structure with minimal dependencies.

### Custom Templates

Create custom templates in `templates/` directory:

```typescript
// templates/my-template.ts
import { defineTemplate } from '@outfitter/hooks-cli';

export default defineTemplate({
  name: 'my-template',
  description: 'Custom hook template',

  hooks: {
    PreToolUse: {
      '*': {
        command: 'bun run hooks/custom-validator.ts',
        timeout: 5000,
      },
    },
  },

  files: [
    {
      path: 'hooks/custom-validator.ts',
      content: `#!/usr/bin/env bun
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  console.log(\`Custom validation for \${context.toolName}\`);
  return HookResults.success('Custom validation passed');
});`,
    },
  ],

  dependencies: ['@outfitter/hooks-core'],

  postInstall: async (context) => {
    console.log('Custom template installed successfully!');
  },
});
```

Use with:

```bash
carabiner init --template ./templates/my-template.ts
```

## Examples

### Complete Project Setup

```bash
# 1. Initialize project with security template
carabiner init --template security --typescript --strict

# 2. Generate additional hooks
carabiner generate --type PostToolUse --tool Write --name format-typescript
carabiner generate --type PreToolUse --tool Bash --name dangerous-command-blocker

# 3. Configure for different environments
carabiner config set environments.production.hooks.PreToolUse.*.timeout 15000
carabiner config set environments.development.hooks.PreToolUse.*.timeout 5000

# 4. Build production configuration
carabiner build --environment production --output .claude/settings.prod.json

# 5. Test everything
carabiner test

# 6. Start development mode
carabiner dev --watch --test-on-change
```

### CI/CD Integration

#### GitHub Actions

```yaml
# .github/workflows/hooks.yml
name: Validate Hooks

on: [push, pull_request]

jobs:
  validate-hooks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - run: bun install

      - name: Validate hooks
        run: |
          bunx @outfitter/hooks-cli validate --all
          bunx @outfitter/hooks-cli test --dry-run
          bunx @outfitter/hooks-cli build --validate
```

### Package.json Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "hooks:build": "carabiner build",
    "hooks:test": "carabiner test",
    "hooks:dev": "carabiner dev",
    "hooks:validate": "carabiner validate",
    "hooks:init": "carabiner init"
  }
}
```

## Troubleshooting

### Common Issues

#### Command Not Found

```bash
# Install globally
npm install -g @outfitter/hooks-cli

# Or use with npx
npx @outfitter/hooks-cli --version
```

#### Permission Errors

```bash
# Fix file permissions
chmod +x hooks/*.ts

# Avoid using sudo; fix file permissions or install to a user-writable location instead
carabiner init
```

#### Configuration Issues

```bash
# Validate configuration
carabiner config validate

# Check specific configuration
carabiner config get PreToolUse.Bash

# Reset configuration
carabiner config backup
carabiner init --force
```

#### Hook Not Executing

```bash
# Test hook directly
carabiner test --hook ./hooks/problematic-hook.ts --verbose

# Check syntax
carabiner validate --syntax --hooks

# Verify configuration
carabiner config validate
```

### Debug Mode

```bash
# Enable debug output
DEBUG=carabiner:* carabiner dev

# Verbose logging
carabiner test --verbose --hook ./hooks/debug-me.ts

# Check internal state
carabiner config list --verbose
```

### Performance Issues

```bash
# Analyze performance
carabiner validate --performance

# Check hook timeouts
carabiner config get global.timeout

# Monitor execution time
carabiner test --verbose --coverage
```

For more detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).

---

**Master the Grapple CLI and build hooks with confidence!** 🛠️

Next steps:

- [Configuration Guide](configuration.md) - Advanced configuration patterns
- [API Reference](api-reference/) - Explore the programmatic API
- [Examples](examples/) - Real-world usage patterns
