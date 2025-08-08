/**
 * Test command - Runs hook tests
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Regex for test file detection
const TEST_FILE_PATTERN = /\.test\.(ts|js)$/;

import { BaseCommand, type CliConfig } from '../cli';

export class TestCommand extends BaseCommand {
  name = 'test';
  description = 'Run hook tests';
  usage = 'test [pattern] [options]';
  options = {
    '--watch, -w': 'Watch mode - rerun tests on file changes',
    '--coverage, -c': 'Generate test coverage report',
    '--timeout, -t': 'Set test timeout in milliseconds',
    '--verbose, -v': 'Verbose test output',
    '--bail, -b': 'Stop on first test failure',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values, positionals } = this.parseArgs(args, {
      help: { type: 'boolean', short: 'h' },
      watch: { type: 'boolean', short: 'w' },
      coverage: { type: 'boolean', short: 'c' },
      timeout: { type: 'string', short: 't' },
      verbose: { type: 'boolean', short: 'v' },
      bail: { type: 'boolean', short: 'b' },
    });

    if (values.help) {
      this.showHelp();
      this.showTestHelp();
      return;
    }

    const pattern = positionals[0] || 'hooks/test/';
    const watchMode = values.watch;
    const coverage = values.coverage;
    const timeout = values.timeout
      ? Number.parseInt(values.timeout, 10)
      : undefined;
    const verbose = values.verbose || config.verbose;
    const bail = values.bail;
    if (watchMode) {
      // TODO: Implement watch mode
    }
    if (coverage) {
      // TODO: Implement coverage reporting
    }

    try {
      await this.runTests({
        workspacePath: config.workspacePath,
        pattern,
        watchMode,
        coverage,
        timeout,
        verbose,
        bail,
      });
    } catch (error) {
      throw new Error(
        `Test execution failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Show additional help for test command
   */
  private showTestHelp(): void {
    // TODO: Implement test help display
  }

  /**
   * Run tests with specified options
   */
  private async runTests(options: {
    workspacePath: string;
    pattern: string;
    watchMode: boolean;
    coverage: boolean;
    timeout?: number;
    verbose: boolean;
    bail: boolean;
  }): Promise<void> {
    const {
      workspacePath,
      pattern,
      watchMode,
      coverage,
      timeout,
      verbose,
      bail,
    } = options;

    // Check if test directory exists
    const testDir = join(workspacePath, 'hooks/test');
    if (!existsSync(testDir)) {
      return;
    }

    // Check if tests exist
    const testFiles = await this.findTestFiles(testDir);
    if (testFiles.length === 0) {
      return;
    }

    if (verbose) {
      for (const _file of testFiles) {
        // TODO: Display test file information
      }
    }

    // Build bun test command
    const args = ['test'];

    // Add pattern/path
    args.push(pattern);

    // Add options
    if (watchMode) {
      args.push('--watch');
    }

    if (coverage) {
      args.push('--coverage');
    }

    if (timeout) {
      args.push('--timeout', timeout.toString());
    }

    if (bail) {
      args.push('--bail');
    }

    if (verbose) {
      args.push('--verbose');
    }

    // Run tests
    const testProcess = spawn('bun', args, {
      cwd: workspacePath,
      stdio: 'inherit',
    });

    return new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Failed to start test process: ${error.message}`));
      });
    });
  }

  /**
   * Find all test files in directory
   */
  private async findTestFiles(testDir: string): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const files: string[] = [];

    try {
      const entries = await readdir(testDir, {
        recursive: true,
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
          const fullPath = join(entry.path || testDir, entry.name);
          files.push(fullPath.replace(`${testDir}/`, ''));
        }
      }
    } catch (_error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }
}
