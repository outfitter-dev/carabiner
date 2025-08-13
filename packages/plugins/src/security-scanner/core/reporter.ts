/**
 * @file core/reporter.ts
 * @description Security finding reporting and formatting
 */

import type { SecurityFinding } from '../types/index.js';

/**
 * Security finding reporter
 */
export class SecurityReporter {
  /**
   * Format findings summary for display
   */
  formatFindings(findings: SecurityFinding[]): string {
    if (findings.length === 0) {
      return 'No security issues found';
    }

    const critical = findings.filter((f) => f.severity === 'critical').length;
    const high = findings.filter((f) => f.severity === 'high').length;
    const medium = findings.filter((f) => f.severity === 'medium').length;

    let summary = `Found ${findings.length} security issue(s)`;
    if (critical > 0) {
      summary += `, ${critical} critical`;
    }
    if (high > 0) {
      summary += `, ${high} high`;
    }
    if (medium > 0) {
      summary += `, ${medium} medium`;
    }

    return summary;
  }

  /**
   * Log findings to console
   */
  logFindings(findings: SecurityFinding[]): void {
    if (findings.length === 0) {
      return;
    }

    console.warn(`[SecurityScanner] ${this.formatFindings(findings)}`);

    for (const finding of findings) {
      this.logSingleFinding(finding);
    }
  }

  /**
   * Log a single finding to console
   */
  private logSingleFinding(finding: SecurityFinding): void {
    console.warn(`  ${finding.severity.toUpperCase()}: ${finding.title}`);
    console.warn(`    ${finding.description}`);

    if (finding.line) {
      console.warn(
        `    Location: line ${finding.line}, column ${finding.column}`
      );
    }

    console.warn(`    Matched: "${finding.matched}"`);

    if (finding.remediation) {
      console.warn(`    Fix: ${finding.remediation}`);
    }
  }

  /**
   * Check if operation should be blocked based on findings
   */
  shouldBlock(
    findings: SecurityFinding[],
    blockOnCritical: boolean,
    blockOnHigh: boolean
  ): boolean {
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const highFindings = findings.filter((f) => f.severity === 'high');

    return (
      (blockOnCritical && criticalFindings.length > 0) ||
      (blockOnHigh && highFindings.length > 0)
    );
  }

  /**
   * Generate metadata for findings
   */
  generateMetadata(findings: SecurityFinding[], blocked: boolean) {
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    const highFindings = findings.filter((f) => f.severity === 'high');

    return {
      findings: findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
        category: f.category,
        line: f.line,
        column: f.column,
      })),
      totalFindings: findings.length,
      criticalFindings: criticalFindings.length,
      highFindings: highFindings.length,
      blocked,
    };
  }

  /**
   * Generate result message
   */
  generateMessage(findings: SecurityFinding[], blocked: boolean): string {
    const summary = this.formatFindings(findings);

    if (blocked) {
      return `🔒 Security issues found - operation blocked: ${summary}`;
    }
    return `⚠️  Security issues found: ${summary}`;
  }
}
