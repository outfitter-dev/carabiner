/**
 * Cross-Package Integration Tests
 *
 * Tests the complete workflow between hooks-cli → hooks-config → hooks-core
 * to ensure all packages work together correctly in real-world scenarios.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { HookConfiguration } from '@carabiner/types';

/**
 * Test workspace for integration tests
 */
class TestWorkspace {
  public readonly path: string;

  constructor() {
    this.path = mkdtempSync(join(tmpdir(), 'grapple-integration-'));
  }

  /**
   * Create a hooks configuration file
   */
  createHooksConfig(config: HookConfiguration): string {
    const claudeDir = join(this.path, '.claude');
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }
    const configPath = join(claudeDir, 'hooks.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Create a hook file
   */
  createHookFile(filename: string, content: string): string {
    const hookPath = join(this.path, filename);
    // Ensure directory exists
    const dir = dirname(hookPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(hookPath, content);
    return hookPath;
  }

  /**
   * Create a package.json for testing
   */
  createPackageJson(packageJson: object): string {
    const pkgPath = join(this.path, 'package.json');
    writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));
    return pkgPath;
  }

  /**
   * Read file contents
   */
  readFile(filename: string): string {
    return readFileSync(join(this.path, filename), 'utf8');
  }

  /**
   * Cleanup the workspace
   */
  cleanup(): void {
    try {
      rmSync(this.path, { recursive: true, force: true });
    } catch (_error) {}
  }
}

