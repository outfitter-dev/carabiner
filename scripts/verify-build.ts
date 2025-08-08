#!/usr/bin/env bun

/**
 * Build verification script
 * Ensures all packages build correctly and meet quality standards
 */

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface PackageCheck {
  name: string;
  path: string;
  hasTypes: boolean;
  hasMain: boolean;
  hasDist: boolean;
  distSize: number;
}

const PACKAGES = [
  'hooks-core',
  'hooks-validators',
  'hooks-config',
  'hooks-testing',
  'hooks-cli',
];

async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

async function checkPackage(packageName: string): Promise<PackageCheck> {
  const packagePath = join(process.cwd(), 'packages', packageName);
  const distPath = join(packagePath, 'dist');
  const mainPath = join(distPath, 'index.js');
  const typesPath = join(distPath, 'index.d.ts');

  let distSize = 0;
  if (existsSync(distPath)) {
    try {
      // Calculate total size of dist directory
      const calculateSize = (dirPath: string): number => {
        const stat = statSync(dirPath);
        if (stat.isFile()) {
          return stat.size;
        }

        if (stat.isDirectory()) {
          const { readdirSync } = await import('node:fs');
          return readdirSync(dirPath)
            .map((name) => calculateSize(join(dirPath, name)))
            .reduce((total, size) => total + size, 0);
        }

        return 0;
      };

      distSize = calculateSize(distPath);
    } catch (_error) {}
  }

  return {
    name: packageName,
    path: packagePath,
    hasTypes: existsSync(typesPath),
    hasMain: existsSync(mainPath),
    hasDist: existsSync(distPath),
    distSize,
  };
}

async function verifyBuild(): Promise<void> {
  const cleanResult = await runCommand('bun', ['run', 'clean'], process.cwd());
  if (cleanResult.code !== 0) {
  }
  const buildResult = await runCommand(
    'bun',
    ['run', 'build:packages'],
    process.cwd()
  );

  if (buildResult.code !== 0) {
    process.exit(1);
  }

  const checks: PackageCheck[] = [];
  for (const packageName of PACKAGES) {
    const check = await checkPackage(packageName);
    checks.push(check);

    const _status = check.hasMain && check.hasTypes ? '✅' : '❌';
  }
  const typecheckResult = await runCommand(
    'bun',
    ['run', 'typecheck'],
    process.cwd()
  );

  if (typecheckResult.code !== 0) {
    process.exit(1);
  }

  for (const packageName of PACKAGES) {
    try {
      const packagePath = join(
        process.cwd(),
        'packages',
        packageName,
        'dist',
        'index.js'
      );
      if (existsSync(packagePath)) {
        // Try to import the built package
        const { readFile } = await import('node:fs/promises');
        const content = await readFile(packagePath, 'utf-8');

        if (content.length === 0) {
          throw new Error('Package file is empty');
        }
      } else {
      }
    } catch (_error) {}
  }
  const publintResult = await runCommand(
    'bunx',
    ['publint', '--strict'],
    join(process.cwd(), 'packages')
  );

  if (publintResult.code !== 0 && publintResult.stderr) {
  } else {
  }

  // Summary
  const failedChecks = checks.filter(
    (check) => !(check.hasMain && check.hasTypes)
  );
  const _totalSize = checks.reduce((sum, check) => sum + check.distSize, 0);

  if (failedChecks.length > 0) {
    process.exit(1);
  }
}

// Run verification if called directly
if (import.meta.main) {
  verifyBuild().catch((_error) => {
    process.exit(1);
  });
}

export { verifyBuild };
