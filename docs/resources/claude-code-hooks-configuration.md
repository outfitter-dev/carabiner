# Claude Code Hooks: Configuration and Settings Guide

> **Source**: [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)

This document provides comprehensive guidance on configuring Carabiner hooks through the settings system, including hierarchical configuration, advanced patterns, and project-specific setups.

## Table of Contents

1. [Settings Hierarchy](#settings-hierarchy)
2. [Hook Configuration Structure](#hook-configuration-structure)
3. [Configuration Examples](#configuration-examples)
4. [Advanced Configuration Patterns](#advanced-configuration-patterns)
5. [Environment-Specific Configuration](#environment-specific-configuration)
6. [Configuration Validation](#configuration-validation)

## Settings Hierarchy

Claude Code uses a hierarchical settings system with the following precedence order (higher numbers override lower):

1. **Enterprise Managed Policy**: Platform-specific managed policy files
2. **Command Line Arguments**: Direct CLI overrides
3. **User Global Settings**: `~/.claude/settings.json`
4. **Project Shared Settings**: `<project>/.claude/settings.json`
5. **Project Local Settings**: `<project>/.claude/settings.local.json` (highest precedence)

### Settings File Locations by Platform

#### macOS

- Enterprise: /Library/Application Support/ClaudeCode/managed-settings.json
- User: ~/.claude/settings.json
- Project: .claude/settings.json
- Local: .claude/settings.local.json

#### Windows

- Enterprise: %ProgramData%\ClaudeCode\managed-settings.json
- User: %USERPROFILE%\.claude\settings.json
- Project: .claude\settings.json
- Local: .claude\settings.local.json

#### Linux

- Enterprise: /etc/claude-code/managed-settings.json
- User: ~/.claude/settings.json
- Project: .claude/settings.json
- Local: .claude/settings.local.json

## Hook Configuration Structure

### Basic Hook Structure

```jsonc
{
  "hooks": {
    "<HookEvent>": "<command>",
    "<HookEvent>": {
      "<ToolName>": "<command>",
    },
    "<HookEvent>": {
      "<ToolName>": {
        "command": "<command>",
        "timeoutMs": 5000,
        "filters": {
          /* filter configuration */
        },
      },
    },
  },
}
```

### Hook Events

Available hook events:

- `PreToolUse`: Before tool execution
- `PostToolUse`: After successful tool execution
- `UserPromptSubmit`: When user submits a prompt
- `SessionStart`: When starting a new session
- `Stop`: When Claude Code finishes responding
- `SubagentStop`: When a subagent finishes responding

### Tool Names

Common tool names for hooks (Claude Code v0.4+):

- `Bash`: Shell command execution
- `Edit`: File editing
- `Write`: File writing
- `Read`: File reading
- `MultiEdit`: Multiple file edits
- `NotebookEdit`: Jupyter notebook editing
- `Glob`: File pattern matching
- `Grep`: Text searching
- `LS`: Directory listing
- `Task`: Subagent task execution
- `WebFetch`: Web content fetching
- `WebSearch`: Web searching
- `Search`: General search
- `Git`: Git operations
- `Make`: Build operations

> **Note**: The tool set evolves with Claude Code versions. Use `"*"` to match any tool not explicitly listed.

### Configuration Options

#### Command Options

- **command** (string): The shell command to execute
- **timeoutMs** (number): Maximum execution time in milliseconds (default: 60000)
- **detached** (boolean): Whether to run asynchronously without waiting (default: false)
- **filters** (object): Conditions for when the hook should run

> **Timeout Behavior**: The timeout is per hook invocation, not per command. When `detached: true`, Claude Code doesn't wait for completion and `TOOL_OUTPUT` may not be available.

#### Filter Patterns

```json
{
  "filters": {
    "file_path": "*.ts", // File path patterns
    "content": ".*test.*", // Content patterns
    "command": "npm.*", // Command patterns
    "environment": "production", // Environment conditions
    "custom_field": "value" // Custom field matching
  }
}
```

## Matcher Behavior and Parallel Execution

When multiple hooks match the same event, **all matching hooks execute in parallel**:

```json
{
  "hooks": {
    "PreToolUse": {
      "*": "bun run hooks/universal-check.ts", // Runs for all tools
      "Bash": "bun run hooks/bash-validator.ts", // ALSO runs for Bash
      "Write": [
        // Multiple hooks for Write
        "bun run hooks/permission-check.ts",
        "bun run hooks/backup-file.ts"
      ]
    }
  }
}
```

> **Important**: This differs from most pattern-matching systems. When a `Write` operation occurs in the above example, **three hooks execute in parallel**: universal-check, permission-check, and backup-file.

## Configuration Examples

### 1. Global Hook Configuration

`~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": "echo 'Claude Code session started at $(date)'",
    "UserPromptSubmit": "echo 'Processing user prompt...'",
    "Stop": "echo 'Response completed'"
  }
}
```

### 2. Tool-Specific Hooks

`.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run scripts/validate-command.ts",
        "timeoutMs": 5000
      },
      "Write": {
        "command": "bun run scripts/check-write-permissions.ts",
        "timeoutMs": 3000
      },
      "Edit": {
        "command": "bun run scripts/backup-before-edit.ts",
        "timeoutMs": 2000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run scripts/format-after-write.ts",
        "timeoutMs": 10000
      },
      "Edit": {
        "command": "bun run scripts/format-after-edit.ts",
        "timeoutMs": 10000
      }
    }
  }
}
```

### 3. Pattern-Based Hook Matching

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": [
        {
          "command": "bun run scripts/production-check.ts",
          "filters": {
            "command": ".*(deploy|publish|push).*"
          },
          "timeoutMs": 8000
        },
        {
          "command": "bun run scripts/safe-command-check.ts",
          "filters": {
            "command": ".*rm.*"
          },
          "timeoutMs": 3000
        }
      ],
      "Write": [
        {
          "command": "bun run scripts/env-file-protection.ts",
          "filters": {
            "file_path": "*.env*"
          },
          "timeoutMs": 2000
        },
        {
          "command": "bun run scripts/config-file-validation.ts",
          "filters": {
            "file_path": "*.config.*"
          },
          "timeoutMs": 5000
        }
      ]
    }
  }
}
```

### 4. Development vs Production Configuration

Development (`.claude/settings.local.json`):

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "echo 'Dev mode: Allowing command'",
        "timeoutMs": 1000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run scripts/dev-file-watcher.ts",
        "timeoutMs": 5000
      }
    }
  }
}
```

Production (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run scripts/strict-command-validation.ts",
        "timeoutMs": 10000
      },
      "Write": {
        "command": "bun run scripts/production-file-protection.ts",
        "timeoutMs": 5000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run scripts/production-audit-log.ts",
        "timeoutMs": 3000
      }
    }
  }
}
```

## Advanced Configuration Patterns

### 1. Conditional Hook Execution

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run scripts/conditional-hook.ts",
        "timeoutMs": 5000,
        "environment": {
          "NODE_ENV": "production",
          "ENABLE_STRICT_MODE": "true"
        }
      }
    }
  }
}
```

