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
import type { HookPlugin, PluginResult } from '@outfitter/registry';
import type { HookContext } from '@outfitter/types';
import { z } from 'zod';

/**
 * Security finding severity levels
 */
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Security finding interface
 */
type SecurityFinding = {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  category: string;
  matched: string;
  line?: number;
  column?: number;
  remediation?: string;
};

/**
 * Security rule interface
 */
type SecurityRule = {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  category: string;
  description: string;
  remediation?: string;
  flags?: string;
  fileTypes?: string[];
};

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
        '*.pem',
        '*.key',
        '*.crt',
        '*.cert',
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
    blockOnHigh: z.boolean().default(true),

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
    pattern: '(api[_-]?key|apikey)\\s*[:=]\\s*["\'][a-zA-Z0-9-_]{10,}["\']',
    severity: 'critical',
    category: 'secrets',
    description: 'Hardcoded API key detected',
    remediation:
      'Move API keys to environment variables or secure configuration',
    flags: 'gi',
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
    flags: 'gi',
  },
  {
    id: 'private-key',
    name: 'Private Key',
    pattern: '-----BEGIN [A-Z]+ PRIVATE KEY-----',
    severity: 'critical',
    category: 'secrets',
    description: 'Private key detected',
    remediation: 'Remove private keys from code and store securely',
    flags: 'gi',
  },
  {
    id: 'password-hardcoded',
    name: 'Hardcoded Password',
    pattern: '(password|passwd|pwd)\\s*[:=]\\s*["\'][^"\'\\s]{4,}["\']',
    severity: 'high',
    category: 'secrets',
    description: 'Hardcoded password detected',
    remediation:
      'Use environment variables or secure configuration for passwords',
    flags: 'gi',
  },
  {
    id: 'jwt-token',
    name: 'JWT Token',
    pattern: 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
    severity: 'high',
    category: 'secrets',
    description: 'JWT token detected',
    remediation: 'Avoid hardcoding JWT tokens in source code',
    flags: 'gi',
  },

  // Command Injection
  {
    id: 'command-injection-bash',
    name: 'Potential Command Injection',
    pattern: '(system|exec|shell_exec|passthru|popen)\\s*\\([^)]*\\$',
    severity: 'high',
    category: 'injection',
    description: 'Potential command injection vulnerability',
    remediation: 'Sanitize input and use parameterized commands',
    flags: 'gi',
  },
  {
    id: 'dangerous-bash-commands',
    name: 'Dangerous Bash Commands',
    pattern:
      '(rm\\s+-rf\\s+/|dd\\s+if=/dev/zero|shutdown|halt|reboot|chmod\\s+777)',
    severity: 'high',
    category: 'dangerous-commands',
    description: 'Dangerous system command detected',
    remediation: 'Review and secure dangerous system commands',
    flags: 'gi',
  },

  // SQL Injection
  {
    id: 'sql-injection',
    name: 'Potential SQL Injection',
    pattern: '(select|insert|update|delete|drop|create).*\\+.*["\']',
    severity: 'high',
    category: 'injection',
    description: 'Potential SQL injection vulnerability',
    remediation: 'Use parameterized queries or prepared statements',
    flags: 'gi',
  },

  // Insecure Configurations
  {
    id: 'debug-mode',
    name: 'Debug Mode Enabled',
    pattern: '(debug)\\s*[:=]\\s*(true|1)',
    severity: 'medium',
    category: 'configuration',
    description: 'Debug mode enabled in configuration',
    remediation: 'Disable debug mode in production environments',
    flags: 'gi',
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
    flags: 'gi',
  },

  // Crypto Issues
  {
    id: 'weak-crypto',
    name: 'Weak Cryptographic Algorithm',
    pattern: '\\b(md5|sha1|des|rc4)\\b',
    severity: 'medium',
    category: 'cryptography',
    description: 'Weak cryptographic algorithm detected',
    remediation: 'Use stronger cryptographic algorithms like SHA-256 or AES',
    flags: 'gi',
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
    flags: 'gi',
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
  // Extract just the filename from the path for pattern matching
  const fileName = filePath.split('/').pop() || filePath;

  return patterns.some((pattern) => {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
      'i'
    );
    return regex.test(fileName);
  });
}

