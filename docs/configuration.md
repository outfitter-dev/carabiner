# Configuration Guide

This guide covers all configuration options for Grapple hooks, from basic Claude Code settings to advanced environment-specific configurations.

## Table of Contents

- [Quick Start](#quick-start)
- [Claude Code Settings](#claude-code-settings)
- [Hook Configuration](#hook-configuration)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Configuration File Reference](#configuration-file-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Quick Start

### Basic Claude Code Configuration

Create `.claude/settings.json` in your project root:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/security-check.ts",
      "timeout": 10000
    }
  },
  "postToolUseHooks": {
    "Write": {
      "command": "bun hooks/format-after-write.ts",
      "timeout": 30000
    }
  }
}
```

### Using the CLI

```bash
# Initialize with template
carabiner init --template security

# Build configuration
carabiner build --output .claude/settings.json

# Validate configuration
carabiner validate --config
```

## Claude Code Settings

Claude Code reads hook configuration from `.claude/settings.json`. This file maps hook events to executable commands.

### Basic Structure

```json
{
  "preToolUseHooks": {
    // Hook definitions for before tool execution
  },
  "postToolUseHooks": {
    // Hook definitions for after tool execution
  },
  "sessionStartHooks": {
    // Hook definitions for session start
  },
  "userPromptSubmitHooks": {
    // Hook definitions for prompt submission
  },
  "stopHooks": {
    // Hook definitions for session stop
  },
  "subagentStopHooks": {
    // Hook definitions for subagent stop
  }
}
```

### Hook Definition Format

Each hook is defined with these properties:

```json
{
  "command": "bun hooks/my-hook.ts", // Command to execute
  "timeout": 10000, // Timeout in milliseconds
  "enabled": true, // Enable/disable hook
  "description": "Security validation" // Optional description
}
```

### Universal vs Tool-Specific Hooks

#### Universal Hooks (All Tools)

Use `"*"` to run hooks for all tools:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/universal-security.ts",
      "timeout": 5000
    }
  }
}
```

#### Tool-Specific Hooks

Use tool names to target specific tools:

```json
{
  "preToolUseHooks": {
    "Bash": {
      "command": "bun hooks/bash-security.ts",
      "timeout": 10000
    },
    "Write": {
      "command": "bun hooks/write-validator.ts",
      "timeout": 15000
    }
  }
}
```

#### Combining Universal and Tool-Specific

You can use both universal and tool-specific hooks. Tool-specific hooks run after universal hooks:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/universal-audit.ts",
      "timeout": 3000
    },
    "Bash": {
      "command": "bun hooks/bash-security.ts",
      "timeout": 10000
    },
    "Write": {
      "command": "bun hooks/file-validator.ts",
      "timeout": 5000
    }
  }
}
```

## Hook Configuration

### Available Tools

These are the tools you can target with hooks:

- `Bash` - Shell command execution
- `Edit` - Single file editing
- `Write` - File creation/writing
- `Read` - File reading
- `MultiEdit` - Multiple file edits
- `NotebookEdit` - Jupyter notebook editing
- `Glob` - File pattern matching
- `Grep` - Text searching
- `LS` - Directory listing
- `Task` - Subagent task execution
- `WebFetch` - Web content fetching
- `WebSearch` - Web searching

### Hook Events

#### PreToolUse

Runs **before** tool execution. Can block execution by returning non-zero exit code.

```json
{
  "preToolUseHooks": {
    "Bash": {
      "command": "bun hooks/bash-security.ts",
      "timeout": 10000,
      "description": "Validate bash commands for security"
    }
  }
}
```

#### PostToolUse

Runs **after** tool execution. Good for cleanup, formatting, or logging.

```json
{
  "postToolUseHooks": {
    "Write": {
      "command": "bun hooks/format-file.ts",
      "timeout": 30000,
      "description": "Auto-format written files"
    },
    "Edit": {
      "command": "bun hooks/lint-after-edit.ts",
      "timeout": 20000
    }
  }
}
```

#### Session Events

Handle session lifecycle:

```json
{
  "sessionStartHooks": {
    "command": "bun hooks/session-init.ts",
    "timeout": 5000,
    "description": "Initialize session with project settings"
  },
  "userPromptSubmitHooks": {
    "command": "bun hooks/prompt-logger.ts",
    "timeout": 2000
  },
  "stopHooks": {
    "command": "bun hooks/session-cleanup.ts",
    "timeout": 10000
  }
}
```

### Timeout Configuration

Set appropriate timeouts based on hook complexity:

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/quick-check.ts",
      "timeout": 2000 // Fast validation
    },
    "Bash": {
      "command": "bun hooks/security-scan.ts",
      "timeout": 10000 // More thorough security check
    }
  },
  "postToolUseHooks": {
    "Write": {
      "command": "bun hooks/format-and-lint.ts",
      "timeout": 30000 // File processing can be slow
    }
  }
}
```