Corresponding TypeScript hook (`scripts/conditional-hook.ts`):

```typescript
#!/usr/bin/env bun

const isProduction = process.env.NODE_ENV === 'production';
const strictMode = process.env.ENABLE_STRICT_MODE === 'true';

if (isProduction && strictMode) {
  // Apply strict production rules
  console.log('Applying strict production validation');
  // ... validation logic
} else {
  console.log('Using relaxed development rules');
}
```

### 2. Multi-Stage Hook Pipeline

```json
{
  "hooks": {
    "PreToolUse": {
      "Write": {
        "command": "bun run scripts/multi-stage-pre-hook.ts",
        "timeoutMs": 15000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run scripts/multi-stage-post-hook.ts",
        "timeoutMs": 30000
      }
    }
  }
}
```

Multi-stage hook (`scripts/multi-stage-pre-hook.ts`):

```typescript

#!/usr/bin/env bun

import { spawn } from 'child_process';

interface Stage {
  name: string;
  command: string[];
  required: boolean;
}

const stages: Stage[] = [
  {
    name: 'Security Check',
    command: ['bun', 'run', 'scripts/security-check.ts'],
    required: true,
  },
  {
    name: 'Permission Check',
    command: ['bun', 'run', 'scripts/permission-check.ts'],
    required: true,
  },
  {
    name: 'Style Check',
    command: ['bun', 'run', 'scripts/style-check.ts'],
    required: false,
  },
];

async function runStage(stage: Stage): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(stage.command[0], stage.command.slice(1), {
      stdio: 'inherit',
    });

    process.on('close', (code) => {
      const success = code === 0;
      console.log(`Stage "${stage.name}": ${success ? 'PASSED' : 'FAILED'}`);
      resolve(success);
    });
  });
}

async function main() {
  for (const stage of stages) {
    const success = await runStage(stage);

    if (!success && stage.required) {
      console.error(`Required stage "${stage.name}" failed. Blocking operation.`);
      process.exit(1);
    }
  }

  console.log('All stages completed successfully');
  process.exit(0);
}

main();

```

