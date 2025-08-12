/**
 * @file core/config.ts
 * @description Configuration management for security scanner
 */

import type { SecurityScannerConfig } from '../types/index.js';
import { SecurityScannerConfigSchema } from '../types/index.js';
import { matchesPatterns } from '../matchers/pattern-matcher.js';

/**
 * Configuration manager for security scanner
 */
export class SecurityScannerConfigManager {
  private config: SecurityScannerConfig;

  constructor(config: Record<string, unknown> = {}) {
    this.config = SecurityScannerConfigSchema.parse(config);
  }

  /**
   * Get the parsed configuration
   */
  getConfig(): SecurityScannerConfig {
    return this.config;
  }

  /**
   * Check if file should be scanned based on include/exclude patterns
   */
  shouldScanFile(filePath: string): { 
    shouldScan: boolean; 
    reason?: string 
  } {
    // Check include patterns
    if (
      this.config.includePatterns.length > 0 &&
      !matchesPatterns(filePath, this.config.includePatterns)
    ) {
      return {
        shouldScan: false,
        reason: 'File not in include patterns'
      };
    }

    // Check exclude patterns
    if (matchesPatterns(filePath, this.config.excludePatterns)) {
      return {
        shouldScan: false,
        reason: 'File matches exclude pattern'
      };
    }

    return { shouldScan: true };
  }

  /**
   * Check if commands should be scanned
   */
  shouldScanCommands(): boolean {
    return this.config.scanCommands;
  }

  /**
   * Check if files should be scanned
   */
  shouldScanFiles(): boolean {
    return this.config.scanFiles;
  }

  /**
   * Get maximum file size limit
   */
  getMaxFileSize(): number {
    return this.config.maxFileSize;
  }

  /**
   * Check if findings should be logged
   */
  shouldLogFindings(): boolean {
    return this.config.logFindings;
  }

  /**
   * Get custom rules
   */
  getCustomRules() {
    return this.config.customRules;
  }

  /**
   * Check blocking configuration
   */
  getBlockingConfig(): {
    blockOnCritical: boolean;
    blockOnHigh: boolean;
  } {
    return {
      blockOnCritical: this.config.blockOnCritical,
      blockOnHigh: this.config.blockOnHigh,
    };
  }
}