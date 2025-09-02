/**
 * @file types/index.ts
 * @description Type exports for security scanner
 */

export type { SecurityScannerConfig } from "./config.js";
export { SecurityScannerConfigSchema } from "./config.js";
export type { ScanResult, SecurityFinding, Severity } from "./findings.js";
export { getSeverityLevel } from "./findings.js";
export type { RuleCategory, RuleContext, SecurityRule } from "./rules.js";
