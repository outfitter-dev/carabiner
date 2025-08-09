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
    const watchMode = this.getBooleanValue(values.watch);
    const coverage = this.getBooleanValue(values.coverage);
    const timeout = this.getStringValue(values.timeout)
      ? Number.parseInt(this.getStringValue(values.timeout), 10)
      : undefined;
    const verbose = this.getBooleanValue(values.verbose) || config.verbose;
    const bail = this.getBooleanValue(values.bail);
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
      // TODO: Display test file information
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
  private findTestFiles(testDir: string): Promise<string[]> {
    return this.findTestFilesRecursive(testDir, testDir);
  }

  /**
   * Recursively find test files in directories
   */
  private async findTestFilesRecursive(
    currentDir: string,
    baseDir: string
  ): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const { join: pathJoin } = await import('node:path');
    const files: string[] = [];

    try {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = pathJoin(currentDir, entry.name);

        if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
          // Add relative path from base directory
          const relativePath = fullPath.replace(`${baseDir}/`, '');
          files.push(relativePath);
        } else if (entry.isDirectory()) {
          // Recursively search subdirectories
          // biome-ignore lint/nursery/noAwaitInLoop: recursive directory traversal requires sequential processing
          const subFiles = await this.findTestFilesRecursive(fullPath, baseDir);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read - return empty array
      if (error instanceof Error) {
        // Silently handle missing directories
      }
    }

    return files;
  }
}
