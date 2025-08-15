/**
 * Tests for hooks-config package configuration management
 * Focuses on immutability and proper config updates
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { ConfigManager, type ExtendedHookConfiguration } from '../config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ConfigManager - Immutability Tests', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hooks-config-test-'));
    configManager = new ConfigManager(tempDir);
  });

  // Clean up after each test
  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('should create immutable updates in setHookConfig for tool-specific config', async () => {
    // Load initial config
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig)); // Deep copy for comparison

    // Set a new tool config
    await configManager.setHookConfig('PreToolUse', 'Write', {
      command: 'bun run hooks/custom-pre.ts',
      timeout: 5000,
      enabled: true,
    });

    const updatedConfig = configManager.getConfig();

    // Verify the original config wasn't mutated
    expect(initialConfig).toEqual(originalConfig);
    
    // Verify the update was applied correctly
    expect(updatedConfig.PreToolUse?.Write).toEqual({
      command: 'bun run hooks/custom-pre.ts',
      timeout: 5000,
      enabled: true,
    });

    // Verify it's a different object reference
    expect(updatedConfig).not.toBe(initialConfig);
    expect(updatedConfig.PreToolUse).not.toBe(initialConfig.PreToolUse);
  });

  test('should create immutable updates in setHookConfig for event-level config', async () => {
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig));

    // Set event-level config
    await configManager.setHookConfig('SessionStart', {
      command: 'bun run hooks/custom-session.ts',
      timeout: 15000,
      enabled: true,
    });

    const updatedConfig = configManager.getConfig();

    // Verify original wasn't mutated
    expect(initialConfig).toEqual(originalConfig);
    
    // Verify the update
    expect(updatedConfig.SessionStart).toEqual({
      command: 'bun run hooks/custom-session.ts',
      timeout: 15000,
      enabled: true,
    });

    // Different references
    expect(updatedConfig).not.toBe(initialConfig);
  });

  test('should create immutable updates in toggleHook for tool-specific hooks', async () => {
    const initialConfig = await configManager.load();
    
    // Ensure we have a tool config to toggle
    await configManager.setHookConfig('PreToolUse', 'Bash', {
      command: 'bun run hooks/pre-bash.ts',
      timeout: 3000,
      enabled: true,
    });

    const beforeToggle = configManager.getConfig();
    const originalBeforeToggle = JSON.parse(JSON.stringify(beforeToggle));

    // Toggle the hook
    await configManager.toggleHook('PreToolUse', 'Bash', false);

    const afterToggle = configManager.getConfig();

    // Verify original wasn't mutated
    expect(beforeToggle).toEqual(originalBeforeToggle);
    
    // Verify the toggle
    expect(afterToggle.PreToolUse?.Bash?.enabled).toBe(false);
    expect(afterToggle.PreToolUse?.Bash?.command).toBe('bun run hooks/pre-bash.ts');
    expect(afterToggle.PreToolUse?.Bash?.timeout).toBe(3000);

    // Different references
    expect(afterToggle).not.toBe(beforeToggle);
    expect(afterToggle.PreToolUse).not.toBe(beforeToggle.PreToolUse);
  });

  test('should create immutable updates in toggleHook for event-level hooks', async () => {
    const initialConfig = await configManager.load();
    const originalConfig = JSON.parse(JSON.stringify(initialConfig));

    // Toggle event-level hook (SessionStart is event-level by default)
    await configManager.toggleHook('SessionStart', undefined, false);

    const updatedConfig = configManager.getConfig();

    // Verify original wasn't mutated  
    expect(initialConfig).toEqual(originalConfig);
    
    // Verify the toggle
    expect(updatedConfig.SessionStart?.enabled).toBe(false);

    // Different references
    expect(updatedConfig).not.toBe(initialConfig);
  });

  test('should handle nested config updates without mutating parent objects', async () => {
    await configManager.load();

    // Set multiple tool configs
    await configManager.setHookConfig('PreToolUse', 'Write', {
      command: 'bun run hooks/pre-write.ts',
      timeout: 2000,
      enabled: true,
    });

    const afterFirstUpdate = configManager.getConfig();
    const originalAfterFirst = JSON.parse(JSON.stringify(afterFirstUpdate));

    await configManager.setHookConfig('PreToolUse', 'Edit', {
      command: 'bun run hooks/pre-edit.ts', 
      timeout: 3000,
      enabled: true,
    });

    const afterSecondUpdate = configManager.getConfig();

    // Verify first update state wasn't mutated
    expect(afterFirstUpdate).toEqual(originalAfterFirst);
    
    // Verify both configs exist
    expect(afterSecondUpdate.PreToolUse?.Write).toEqual({
      command: 'bun run hooks/pre-write.ts',
      timeout: 2000,
      enabled: true,
    });
    expect(afterSecondUpdate.PreToolUse?.Edit).toEqual({
      command: 'bun run hooks/pre-edit.ts',
      timeout: 3000,
      enabled: true,
    });

    // Different references
    expect(afterSecondUpdate).not.toBe(afterFirstUpdate);
  });
});
