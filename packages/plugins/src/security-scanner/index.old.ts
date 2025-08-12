/**
 * @file security-scanner/index.ts
 * @description Security scanner plugin - detects potential security issues in code and operations
 *
 * This plugin scans for security vulnerabilities including:
 * - Hardcoded secrets and API keys
 * - Dangerous command patterns
 * - Insecure file operations
 * - Common security anti-patterns
 */

import { readFile } from 'node:fs/promises';
import type { HookContext } from '@outfitter/types';
import { z } from 'zod';
import type { HookPlugin, PluginResult } from '../../../registry/src';

/**
 * Security finding severity levels
 */
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Security finding interface
 */
interface SecurityFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  category: string;
  matched: string;
  line?: number;
  column?: number;
  remediation?: string;
}

/**
 * Security rule interface
 */
interface SecurityRule {
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
 * Security scanner plugin configuration schema
 */
const SecurityScannerConfigSchema = z
  .object({
    /** Whether to scan bash commands */
    scanCommands: z.boolean().default(true),

    /** Whether to scan file contents */
    scanFiles: z.boolean().default(true),

    /** Maximum file size to scan (bytes) */
    maxFileSize: z
      .number()
      .min(0)
      .default(1024 * 1024), // 1MB

    /** File patterns to include in scanning */
    includePatterns: z
      .array(z.string())
      .default([
        '*.js',
        '*.ts',
        '*.jsx',
        '*.tsx',
        '*.py',
        '*.java',
        '*.go',
        '*.php',
        '*.rb',
        '*.rs',
        '*.c',
        '*.cpp',
        '*.h',
        '*.cs',
        '*.json',
        '*.yaml',
        '*.yml',
        '*.xml',
        '*.env',
        '*.config',
        '*.conf',
      ]),

    /** File patterns to exclude from scanning */
    excludePatterns: z
      .array(z.string())
      .default([
        '**/node_modules/**',
        '**/vendor/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '*.min.*',
        '*.bundle.*',
      ]),

    /** Minimum severity level to report */
    minSeverity: z
      .enum(['critical', 'high', 'medium', 'low', 'info'])
      .default('medium'),

    /** Whether to block on critical/high severity findings */
    blockOnCritical: z.boolean().default(true),

    /** Whether to block on high severity findings */
    blockOnHigh: z.boolean().default(false),

    /** Custom security rules */
    customRules: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          pattern: z.string(),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          category: z.string(),
          description: z.string(),
          remediation: z.string().optional(),
          flags: z.string().optional(),
          fileTypes: z.array(z.string()).optional(),
        })
      )
      .default([]),

    /** Whether to log all findings */
    logFindings: z.boolean().default(true),

    /** Whether to include line context in findings */
    includeContext: z.boolean().default(true),

    /** Number of context lines to include around findings */
    contextLines: z.number().min(0).max(10).default(2),
  })
  .default({});

type SecurityScannerConfig = z.infer<typeof SecurityScannerConfigSchema>;

/**
 * Built-in security rules
 */