### 3. Dynamic Hook Loading

```json
{
  "hooks": {
    "PreToolUse": {
      "*": {
        "command": "bun run scripts/dynamic-hook-loader.ts",
        "timeoutMs": 10000
      }
    }
  }
}
```

Dynamic hook loader (`scripts/dynamic-hook-loader.ts`):

```typescript

#!/usr/bin/env bun

import { existsSync } from 'fs';
import { join } from 'path';

const toolName = process.env.CLAUDE_TOOL_NAME;
const hookDir = join(process.cwd(), 'hooks', 'tools');

// Try to load tool-specific hook
const toolHookPath = join(hookDir, `${toolName?.toLowerCase()}-pre.ts`);

if (existsSync(toolHookPath)) {
  console.log(`Loading tool-specific hook: ${toolHookPath}`);

  // Dynamic import and execution
  const { default: hookHandler } = await import(toolHookPath);
  await hookHandler();
} else {
  console.log(`No specific hook found for tool: ${toolName}`);
  // Run default validation
  await import('./default-pre-hook.ts');
}

```

## Environment-Specific Configuration

### 1. Environment Detection

```json
{
  "hooks": {
    "SessionStart": {
      "command": "bun run scripts/environment-setup.ts",
      "timeoutMs": 5000
    }
  }
}
```

Environment setup hook (`scripts/environment-setup.ts`):

```typescript

#!/usr/bin/env bun

interface EnvironmentConfig {
  name: string;
  hooks: Record<string, any>;
  validators: string[];
}

const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: 'Development',
    hooks: {
      PreToolUse: {
        Bash: 'echo "Dev mode: relaxed validation"',
      },
    },
    validators: ['basic-safety'],
  },
  staging: {
    name: 'Staging',
    hooks: {
      PreToolUse: {
        Bash: 'bun run scripts/staging-validation.ts',
      },
    },
    validators: ['basic-safety', 'performance-check'],
  },
  production: {
    name: 'Production',
    hooks: {
      PreToolUse: {
        Bash: 'bun run scripts/production-validation.ts',
        Write: 'bun run scripts/production-file-check.ts',
      },
    },
    validators: ['basic-safety', 'security-audit', 'compliance-check'],
  },
};

function detectEnvironment(): string {
  // Check environment variables
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Check for deployment indicators
  if (process.env.VERCEL || process.env.NETLIFY) {
    return 'production';
  }

  // Check git branch
  try {
    const { execSync } = require('child_process');
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

    if (branch === 'main' || branch === 'master') {
      return 'production';
    } else if (branch === 'staging' || branch === 'develop') {
      return 'staging';
    }
  } catch (error) {
    // Git not available or not a git repository
  }

  return 'development';
}

const currentEnv = detectEnvironment();
const config = environments[currentEnv] || environments.development;

console.log(`Environment detected: ${config.name}`);
console.log(`Active validators: ${config.validators.join(', ')}`);

// Set environment-specific configuration
process.env.CLAUDE_ENVIRONMENT = currentEnv;
process.env.CLAUDE_VALIDATORS = config.validators.join(',');

```

### 2. Workspace-Specific Configuration

```json
{
  "hooks": {
    "SessionStart": {
      "command": "bun run scripts/workspace-config.ts",
      "timeoutMs": 3000
    },
    "PreToolUse": {
      "*": {
        "command": "bun run scripts/workspace-aware-hook.ts",
        "timeoutMs": 5000
      }
    }
  }
}
```

Workspace configuration (`scripts/workspace-config.ts`):