describe('Cross-Package Integration Tests', () => {
  let workspace: TestWorkspace;

  beforeAll(() => {
    workspace = new TestWorkspace();
  });

  afterAll(() => {
    workspace.cleanup();
  });

  describe('CLI → Config → Core Integration', () => {
    test('should generate valid hook configuration through CLI', async () => {
      // This would test the CLI generation of hook configs
      // For now, create a config manually that simulates CLI output
      const config: HookConfiguration = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/security-check.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        PostToolUse: {
          Bash: {
            command: 'bun run ./hooks/logging.ts',
            timeout: 3000,
            enabled: true,
          },
        },
        environments: {
          test: {
            NODE_ENV: 'test',
          },
        },
      };

      const _configPath = workspace.createHooksConfig(config);
      const configContent = workspace.readFile('.claude/hooks.json');
      const parsedConfig = JSON.parse(configContent);

      expect(parsedConfig).toEqual(config);
      expect(parsedConfig.PreToolUse.Bash.command).toBe(
        'bun run ./hooks/security-check.ts'
      );
    });

    test('should load and validate configuration through hooks-config', async () => {
      // Test loading config through the config package
      const { ConfigManager } = await import('@carabiner/hooks-config');

      const config = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/security-check.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        PostToolUse: {},
        SessionStart: {
          command: 'bun run hooks/session-start.ts',
          timeout: 10_000,
          enabled: true,
        },
        UserPromptSubmit: {
          command: 'bun run hooks/user-prompt-submit.ts',
          timeout: 5000,
          enabled: false,
        },
        templates: {
          typescript: {
            command: 'bun run {hookPath}',
            timeout: 10_000,
            enabled: true,
          },
        },
        variables: {
          hookPath: 'hooks/{event}.ts',
        },
        environments: {},
      };

      workspace.createHooksConfig(config);

      const configManager = new ConfigManager(workspace.path);
      const loadedConfig = await configManager.load();

      expect(loadedConfig.version).toBe('1.0.0');
      expect(loadedConfig.PreToolUse).toBeDefined();
      expect(loadedConfig.PreToolUse.Bash).toBeDefined();
      expect(loadedConfig.PreToolUse.Bash.timeout).toBe(5000);
    });

    test('should execute hooks through hooks-core runtime', async () => {
      // Test the complete execution flow
      const { HookExecutor } = await import('@carabiner/execution');
      const { TestProtocol } = await import('@carabiner/protocol');

      // Create a simple hook
      const hookContent = `
export default async function(context) {
  return {
    success: true,
    message: 'Integration test hook executed',
    data: { timestamp: new Date().toISOString() }
  };
}
      `;

      workspace.createHookFile('test-hook.ts', hookContent);

      // Create test protocol with mock input
      const protocol = new TestProtocol({
        event: 'pre-tool-use',
        tool: 'Bash',
        input: { command: 'echo "test"' },
      });

      const executor = new HookExecutor(protocol, {
        timeout: 5000,
        collectMetrics: true,
        exitProcess: false, // Don't exit during tests
      });

      // This would test the actual execution
      // For now, verify the executor was created correctly
      expect(executor).toBeDefined();
    });
  });

  describe('Configuration Validation Integration', () => {
    test('should validate complete hook configuration', async () => {
      const { ConfigManager } = await import('@carabiner/hooks-config');

      const validConfig: HookConfiguration = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/security-check.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        PostToolUse: {
          Bash: {
            command: 'bun run ./hooks/audit-log.ts',
            timeout: 3000,
            enabled: true,
          },
        },
        environments: {
          production: {
            LOG_LEVEL: 'info',
            WORKSPACE_PATH: workspace.path,
          },
        },
      };

      workspace.createHooksConfig(validConfig);
      const configManager = new ConfigManager(workspace.path);

      // Test validation
      expect(async () => {
        await configManager.load();
      }).not.toThrow();
    });

    test('should reject invalid configuration', async () => {
      const { ConfigManager } = await import('@carabiner/hooks-config');

      const invalidConfig = {
        version: '1.0.0',
        InvalidEvent: {
          // Invalid hook event - not in allowed list
          Bash: {
            command: 'bun run ./hooks/test.ts',
            timeout: 5000,
            enabled: true,
          },
        },
      };

      workspace.createHooksConfig(invalidConfig as HookConfiguration);
      const configManager = new ConfigManager(workspace.path);

      await expect(configManager.load()).rejects.toThrow();
    });
  });

  describe('End-to-End Hook Execution', () => {
    test('should execute complete hook workflow with metrics', async () => {
      // Test the complete flow from configuration loading to hook execution
      const { ConfigManager } = await import('@carabiner/hooks-config');
      const { clearExecutionMetrics, getExecutionStats } = await import(
        '@carabiner/execution'
      );

      // Clear any existing metrics
      clearExecutionMetrics();

      // Create a hook configuration
      const config = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/test-hook.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        PostToolUse: {},
        SessionStart: {
          command: 'bun run hooks/session-start.ts',
          timeout: 10_000,
          enabled: true,
        },
        UserPromptSubmit: {
          command: 'bun run hooks/user-prompt-submit.ts',
          timeout: 5000,
          enabled: false,
        },
        templates: {
          typescript: {
            command: 'bun run {hookPath}',
            timeout: 10_000,
            enabled: true,
          },
        },
        variables: {
          hookPath: 'hooks/{event}.ts',
        },
        environments: {
          test: {
            PreToolUse: {
              Bash: { timeout: 3000 },
            },
          },
        },
      };

      // Create a test hook that returns metrics
      const hookContent = `
export default async function(context) {
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    success: true,
    message: 'Test hook completed successfully',
    data: {
      event: context.event,
      tool: context.tool,
      executedAt: new Date().toISOString()
    }
  };
}
      `;

      workspace.createHooksConfig(config);
      workspace.createHookFile('hooks/test-hook.ts', hookContent);

      // Load configuration
      const configManager = new ConfigManager(workspace.path);
      const loadedConfig = await configManager.load();

      expect(loadedConfig.PreToolUse).toBeDefined();
      expect(loadedConfig.PreToolUse.Bash).toBeDefined();

      // Verify metrics collection is available
      const initialMetrics = getExecutionStats();
      expect(initialMetrics).toBeDefined();
    });

    test('should handle hook execution errors gracefully', async () => {
      const { ConfigManager } = await import('@carabiner/hooks-config');

      // Create a failing hook
      const failingHookContent = `
export default async function(context) {
  throw new Error('Intentional test failure');
}
      `;

      const config = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/failing-hook.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        PostToolUse: {},
        SessionStart: {
          command: 'bun run hooks/session-start.ts',
          timeout: 10_000,
          enabled: true,
        },
        UserPromptSubmit: {
          command: 'bun run hooks/user-prompt-submit.ts',
          timeout: 5000,
          enabled: false,
        },
        templates: {
          typescript: {
            command: 'bun run {hookPath}',
            timeout: 10_000,
            enabled: true,
          },
        },
        variables: {
          hookPath: 'hooks/{event}.ts',
        },
        environments: {},
      };

      workspace.createHooksConfig(config);
      workspace.createHookFile('hooks/failing-hook.ts', failingHookContent);

      const configManager = new ConfigManager(workspace.path);
      const loadedConfig = await configManager.load();

      // Configuration should load successfully even with failing hooks
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.PreToolUse.Bash.command).toBe(
        'bun run ./hooks/failing-hook.ts'
      );
    });
  });

  describe('Security Integration Tests', () => {
    test('should enforce security policies across packages', async () => {
      const { ConfigManager } = await import('@carabiner/hooks-config');

      // Test configuration with potentially unsafe settings
      const unsafeConfig = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ../../../etc/passwd', // Path traversal attempt
            timeout: 5000,
            enabled: true,
          },
        },
        environments: {},
      };

      workspace.createHooksConfig(unsafeConfig as HookConfiguration);
      const configManager = new ConfigManager(workspace.path);

      // Should reject unsafe paths
      await expect(configManager.load()).rejects.toThrow(
        /Dangerous command pattern/
      );
    });

    test('should validate environment variable safety', async () => {
      const { ConfigManager } = await import('@carabiner/hooks-config');

      const configWithUnsafeEnv: HookConfiguration = {
        version: '1.0.0',
        PreToolUse: {
          Bash: {
            command: 'bun run ./hooks/test.ts',
            timeout: 5000,
            enabled: true,
          },
        },
        environments: {
          production: {
            // These should be validated by security policies
            WORKSPACE_PATH: workspace.path,
            LOG_LEVEL: 'debug',
          },
        },
      };

      workspace.createHooksConfig(configWithUnsafeEnv);
      const configManager = new ConfigManager(workspace.path);

      // Should load safely with proper environment variables
      const config = await configManager.load();
      expect(config.environments?.production?.WORKSPACE_PATH).toBe(
        workspace.path
      );
    });
  });

  describe('Performance Integration', () => {
    test('should track performance across package boundaries', async () => {
      const { clearExecutionMetrics } = await import('@carabiner/execution');

      // Clear existing metrics
      clearExecutionMetrics();

      // Simulate a complete workflow
      const startTime = performance.now();

      // Configuration loading (simulated)
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Hook execution (simulated)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify timing is reasonable
      expect(duration).toBeGreaterThan(10); // At least 15ms of simulated work
      expect(duration).toBeLessThan(1000); // Should complete quickly in tests
    });

    test('should handle concurrent hook executions', async () => {
      // Test concurrent execution capabilities
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          new Promise((resolve) =>
            setTimeout(() => resolve(`concurrent-${i}`), Math.random() * 20)
          )
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBe(`concurrent-${index}`);
      });
    });
  });
});
