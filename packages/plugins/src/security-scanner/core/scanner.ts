/**
 * @file core/scanner.ts
 * @description Main security scanning orchestration
 */

import type { SecurityFinding, SecurityRule, ScanResult } from '../types/index.js';
import type { ToolInput } from '../analyzers/tool-analyzer.js';
import { SecurityScannerConfigManager } from './config.js';
import { SecurityReporter } from './reporter.js';
import { ruleRegistry } from '../rules/index.js';
import { analyzeCommand } from '../analyzers/command-analyzer.js';
import { analyzeFileContent, exceedsSizeLimit } from '../analyzers/file-analyzer.js';
import {
  extractWriteContent,
  extractEditContent,
  extractMultiEditContent,
  extractBashCommand,
} from '../analyzers/tool-analyzer.js';

/**
 * Main security scanner orchestrator
 */
export class SecurityScanner {
  private configManager: SecurityScannerConfigManager;
  private reporter: SecurityReporter;
  private rules: SecurityRule[];

  constructor(config: Record<string, unknown> = {}) {
    this.configManager = new SecurityScannerConfigManager(config);
    this.reporter = new SecurityReporter();
    this.rules = ruleRegistry.combineWithCustomRules(
      this.configManager.getCustomRules()
    );
  }

  /**
   * Scan bash command for security issues
   */
  async scanCommand(command: string): Promise<ScanResult> {
    if (!this.configManager.shouldScanCommands()) {
      return { findings: [], scanned: false };
    }

    const findings = analyzeCommand(command, this.rules);
    return { findings, scanned: true };
  }

  /**
   * Scan file content for security issues
   */
  async scanFileContent(
    content: string,
    filePath: string
  ): Promise<ScanResult> {
    if (!this.configManager.shouldScanFiles()) {
      return { findings: [], scanned: false };
    }

    const fileCheck = this.configManager.shouldScanFile(filePath);
    if (!fileCheck.shouldScan) {
      return {
        findings: [],
        scanned: false,
        skipped: true,
        skipReason: fileCheck.reason,
      };
    }

    if (exceedsSizeLimit(content, this.configManager.getMaxFileSize())) {
      return {
        findings: [],
        scanned: false,
        skipped: true,
        skipReason: 'File too large',
      };
    }

    const findings = analyzeFileContent(
      content,
      filePath,
      this.rules,
      this.configManager.getConfig()
    );

    return { findings, scanned: true };
  }

  /**
   * Scan tool usage for security issues
   */
  async scanTool(
    toolName: string,
    toolInput: ToolInput
  ): Promise<ScanResult> {
    let findings: SecurityFinding[] = [];

    if (toolName === 'Bash') {
      const command = extractBashCommand(toolInput);
      if (command) {
        const result = await this.scanCommand(command);
        findings = result.findings;
      }
    } else if (['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      const filePath = toolInput.file_path;
      if (filePath) {
        let content = '';

        if (toolName === 'Write') {
          content = extractWriteContent(toolInput);
        } else if (toolName === 'Edit') {
          content = await extractEditContent(toolInput, filePath);
        } else if (toolName === 'MultiEdit') {
          content = await extractMultiEditContent(toolInput, filePath);
        }

        if (content) {
          const result = await this.scanFileContent(content, filePath);
          if (result.skipped) {
            return result;
          }
          findings = result.findings;
        }
      }
    }

    return { findings, scanned: true };
  }

  /**
   * Generate scan report
   */
  generateReport(scanResult: ScanResult) {
    const { findings } = scanResult;
    const config = this.configManager.getConfig();
    const blockingConfig = this.configManager.getBlockingConfig();

    if (findings.length === 0) {
      return {
        success: true,
        message: 'No security issues detected',
        metadata: { scanned: true, findings: [] },
      };
    }

    if (this.configManager.shouldLogFindings()) {
      this.reporter.logFindings(findings);
    }

    const blocked = this.reporter.shouldBlock(
      findings,
      blockingConfig.blockOnCritical,
      blockingConfig.blockOnHigh
    );

    return {
      success: !blocked,
      block: blocked,
      message: this.reporter.generateMessage(findings, blocked),
      metadata: this.reporter.generateMetadata(findings, blocked),
    };
  }
}