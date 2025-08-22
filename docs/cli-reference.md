# CLI Reference

The Carabiner CLI (`claude-hooks`) provides comprehensive tools for developing, testing, and managing Claude Code hooks. This reference covers all commands, options, and usage patterns.

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
claude-hooks --version
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

Initialize Claude Code hooks in your project.

#### Syntax

```bash
claude-hooks init [options]
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
claude-hooks init

# JavaScript project with Node.js
claude-hooks init --javascript --runtime node

# Security-focused setup with strict TypeScript
claude-hooks init --template security --strict

# See what would be created without making changes
claude-hooks init --template audit --dry-run

# Force overwrite existing files
claude-hooks init --template security --force
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
claude-hooks generate [options]
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
claude-hooks generate --type PreToolUse --name universal-security

# Bash-specific security hook
claude-hooks generate --type PreToolUse --tool Bash --name bash-security

# Post-write formatting hook
claude-hooks generate --type PostToolUse --tool Write --name format-after-write

# Session audit hook
claude-hooks generate --type SessionStart --name session-audit

# Use specific template
claude-hooks generate --type PreToolUse --template security --name custom-security

# Generate in specific directory
claude-hooks generate --type PreToolUse --tool Edit --name edit-validator --output ./custom-hooks

# Force overwrite existing hook
claude-hooks generate --type PostToolUse --tool Write --name formatter --force
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
claude-hooks build [options]
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
claude-hooks build

# Build for production environment
claude-hooks build --environment production --output .claude/settings.prod.json

# Build with validation and minification
claude-hooks build --validate --minify

# Watch mode for development
claude-hooks build --watch

# Check configuration without building output
claude-hooks build --check

# Build from custom config file
claude-hooks build --config ./custom-hooks.config.ts
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
claude-hooks test [options] [hook-file...]
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
claude-hooks test

# Test specific hook file
claude-hooks test --hook ./hooks/bash-security.ts

# Test with specific tool context
claude-hooks test --hook ./hooks/pre-tool-use.ts --tool Bash --input '{"command":"ls -la"}'

# Test PreToolUse event with mock data
claude-hooks test --event PreToolUse --tool Write --input '{"file_path":"test.txt","content":"hello"}'

# Validate without execution
claude-hooks test --dry-run --verbose

# Watch mode for development
claude-hooks test --watch

# Generate coverage report
claude-hooks test --coverage

# Test multiple hook files
claude-hooks test ./hooks/security.ts ./hooks/formatting.ts
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
claude-hooks dev [options]
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
claude-hooks dev

# Watch with testing and rebuilding
claude-hooks dev --test-on-change --build-on-change

# Development server with UI
claude-hooks dev --port 3001 --open

# Verbose development mode
claude-hooks dev --verbose

# Development without hot reload
claude-hooks dev --no-hot-reload
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
claude-hooks config <command> [options]
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
claude-hooks config list

# Get specific hook configuration
claude-hooks config get PreToolUse.Bash

# Set hook configuration
claude-hooks config set PreToolUse.Bash.timeout 10000

# Remove hook
claude-hooks config remove PostToolUse.Write

# Validate configuration
claude-hooks config validate

# Create backup
claude-hooks config backup

# Restore from backup
claude-hooks config restore .claude/backups/settings-2024-01-15.json
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
claude-hooks validate [options]
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
claude-hooks validate

# Validate only configuration
claude-hooks validate --config

# Syntax and type checking only
claude-hooks validate --syntax --types

# Security-focused validation
claude-hooks validate --security

# Performance analysis
claude-hooks validate --performance

# Auto-fix issues
claude-hooks validate --fix
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
claude-hooks init --template security
```

Creates hooks for:

- Dangerous command detection
- File access validation
- Network request monitoring
- Content filtering

#### Formatting Template

```bash
claude-hooks init --template formatting
```

Creates hooks for:

- Auto-formatting after writes
- Code style validation
- Import organization
- Linting integration

#### Audit Template

```bash
claude-hooks init --template audit
```

Creates hooks for:

- Comprehensive logging
- Performance monitoring
- Security auditing
- Usage tracking

#### Minimal Template

```bash
claude-hooks init --template minimal
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
claude-hooks init --template ./templates/my-template.ts
```

## Examples

### Complete Project Setup

```bash
# 1. Initialize project with security template
claude-hooks init --template security --typescript --strict

# 2. Generate additional hooks
claude-hooks generate --type PostToolUse --tool Write --name format-typescript
claude-hooks generate --type PreToolUse --tool Bash --name dangerous-command-blocker

# 3. Configure for different environments
claude-hooks config set environments.production.hooks.PreToolUse.*.timeout 15000
claude-hooks config set environments.development.hooks.PreToolUse.*.timeout 5000

# 4. Build production configuration
claude-hooks build --environment production --output .claude/settings.prod.json

# 5. Test everything
claude-hooks test

# 6. Start development mode
claude-hooks dev --watch --test-on-change
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
    "hooks:build": "claude-hooks build",
    "hooks:test": "claude-hooks test",
    "hooks:dev": "claude-hooks dev",
    "hooks:validate": "claude-hooks validate",
    "hooks:init": "claude-hooks init"
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
claude-hooks init
```

#### Configuration Issues

```bash
# Validate configuration
claude-hooks config validate

# Check specific configuration
claude-hooks config get PreToolUse.Bash

# Reset configuration
claude-hooks config backup
claude-hooks init --force
```

#### Hook Not Executing

```bash
# Test hook directly
claude-hooks test --hook ./hooks/problematic-hook.ts --verbose

# Check syntax
claude-hooks validate --syntax --hooks

# Verify configuration
claude-hooks config validate
```

### Debug Mode

```bash
# Enable debug output
DEBUG=claude-hooks:* claude-hooks dev

# Verbose logging
claude-hooks test --verbose --hook ./hooks/debug-me.ts

# Check internal state
claude-hooks config list --verbose
```

### Performance Issues

```bash
# Analyze performance
claude-hooks validate --performance

# Check hook timeouts
claude-hooks config get global.timeout

# Monitor execution time
claude-hooks test --verbose --coverage
```

For more detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).

---

**Master the Carabiner CLI and build hooks with confidence!** 🛠️

Next steps:

- [Configuration Guide](configuration.md) - Advanced configuration patterns
- [API Reference](api-reference/) - Explore the programmatic API
- [Examples](examples/) - Real-world usage patterns