```typescript

#!/usr/bin/env bun

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface WorkspaceConfig {
  type: 'monorepo' | 'library' | 'application';
  framework?: string;
  strictMode: boolean;
  customRules: string[];
}

function detectWorkspaceType(workspacePath: string): WorkspaceConfig {
  const packageJsonPath = join(workspacePath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {
      type: 'application',
      strictMode: false,
      customRules: [],
    };
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // Detect monorepo
  if (packageJson.workspaces || existsSync(join(workspacePath, 'turbo.json'))) {
    return {
      type: 'monorepo',
      framework: detectFramework(packageJson),
      strictMode: true,
      customRules: ['monorepo-validation', 'workspace-consistency'],
    };
  }

  // Detect library
  if (packageJson.main || packageJson.exports) {
    return {
      type: 'library',
      framework: detectFramework(packageJson),
      strictMode: true,
      customRules: ['api-stability', 'breaking-change-detection'],
    };
  }

  return {
    type: 'application',
    framework: detectFramework(packageJson),
    strictMode: false,
    customRules: [],
  };
}

function detectFramework(packageJson: any): string | undefined {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (dependencies.next) return 'nextjs';
  if (dependencies.vite) return 'vite';
  if (dependencies.react) return 'react';
  if (dependencies['@angular/core']) return 'angular';
  if (dependencies.vue) return 'vue';

  return undefined;
}

const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const config = detectWorkspaceType(workspacePath);

console.log(`Workspace type: ${config.type}`);
if (config.framework) {
  console.log(`Framework: ${config.framework}`);
}
console.log(`Strict mode: ${config.strictMode}`);
console.log(`Custom rules: ${config.customRules.join(', ')}`);

// Export configuration for other hooks
process.env.CLAUDE_WORKSPACE_TYPE = config.type;
process.env.CLAUDE_WORKSPACE_FRAMEWORK = config.framework || '';
process.env.CLAUDE_STRICT_MODE = config.strictMode.toString();
process.env.CLAUDE_CUSTOM_RULES = config.customRules.join(',');

```

## Configuration Validation

### 1. Settings Validation Schema

```typescript
// scripts/validate-settings.ts
import { z } from 'zod';

const HookConfigSchema = z.object({
  command: z.string(),
  timeoutMs: z.number().positive().optional(),
  detached: z.boolean().optional(),
  filters: z.record(z.string()).optional(),
  environment: z.record(z.string()).optional(),
});

const HooksSchema = z.record(
  z.enum(['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'SessionStart', 'Stop', 'SubagentStop']),
  z.union([
    z.string(),
    z.record(z.string()),
    z.record(HookConfigSchema),
    z.record(z.array(HookConfigSchema)),
  ]),
);

const SettingsSchema = z.object({
  hooks: HooksSchema.optional(),
  // Other settings...
});

export function validateSettings(settings: unknown): boolean {
  try {
    SettingsSchema.parse(settings);
    return true;
  } catch (error) {
    console.error('Settings validation failed:', error);
    return false;
  }
}
```

### 2. Configuration Testing

```typescript
// scripts/test-hook-config.ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { validateSettings } from './validate-settings.ts';

function testHookConfiguration(configPath: string): void {
  if (!existsSync(configPath)) {
    console.log(`Config file not found: ${configPath}`);
    return;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));

    if (!validateSettings(config)) {
      console.error(`Invalid configuration: ${configPath}`);
      process.exit(1);
    }

    console.log(`✅ Valid configuration: ${configPath}`);

    // Test hook commands
    if (config.hooks) {
      testHookCommands(config.hooks);
    }
  } catch (error) {
    console.error(`Failed to parse config: ${configPath}`, error);
    process.exit(1);
  }
}

function testHookCommands(hooks: any): void {
  // Validate that hook scripts exist
  for (const [event, eventHooks] of Object.entries(hooks)) {
    if (typeof eventHooks === 'string') {
      testCommand(eventHooks, event);
    } else if (typeof eventHooks === 'object') {
      for (const [tool, toolHook] of Object.entries(eventHooks as any)) {
        if (typeof toolHook === 'string') {
          testCommand(toolHook, `${event}.${tool}`);
        } else if (toolHook.command) {
          testCommand(toolHook.command, `${event}.${tool}`);
        }
      }
    }
  }
}

function testCommand(command: string, context: string): void {
  // Check if command references existing scripts
  const scriptMatch = command.match(/bun run ([\w\/.-]+)/);
  if (scriptMatch) {
    const scriptPath = scriptMatch[1];
    if (!existsSync(scriptPath)) {
      console.warn(`⚠️  Script not found: ${scriptPath} (referenced in ${context})`);
    } else {
      console.log(`✅ Script found: ${scriptPath}`);
    }
  }
}

// Test all configuration files
const configFiles = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  join(process.env.HOME || '', '.claude/settings.json'),
];

configFiles.forEach(testHookConfiguration);
```

This comprehensive configuration guide provides all the necessary information for setting up and managing Carabiner hooks across different environments and use cases.
