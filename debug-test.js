import { afterEach, beforeEach, describe, test } from 'bun:test';
import { TestWorkspaceBuilder } from './tests/utils/test-workspace.ts';

describe('Debug Config Loading', () => {
  let workspace;

  beforeEach(async () => {
    workspace = new TestWorkspaceBuilder();
  });

  afterEach(async () => {
    await workspace?.cleanup();
  });

  test('debug invalid config loading', async () => {
    const { ConfigManager } = await import(
      './packages/hooks-config/src/config.ts'
    );

    const invalidConfig = {
      version: '1.0.0',
      InvalidEvent: {
        Bash: {
          command: 'bun run ./hooks/test.ts',
          timeout: 5000,
          enabled: true,
        },
      },
    };

    workspace.createHooksConfig(invalidConfig);
    const configManager = new ConfigManager(workspace.path);
    const _result = await configManager.load();
  });
});
