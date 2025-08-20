# @outfitter/hooks-config

Configuration management and settings generation for Claude Code hooks.

## Installation

```bash
bun add @outfitter/hooks-config

```

## Usage

### Basic Configuration Management

```typescript
import { ConfigManager } from '@outfitter/hooks-config';

// Create configuration manager
const config = new ConfigManager('/path/to/workspace');

// Initialize configuration
await config.initialize();

// Get configuration
const hookConfig = config.getHookConfig('PreToolUse', 'Bash');
console.log(hookConfig); // { command, timeout, etc. }

// Update configuration
await config.updateHookConfig('PreToolUse', 'Bash', {
  command: 'bun run hooks/bash-security.ts',
  timeout: 10000,
});

// Save to settings file
await config.save();
```

### Settings Generation

Generate Claude Code settings from hook configurations:

```typescript
import { generateSettings } from '@outfitter/hooks-config';

const settings = generateSettings({
  hooks: {
    PreToolUse: {
      '*': {
        command: 'bun run hooks/universal-validator.ts',
        timeout: 5000,
      },
      Bash: {
        command: 'bun run hooks/bash-security.ts',
        timeout: 10000,
      },
    },
    PostToolUse: {
      Write: {
        command: 'bun run hooks/format-after-write.ts',
        timeout: 30000,
      },
    },
  },
});

console.log(JSON.stringify(settings, null, 2));
```

### Template-Based Configuration

Create configurations from templates:

```typescript
import { createConfigFromTemplate, templates } from '@outfitter/hooks-config';

// Use built-in security template
const securityConfig = createConfigFromTemplate(templates.security, {
  workspacePath: '/path/to/project',
  runtime: 'bun',
  timeout: 10000,
});

// Use built-in formatting template
const formattingConfig = createConfigFromTemplate(templates.formatting, {
  workspacePath: '/path/to/project',
  formatters: ['biome', 'prettier'],
  timeout: 30000,
});

// Merge configurations
const mergedConfig = mergeConfigurations([securityConfig, formattingConfig]);
```

## API Reference

### `ConfigManager`

Main configuration management class.

#### `new ConfigManager(workspacePath: string, options?: ConfigOptions)`

**Parameters:**

- `workspacePath` - Path to the workspace directory
- `options` - Optional configuration options

**Options:**

- `settingsPath?: string` - Custom path to settings file (default: `.claude/settings.json`)
- `createIfMissing?: boolean` - Create settings file if it doesn't exist (default: true)
- `backup?: boolean` - Create backup before saving (default: true)

#### Methods

##### `initialize(): Promise<void>`

Initialize the configuration manager and load existing settings.

##### `getHookConfig(event: HookEvent, tool?: ToolName): HookConfig | undefined`

Get configuration for a specific hook.

**Parameters:**

- `event` - Hook event name
- `tool` - Optional tool name (use '\*' for universal hooks)

**Returns:** Hook configuration object or undefined if not found

##### `setHookConfig(event: HookEvent, tool: ToolName | '*', config: HookConfig): void`

Set configuration for a specific hook.

##### `updateHookConfig(event: HookEvent, tool: ToolName | '*', updates: Partial<HookConfig>): void`

Update existing hook configuration.

##### `removeHookConfig(event: HookEvent, tool?: ToolName | '*'): boolean`

Remove hook configuration.

##### `getAllHooks(): Record<HookEvent, Record<string, HookConfig>>`

Get all hook configurations.

##### `save(): Promise<void>`

Save current configuration to settings file.

##### `backup(): Promise<string>`

Create backup of current settings file.

**Returns:** Path to backup file

##### `restore(backupPath: string): Promise<void>`

Restore settings from backup file.

##### `validate(): ValidationResult`

Validate current configuration.

##### `getWorkspacePath(): string`

Get the current workspace path.

### Configuration Templates

#### `templates.security`

Security-focused hook template:

```typescript
const securityTemplate = {
  PreToolUse: {
    '*': {
      command: '{{runtime}} run hooks/universal-security.ts',
      timeout: 5000,
    },
    Bash: {
      command: '{{runtime}} run hooks/bash-security.ts',
      timeout: 10000,
    },
    Write: {
      command: '{{runtime}} run hooks/write-security.ts',
      timeout: 5000,
    },
  },
};
```

#### `templates.formatting`

Code formatting template:

```typescript
const formattingTemplate = {
  PostToolUse: {
    Write: {
      command: '{{runtime}} run hooks/format-after-write.ts',
      timeout: 30000,
    },
    Edit: {
      command: '{{runtime}} run hooks/format-after-edit.ts',
      timeout: 30000,
    },
  },
};
```

#### `templates.audit`

Audit and logging template:

```typescript
const auditTemplate = {
  PreToolUse: {
    '*': {
      command: '{{runtime}} run hooks/audit-pre.ts',
      timeout: 2000,
      detached: true,
    },
  },
  PostToolUse: {
    '*': {
      command: '{{runtime}} run hooks/audit-post.ts',
      timeout: 2000,
      detached: true,
    },
  },
  SessionStart: {
    command: '{{runtime}} run hooks/session-audit.ts',
    timeout: 5000,
  },
};
```

### Helper Functions

#### `generateSettings(config: HookConfiguration): ClaudeSettings`

Generate Claude Code settings from hook configuration.

#### `createConfigFromTemplate(template: ConfigTemplate, variables: TemplateVariables): HookConfiguration`

