# @outfitter/hooks-cli

Command-line tools, scaffolding, and project management for Claude Code hooks.

## Installation

```bash

# Global installation (recommended)

npm install -g @outfitter/hooks-cli

# Or use directly with npx

npx @outfitter/hooks-cli --help

```

## Usage

### Quick Start

```bash

# Initialize hooks in your project

claude-hooks init

# Generate a new hook

claude-hooks generate --type PreToolUse --tool Bash --name security-check

# Build and validate configuration

claude-hooks build --output .claude/settings.json

# Test a specific hook

claude-hooks test --hook ./hooks/pre-tool-use.ts

# Development mode with file watching

claude-hooks dev --watch

```

### Project Initialization

```bash

# Basic initialization

claude-hooks init

# TypeScript project with strict configuration

claude-hooks init --typescript --strict

# Initialize with templates

claude-hooks init --template security
claude-hooks init --template formatting
claude-hooks init --template audit

```

This creates:

```text
.claude/
├── settings.json              # Claude Code settings
└── settings.local.json        # Local settings (gitignored)

hooks/
├── pre-tool-use.ts           # Universal pre-tool hook
├── post-tool-use.ts          # Universal post-tool hook
├── session-start.ts          # Session initialization
└── utils/                    # Shared utilities
    ├── security.ts
    └── formatting.ts

package.json                  # Updated with hook dependencies
.gitignore                    # Updated to ignore local settings
README.md                     # Updated with hook documentation

```

## Commands

### `init`

Initialize Claude Code hooks in your project.

```bash
claude-hooks init [options]

Options:
  --typescript, -t     Generate TypeScript hooks (default: true)
  --javascript, -j     Generate JavaScript hooks
  --template <name>    Use template (security, formatting, audit, minimal)
  --strict             Use strict TypeScript configuration
  --runtime <name>     Target runtime (bun, node, deno) (default: bun)
  --force              Overwrite existing files
  --dry-run            Show what would be created without making changes
```

**Examples:**

```bash

# Basic TypeScript setup with Bun

claude-hooks init

# JavaScript with Node.js

claude-hooks init --javascript --runtime node

# Security-focused setup

claude-hooks init --template security --strict

# See what would be created

claude-hooks init --template audit --dry-run

```

### `generate`

Generate new hook scripts from templates.

```bash
claude-hooks generate [options]

Options:
  --type <event>       Hook event (PreToolUse, PostToolUse, SessionStart, etc.)
  --tool <tool>        Target tool (Bash, Write, Edit, etc.) - omit for universal
  --name <name>        Hook name/filename
  --template <name>    Template to use (security, formatting, validation, audit)
  --output <path>      Output directory (default: ./hooks)
  --typescript         Generate TypeScript (default: true)
  --javascript         Generate JavaScript
```

**Examples:**

```bash

# Universal security hook for all tools

claude-hooks generate --type PreToolUse --name universal-security

# Bash-specific security hook

claude-hooks generate --type PreToolUse --tool Bash --name bash-security

# Post-write formatting hook

claude-hooks generate --type PostToolUse --tool Write --name format-after-write

# Session audit hook

claude-hooks generate --type SessionStart --name session-audit

# Use template with custom name

claude-hooks generate --type PreToolUse --template security --name custom-security

```

Generated files include:

- Hook script with proper imports and structure
- Type-safe tool input handling
- Error handling patterns
- Documentation comments
- Example validation logic

### `build`

Build and validate hook configuration for Claude Code.

```bash
claude-hooks build [options]

Options:
  --config <path>      Configuration file (default: .claude/hooks.config.ts)
  --output <path>      Output settings file (default: .claude/settings.json)
  --environment <env>  Target environment (development, production, test)
  --validate           Validate configuration before building (default: true)
  --minify             Minify output JSON
  --watch              Watch for changes and rebuild
```

**Examples:**

```bash

# Build default configuration

claude-hooks build

# Build for production environment

claude-hooks build --environment production --output .claude/settings.prod.json

# Build with validation and minification

claude-hooks build --validate --minify

# Watch mode for development

claude-hooks build --watch

```

### `test`

Test hooks with mock data or run validation checks.

```bash
claude-hooks test [options] [hook-file...]

Options:
  --hook <path>        Specific hook file to test
  --event <event>      Test specific event (PreToolUse, PostToolUse, etc.)
  --tool <tool>        Test specific tool context
  --input <json>       Custom tool input JSON
  --timeout <ms>       Test timeout (default: 30000)
  --verbose            Verbose output with execution details
  --dry-run            Validate hooks without executing
```

**Examples:**

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

```

### `dev`

Development mode with file watching and hot reload.

```bash
claude-hooks dev [options]