/**
 * Extract file extension from path
 */
function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() || '';
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
  // const lines = content.split('\n'); // Available for future line-specific analysis
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
    } catch (_error) {}
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
    } catch (_error) {}
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

// Helper functions that operate on plugin context

/**
 * Validate if context is applicable for security scanning
 */
function isValidContext(context: HookContext): boolean {
  if (context.event !== 'PreToolUse' || !('toolName' in context)) {
    return false;
  }

  const toolName = context.toolName;
  return ['Bash', 'Write', 'Edit', 'MultiEdit'].includes(toolName);
}

/**
 * Create a success result with plugin metadata
 */
function createSuccessResult(
  pluginName: string,
  pluginVersion: string,
  metadata?: Record<string, unknown>
): PluginResult {
  return {
    success: true,
    pluginName,
    pluginVersion,
    ...(metadata && { metadata }),
  };
}

/**
 * Create an error result
 */
function createErrorResult(
  pluginName: string,
  pluginVersion: string,
  error: unknown
): PluginResult {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return {
    success: false,
    pluginName,
    pluginVersion,
    message: `Security scan failed: ${errorMessage}`,
    metadata: { error: errorMessage },
  };
}

/**
 * Check if file should be scanned based on patterns
 */
function shouldScanFile(
  filePath: string,
  config: SecurityScannerConfig,
  pluginName: string,
  pluginVersion: string
): PluginResult | null {
  // Check include patterns
  if (
    config.includePatterns.length > 0 &&
    !matchesPatterns(filePath, config.includePatterns)
  ) {
    return createSuccessResult(pluginName, pluginVersion, {
      skipped: true,
      reason: 'File not in include patterns',
    });
  }

  // Check exclude patterns
  if (matchesPatterns(filePath, config.excludePatterns)) {
    return createSuccessResult(pluginName, pluginVersion, {
      skipped: true,
      reason: 'File matches exclude pattern',
    });
  }

  return null; // Should scan
}

/**
 * Get content for Edit tool operations
 */
async function getEditContent(
  filePath: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    const existingContent = await readFile(filePath, 'utf-8');
    const oldString = toolInput?.old_string as string;
    const newString = toolInput?.new_string as string;
    const replaceAll = toolInput?.replace_all as boolean;

    if (oldString && newString !== undefined) {
      return replaceAll
        ? existingContent.replaceAll(oldString, newString)
        : existingContent.replace(oldString, newString);
    }

    return existingContent;
  } catch (_error) {
    // File doesn't exist or can't be read - use new content if available
    return (toolInput?.content as string) || '';
  }
}

/**
 * Get content to scan based on tool type
 */
async function getContentToScan(
  toolName: string,
  filePath: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  if (toolName === 'Write') {
    return (toolInput?.content as string) || '';
  }

  if (toolName === 'Edit') {
    return getEditContent(filePath, toolInput);
  }

  if (toolName === 'MultiEdit') {
    // For MultiEdit, scan existing content (complex edit simulation not implemented)
    try {
      return await readFile(filePath, 'utf-8');
    } catch (_error) {
      return (toolInput?.content as string) || '';
    }
  }

  return '';
}

/**
 * Scan bash command for security issues
 */
function scanBashCommand(
  toolInput: Record<string, unknown>,
  rules: SecurityRule[]
): SecurityFinding[] {
  const command = toolInput?.command as string;
  return command ? scanCommand(command, rules) : [];
}

/**
 * Scan file operation for security issues
 */
async function scanFileOperation(
  toolName: string,
  toolInput: Record<string, unknown>,
  rules: SecurityRule[],
  config: SecurityScannerConfig,
  pluginName: string,
  pluginVersion: string
): Promise<SecurityFinding[] | PluginResult> {
  const filePath = toolInput?.file_path as string;
  if (!filePath) {
    return [];
  }

  // Check if file should be scanned
  const skipResult = shouldScanFile(
    filePath,
    config,
    pluginName,
    pluginVersion
  );
  if (skipResult) {
    return skipResult; // Return skip result directly
  }

  const content = await getContentToScan(toolName, filePath, toolInput);
  if (!content) {
    return [];
  }

  // Check file size limit
  if (content.length > config.maxFileSize) {
    return {
      success: true,
      pluginName,
      pluginVersion,
      message: `File too large to scan (${content.length} > ${config.maxFileSize} bytes)`,
      metadata: { skipped: true, reason: 'File too large' },
    };
  }

  return scanContent(content, filePath, rules, config);
}

