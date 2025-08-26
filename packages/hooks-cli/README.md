# @carabiner/hooks-cli

Command-line tools, scaffolding, and project management for Carabiner hooks.

## Installation

```bash

# Global installation (recommended)

npm install -g @carabiner/hooks-cli

# Or use directly with npx

npx @carabiner/hooks-cli --help

```

## Usage

### Quick Start

```bash

# Initialize hooks in your project

carabiner init

# Generate a new hook

carabiner generate --type PreToolUse --tool Bash --name security-check

# Build and validate configuration

carabiner build --output .claude/settings.json

# Test a specific hook

carabiner test --hook ./hooks/pre-tool-use.ts

# Development mode with file watching

carabiner dev --watch

```

### Project Initialization

```bash

# Basic initialization

carabiner init

# TypeScript project with strict configuration

carabiner init --typescript --strict

# Initialize with templates

carabiner init --template security
carabiner init --template formatting
carabiner init --template audit

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

Initialize Carabiner hooks in your project.

```bash
carabiner init [options]

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

carabiner init

# JavaScript with Node.js

carabiner init --javascript --runtime node

# Security-focused setup

carabiner init --template security --strict

# See what would be created

carabiner init --template audit --dry-run

```

### `generate`

Generate new hook scripts from templates.

```bash
carabiner generate [options]

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

carabiner generate --type PreToolUse --name universal-security

# Bash-specific security hook

carabiner generate --type PreToolUse --tool Bash --name bash-security

# Post-write formatting hook

carabiner generate --type PostToolUse --tool Write --name format-after-write

# Session audit hook

carabiner generate --type SessionStart --name session-audit

# Use template with custom name

carabiner generate --type PreToolUse --template security --name custom-security

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
carabiner build [options]

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

carabiner build

# Build for production environment

carabiner build --environment production --output .claude/settings.prod.json

# Build with validation and minification

carabiner build --validate --minify

# Watch mode for development

carabiner build --watch

```

### `test`

Test hooks with mock data or run validation checks.

```bash
carabiner test [options] [hook-file...]

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

carabiner test

# Test specific hook file

carabiner test --hook ./hooks/bash-security.ts

# Test with specific tool context

carabiner test --hook ./hooks/pre-tool-use.ts --tool Bash --input '{"command":"ls -la"}'

# Test PreToolUse event with mock data

carabiner test --event PreToolUse --tool Write --input '{"file_path":"test.txt","content":"hello"}'

# Validate without execution

carabiner test --dry-run --verbose

```

### `dev`

Development mode with file watching and hot reload.

```bash
carabiner dev [options]

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

carabiner dev

# Watch with testing and rebuilding

carabiner dev --test-on-change --build-on-change

# Development server with UI

carabiner dev --port 3001 --open

```

### `config`

Manage hook configuration.

```bash
carabiner config <command> [options]

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

### `validate`

Validate hooks and configuration.

```bash
carabiner validate [options]

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

carabiner validate

# Validate only configuration

carabiner validate --config

# Syntax and type checking only

carabiner validate --syntax --types

# Security-focused validation

carabiner validate --security

```

## Configuration File

Create a `hooks.config.ts` file for advanced configuration:

```typescript
import { defineConfig } from '@carabiner/hooks-cli';
import { templates } from '@carabiner/hooks-config';

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
import { defineTemplate } from '@carabiner/hooks-cli';

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
import { runClaudeHook, HookResults } from '@carabiner/hooks-core';

runClaudeHook(async (context) => {
  console.log(\`Custom validation for \${context.toolName}\`);
  return HookResults.success('Custom validation passed');
});`,
    },
  ],

  dependencies: ['@carabiner/hooks-core'],

  postInstall: async (context) => {
    console.log('Custom template installed successfully!');
  },
});
```

Use with:

```bash
carabiner init --template ./templates/my-template.ts

```

## Integration

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
          bunx @carabiner/hooks-cli validate --all
          bunx @carabiner/hooks-cli test --dry-run
          bunx @carabiner/hooks-cli build --validate
```

### IDE Integration

#### VS Code Extension Support

The CLI works with the Claude Code VS Code extension:

```json
// .vscode/settings.json
{
  "carabiner.hooks.validateOnSave": true,
  "carabiner.hooks.formatOnSave": true,
  "carabiner.hooks.showInlineErrors": true
}
```

## TypeScript Support

### Generated Types

The CLI generates TypeScript definitions:

```typescript
// types/hooks.d.ts (auto-generated)
import type { HookContext, HookResult } from '@carabiner/hooks-core';

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

carabiner validate --types

# Type check specific hook

carabiner validate --types --hook ./hooks/bash-security.ts

```

## Troubleshooting

### Common Issues

#### Hooks Not Executing

```bash

# Check configuration

carabiner config validate

# Test hook directly

carabiner test --hook ./hooks/problematic-hook.ts --verbose

```

#### Performance Issues

```bash

# Analyze hook performance

carabiner validate --performance

# Check timeout settings

carabiner config get PreToolUse.Bash.timeout

```

#### Permission Errors

```bash

# Verify file permissions

ls -la hooks/

# Test with explicit permissions

chmod +x hooks/*.ts
carabiner test

```

### Debug Mode

```bash

# Enable debug output

DEBUG=carabiner:* carabiner dev

# Verbose logging

carabiner test --verbose --hook ./hooks/debug-me.ts

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

carabiner test --all

# 6. Start development mode

carabiner dev --watch --test-on-change

```

### Custom Hook Generation

```bash

# Generate tool-specific hooks for different scenarios

carabiner generate --type PreToolUse --tool Bash --name production-bash-security --template security
carabiner generate --type PreToolUse --tool Write --name file-validation --template validation
carabiner generate --type PostToolUse --tool Edit --name format-and-lint --template formatting
carabiner generate --type SessionStart --name project-initialization

```

## API Reference

For programmatic usage:

```typescript
import { CLI, ConfigManager, TemplateEngine } from '@carabiner/hooks-cli';

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