Options:
  --watch              Watch hook files for changes (default: true)
  --port <port>        Development server port (default: 3000)
  --open               Open browser to development UI
  --verbose            Verbose logging
  --test-on-change     Run tests when files change
  --build-on-change    Rebuild configuration when files change
```

**Examples:**

```bash

# Basic development mode

claude-hooks dev

# Watch with testing and rebuilding

claude-hooks dev --test-on-change --build-on-change

# Development server with UI

claude-hooks dev --port 3001 --open

```

### `config`

Manage hook configuration.

```bash
claude-hooks config <command> [options]

Commands:
  get <key>            Get configuration value
  set <key> <value>    Set configuration value
  remove <key>         Remove configuration key
  list                 List all configuration
  validate             Validate current configuration
  backup               Create configuration backup
  restore <file>       Restore from backup
```

**Examples:**

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

### `validate`

Validate hooks and configuration.

```bash
claude-hooks validate [options]

Options:
  --config             Validate configuration files
  --hooks              Validate hook scripts
  --syntax             Check syntax only
  --types              Type checking (TypeScript only)
  --security           Security validation
  --performance        Performance analysis
  --all                Run all validations (default)
```

**Examples:**

```bash

# Validate everything

claude-hooks validate

# Validate only configuration

claude-hooks validate --config

# Syntax and type checking only

claude-hooks validate --syntax --types

# Security-focused validation

claude-hooks validate --security

```

## Configuration File

Create a `hooks.config.ts` file for advanced configuration:

```typescript
import { defineConfig } from '@outfitter/hooks-cli';
import { templates } from '@outfitter/hooks-config';

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
      // Format after writing
      Write: {
        command: 'bun run hooks/format-after-write.ts',
        timeout: 30000,
        enabled: true,
      },
      // Format after editing
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

  // Template usage
  templates: [templates.security, templates.formatting],

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

## Integration

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

### IDE Integration

#### VS Code Extension Support

The CLI works with the Claude Code VS Code extension:

```json
// .vscode/settings.json
{
  "claude-code.hooks.validateOnSave": true,
  "claude-code.hooks.formatOnSave": true,
  "claude-code.hooks.showInlineErrors": true
}
```

## TypeScript Support

### Generated Types

The CLI generates TypeScript definitions:

```typescript
// types/hooks.d.ts (auto-generated)
import type { HookContext, HookResult } from '@outfitter/hooks-core';

export interface ProjectHookContext extends HookContext {
  // Project-specific context extensions
}

export interface ProjectHookResult extends HookResult {
  // Project-specific result extensions
}
```

### Type Checking

```bash

# Type check all hooks

claude-hooks validate --types

# Type check specific hook

claude-hooks validate --types --hook ./hooks/bash-security.ts

```

## Troubleshooting

### Common Issues

#### Hooks Not Executing

```bash

# Check configuration

claude-hooks config validate

# Test hook directly

claude-hooks test --hook ./hooks/problematic-hook.ts --verbose

```

#### Performance Issues

```bash

# Analyze hook performance

claude-hooks validate --performance

# Check timeout settings

claude-hooks config get PreToolUse.Bash.timeout

```

#### Permission Errors

```bash

# Verify file permissions

ls -la hooks/

# Test with explicit permissions

chmod +x hooks/*.ts
claude-hooks test

```

### Debug Mode

```bash

# Enable debug output

DEBUG=claude-hooks:* claude-hooks dev

# Verbose logging

claude-hooks test --verbose --hook ./hooks/debug-me.ts

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

claude-hooks test --all

# 6. Start development mode

claude-hooks dev --watch --test-on-change

```

### Custom Hook Generation

```bash

# Generate tool-specific hooks for different scenarios

claude-hooks generate --type PreToolUse --tool Bash --name production-bash-security --template security
claude-hooks generate --type PreToolUse --tool Write --name file-validation --template validation
claude-hooks generate --type PostToolUse --tool Edit --name format-and-lint --template formatting
claude-hooks generate --type SessionStart --name project-initialization

```

## API Reference

For programmatic usage:

```typescript
import { CLI, ConfigManager, TemplateEngine } from '@outfitter/hooks-cli';

// Programmatic CLI usage
const cli = new CLI();
await cli.init({ typescript: true, template: 'security' });
await cli.generate({ type: 'PreToolUse', tool: 'Bash', name: 'security' });
await cli.build({ environment: 'production' });
await cli.test({ hook: './hooks/test-hook.ts' });

// Configuration management
const config = new ConfigManager('./project');
await config.initialize();
config.setHook('PreToolUse', 'Bash', { command: 'bun run security.ts' });
await config.save();

// Template engine
const templates = new TemplateEngine();
const template = await templates.load('security');
await templates.generate(template, { runtime: 'bun', typescript: true });
```

## License

MIT
