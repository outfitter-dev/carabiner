#!/usr/bin/env bun

/**
 * Local binary build script for development and testing
 * Builds the claude-hooks CLI as a standalone binary
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

type BuildOptions = {
  target?: 'current' | 'linux' | 'macos' | 'windows';
  minify?: boolean;
  sourcemap?: boolean;
  verbose?: boolean;
  output?: string;
};

async function buildBinary(options: BuildOptions = {}) {
  const {
    target = 'current',
    minify = true,
    sourcemap = true,
    verbose = false,
    output,
  } = options;

  // Verify we're in the correct directory
  const rootDir = process.cwd();
  const cliDir = join(rootDir, 'packages/hooks-cli');
  const entryPoint = join(cliDir, 'src/cli.ts');

  if (!existsSync(entryPoint)) {
    process.exit(1);
  }

  // Determine output filename based on target
  let binaryName: string;
  if (output) {
    binaryName = output;
  } else {
    switch (target) {
      case 'linux':
        binaryName = 'claude-hooks-linux';
        break;
      case 'macos':
        binaryName =
          process.arch === 'arm64'
            ? 'claude-hooks-macos-arm64'
            : 'claude-hooks-macos-x64';
        break;
      case 'windows':
        binaryName = 'claude-hooks-windows.exe';
        break;
      default: {
        const platform =
          process.platform === 'win32'
            ? 'windows'
            : process.platform === 'darwin'
              ? 'macos'
              : 'linux';
        const arch = process.arch === 'arm64' ? '-arm64' : '-x64';
        const ext = process.platform === 'win32' ? '.exe' : '';
        binaryName = `claude-hooks-${platform}${arch}${ext}`;
      }
    }
  }

  const outputPath = join(rootDir, binaryName);

  try {
    await $`bun run build`.quiet(!verbose);

    // Read version from CLI package.json
    const cliPackageJson = JSON.parse(
      await Bun.file(join(cliDir, 'package.json')).text()
    );
    const version = cliPackageJson.version;

    // Construct build command
    const buildArgs = [
      'build',
      entryPoint,
      '--compile',
      '--target=bun',
      `--outfile=${outputPath}`,
      '--define',
      'process.env.NODE_ENV="production"',
      '--define',
      `process.env.CLI_VERSION="${version}"`,
      '--external',
      'fsevents',
    ];

    if (minify) {
      buildArgs.push('--minify');
    }

    if (sourcemap) {
      buildArgs.push('--sourcemap=external');
    }

    const _buildCommand = buildArgs.join(' ');
    if (verbose) {
    }

    await $`bun ${buildArgs}`.quiet(!verbose);

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      await $`chmod +x ${outputPath}`;
    }

    // Get file info
    try {
      const stat = await Bun.file(outputPath).exists();
      if (stat) {
        const _size = (await Bun.file(outputPath).bytes()).length;
      }
    } catch {
      // Ignore file size errors
    }

    try {
      await $`${outputPath} --version`.quiet(!verbose);
    } catch (_error) {
      if (verbose) {
      }
    }

    try {
      await $`${outputPath} --help`.quiet(!verbose);
    } catch (_error) {
      if (verbose) {
      }
    }

    try {
      await $`${outputPath} validate --help`.quiet(!verbose);
    } catch (_error) {
      if (verbose) {
      }
    }
  } catch (_error) {
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): BuildOptions {
  const args = process.argv.slice(2);
  const options: BuildOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--target':
        options.target = args[++i] as BuildOptions['target'];
        break;
      case '--no-minify':
        options.minify = false;
        break;
      case '--no-sourcemap':
        options.sourcemap = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
        process.exit(0);
        break;
    }
  }

  return options;
}

// Main execution
if (import.meta.main) {
  const options = parseArgs();
  await buildBinary(options);
}

export { buildBinary };
