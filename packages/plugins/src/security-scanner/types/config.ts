/**
 * @file types/config.ts
 * @description Security scanner configuration types
 */

import { z } from 'zod';

/**
 * Security scanner plugin configuration schema
 */
export const SecurityScannerConfigSchema = z
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

export type SecurityScannerConfig = z.infer<typeof SecurityScannerConfigSchema>;