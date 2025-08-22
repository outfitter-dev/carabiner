#!/usr/bin/env bun
/**
 * Comprehensive Test Execution Script
 *
 * Orchestrates the execution of all test suites with proper reporting,
 * coverage analysis, and CI/CD integration.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  detectTestEnvironment,
  TestOrchestrator,
} from '../tests/test-runner.config';

type TestExecutionOptions = {
  /** Filter to specific test categories */
  categories?: string[];
  /** Generate coverage reports */
  coverage?: boolean;
  /** Include performance tests */
  performance?: boolean;
  /** Include production tests */
  production?: boolean;
  /** Parallel execution */
  parallel?: boolean;
  /** Output directory for reports */
  outputDir?: string;
  /** Verbose logging */
  verbose?: boolean;
};

type TestPhaseResult = {
  name: string;
  success: boolean;
  duration: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  coverage?: CoverageResult;
  errors: string[];
  warnings: string[];
};

type CoverageResult = {
  linesCovered: number;
  functionsCovered: number;
  branchesCovered: number;
  totalLines: number;
  totalFunctions: number;
  totalBranches: number;
  uncoveredFiles: string[];
};

type TestSuiteResult = {
  environment: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  phases: TestPhaseResult[];
  overallSuccess: boolean;
  coverageSummary?: CoverageResult;
  performanceMetrics?: {
    avgTestDuration: number;
    memoryUsage: {
      peak: number;
      average: number;
    };
    slowestTests: Array<{ name: string; duration: number }>;
  };
};

/**
 * Main test execution orchestrator
 */
class ComprehensiveTestRunner {
  private readonly orchestrator: TestOrchestrator;
  private readonly options: TestExecutionOptions;
  private readonly outputDir: string;

  constructor(options: TestExecutionOptions = {}) {
    this.orchestrator = new TestOrchestrator();
    this.options = {
      coverage: true,
      performance: false,
      production: false,
      parallel: true,
      outputDir: './test-results',
      verbose: false,
      ...options,
    };

    this.outputDir = resolve(this.options.outputDir!);
    this.ensureOutputDirectory();
  }

  /**
   * Execute all test phases
   */
  async run(): Promise<TestSuiteResult> {
    const startTime = new Date();
    const environment = detectTestEnvironment();

    const result: TestSuiteResult = {
      environment,
      startTime,
      endTime: new Date(),
      totalDuration: 0,
      phases: [],
      overallSuccess: true,
    };

    try {
      // Generate execution plan
      const plan = this.orchestrator.generateExecutionPlan();
      plan.phases.forEach((phase, _index) => {
        const _status = phase.condition !== false ? '✅' : '⏭️ ';
      });

      // Execute test phases
      for (const phase of plan.phases) {
        if (phase.condition === false) {
          continue;
        }

        if (
          this.options.categories &&
          !this.options.categories.includes(
            phase.name.toLowerCase().replace(/\s+/g, '-')
          )
        ) {
          continue;
        }

        const phaseResult = await this.executePhase(phase);
        result.phases.push(phaseResult);

        if (phase.required && !phaseResult.success) {
          result.overallSuccess = false;
          break;
        }
      }

      // Generate coverage summary if enabled
      if (this.options.coverage && result.phases.some((p) => p.coverage)) {
        result.coverageSummary = this.generateCoverageSummary(result.phases);
      }

      // Generate performance metrics
      result.performanceMetrics = this.generatePerformanceMetrics(
        result.phases
      );

      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - startTime.getTime();

      // Generate reports
      await this.generateReports(result);

      // Print summary
      this.printSummary(result);

      return result;
    } catch (error) {
      result.overallSuccess = false;
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - startTime.getTime();
      throw error;
    }
  }