const BUILT_IN_RULES: SecurityRule[] = [
  // API Keys and Secrets
  {
    id: 'hardcoded-api-key',
    name: 'Hardcoded API Key',
    pattern: '(?i)(api[_-]?key|apikey)\\s*[:=]\\s*["\'][a-zA-Z0-9]{10,}["\']',
    severity: 'critical',
    category: 'secrets',
    description: 'Hardcoded API key detected',
    remediation:
      'Move API keys to environment variables or secure configuration',
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key',
    pattern: 'AKIA[0-9A-Z]{16}',
    severity: 'critical',
    category: 'secrets',
    description: 'AWS Access Key ID detected',
    remediation:
      'Remove AWS credentials and use IAM roles or environment variables',
  },
  {
    id: 'private-key',
    name: 'Private Key',
    pattern: '-----BEGIN [A-Z]+ PRIVATE KEY-----',
    severity: 'critical',
    category: 'secrets',
    description: 'Private key detected',
    remediation: 'Remove private keys from code and store securely',
  },
  {
    id: 'password-hardcoded',
    name: 'Hardcoded Password',
    pattern: '(?i)(password|passwd|pwd)\\s*[:=]\\s*["\'][^"\'\\s]{4,}["\']',
    severity: 'high',
    category: 'secrets',
    description: 'Hardcoded password detected',
    remediation:
      'Use environment variables or secure configuration for passwords',
  },
  {
    id: 'jwt-token',
    name: 'JWT Token',
    pattern: 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
    severity: 'high',
    category: 'secrets',
    description: 'JWT token detected',
    remediation: 'Avoid hardcoding JWT tokens in source code',
  },

  // Command Injection
  {
    id: 'command-injection-bash',
    name: 'Potential Command Injection',
    pattern: '(?i)(system|exec|shell_exec|passthru|popen)\\s*\\([^)]*\\$',
    severity: 'high',
    category: 'injection',
    description: 'Potential command injection vulnerability',
    remediation: 'Sanitize input and use parameterized commands',
  },
  {
    id: 'dangerous-bash-commands',
    name: 'Dangerous Bash Commands',
    pattern:
      '\\b(rm\\s+-rf\\s+/|dd\\s+if=/dev/zero|:(\\){\\||shutdown|halt|reboot)\\b',
    severity: 'high',
    category: 'dangerous-commands',
    description: 'Dangerous system command detected',
    remediation: 'Review and secure dangerous system commands',
  },

  // SQL Injection
  {
    id: 'sql-injection',
    name: 'Potential SQL Injection',
    pattern: '(?i)(select|insert|update|delete|drop|create).*\\+.*["\']',
    severity: 'high',
    category: 'injection',
    description: 'Potential SQL injection vulnerability',
    remediation: 'Use parameterized queries or prepared statements',
  },

  // Insecure Configurations
  {
    id: 'debug-mode',
    name: 'Debug Mode Enabled',
    pattern: '(?i)(debug|DEBUG)\\s*[:=]\\s*(true|True|TRUE|1)',
    severity: 'medium',
    category: 'configuration',
    description: 'Debug mode enabled in configuration',
    remediation: 'Disable debug mode in production environments',
  },
  {
    id: 'insecure-http',
    name: 'Insecure HTTP URL',
    pattern: 'http://[^\\s"\'<>]+',
    severity: 'low',
    category: 'network',
    description: 'Insecure HTTP URL detected',
    remediation: 'Use HTTPS URLs for secure communication',
    fileTypes: ['js', 'ts', 'py', 'java', 'go', 'php'],
  },

  // Crypto Issues
  {
    id: 'weak-crypto',
    name: 'Weak Cryptographic Algorithm',
    pattern: '(?i)\\b(md5|sha1|des|rc4)\\b',
    severity: 'medium',
    category: 'cryptography',
    description: 'Weak cryptographic algorithm detected',
    remediation: 'Use stronger cryptographic algorithms like SHA-256 or AES',
  },

  // File System Issues
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

/**
 * Get severity level numeric value for comparison
 */
function getSeverityLevel(severity: Severity): number {
  const levels = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
  return levels[severity] || 0;
}

/**
 * Check if file matches patterns
 */
function matchesPatterns(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
    );
    return regex.test(filePath);
  });
}

/**
 * Extract file extension from path
 */
function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Scan content for security issues
 */
function scanContent(
  content: string,
  filePath: string,
  rules: SecurityRule[],
  config: SecurityScannerConfig
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const _lines = content.split('\n');
  const fileExt = getFileExtension(filePath);

  for (const rule of rules) {
    // Skip rule if it doesn't apply to this file type
    if (
      rule.fileTypes &&
      rule.fileTypes.length > 0 &&
      !rule.fileTypes.includes(fileExt)
    ) {
      continue;
    }

    // Skip if severity is below minimum
    if (
      getSeverityLevel(rule.severity) < getSeverityLevel(config.minSeverity)
    ) {
      continue;
    }

    try {
      const flags = rule.flags || 'gm';
      const regex = new RegExp(rule.pattern, flags);

      let match: RegExpExecArray | null = regex.exec(content);
      while (match !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const columnNumber = beforeMatch.split('\n').pop()?.length || 0;

        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.name,
          description: rule.description,
          category: rule.category,
          matched: match[0],
          line: lineNumber,
          column: columnNumber,
          remediation: rule.remediation,
        });

        // Prevent infinite loops with global regex
        if (!flags.includes('g')) {
          break;
        }

        match = regex.exec(content);
      }
    } catch (error) {
      console.warn(
        `[SecurityScanner] Invalid regex in rule ${rule.id}:`,
        error
      );
    }
  }

  return findings;
}