## Environment-Specific Configuration

### Multiple Settings Files

Create different settings for each environment:

```bash
.claude/
├── settings.json              # Default/development
├── settings.production.json   # Production
├── settings.staging.json      # Staging
└── settings.test.json         # Testing
```

#### Development Configuration

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/dev-validator.ts",
      "timeout": 2000,
      "enabled": true
    }
  }
}
```

#### Production Configuration

```json
{
  "preToolUseHooks": {
    "*": {
      "command": "bun hooks/security-validator.ts",
      "timeout": 15000,
      "enabled": true
    },
    "Bash": {
      "command": "bun hooks/strict-bash-security.ts",
      "timeout": 20000,
      "enabled": true
    }
  },
  "postToolUseHooks": {
    "*": {
      "command": "bun hooks/audit-logger.ts",
      "timeout": 5000,
      "enabled": true
    }
  }
}
```

### Building Environment-Specific Configurations

```bash
# Build for specific environment
carabiner build --environment production --output .claude/settings.production.json
carabiner build --environment staging --output .claude/settings.staging.json
carabiner build --environment test --output .claude/settings.test.json
```

## Advanced Configuration

### Hook Configuration File

Create `hooks.config.ts` for advanced configuration:

```typescript
import { defineConfig } from '@outfitter/hooks-cli';

export default defineConfig({
  // Global settings
  runtime: 'bun',
  typescript: true,
  strict: true,

  // Hook definitions
  hooks: {
    PreToolUse: {
      // Universal hook (all tools)
      '*': {
        command: 'bun hooks/universal-security.ts',
        timeout: 5000,
        enabled: true,
        description: 'Universal security validation',
      },

      // Tool-specific hooks
      Bash: {
        command: 'bun hooks/bash-security.ts',
        timeout: 10000,
        enabled: process.env.NODE_ENV === 'production',
        description: 'Bash command security validation',
      },

      Write: {
        command: 'bun hooks/file-validator.ts',
        timeout: 8000,
        enabled: true,
        description: 'File write validation',
      },
    },

    PostToolUse: {
      Write: {
        command: 'bun hooks/format-after-write.ts',
        timeout: 30000,
        enabled: true,
        description: 'Auto-format files after writing',
      },

      Edit: {
        command: 'bun hooks/lint-after-edit.ts',
        timeout: 20000,
        enabled: true,
        description: 'Lint files after editing',
      },
    },

    SessionStart: {
      command: 'bun hooks/session-init.ts',
      timeout: 10000,
      enabled: true,
      description: 'Initialize session with project settings',
    },
  },

  // Environment-specific overrides
  environments: {
    development: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 2000, // Faster in development
            enabled: true,
          },
          Bash: {
            enabled: false, // Disable strict bash checks in dev
          },
        },
      },
    },

    production: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 15000, // More thorough in production
          },
          Bash: {
            timeout: 20000, // Extra time for security checks
            enabled: true,
          },
        },
        PostToolUse: {
          '*': {
            command: 'bun hooks/audit-logger.ts',
            timeout: 5000,
            enabled: true,
            description: 'Comprehensive audit logging',
          },
        },
      },
    },

    test: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 1000, // Fast tests
            enabled: false, // Disable hooks during testing
          },
        },
      },
    },
  },

  // Template configuration
  templates: {
    security: {
      strict: true,
      includeBashValidation: true,
      includeFileValidation: true,
    },
    formatting: {
      autoFormat: true,
      lintOnSave: true,
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
    port: 3000,
  },
});
```

### Conditional Hook Configuration

Enable hooks based on conditions:

```typescript
export default defineConfig({
  hooks: {
    PreToolUse: {
      Bash: {
        command: 'bun hooks/bash-security.ts',
        timeout: 10000,
        // Only enable in production or when explicitly requested
        enabled: process.env.NODE_ENV === 'production' || process.env.STRICT_SECURITY === 'true',
      },

      Write: {
        command: 'bun hooks/file-validator.ts',
        timeout: 5000,
        // Enable everywhere except test environment
        enabled: process.env.NODE_ENV !== 'test',
      },
    },

    PostToolUse: {
      '*': {
        command: 'bun hooks/audit-logger.ts',
        timeout: 3000,
        // Only enable audit logging in production
        enabled: process.env.NODE_ENV === 'production',
      },
    },
  },
});
```

### Custom Hook Paths

Configure custom paths for hooks:

```typescript
export default defineConfig({
  hooks: {
    PreToolUse: {
      '*': {
        command:
          process.env.NODE_ENV === 'production'
            ? 'bun security/production-validator.ts'
            : 'bun security/dev-validator.ts',
        timeout: 5000,
      },
    },
  },

  // Custom directories
  paths: {
    hooks: './src/hooks',
    security: './src/security',
    utils: './src/utils',
  },
});
```

## Configuration File Reference

### Complete Configuration Schema

```typescript
interface GrappleConfig {
  // Global settings
  runtime?: 'bun' | 'node' | 'deno';
  typescript?: boolean;
  strict?: boolean;