/**
 * Scan for security issues based on tool type
 */
async function scanForSecurityIssues(
  context: HookContext,
  config: SecurityScannerConfig,
  rules: SecurityRule[],
  pluginName: string,
  pluginVersion: string
): Promise<SecurityFinding[] | PluginResult> {
  const toolContext = context as HookContext & {
    toolInput: Record<string, unknown>;
  };
  const toolName = 'toolName' in context ? context.toolName : undefined;
  const { toolInput } = toolContext;

  // Handle bash commands
  if (toolName === 'Bash' && config.scanCommands) {
    return scanBashCommand(toolInput, rules);
  }

  // Handle file operations
  if (
    toolName &&
    ['Write', 'Edit', 'MultiEdit'].includes(toolName) &&
    config.scanFiles
  ) {
    return scanFileOperation(
      toolName,
      toolInput,
      rules,
      config,
      pluginName,
      pluginVersion
    );
  }

  return [];
}

/**
 * Log security findings to console
 */
function logFindings(findings: SecurityFinding[]): void {
  for (const finding of findings) {
    if (finding.line) {
    }
    if (finding.remediation) {
    }
  }
}

/**
 * Determine if findings should block the operation
 */
function shouldBlockOperation(
  findings: SecurityFinding[],
  config: SecurityScannerConfig
): boolean {
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  const highFindings = findings.filter((f) => f.severity === 'high');

  return (
    (config.blockOnCritical && criticalFindings.length > 0) ||
    (config.blockOnHigh && highFindings.length > 0)
  );
}

/**
 * Process findings and create appropriate result
 */
function processFindings(
  findings: SecurityFinding[],
  config: SecurityScannerConfig,
  pluginName: string,
  pluginVersion: string
): PluginResult {
  // No findings - success
  if (findings.length === 0) {
    return {
      success: true,
      pluginName,
      pluginVersion,
      message: 'No security issues detected',
      metadata: { scanned: true, findings: [] },
    };
  }

  // Log findings if configured
  if (config.logFindings) {
    logFindings(findings);
  }

  // Determine if operation should be blocked
  const shouldBlock = shouldBlockOperation(findings, config);
  const criticalFindings = findings.filter((f) => f.severity === 'critical');
  const highFindings = findings.filter((f) => f.severity === 'high');

  const summary = formatFindings(findings);
  const message = shouldBlock
    ? `🔒 Security issues found - operation blocked: ${summary}`
    : `⚠️  Security issues found: ${summary}`;

  return {
    success: !shouldBlock,
    block: shouldBlock,
    pluginName,
    pluginVersion,
    message,
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

  configSchema: SecurityScannerConfigSchema as z.ZodType<
    Record<string, unknown>
  >,
  defaultConfig: {},

  async apply(
    context: HookContext,
    config: Record<string, unknown> = {}
  ): Promise<PluginResult> {
    // Early validation
    if (!isValidContext(context)) {
      return createSuccessResult(this.name, this.version);
    }

    const scannerConfig = SecurityScannerConfigSchema.parse(config);
    const allRules = [...BUILT_IN_RULES, ...scannerConfig.customRules];

    try {
      const result = await scanForSecurityIssues(
        context,
        scannerConfig,
        allRules,
        this.name,
        this.version
      );

      // If result is already a PluginResult (skip case), return it directly
      if ('success' in result) {
        return result;
      }

      // Otherwise, process the findings
      return processFindings(result, scannerConfig, this.name, this.version);
    } catch (error) {
      return createErrorResult(this.name, this.version, error);
    }
  },

  /**
   * Initialize with rule validation
   */
  async init(): Promise<void> {},

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