Create configuration from template with variable substitution.

#### `mergeConfigurations(configs: HookConfiguration[]): HookConfiguration`

Merge multiple configurations into one.

#### `validateConfiguration(config: HookConfiguration): ValidationResult`

Validate hook configuration structure.

#### `loadSettingsFile(filePath: string): Promise<ClaudeSettings>`

Load settings from file.

#### `saveSettingsFile(filePath: string, settings: ClaudeSettings): Promise<void>`

Save settings to file.

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  ConfigManager,
  HookConfiguration,
  HookConfig,
  ClaudeSettings,
  ConfigTemplate,
  TemplateVariables,
  ConfigOptions,
  ValidationResult,
} from '@outfitter/hooks-config';

// Type-safe configuration
const config: HookConfiguration = {
  PreToolUse: {
    Bash: {
      command: 'bun run security.ts',
      timeout: 10000,
    },
  },
};
```

## Configuration Schema

### `HookConfig`

Individual hook configuration:

```typescript
interface HookConfig {
  /** Command to execute */
  command: string;

  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Run hook detached (don't wait for completion) */
  detached?: boolean;

  /** Working directory (default: workspace root) */
  cwd?: string;

  /** Additional environment variables */
  env?: Record<string, string>;

  /** Hook description */
  description?: string;

  /** Whether hook is enabled (default: true) */
  enabled?: boolean;
}
```

### `HookConfiguration`

Complete hook configuration structure:

```typescript
interface HookConfiguration {
  PreToolUse?: Record<ToolName | '*', HookConfig>;
  PostToolUse?: Record<ToolName | '*', HookConfig>;
  SessionStart?: HookConfig;
  UserPromptSubmit?: HookConfig;
  Stop?: HookConfig;
  SubagentStop?: HookConfig;
  Notification?: HookConfig;
  PreCompact?: HookConfig;
}
```

### `ClaudeSettings`

Complete Claude Code settings file format:

```typescript
interface ClaudeSettings {
  hooks?: HookConfiguration;
  // Other Claude Code settings...
}
```

## Template Variables

When using templates, you can substitute these variables:

- `{{runtime}}` - JavaScript runtime (bun, node, deno)
- `{{workspacePath}}` - Workspace directory path
- `{{timeout}}` - Default timeout value
- `{{command}}` - Base command template
- Custom variables you define

**Example:**

```typescript
const template = {
  PreToolUse: {
    Bash: {
      command: '{{runtime}} run {{workspacePath}}/hooks/bash-security.ts',
      timeout: '{{timeout}}',
    },
  },
};

const config = createConfigFromTemplate(template, {
  runtime: 'bun',
  workspacePath: '/home/user/project',
  timeout: 10000,
});
```

## File Structure

The configuration manager works with this file structure:

```text
workspace/
├── .claude/
│   ├── settings.json          # Main settings file
│   ├── settings.local.json    # Local/personal settings
│   └── backups/               # Configuration backups
├── hooks/                     # Hook scripts
│   ├── bash-security.ts
│   ├── format-after-write.ts
│   └── universal-validator.ts
└── package.json

```

## Settings Hierarchy

Settings are loaded in this order (highest to lowest precedence):

1. **Command Line**: Direct CLI arguments
2. **Project Local**: `.claude/settings.local.json` (not committed)
3. **Project Shared**: `.claude/settings.json` (committed)
4. **User Global**: `~/.claude/settings.json`
5. **Enterprise Managed**: Platform-specific policy files

## Examples

### Complete Setup

```typescript
import { ConfigManager, templates } from '@outfitter/hooks-config';

async function setupHooks() {
  const config = new ConfigManager('/path/to/project');
  await config.initialize();

  // Add security hooks
  const securityConfig = createConfigFromTemplate(templates.security, {
    runtime: 'bun',
    workspacePath: '/path/to/project',
    timeout: 10000,
  });

  // Add formatting hooks
  const formattingConfig = createConfigFromTemplate(templates.formatting, {
    runtime: 'bun',
    workspacePath: '/path/to/project',
    timeout: 30000,
  });

  // Merge and apply
  const mergedConfig = mergeConfigurations([securityConfig, formattingConfig]);

  for (const [event, tools] of Object.entries(mergedConfig)) {
    for (const [tool, hookConfig] of Object.entries(tools)) {
      config.setHookConfig(event as HookEvent, tool as ToolName, hookConfig);
    }
  }

  // Save to file
  await config.save();
  console.log('Hook configuration saved to .claude/settings.json');
}
```

### Dynamic Configuration

```typescript
import { ConfigManager } from '@outfitter/hooks-config';

async function dynamicConfig() {
  const config = new ConfigManager(process.cwd());
  await config.initialize();

  // Environment-based configuration
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isDevelopment) {
    // Lenient hooks for development
    config.setHookConfig('PreToolUse', '*', {
      command: 'bun run hooks/dev-validator.ts',
      timeout: 5000,
    });
  }

  if (isProduction) {
    // Strict hooks for production
    config.setHookConfig('PreToolUse', '*', {
      command: 'bun run hooks/strict-validator.ts',
      timeout: 10000,
    });

    config.setHookConfig('PreToolUse', 'Bash', {
      command: 'bun run hooks/bash-strict.ts',
      timeout: 15000,
    });
  }

  await config.save();
}
```

## License

MIT
