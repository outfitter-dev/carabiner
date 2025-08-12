/**
 * @file types/index.ts
 * @description Type exports for security scanner
 */

export type { Severity, SecurityFinding, ScanResult } from './findings.js';
export { getSeverityLevel } from './findings.js';

export type { SecurityRule, RuleCategory, RuleContext } from './rules.js';

export type { SecurityScannerConfig } from './config.js';
export { SecurityScannerConfigSchema } from './config.js';