  // Hook definitions
  hooks: {
    PreToolUse?: HookEventConfig;
    PostToolUse?: HookEventConfig;
    SessionStart?: HookConfig;
    UserPromptSubmit?: HookConfig;
    Stop?: HookConfig;
    SubagentStop?: HookConfig;
  };

  // Environment-specific overrides
  environments?: {
    [env: string]: Partial<GrappleConfig>;
  };

  // Template configuration
  templates?: {
    [templateName: string]: TemplateConfig;
  };

  // Generation settings
  generation?: {
    outputDir?: string;
    typescript?: boolean;
    includeTypes?: boolean;
    includeTests?: boolean;
    includeDocumentation?: boolean;
  };

  // Development settings
  development?: {
    watch?: boolean;
    testOnChange?: boolean;
    buildOnChange?: boolean;
    hotReload?: boolean;
    port?: number;
  };

  // Custom paths
  paths?: {
    [name: string]: string;
  };
}

interface HookEventConfig {
  '*'?: HookConfig; // Universal hook
  [toolName: string]: HookConfig; // Tool-specific hooks
}

interface HookConfig {
  command: string;
  timeout?: number;
  enabled?: boolean;
  description?: string;
}
```

## Examples

### Complete Real-World Configuration

```typescript
// hooks.config.ts
import { defineConfig } from '@outfitter/hooks-cli';

export default defineConfig({
  runtime: 'bun',
  typescript: true,
  strict: true,

  hooks: {
    // Pre-tool validation
    PreToolUse: {
      // Universal security check
      '*': {
        command: 'bun hooks/security/universal-validator.ts',
        timeout: 5000,
        enabled: true,
        description: 'Universal security and safety validation',
      },

      // Bash command security
      Bash: {
        command: 'bun hooks/security/bash-validator.ts',
        timeout: 10000,
        enabled: true,
        description: 'Bash command security validation',
      },

      // File operation validation
      Write: {
        command: 'bun hooks/validation/file-write-validator.ts',
        timeout: 8000,
        enabled: true,
        description: 'File write operation validation',
      },

      Edit: {
        command: 'bun hooks/validation/file-edit-validator.ts',
        timeout: 8000,
        enabled: true,
        description: 'File edit operation validation',
      },

      // Web operation monitoring
      WebFetch: {
        command: 'bun hooks/security/web-security.ts',
        timeout: 5000,
        enabled: true,
        description: 'Web fetch security validation',
      },
    },

    // Post-tool processing
    PostToolUse: {
      // File formatting after writes
      Write: {
        command: 'bun hooks/formatting/format-after-write.ts',
        timeout: 30000,
        enabled: true,
        description: 'Auto-format files after writing',
      },

      // Linting after edits
      Edit: {
        command: 'bun hooks/formatting/lint-after-edit.ts',
        timeout: 20000,
        enabled: true,
        description: 'Lint and fix files after editing',
      },

      // Import organization
      MultiEdit: {
        command: 'bun hooks/formatting/organize-imports.ts',
        timeout: 15000,
        enabled: true,
        description: 'Organize imports after multi-file edits',
      },
    },

    // Session management
    SessionStart: {
      command: 'bun hooks/session/initialize.ts',
      timeout: 10000,
      enabled: true,
      description: 'Initialize session with project-specific settings',
    },

    UserPromptSubmit: {
      command: 'bun hooks/audit/prompt-logger.ts',
      timeout: 2000,
      enabled: process.env.NODE_ENV === 'production',
      description: 'Log user prompts for audit purposes',
    },

    Stop: {
      command: 'bun hooks/session/cleanup.ts',
      timeout: 15000,
      enabled: true,
      description: 'Clean up temporary files and sessions',
    },
  },

  // Environment-specific configurations
  environments: {
    development: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 2000, // Faster validation in dev
          },
          Bash: {
            timeout: 5000, // Reduced bash validation time
          },
        },
        PostToolUse: {
          Write: {
            timeout: 10000, // Faster formatting in dev
          },
          Edit: {
            enabled: false, // Skip linting in dev for speed
          },
        },
        UserPromptSubmit: {
          enabled: false, // No audit logging in dev
        },
      },
    },

    production: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 15000, // More thorough validation
          },
          Bash: {
            timeout: 20000, // Extra thorough bash validation
          },
          WebFetch: {
            timeout: 10000, // More careful web validation
          },
        },
        PostToolUse: {
          '*': {
            command: 'bun hooks/audit/comprehensive-logger.ts',
            timeout: 5000,
            enabled: true,
            description: 'Comprehensive audit logging for all tools',
          },
        },
        UserPromptSubmit: {
          enabled: true, // Full audit logging
        },
      },
    },

    test: {
      hooks: {
        PreToolUse: {
          '*': {
            timeout: 1000, // Fast validation for tests
          },
        },
        PostToolUse: {
          '*': {
            enabled: false, // Disable post-processing in tests
          },
        },
        SessionStart: {
          enabled: false, // Skip session init in tests
        },
        Stop: {
          enabled: false, // Skip cleanup in tests
        },
      },
    },
  },

  // Custom paths
  paths: {
    hooks: './src/hooks',
    security: './src/hooks/security',
    validation: './src/hooks/validation',
    formatting: './src/hooks/formatting',
    audit: './src/hooks/audit',
    session: './src/hooks/session',
  },

  // Generation settings
  generation: {
    outputDir: './src/hooks',
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
    port: 3000,
  },
});
```

### Building Multiple Environments

```bash
# Build configurations for all environments
carabiner build --environment development --output .claude/settings.json
carabiner build --environment production --output .claude/settings.prod.json
carabiner build --environment staging --output .claude/settings.staging.json
carabiner build --environment test --output .claude/settings.test.json