  /**
   * Execute a single test phase
   */
  private async executePhase(phase: any): Promise<TestPhaseResult> {
    const startTime = Date.now();

    const result: TestPhaseResult = {
      name: phase.name,
      success: false,
      duration: 0,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      errors: [],
      warnings: [],
    };

    try {
      // Build command
      const args = ['test'];

      if (phase.pattern !== '**/*.test.ts') {
        args.push(phase.pattern);
      }

      if (this.options.coverage) {
        args.push('--coverage');
      }

      if (this.options.verbose) {
        args.push('--verbose');
      }

      // Execute tests
      const testResult = await this.runBunTest(args, {
        timeout: phase.timeout,
        retries: phase.retries,
      });

      result.success = testResult.exitCode === 0;
      result.testsRun = testResult.testsRun;
      result.testsPassed = testResult.testsPassed;
      result.testsFailed = testResult.testsFailed;
      result.errors = testResult.errors;
      result.warnings = testResult.warnings;

      if (this.options.coverage && testResult.coverage) {
        result.coverage = testResult.coverage;
      }

      result.duration = Date.now() - startTime;

      const _status = result.success ? '✅' : '❌';

      if (result.errors.length > 0 && this.options.verbose) {
        result.errors.forEach((_error) => {});
      }
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    return result;
  }

  /**
   * Run Bun test command
   */
  private async runBunTest(
    args: string[],
    options: { timeout: number; retries: number }
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let attempt = 0;
      let lastError: Error | null = null;

      const tryRun = () => {
        attempt++;

        const proc = spawn('bun', args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          lastError = new Error(`Test timed out after ${options.timeout}ms`);
        }, options.timeout);

        proc.on('close', (code) => {
          clearTimeout(timeoutId);

          if (code === 0) {
            resolve(this.parseTestOutput(stdout, stderr));
          } else {
            lastError = new Error(
              `Test failed with exit code ${code}: ${stderr}`
            );

            if (attempt <= options.retries) {
              setTimeout(tryRun, 1000 * attempt); // Exponential backoff
            } else {
              reject(lastError);
            }
          }
        });

        proc.on('error', (error) => {
          clearTimeout(timeoutId);
          lastError = error;

          if (attempt <= options.retries) {
            setTimeout(tryRun, 1000 * attempt);
          } else {
            reject(error);
          }
        });
      };

      tryRun();
    });
  }

  /**
   * Parse test output from Bun test
   */
  private parseTestOutput(stdout: string, _stderr: string): any {
    // Parse Bun test output to extract test results
    // This is a simplified parser - in production, you'd want more robust parsing

    const lines = stdout.split('\n');
    let testsRun = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    // Look for test summary line
    const summaryLine = lines.find(
      (line) => line.includes('pass') && line.includes('fail')
    );
    if (summaryLine) {
      const passMatch = summaryLine.match(/(\d+) pass/);
      const failMatch = summaryLine.match(/(\d+) fail/);

      if (passMatch) {
        testsPassed = Number.parseInt(passMatch[1], 10);
      }
      if (failMatch) {
        testsFailed = Number.parseInt(failMatch[1], 10);
      }
      testsRun = testsPassed + testsFailed;
    }

    // Extract errors
    lines.forEach((line) => {
      if (line.includes('(fail)') || line.includes('Error:')) {
        errors.push(line.trim());
      }
      if (line.includes('warn') || line.includes('Warning:')) {
        warnings.push(line.trim());
      }
    });

    // Parse coverage if present
    let coverage;
    if (stdout.includes('Coverage')) {
      coverage = this.parseCoverageOutput(stdout);
    }

    return {
      exitCode: testsFailed === 0 ? 0 : 1,
      testsRun,
      testsPassed,
      testsFailed,
      errors,
      warnings,
      coverage,
    };
  }

  /**
   * Parse coverage output
   */
  private parseCoverageOutput(output: string): CoverageResult | null {
    // Simplified coverage parsing - in production, use proper coverage tools
    const lines = output.split('\n');
    const coverageLine = lines.find((line) => line.includes('All files'));

    if (coverageLine) {
      // Extract coverage percentages using regex
      const percentages = coverageLine.match(/(\d+\.?\d*)/g);

      if (percentages && percentages.length >= 2) {
        return {
          functionsCovered: Number.parseFloat(percentages[0]),
          linesCovered: Number.parseFloat(percentages[1]),
          branchesCovered: percentages[2]
            ? Number.parseFloat(percentages[2])
            : 0,
          totalLines: 1000, // Placeholder
          totalFunctions: 100, // Placeholder
          totalBranches: 50, // Placeholder
          uncoveredFiles: [],
        };
      }
    }

    return null;
  }

  /**
   * Generate coverage summary across all phases
   */
  private generateCoverageSummary(phases: TestPhaseResult[]): CoverageResult {
    const coveragePhases = phases.filter((p) => p.coverage);

    if (coveragePhases.length === 0) {
      return {
        linesCovered: 0,
        functionsCovered: 0,
        branchesCovered: 0,
        totalLines: 0,
        totalFunctions: 0,
        totalBranches: 0,
        uncoveredFiles: [],
      };
    }

    // Aggregate coverage data
    return coveragePhases.reduce(
      (acc, phase) => {
        const cov = phase.coverage!;
        return {
          linesCovered: Math.max(acc.linesCovered, cov.linesCovered),
          functionsCovered: Math.max(
            acc.functionsCovered,
            cov.functionsCovered
          ),
          branchesCovered: Math.max(acc.branchesCovered, cov.branchesCovered),
          totalLines: acc.totalLines + cov.totalLines,
          totalFunctions: acc.totalFunctions + cov.totalFunctions,
          totalBranches: acc.totalBranches + cov.totalBranches,
          uncoveredFiles: [...acc.uncoveredFiles, ...cov.uncoveredFiles],
        };
      },
      {
        linesCovered: 0,
        functionsCovered: 0,
        branchesCovered: 0,
        totalLines: 0,
        totalFunctions: 0,
        totalBranches: 0,
        uncoveredFiles: [],
      }
    );
  }

  /**
   * Generate performance metrics
   */
  private generatePerformanceMetrics(phases: TestPhaseResult[]): any {
    const totalTests = phases.reduce((acc, phase) => acc + phase.testsRun, 0);
    const totalDuration = phases.reduce(
      (acc, phase) => acc + phase.duration,
      0
    );

    const slowestTests = phases
      .filter((phase) => phase.duration > 1000) // Tests taking more than 1 second
      .map((phase) => ({ name: phase.name, duration: phase.duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      avgTestDuration: totalTests > 0 ? totalDuration / totalTests : 0,
      memoryUsage: {
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed,
      },
      slowestTests,
    };
  }

  /**
   * Generate test reports
   */
  private async generateReports(result: TestSuiteResult): Promise<void> {
    // Generate JSON report
    const jsonReport = {
      ...result,
      timestamp: new Date().toISOString(),
      version: require('../package.json').version,
    };

    writeFileSync(
      join(this.outputDir, 'test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    // Generate HTML report (simplified)
    const htmlReport = this.generateHtmlReport(result);
    writeFileSync(join(this.outputDir, 'test-results.html'), htmlReport);

    // Generate coverage report if available
    if (result.coverageSummary) {
      writeFileSync(
        join(this.outputDir, 'coverage-summary.json'),
        JSON.stringify(result.coverageSummary, null, 2)
      );
    }

    // Generate CI-compatible output
    if (process.env.CI) {
      this.generateCIOutput(result);
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(result: TestSuiteResult): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Carabiner Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .phase { margin: 15px 0; padding: 15px; border-left: 4px solid #ccc; }
        .success { border-left-color: #4CAF50; }
        .failure { border-left-color: #f44336; }
        .stats { display: flex; gap: 20px; }
        .stat { text-align: center; }
        .coverage { background: #e3f2fd; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Carabiner Test Results</h1>
        <p>Environment: ${result.environment}</p>
        <p>Duration: ${result.totalDuration}ms</p>
        <p>Status: ${result.overallSuccess ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>

    <div class="stats">
        <div class="stat">
            <h3>${result.phases.reduce((acc, p) => acc + p.testsRun, 0)}</h3>
            <p>Total Tests</p>
        </div>
        <div class="stat">
            <h3>${result.phases.reduce((acc, p) => acc + p.testsPassed, 0)}</h3>
            <p>Passed</p>
        </div>
        <div class="stat">
            <h3>${result.phases.reduce((acc, p) => acc + p.testsFailed, 0)}</h3>
            <p>Failed</p>
        </div>
    </div>

    ${
      result.coverageSummary
        ? `
    <div class="coverage">
        <h2>📊 Coverage Summary</h2>
        <p>Lines: ${result.coverageSummary.linesCovered.toFixed(2)}%</p>
        <p>Functions: ${result.coverageSummary.functionsCovered.toFixed(2)}%</p>
        <p>Branches: ${result.coverageSummary.branchesCovered.toFixed(2)}%</p>
    </div>
    `
        : ''
    }

    <h2>📋 Test Phases</h2>
    ${result.phases
      .map(
        (phase) => `
    <div class="phase ${phase.success ? 'success' : 'failure'}">
        <h3>${phase.success ? '✅' : '❌'} ${phase.name}</h3>
        <p>Duration: ${phase.duration}ms</p>
        <p>Tests: ${phase.testsPassed}/${phase.testsRun} passed</p>
        ${
          phase.errors.length > 0
            ? `
        <details>
            <summary>Errors (${phase.errors.length})</summary>
            <pre>${phase.errors.join('\n')}</pre>
        </details>
        `
            : ''
        }
    </div>
    `
      )
      .join('')}
</body>
</html>
    `;
  }

  /**
   * Generate CI-compatible output
   */
  private generateCIOutput(result: TestSuiteResult): void {
    // Generate GitHub Actions annotations
    if (process.env.GITHUB_ACTIONS) {
      result.phases.forEach((phase) => {
        if (!phase.success) {
        }
      });

      if (result.coverageSummary) {
      }
    }

    // Generate JUnit XML for CI systems
    const junit = this.generateJUnitXML(result);
    writeFileSync(join(this.outputDir, 'junit.xml'), junit);
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitXML(result: TestSuiteResult): string {
    const totalTests = result.phases.reduce((acc, p) => acc + p.testsRun, 0);
    const totalFailures = result.phases.reduce(
      (acc, p) => acc + p.testsFailed,
      0
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Carabiner Tests" tests="${totalTests}" failures="${totalFailures}" time="${result.totalDuration / 1000}">
  ${result.phases
    .map(
      (phase) => `
  <testsuite name="${phase.name}" tests="${phase.testsRun}" failures="${phase.testsFailed}" time="${phase.duration / 1000}">
    ${phase.success ? '<testcase name="Phase Execution" />' : `<testcase name="Phase Execution"><failure message="${phase.errors.join('; ')}" /></testcase>`}
  </testsuite>
  `
    )
    .join('')}
</testsuites>`;
  }

  /**
   * Print execution summary
   */
  private printSummary(result: TestSuiteResult): void {
    result.phases.forEach((phase) => {
      const _status = phase.success ? '✅' : '❌';
    });

    if (result.coverageSummary) {
    }

    if (result.performanceMetrics?.slowestTests.length) {
      result.performanceMetrics.slowestTests.slice(0, 5).forEach((_test) => {});
    }
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const options: TestExecutionOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--coverage':
        options.coverage = true;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--performance':
        options.performance = true;
        break;
      case '--production':
        options.production = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--categories':
        options.categories = args[++i]?.split(',');
        break;
      case '--help':
        process.exit(0);
        break;
    }
  }

  const runner = new ComprehensiveTestRunner(options);

  try {
    const result = await runner.run();
    process.exit(result.overallSuccess ? 0 : 1);
  } catch (_error) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error);
}

export { ComprehensiveTestRunner, type TestExecutionOptions };
