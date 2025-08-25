# @outfitter/plugins

Example plugin collection for Carabiner hooks - demonstrates plugin architecture patterns and best practices.

## Overview

This package provides a collection of production-ready plugins that showcase the power and flexibility of the Claude Code plugin system. Each plugin demonstrates different aspects of plugin development while solving real-world problems in development workflows.

## Included Plugins

### 🔒 Git Safety (`git-safety`)

Prevents dangerous git operations like force pushes and hard resets.

**Features:**

- Configurable pattern blocking
- Allow list for safe commands
- Custom rules with warning/blocking levels
- Repository filtering
- Comprehensive logging

**Example Configuration:**

```typescript
{
  "git-safety": {
    "blockPatterns": ["push.*--force", "reset.*--hard"],
    "allowList": ["git status", "git diff"],
    "logBlocked": true
  }
}

```

### 💾 File Backup (`file-backup`)

Automatically creates backups before file modifications.

**Features:**

- Multiple naming strategies (timestamp, numbered, date)
- Configurable retention policies
- File filtering and size limits
- Backup directory management
- Duplicate detection

**Example Configuration:**

```typescript
{
  "file-backup": {
    "backupDir": ".backups",
    "maxBackups": 5,
    "namingStrategy": "timestamp",
    "excludePatterns": ["*.tmp", "**/node_modules/**"]
  }
}

```

### 🛡️ Security Scanner (`security-scanner`)

Scans for security vulnerabilities in code and operations.

**Features:**

- Hardcoded secrets detection
- Command injection prevention
- SQL injection pattern detection
- Weak cryptography identification
- Custom security rules
- Configurable severity levels

**Example Configuration:**

```typescript
{
  "security-scanner": {
    "scanCommands": true,
    "scanFiles": true,
    "minSeverity": "medium",
    "blockOnCritical": true,
    "customRules": [
      {
        "id": "company-secret",
        "pattern": "COMPANY_[A-Z0-9]{32}",
        "severity": "critical"
      }
    ]
  }
}

```

### 📊 Performance Monitor (`performance-monitor`)

Tracks execution time and resource usage.

**Features:**

- Execution time tracking
- Memory usage monitoring
- Operation frequency analysis
- Performance alerting
- Detailed profiling support

**Example Configuration:**

```typescript
{
  "performance-monitor": {
    "trackExecutionTime": true,
    "slowOperationThreshold": 5000,
    "logAlerts": true,
    "enableProfiling": true
  }
}

```

### 📋 Audit Logger (`audit-logger`)

Comprehensive logging of all Claude Code operations.

**Features:**

- Multiple output formats (JSON, text, CSV)
- Configurable log levels
- Sensitive data filtering
- Log rotation and compression
- Security-focused logging

**Example Configuration:**

```typescript
{
  "audit-logger": {
    "format": "json",
    "level": "all",
    "logFile": "claude-audit.log",
    "anonymizePaths": true,
    "rotateFiles": true
  }
}

```

## Quick Start

### Individual Plugin Usage

```typescript
import { gitSafetyPlugin, fileBackupPlugin } from '@outfitter/plugins';
import { PluginRegistry } from '@outfitter/registry';

const registry = new PluginRegistry();
registry.register(gitSafetyPlugin);
registry.register(fileBackupPlugin);

// Execute plugins
const results = await registry.execute(context);
```

### Plugin Collection

```typescript
import { createPluginCollection } from '@outfitter/plugins';
import { PluginRegistry } from '@outfitter/registry';

const plugins = createPluginCollection({
  gitSafety: true,
  fileBackup: { maxBackups: 10 },
  securityScanner: { minSeverity: 'high' },
  performanceMonitor: false,
  auditLogger: { logFile: 'custom-audit.log' },
});

const registry = new PluginRegistry();
plugins.forEach(({ plugin, config }) => registry.register(plugin, config));
```

### Configuration File

Create a `hooks.config.ts` file:

```typescript
export default {
  plugins: [
    { name: 'git-safety', enabled: true, priority: 90 },
    { name: 'file-backup', enabled: true, priority: 80 },
    { name: 'security-scanner', enabled: true, priority: 85 },
    { name: 'performance-monitor', enabled: true, priority: 10 },
    { name: 'audit-logger', enabled: true, priority: 5 },
  ],
  rules: {
    'git-safety': {
      blockPatterns: ['push.*--force', 'reset.*--hard'],
      allowList: ['git status', 'git diff'],
    },
    'file-backup': {
      backupDir: '.backups',
      maxBackups: 5,
      namingStrategy: 'timestamp',
    },
    'security-scanner': {
      minSeverity: 'medium',
      blockOnCritical: true,
    },
    'performance-monitor': {
      slowOperationThreshold: 5000,
      logAlerts: true,
    },
    'audit-logger': {
      format: 'json',
      level: 'all',
      logFile: 'claude-audit.log',
    },
  },
};
```

## Pre-configured Setups

### Default Configuration

Balanced settings suitable for most development workflows:

```typescript
import { createDefaultConfiguration } from '@outfitter/plugins';

const config = createDefaultConfiguration();
```

### Security-Focused Configuration

Enhanced security with stricter rules:

```typescript
import { createSecurityConfiguration } from '@outfitter/plugins';

const config = createSecurityConfiguration();
```

### Development-Friendly Configuration

Relaxed settings for development environments:

```typescript
import { createDevelopmentConfiguration } from '@outfitter/plugins';

const config = createDevelopmentConfiguration();
```

## Plugin Development

These plugins serve as excellent examples for developing your own plugins. Each demonstrates different patterns:

### Simple Event Handler (Git Safety)

```typescript
export const myPlugin: HookPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  events: ['PreToolUse'],

  apply(context) {
    if (context.toolName !== 'Bash') {
      return { success: true, pluginName: 'my-plugin', pluginVersion: '1.0.0' };
    }

    // Plugin logic here
    return { success: true, pluginName: 'my-plugin', pluginVersion: '1.0.0' };
  },
};
```

### Async File Operations (File Backup)

```typescript
export const asyncPlugin: HookPlugin = {
  name: 'async-plugin',
  version: '1.0.0',
  events: ['PreToolUse'],

  async apply(context) {
    // Async operations
    const result = await someAsyncOperation();

    return {
      success: true,
      pluginName: 'async-plugin',
      pluginVersion: '1.0.0',
      metadata: { result },
    };
  },
};
```

### Configuration Schema (Security Scanner)

```typescript
import { z } from 'zod';

const ConfigSchema = z
  .object({
    threshold: z.number().default(100),
    enabled: z.boolean().default(true),
  })
  .default({});

export const configurablePlugin: HookPlugin = {
  name: 'configurable-plugin',
  version: '1.0.0',
  events: ['PreToolUse'],
  configSchema: ConfigSchema,

  apply(context, config = {}) {
    const validatedConfig = ConfigSchema.parse(config);

    // Use validatedConfig.threshold, validatedConfig.enabled

    return { success: true, pluginName: 'configurable-plugin', pluginVersion: '1.0.0' };
  },
};
```

## Testing

Run the test suite:

```bash
bun test

```

Test individual plugins:

```bash
bun test src/__tests__/git-safety.test.ts
bun test src/__tests__/security-scanner.test.ts

```

## Contributing

These plugins are meant to be examples and starting points. Feel free to:

1. Fork and modify for your needs
2. Create new plugins following these patterns
3. Share improvements back to the community

## License

MIT License - see LICENSE file for details.
