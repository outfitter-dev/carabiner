/**
 * @file rules/injection.ts
 * @description Injection vulnerability detection rules
 */

import type { SecurityRule } from '../types/index.js';

/**
 * Security rules for detecting injection vulnerabilities
 */
export const injectionRules: SecurityRule[] = [
  {
    id: 'command-injection-bash',
    name: 'Potential Command Injection',
    pattern: '(system|exec|shell_exec|passthru|popen)\\s*\\([^)]*\\$',
    flags: 'gi',
    severity: 'high',
    category: 'injection',
    description: 'Potential command injection vulnerability',
    remediation: 'Sanitize input and use parameterized commands',
  },
  {
    id: 'sql-injection',
    name: 'Potential SQL Injection',
    pattern: '(select|insert|update|delete|drop|create).*\\+.*["\']',
    flags: 'gi',
    severity: 'high',
    category: 'injection',
    description: 'Potential SQL injection vulnerability',
    remediation: 'Use parameterized queries or prepared statements',
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal',
    pattern: '\\.\\./|\\.\\.\\\\ ',
    severity: 'high',
    category: 'path-traversal',
    description: 'Potential path traversal vulnerability',
    remediation: 'Validate and sanitize file paths',
  },
];
