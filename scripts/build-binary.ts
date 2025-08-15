#!/usr/bin/env bun

/**
 * Local binary build script for development and testing
 * Builds the claude-hooks CLI as a standalone binary
 */

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { $ } from 'bun';

interface BuildOptions {
  target?: 'current' | 'linux' | 'macos' | 'windows';
  minify?: boolean;
  sourcemap?: boolean;
  verbose?: boolean;
  output?: string;
}

async function buildBinary(options: BuildOptions = {}) {
  const {
    target = 'current',
    minify = true,
    sourcemap = true,
    verbose = false,
    output
  } = options;

  console.log('🔨 Building claude-hooks binary...\n');

  // Verify we're in the correct directory
  const rootDir = process.cwd();
  const cliDir = join(rootDir, 'packages/hooks-cli');
  const entryPoint = join(cliDir, 'src/cli.ts');

  if (!existsSync(entryPoint)) {
    console.error('❌ CLI entry point not found. Make sure you\'re in the project root.');
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
        binaryName = process.arch === 'arm64' ? 'claude-hooks-macos-arm64' : 'claude-hooks-macos-x64';
        break;
      case 'windows':
        binaryName = 'claude-hooks-windows.exe';
        break;
      case 'current':
      default:
        const platform = process.platform === 'win32' ? 'windows' : 
                        process.platform === 'darwin' ? 'macos' : 'linux';
        const arch = process.arch === 'arm64' ? '-arm64' : '-x64';
        const ext = process.platform === 'win32' ? '.exe' : '';
        binaryName = `claude-hooks-${platform}${arch}${ext}`;
    }
  }

  const outputPath = join(rootDir, binaryName);

  try {
    // Build dependencies first
    console.log('📦 Building packages (dependencies)...');
    await $`bun run build`.quiet(!verbose);
    console.log('✅ Dependencies built\n');

    // Read version from CLI package.json
    const cliPackageJson = JSON.parse(
      await Bun.file(join(cliDir, 'package.json')).text()
    );
    const version = cliPackageJson.version;

    // Build the binary
    console.log(`🏗️  Building binary: ${binaryName} (v${version})`);
    console.log(`   Entry: ${entryPoint}`);
    console.log(`   Output: ${outputPath}\n`);

    // Construct build command
    const buildArgs = [
      'build',
      entryPoint,
      '--compile',
      '--target=bun',
      `--outfile=${outputPath}`,
      '--define', 'process.env.NODE_ENV="production"',
      '--define', `process.env.CLI_VERSION="${version}"`,
      '--external', 'fsevents'
    ];

    if (minify) {
      buildArgs.push('--minify');
    }

    if (sourcemap) {
      buildArgs.push('--sourcemap=external');
    }

    const buildCommand = buildArgs.join(' ');
    if (verbose) {
      console.log(`Command: bun ${buildCommand}\n`);
    }

    await $`bun ${buildArgs}`.quiet(!verbose);

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      await $`chmod +x ${outputPath}`;
    }

    console.log(`✅ Binary built successfully: ${binaryName}\n`);

    // Get file info
    try {
      const stat = await Bun.file(outputPath).exists();
      if (stat) {
        const size = (await Bun.file(outputPath).bytes()).length;
        console.log(`📊 Binary size: ${(size / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch {
      // Ignore file size errors
    }

    // Run smoke tests
    console.log('\n🧪 Running smoke tests...');
    
    try {
      await $`${outputPath} --version`.quiet(!verbose);
      console.log('✅ Version test passed');
    } catch (error) {
      console.log('❌ Version test failed');
      if (verbose) console.error(error);
    }

    try {
      await $`${outputPath} --help`.quiet(!verbose);
      console.log('✅ Help test passed');
    } catch (error) {
      console.log('❌ Help test failed');
      if (verbose) console.error(error);
    }

    try {
      await $`${outputPath} validate --help`.quiet(!verbose);
      console.log('✅ Command help test passed');
    } catch (error) {
      console.log('❌ Command help test failed');
      if (verbose) console.error(error);
    }

    console.log(`\n🎉 Binary ready: ${outputPath}`);
    console.log('\n📝 Usage examples:');
    console.log(`   ${outputPath} --version`);
    console.log(`   ${outputPath} --help`);
    console.log(`   ${outputPath} validate --help`);

  } catch (error) {
    console.error('❌ Build failed:', error);
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
        console.log(`
Usage: bun scripts/build-binary.ts [options]

Options:
  --target <target>    Target platform: current, linux, macos, windows
  --no-minify          Disable minification
  --no-sourcemap       Disable sourcemap generation  
  --verbose            Enable verbose output
  --output <path>      Custom output filename
  --help               Show this help

Examples:
  bun scripts/build-binary.ts
  bun scripts/build-binary.ts --target linux
  bun scripts/build-binary.ts --target macos --verbose
  bun scripts/build-binary.ts --output my-cli
        `);
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