/**
 * @file rules/commands.ts
 * @description Dangerous command detection rules
 */

import type { SecurityRule } from '../types/index.js';

/**
 * Security rules for detecting dangerous commands
 */
export const commandRules: SecurityRule[] = [
  {
    id: 'dangerous-bash-commands',
    name: 'Dangerous Bash Commands',
    pattern:
      '\\b(rm\\s+-rf\\s+/|dd\\s+if=/dev/zero|:\\(\\)\\{\\||shutdown|halt|reboot)\\b',
    severity: 'high',
    category: 'dangerous-commands',
    description: 'Dangerous system command detected',
    remediation: 'Review and secure dangerous system commands',
  },
];
