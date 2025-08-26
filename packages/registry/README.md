# @outfitter/registry

Plugin registry system for Carabiner hooks - enables composition of small, focused hooks through a plugin architecture.

## Features

- **Plugin Management**: Register, discover, and manage hooks as plugins
- **Event-Based Execution**: Execute plugins based on hook events
- **Priority Ordering**: Control plugin execution order with priority levels
- **Configuration System**: JSON/TypeScript configuration for plugin composition
- **Plugin Lifecycle**: Init, shutdown, and health check hooks
- **Hot Reload**: Development-time plugin reloading
- **Dependency Management**: Plugin dependencies and ordering
- **Performance Monitoring**: Track plugin execution metrics

## Quick Start

### Basic Plugin

```typescript
import type { HookPlugin } from '@outfitter/registry';

export const myPlugin: HookPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'A simple example plugin',
  events: ['PreToolUse', 'PostToolUse'],
  priority: 100,

  async apply(context) {
    if (context.event === 'PreToolUse') {
      // Validate tool usage
      return { success: true, message: 'Validation passed' };
    }

    return { success: true };
  },
};
```

### Plugin Registry

```typescript
import { PluginRegistry } from '@outfitter/registry';
import { myPlugin } from './my-plugin';

const registry = new PluginRegistry();
registry.register(myPlugin);

// Execute plugins for a context
const results = await registry.execute(context);
```

### Configuration-Driven Setup

```typescript
// hooks.config.ts
export default {
  plugins: [
    { name: 'git-safety', enabled: true, priority: 100 },
    { name: 'file-backup', enabled: true, priority: 50 },
    { name: 'security-scanner', enabled: false },
  ],
  rules: {
    'git-safety': {
      blockPatterns: ['--force', 'reset --hard'],
      allowList: ['git status', 'git diff'],
    },
  },
};
```

## Plugin Interface

```typescript
interface HookPlugin {
  // Plugin metadata
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Event filtering
  events: string[];
  tools?: string[];

  // Execution control
  priority?: number;
  enabled?: boolean;

  // Configuration
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, unknown>;

  // Plugin implementation
  apply(context: HookContext, config?: Record<string, unknown>): Promise<HookResult> | HookResult;

  // Lifecycle hooks
  init?(): Promise<void> | void;
  shutdown?(): Promise<void> | void;
  healthCheck?(): Promise<boolean> | boolean;
}
```

## Testing

```typescript
import { test, expect } from 'bun:test';
import { PluginRegistry } from '@outfitter/registry';
import { createMockContext } from '@outfitter/types';

test('should execute plugins in priority order', async () => {
  const registry = new PluginRegistry();

  registry.register(highPriorityPlugin);
  registry.register(lowPriorityPlugin);

  const context = createMockContext('PreToolUse', 'Bash');
  const results = await registry.execute(context);

  expect(results).toHaveLength(2);
  expect(results[0].pluginName).toBe('high-priority');
});
```
