import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { unlink, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HookGenerator } from '../hook-generator.js';
import type { HookGeneratorOptions } from '../hook-generator.js';

describe('HookGenerator', () => {
  const testWorkspace = '/tmp/hooks-cli-test';
  const testOptions: HookGeneratorOptions = {
    workspacePath: testWorkspace,
    name: 'test-hook',
    useTypeScript: true,
    force: false,
    template: 'basic',
  };

  beforeEach(async () => {
    // Ensure test workspace exists
    await Bun.write(join(testWorkspace, 'hooks', '.gitkeep'), '');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
      if (existsSync(hookPath)) {
        await unlink(hookPath);
      }
      await rmdir(join(testWorkspace, 'hooks'), { recursive: true });
      await rmdir(testWorkspace, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('generates basic TypeScript hook', async () => {
    const generator = new HookGenerator(testOptions);
    await generator.generate();

    const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
    expect(existsSync(hookPath)).toBe(true);

    const content = await Bun.file(hookPath).text();
    expect(content).toContain('#!/usr/bin/env bun');
    expect(content).toContain('import { runClaudeHook');
    expect(content).toContain('test-hook hook triggered');
  });

  test('generates JavaScript hook when useTypeScript is false', async () => {
    const jsOptions = { ...testOptions, useTypeScript: false };
    const generator = new HookGenerator(jsOptions);
    await generator.generate();

    const hookPath = join(testWorkspace, 'hooks', 'test-hook.js');
    expect(existsSync(hookPath)).toBe(true);

    const content = await Bun.file(hookPath).text();
    expect(content).toContain('const { runClaudeHook');
    expect(content).toContain('require.main === module');
  });

  test('generates validation hook template', async () => {
    const validationOptions = { ...testOptions, template: 'validation' as const };
    const generator = new HookGenerator(validationOptions);
    await generator.generate();

    const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
    const content = await Bun.file(hookPath).text();
    expect(content).toContain('validateHookContext');
    expect(content).toContain('performCustomValidation');
  });

  test('generates security hook template', async () => {
    const securityOptions = { ...testOptions, template: 'security' as const };
    const generator = new HookGenerator(securityOptions);
    await generator.generate();

    const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
    const content = await Bun.file(hookPath).text();
    expect(content).toContain('SecurityValidators');
    expect(content).toContain('performSecurityChecks');
    expect(content).toContain('🔒');
  });

  test('throws error when file exists and force is false', async () => {
    // Create the file first
    const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
    await Bun.write(hookPath, 'existing content');

    const generator = new HookGenerator(testOptions);
    await expect(generator.generate()).rejects.toThrow('File already exists');
  });

  test('overwrites file when force is true', async () => {
    // Create the file first
    const hookPath = join(testWorkspace, 'hooks', 'test-hook.ts');
    await Bun.write(hookPath, 'existing content');

    const forceOptions = { ...testOptions, force: true };
    const generator = new HookGenerator(forceOptions);
    await generator.generate();

    const content = await Bun.file(hookPath).text();
    expect(content).not.toContain('existing content');
    expect(content).toContain('test-hook hook triggered');
  });
});