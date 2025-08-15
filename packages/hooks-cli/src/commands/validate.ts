/**
 * Validate command - Validates hook configuration and files
 */

import { BaseCommand, type CliConfig } from '../types';
import { configurationValidator, hookFileValidator } from '../validation-utils';

/**
 * Report validation results to console
 */
function reportValidationResults(
  report: import('../validation-types').ValidationReport,
  verbose: boolean
): void {
  if (verbose) {
    process.stdout.write(`Validation Summary:
- Errors: ${report.summary.totalErrors}
- Warnings: ${report.summary.totalWarnings}
- Checked Files: ${report.summary.checkedFiles}
- Validated Hooks: ${report.summary.validatedHooks}\n`);
  }

  // Report errors
  for (const error of report.errors) {
    process.stderr.write(`❌ ${error.type.toUpperCase()}: ${error.message}\n`);
    process.stderr.write(`   Path: ${error.path}\n`);
    if (error.suggestion) {
      process.stderr.write(`   Suggestion: ${error.suggestion}\n`);
    }
  }

  // Report warnings if verbose
  if (verbose && report.warnings.length > 0) {
    for (const warning of report.warnings) {
      process.stderr.write(
        `⚠️  ${warning.type.toUpperCase()}: ${warning.message}\n`
      );
      process.stderr.write(`   Path: ${warning.path}\n`);
      if (warning.recommendation) {
        process.stderr.write(`   Recommendation: ${warning.recommendation}\n`);
      }
    }
  }
}

/**
 * Validation options parsed from command line arguments
 */
type ValidationOptions = {
  validateConfig: boolean;
  validateHooks: boolean;
  autoFix: boolean;
  verbose: boolean;
};

/**
 * Combined validation results from both config and hooks validation
 */
type CombinedValidationResults = {
  configReport: import('../validation-types').ValidationReport | null;
  hooksReport: import('../validation-types').ValidationReport | null;
  hasErrors: boolean;
};

export class ValidateCommand extends BaseCommand {
  name = 'validate';
  description = 'Validate hook configuration and files';
  usage = 'validate [options]';
  options = {
    '--config, -c': 'Validate configuration only',
    '--hooks, -k': 'Validate hook files only',
    '--fix': 'Automatically fix issues where possible',
    '--verbose, -v': 'Show detailed validation output',
    '--help, -h': 'Show help',
  };

  async execute(args: string[], config: CliConfig): Promise<void> {
    const { values } = this.parseArgs(args, {
      help: { type: 'boolean', short: 'h' },
      config: { type: 'boolean', short: 'c' },
      hooks: { type: 'boolean', short: 'k' },
      fix: { type: 'boolean' },
      verbose: { type: 'boolean', short: 'v' },
    });

    if (values.help) {
      this.showHelp();
      return;
    }

    const options = this.parseValidationOptions(values, config);

    try {
      const results = await this.performValidation(
        options,
        config.workspacePath
      );
      this.handleValidationResults(results, options);
    } catch (error) {
      const message = `Validation failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(message, { cause: error as unknown });
    }
  }

  /**
   * Parse command line values into validation options
   */
  private parseValidationOptions(
    values: Record<string, unknown>,
    config: CliConfig
  ): ValidationOptions {
    return {
      validateConfig: !this.getBooleanValue(
        values.hooks as string | boolean | undefined
      ),
      validateHooks: !this.getBooleanValue(
        values.config as string | boolean | undefined
      ),
      autoFix: this.getBooleanValue(values.fix as string | boolean | undefined),
      verbose:
        this.getBooleanValue(values.verbose as string | boolean | undefined) ||
        config.verbose,
    };
  }

  /**
   * Execute validation for both configuration and hooks based on options
   */
  private async performValidation(
    options: ValidationOptions,
    workspacePath: string
  ): Promise<CombinedValidationResults> {
    let configReport: import('../validation-types').ValidationReport | null =
      null;
    let hooksReport: import('../validation-types').ValidationReport | null =
      null;
    let hasErrors = false;

    if (options.validateConfig) {
      configReport = await this.validateConfiguration(
        workspacePath,
        options.verbose
      );
      hasErrors = hasErrors || !configReport.configurationValid;
    }

    if (options.validateHooks) {
      hooksReport = await this.validateHookFiles(
        workspacePath,
        options.verbose
      );
      hasErrors = hasErrors || !hooksReport.hookFilesValid;
    }

    return { configReport, hooksReport, hasErrors };
  }

  /**
   * Validate configuration and report results
   */
  private async validateConfiguration(
    workspacePath: string,
    verbose: boolean
  ): Promise<import('../validation-types').ValidationReport> {
    const report =
      await configurationValidator.validateConfiguration(workspacePath);
    reportValidationResults(report, verbose);
    return report;
  }

  /**
   * Validate hook files and report results
   */
  private async validateHookFiles(
    workspacePath: string,
    verbose: boolean
  ): Promise<import('../validation-types').ValidationReport> {
    const report = await hookFileValidator.validateHookFiles(workspacePath);
    reportValidationResults(report, verbose);
    return report;
  }

  /**
   * Handle validation results and determine exit behavior
   */
  private handleValidationResults(
    results: CombinedValidationResults,
    options: ValidationOptions
  ): void {
    if (results.hasErrors) {
      this.handleValidationErrors(results, options.autoFix);
      process.exit(1);
    } else if (options.verbose) {
      process.stdout.write('✅ All validation checks passed.\n');
    }
  }

  /**
   * Handle validation errors and provide appropriate feedback
   */
  private handleValidationErrors(
    results: CombinedValidationResults,
    autoFix: boolean
  ): void {
    if (!autoFix) {
      const fixableErrorCount = this.countFixableErrors(results);
      this.displayErrorGuidance(fixableErrorCount);
    }
  }

  /**
   * Count total number of fixable errors across all reports
   */
  private countFixableErrors(results: CombinedValidationResults): number {
    const configFixable =
      results.configReport?.errors.filter((e) => e.fixable) ?? [];
    const hooksFixable =
      results.hooksReport?.errors.filter((e) => e.fixable) ?? [];
    return configFixable.length + hooksFixable.length;
  }

  /**
   * Display appropriate error guidance based on fixable error count
   */
  private displayErrorGuidance(fixableErrorCount: number): void {
    if (fixableErrorCount > 0) {
      process.stderr.write(
        `Validation found ${fixableErrorCount} fixable issues. Re-run with --fix to attempt automatic remediation.\n`
      );
    } else {
      process.stderr.write(
        'Validation found issues that require manual fixing.\n'
      );
    }
  }

  /**
   * @deprecated These methods have been replaced with type-safe validation utilities in validation-utils.ts
   * The new implementation eliminates `any` types and complex functions by using discriminated unions
   * and composable validation functions.
   */
}