# Validate all configurations
carabiner validate --config
```

### Package.json Scripts

```json
{
  "scripts": {
    "hooks:build": "carabiner build",
    "hooks:build:prod": "carabiner build --environment production --output .claude/settings.prod.json",
    "hooks:build:staging": "carabiner build --environment staging --output .claude/settings.staging.json",
    "hooks:build:all": "npm run hooks:build && npm run hooks:build:prod && npm run hooks:build:staging",
    "hooks:validate": "carabiner validate --config",
    "hooks:test": "carabiner test",
    "hooks:dev": "carabiner dev --watch"
  }
}
```

## Best Practices

### 1. Environment Separation

**Do**: Use different configurations for different environments.

```typescript
// Good: Environment-specific timeouts and enabled flags
environments: {
  development: {
    hooks: {
      PreToolUse: { '*': { timeout: 2000 } }
    }
  },
  production: {
    hooks: {
      PreToolUse: { '*': { timeout: 15000 } }
    }
  }
}
```

**Don't**: Use the same configuration everywhere.

### 2. Appropriate Timeouts

**Do**: Set timeouts based on hook complexity.

```json
{
  "preToolUseHooks": {
    "*": { "timeout": 5000 }, // Quick validation
    "Bash": { "timeout": 10000 } // Security checks take longer
  },
  "postToolUseHooks": {
    "Write": { "timeout": 30000 } // File formatting can be slow
  }
}
```

**Don't**: Use one timeout for all hooks.

### 3. Tool Scoping

**Do**: Use tool-specific hooks for targeted behavior.

```json
{
  "preToolUseHooks": {
    "*": { "command": "bun hooks/universal-audit.ts" },
    "Bash": { "command": "bun hooks/bash-security.ts" }
  }
}
```

**Don't**: Put all logic in universal hooks.

### 4. Conditional Enabling

**Do**: Use environment variables for conditional enabling.

```typescript
{
  command: 'bun hooks/security.ts',
  enabled: process.env.NODE_ENV === 'production',
}
```

**Don't**: Hardcode enabled/disabled state.

### 5. Performance Considerations

**Do**: Keep hooks fast and focused.

```json
{
  "timeout": 5000,
  "description": "Quick security validation"
}
```

**Don't**: Create slow, monolithic hooks.

### 6. Error Handling

**Do**: Configure appropriate timeouts and fallbacks.

```typescript
{
  timeout: 10000,
  enabled: true,
  // Hook should handle its own errors gracefully
}
```

**Don't**: Let hooks block Claude Code indefinitely.

### 7. Documentation

**Do**: Document your configuration.

```json
{
  "command": "bun hooks/security.ts",
  "timeout": 10000,
  "description": "Validates bash commands for security vulnerabilities"
}
```

**Don't**: Leave configurations undocumented.

---

**Configure Grapple hooks for optimal development experience!** ⚙️

Next steps:

- [Architecture Guide](architecture.md) - Understand the system design
- [CLI Reference](cli-reference.md) - Master the command-line tools
- [API Reference](api-reference/) - Explore the programmatic API
