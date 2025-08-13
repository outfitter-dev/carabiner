/**
 * @file types/rules.ts
 * @description Security rule types and interfaces
 */

import type { Severity } from './findings.js';

/**
 * Security rule interface
 */
export interface SecurityRule {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  category: string;
  description: string;
  remediation?: string;
  flags?: string;
  fileTypes?: string[];
}

/**
 * Rule category for grouping rules
 */
export type RuleCategory =
  | 'secrets'
  | 'injection'
  | 'dangerous-commands'
  | 'configuration'
  | 'network'
  | 'cryptography'
  | 'path-traversal';

/**
 * Rule execution context
 */
export interface RuleContext {
  content: string;
  filePath?: string;
  fileExtension?: string;
  isCommand?: boolean;
}