/**
 * Scan bash command for security issues
 */
function scanCommand(
  command: string,
  rules: SecurityRule[]
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const rule of rules) {
    if (
      rule.category !== 'dangerous-commands' &&
      rule.category !== 'injection'
    ) {
      continue;
    }

    try {
      const regex = new RegExp(rule.pattern, rule.flags || 'gi');
      const match = regex.exec(command);

      if (match) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.name,
          description: rule.description,
          category: rule.category,
          matched: match[0],
          remediation: rule.remediation,
        });
      }
    } catch (error) {
      console.warn(
        `[SecurityScanner] Invalid regex in rule ${rule.id}:`,
        error
      );
    }
  }

  return findings;
}

/**
 * Format findings for display
 */
function formatFindings(findings: SecurityFinding[]): string {
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
 * Security Scanner Plugin
 *
 * Scans code and commands for potential security vulnerabilities including:
 * - Hardcoded secrets and API keys
 * - Command injection vulnerabilities
 * - SQL injection patterns
 * - Weak cryptography usage
 * - Insecure configurations
 * - Path traversal vulnerabilities
 *
 * @example Basic Configuration
 * ```typescript
 * {
 *   "security-scanner": {
 *     "scanCommands": true,
 *     "scanFiles": true,
 *     "minSeverity": "medium",
 *     "blockOnCritical": true
 *   }
 * }
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * {
 *   "security-scanner": {
 *     "scanCommands": true,
 *     "scanFiles": true,
 *     "maxFileSize": 2097152,
 *     "includePatterns": ["*.js", "*.ts", "*.py"],
 *     "minSeverity": "low",
 *     "blockOnCritical": true,
 *     "blockOnHigh": true,
 *     "customRules": [
 *       {
 *         "id": "custom-secret",
 *         "name": "Company API Key",
 *         "pattern": "COMPANY_[A-Z0-9]{32}",
 *         "severity": "critical",
 *         "category": "secrets",
 *         "description": "Company API key detected"
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export const securityScannerPlugin: HookPlugin = {
  name: 'security-scanner',
  version: '1.0.0',
  description: 'Scans for security vulnerabilities in code and operations',
  author: 'Outfitter Team',

  events: ['PreToolUse'],
  tools: ['Bash', 'Write', 'Edit', 'MultiEdit'],
  priority: 85, // High priority to catch issues early

  configSchema: SecurityScannerConfigSchema,
  defaultConfig: {},

  async apply(
    context: HookContext,
    config: Record<string, unknown> = {}
  ): Promise<PluginResult> {
    // Only handle specific tools
    if (context.event !== 'PreToolUse' || !('toolName' in context)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    const toolName = context.toolName;
    if (!['Bash', 'Write', 'Edit', 'MultiEdit'].includes(toolName)) {
      return {
        success: true,
        pluginName: this.name,
        pluginVersion: this.version,
      };
    }

    // Parse configuration
    const scannerConfig = SecurityScannerConfigSchema.parse(config);

    // Combine built-in and custom rules
    const allRules = [...BUILT_IN_RULES, ...scannerConfig.customRules];
    const findings: SecurityFinding[] = [];

    const toolContext = context as HookContext & {
      toolInput: Record<string, unknown>;
    };
    const toolInput = toolContext.toolInput;

    try {
      if (toolName === 'Bash' && scannerConfig.scanCommands) {
        // Scan bash command
        const command = toolInput?.command as string;
        if (command) {
          const commandFindings = scanCommand(command, allRules);
          findings.push(...commandFindings);
        }
      } else if (
        ['Write', 'Edit', 'MultiEdit'].includes(toolName) &&
        scannerConfig.scanFiles
      ) {
        // Scan file content
        const filePath = toolInput?.file_path as string;
        if (filePath) {
          // Check if file should be scanned
          if (
            scannerConfig.includePatterns.length > 0 &&
            !matchesPatterns(filePath, scannerConfig.includePatterns)
          ) {
            return {
              success: true,
              pluginName: this.name,
              pluginVersion: this.version,
              metadata: {
                skipped: true,
                reason: 'File not in include patterns',
              },
            };
          }

          if (matchesPatterns(filePath, scannerConfig.excludePatterns)) {
            return {
              success: true,
              pluginName: this.name,
              pluginVersion: this.version,
              metadata: {
                skipped: true,
                reason: 'File matches exclude pattern',
              },
            };
          }

          let content = '';

          if (toolName === 'Write') {
            // Scan content being written
            content = (toolInput?.content as string) || '';
          } else if (toolName === 'Edit' || toolName === 'MultiEdit') {
            // For edits, try to read existing file to scan full content
            try {
              const existingContent = await readFile(filePath, 'utf-8');

              if (toolName === 'Edit') {
                // Apply edit to get final content
                const oldString = toolInput?.old_string as string;
                const newString = toolInput?.new_string as string;
                const replaceAll = toolInput?.replace_all as boolean;

                if (oldString && newString !== undefined) {
                  if (replaceAll) {
                    content = existingContent.replaceAll(oldString, newString);
                  } else {
                    content = existingContent.replace(oldString, newString);
                  }
                } else {
                  content = existingContent;
                }
              } else {
                // For MultiEdit, just scan existing content
                // (would need more complex logic to simulate all edits)
                content = existingContent;
              }
            } catch (_error) {
              // File doesn't exist or can't be read - use new content if available
              content = (toolInput?.content as string) || '';
            }
          }

          if (content) {
            // Check file size limit
            if (content.length > scannerConfig.maxFileSize) {
              return {
                success: true,
                pluginName: this.name,
                pluginVersion: this.version,
                message: `File too large to scan (${content.length} > ${scannerConfig.maxFileSize} bytes)`,
                metadata: { skipped: true, reason: 'File too large' },
              };
            }

            const fileFindings = scanContent(
              content,
              filePath,
              allRules,
              scannerConfig
            );
            findings.push(...fileFindings);
          }
        }
      }

      // Process findings
      if (findings.length === 0) {
        return {
          success: true,
          pluginName: this.name,
          pluginVersion: this.version,
          message: 'No security issues detected',
          metadata: { scanned: true, findings: [] },
        };
      }

      // Log findings
      if (scannerConfig.logFindings) {
        console.warn(`[SecurityScanner] ${formatFindings(findings)}`);

        for (const finding of findings) {
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
      }

      // Determine if should block
      const criticalFindings = findings.filter(
        (f) => f.severity === 'critical'
      );
      const highFindings = findings.filter((f) => f.severity === 'high');

      const shouldBlock =
        (scannerConfig.blockOnCritical && criticalFindings.length > 0) ||
        (scannerConfig.blockOnHigh && highFindings.length > 0);

      return {
        success: !shouldBlock,
        block: shouldBlock,
        pluginName: this.name,
        pluginVersion: this.version,
        message: shouldBlock
          ? `🔒 Security issues found - operation blocked: ${formatFindings(findings)}`
          : `⚠️  Security issues found: ${formatFindings(findings)}`,
        metadata: {
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
          blocked: shouldBlock,
        },
      };
    } catch (error) {
      return {
        success: false,
        pluginName: this.name,
        pluginVersion: this.version,
        message: `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  /**
   * Initialize with rule validation
   */
  async init(): Promise<void> {
    console.log(
      `[SecurityScanner] Initialized with ${BUILT_IN_RULES.length} built-in security rules`
    );
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return true;
  },

  metadata: {
    name: 'security-scanner',
    version: '1.0.0',
    description: 'Scans for security vulnerabilities in code and operations',
    author: 'Outfitter Team',
    keywords: ['security', 'vulnerability', 'scanner', 'secrets', 'injection'],
    license: 'MIT',
  },
};

export default securityScannerPlugin;
