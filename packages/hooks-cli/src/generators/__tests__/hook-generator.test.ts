import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HookGeneratorOptions } from '../hook-generator.js';
import { HookGenerator } from '../hook-generator.js';

describe('HookGenerator', () => {
  const testWorkspace = join(tmpdir(), `hooks-cli-test-${Date.now()}`);
  const testOptions: HookGeneratorOptions = {
    workspacePath: testWorkspace,
    name: 'test-hook',
    useTypeScript: true,
    force: false,
    template: 'basic',
  };

  beforeEach(() => {
    // Ensure test workspace exists
    mkdirSync(join(testWorkspace, 'hooks'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await rm(testWorkspace, { recursive: true, force: true });
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
    const validationOptions = {
      ...testOptions,
      template: 'validation' as const,
    };
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
