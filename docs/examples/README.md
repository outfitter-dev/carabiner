# Examples & Tutorials

Real-world examples and best practices for building production-ready Claude Code hooks with Carabiner.

## Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Security Patterns](#security-patterns)
- [Development Workflows](#development-workflows)
- [Production Patterns](#production-patterns)
- [Integration Examples](#integration-examples)
- [Advanced Patterns](#advanced-patterns)

## Quick Start Examples

### Basic Security Hook

A simple hook that validates bash commands for security:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  console.log(`🔍 Security validation for ${context.toolName}`);

  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    // Define dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /sudo\s+rm/, // sudo rm
      /curl.*\|\s*sh/, // curl | sh
      /wget.*\|\s*sh/, // wget | sh
      /dd\s+if=/, // dd if=
      /:\(\)\{.*\}/, // fork bombs
      /chmod\s+777/, // dangerous permissions
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(
          `🚫 Blocked dangerous command: ${command}`,
          `Matched pattern: ${pattern.source}`,
        );
      }
    }

    console.log(`✅ Command approved: ${command}`);
  }

  return HookResults.success(`Security check passed for ${context.toolName}`);
});
```

### File Auto-Formatter

A hook that automatically formats files after they're written:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { $ } from 'bun';

runClaudeHook(async (context) => {
  if (context.toolName === 'Write') {
    const { file_path } = context.toolInput as { file_path: string };

    try {
      // Format TypeScript/JavaScript files
      if (file_path.match(/\.(ts|tsx|js|jsx)$/)) {
        console.log(`🎨 Formatting TypeScript file: ${file_path}`);
        await $`bunx prettier --write ${file_path}`;
        await $`bunx eslint --fix ${file_path}`.quiet();
      }

      // Format JSON files
      if (file_path.endsWith('.json')) {
        console.log(`🎨 Formatting JSON file: ${file_path}`);
        await $`bunx prettier --write ${file_path}`;
      }

      // Format Markdown files
      if (file_path.endsWith('.md')) {
        console.log(`🎨 Formatting Markdown file: ${file_path}`);
        await $`bunx prettier --write ${file_path}`;
      }

      return HookResults.success(`Formatted ${file_path}`);
    } catch (error) {
      console.warn(`⚠️ Could not format ${file_path}:`, error);
      // Don't fail if formatting fails
      return HookResults.success(`Skipped formatting ${file_path}`);
    }
  }

  return HookResults.success('No formatting needed');
});
```

## Security Patterns

### Environment-Specific Security

Different security rules for different environments:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

interface SecurityRule {
  pattern: RegExp;
  message: string;
  severity: 'block' | 'warn' | 'info';
}

runClaudeHook(async (context) => {
  if (context.toolName !== 'Bash') {
    return HookResults.success('Non-bash command approved');
  }

  const { command } = context.toolInput as { command: string };
  const env = process.env.NODE_ENV || 'development';

  // Environment-specific rules
  const rules: Record<string, SecurityRule[]> = {
    production: [
      {
        pattern: /rm\s+-rf/,
        message: 'rm -rf commands are blocked in production',
        severity: 'block',
      },
      {
        pattern: /sudo/,
        message: 'sudo commands require approval in production',
        severity: 'block',
      },
      {
        pattern: /curl.*\|\s*sh/,
        message: 'Piping curl to shell is dangerous',
        severity: 'block',
      },
      {
        pattern: /npm\s+install.*--global/,
        message: 'Global npm installs not allowed in production',
        severity: 'block',
      },
    ],

    staging: [
      {
        pattern: /rm\s+-rf\s+\//,
        message: 'rm -rf / is extremely dangerous',
        severity: 'block',
      },
      {
        pattern: /sudo\s+rm/,
        message: 'sudo rm is risky in staging',
        severity: 'warn',
      },
    ],

    development: [
      {
        pattern: /rm\s+-rf\s+\//,
        message: 'rm -rf / detected - this will destroy your system!',
        severity: 'block',
      },
      {
        pattern: /curl.*\|\s*sh/,
        message: 'Piping to shell - be careful!',
        severity: 'warn',
      },
    ],
  };

  const envRules = rules[env] || rules.development;

  for (const rule of envRules) {
    if (rule.pattern.test(command)) {
      const message = `${rule.message} (Environment: ${env})`;

      switch (rule.severity) {
        case 'block':
          return HookResults.block(message);
        case 'warn':
          console.warn(`⚠️ Warning: ${message}`);
          break;
        case 'info':
          console.info(`ℹ️ Info: ${message}`);
          break;
      }
    }
  }

  console.log(`✅ Command approved for ${env}: ${command}`);
  return HookResults.success(`Security check passed in ${env} environment`);
});
```

### File Access Control

Control which files can be written or edited:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import path from 'path';

runClaudeHook(async (context) => {
  if (!['Write', 'Edit', 'MultiEdit'].includes(context.toolName)) {
    return HookResults.success('Non-file operation approved');
  }

  let filePath: string;

  // Extract file path based on tool
  if (context.toolName === 'Write') {
    const { file_path } = context.toolInput as { file_path: string };
    filePath = file_path;
  } else if (context.toolName === 'Edit') {
    const { file_path } = context.toolInput as { file_path: string };
    filePath = file_path;
  } else {
    // MultiEdit - check all files in edits array
    const { edits } = context.toolInput as { edits: Array<{ file_path: string }> };
    for (const edit of edits) {
      const result = await validateFilePath(edit.file_path, context.cwd);
      if (!result.allowed) {
        return HookResults.block(result.message);
      }
    }
    return HookResults.success('All file paths approved');
  }

  const validation = await validateFilePath(filePath, context.cwd);

  if (!validation.allowed) {
    return HookResults.block(validation.message);
  }

  return HookResults.success(`File access approved: ${filePath}`);
});

async function validateFilePath(filePath: string, cwd: string) {
  const fullPath = path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, fullPath);

  // Block access outside project directory
  if (relativePath.startsWith('..')) {
    return {
      allowed: false,
      message: `File access outside project directory blocked: ${filePath}`,
    };
  }

  // Block system files
  const systemPaths = ['/etc/', '/usr/', '/bin/', '/sbin/', '/boot/', '/proc/', '/sys/', '/dev/'];

  for (const systemPath of systemPaths) {
    if (fullPath.startsWith(systemPath)) {
      return {
        allowed: false,
        message: `System file access blocked: ${filePath}`,
      };
    }
  }

  // Block sensitive files
  const sensitiveFiles = [
    'package-lock.json',
    'yarn.lock',
    'bun.lockb',
    '.env',
    '.env.local',
    '.env.production',
    'id_rsa',
    'id_ed25519',
    '.ssh/config',
  ];

  const fileName = path.basename(filePath);
  if (sensitiveFiles.includes(fileName)) {
    console.warn(`⚠️ Sensitive file access: ${filePath}`);
    // In production, you might want to block this
    if (process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        message: `Sensitive file access blocked in production: ${filePath}`,
      };
    }
  }

  // Block certain extensions in production
  if (process.env.NODE_ENV === 'production') {
    const dangerousExtensions = ['.sh', '.bash', '.bat', '.cmd', '.exe'];
    const ext = path.extname(filePath);

    if (dangerousExtensions.includes(ext)) {
      return {
        allowed: false,
        message: `Executable file creation blocked in production: ${filePath}`,
      };
    }
  }

  return { allowed: true, message: 'File access approved' };
}
```

## Development Workflows

### Git Integration Hook

Automatically commit and push changes:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { $ } from 'bun';

runClaudeHook(async (context) => {
  // Only run for file operations
  if (!['Write', 'Edit', 'MultiEdit'].includes(context.toolName)) {
    return HookResults.success('Non-file operation - no git action needed');
  }

  // Skip in CI environments
  if (process.env.CI) {
    return HookResults.success('Skipping git operations in CI');
  }

  try {
    // Check if we're in a git repository
    await $`git rev-parse --git-dir`.quiet();

    // Get current status
    const status = await $`git status --porcelain`.text();

    if (!status.trim()) {
      return HookResults.success('No changes to commit');
    }

    // Add all changes
    await $`git add .`;

    // Create commit message based on the operation
    let commitMessage = `feat: ${context.toolName} operation via Claude Code`;

    if (context.toolName === 'Write') {
      const { file_path } = context.toolInput as { file_path: string };
      commitMessage = `feat: create ${file_path} via Claude Code`;
    } else if (context.toolName === 'Edit') {
      const { file_path } = context.toolInput as { file_path: string };
      commitMessage = `feat: update ${file_path} via Claude Code`;
    } else if (context.toolName === 'MultiEdit') {
      commitMessage = `feat: update multiple files via Claude Code`;
    }

    // Commit changes
    await $`git commit -m ${commitMessage}`;

    console.log(`✅ Committed changes: ${commitMessage}`);

    // Optionally push to remote (enable with environment variable)
    if (process.env.AUTO_PUSH === 'true') {
      try {
        await $`git push`;
        console.log('✅ Pushed changes to remote');
      } catch (error) {
        console.warn('⚠️ Could not push to remote:', error);
      }
    }

    return HookResults.success('Git operations completed');
  } catch (error) {
    // Not a git repo or git command failed
    console.warn('⚠️ Git operation failed:', error);
    return HookResults.success('Git operation skipped');
  }
});
```

### TypeScript Project Hook

Compile and validate TypeScript projects:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { $ } from 'bun';
import path from 'path';

runClaudeHook(async (context) => {
  // Only run for TypeScript files
  if (!['Write', 'Edit'].includes(context.toolName)) {
    return HookResults.success('Non-file operation - no TypeScript validation needed');
  }

  const filePath =
    context.toolName === 'Write'
      ? (context.toolInput as { file_path: string }).file_path
      : (context.toolInput as { file_path: string }).file_path;

  if (!filePath.match(/\.(ts|tsx)$/)) {
    return HookResults.success('Non-TypeScript file - no validation needed');
  }

  console.log(`🔍 TypeScript validation for: ${filePath}`);

  try {
    // Check if this is a TypeScript project
    const tsconfigPath = await findTsConfig(context.cwd);

    if (!tsconfigPath) {
      console.log('ℹ️ No tsconfig.json found - skipping TypeScript validation');
      return HookResults.success('No TypeScript project detected');
    }

    // Type check the specific file
    console.log('🔍 Running TypeScript type checking...');
    await $`bunx tsc --noEmit --project ${tsconfigPath}`.quiet();

    console.log('✅ TypeScript validation passed');

    // Optionally run linting
    try {
      console.log('🔍 Running ESLint...');
      await $`bunx eslint ${filePath} --fix`.quiet();
      console.log('✅ ESLint validation passed');
    } catch (eslintError) {
      console.warn('⚠️ ESLint issues found (not blocking)');
    }

    return HookResults.success(`TypeScript validation passed for ${filePath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // In development, we might want to warn but not block
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ TypeScript validation failed: ${errorMessage}`);
      return HookResults.success('TypeScript validation failed but not blocking in development');
    }

    // In production, block on TypeScript errors
    return HookResults.block(`TypeScript validation failed: ${errorMessage}`);
  }
});

async function findTsConfig(startDir: string): Promise<string | null> {
  let currentDir = startDir;

  while (currentDir !== '/') {
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');

    try {
      await Bun.file(tsconfigPath).text();
      return tsconfigPath;
    } catch {
      // File doesn't exist, continue searching
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}
```

## Production Patterns

### Comprehensive Audit Logger

Log all tool usage for compliance and debugging:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { createHash } from 'crypto';

interface AuditLog {
  timestamp: string;
  sessionId: string;
  event: string;
  toolName: string;
  toolInput: any;
  toolResponse?: string;
  userId?: string;
  workspaceId?: string;
  metadata: Record<string, any>;
}

runClaudeHook(async (context) => {
  const auditLog: AuditLog = {
    timestamp: new Date().toISOString(),
    sessionId: context.sessionId,
    event: context.event,
    toolName: context.toolName,
    toolInput: sanitizeInput(context.toolInput),
    toolResponse: context.toolResponse ? sanitizeOutput(context.toolResponse) : undefined,
    userId: process.env.USER_ID,
    workspaceId: extractWorkspaceId(context.cwd),
    metadata: {
      cwd: context.cwd,
      transcriptPath: context.transcriptPath,
      nodeEnv: process.env.NODE_ENV,
      timestamp: Date.now(),
    },
  };

  try {
    // Log to multiple destinations
    await Promise.all([logToFile(auditLog), logToDatabase(auditLog), logToMetrics(auditLog)]);

    console.log(`📝 Audit logged: ${context.toolName} - ${context.sessionId}`);
  } catch (error) {
    console.error('❌ Audit logging failed:', error);
    // Don't block execution if audit logging fails
  }

  return HookResults.success('Audit logging completed');
});

function sanitizeInput(input: any): any {
  // Remove sensitive data from input
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
  const sanitized = JSON.parse(JSON.stringify(input));

  function sanitizeObject(obj: any): void {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      } else if (typeof obj[key] === 'string') {
        // Check if key name suggests sensitive data
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          obj[key] = '[REDACTED]';
        }
        // Redact potential secrets in content
        obj[key] = obj[key].replace(
          /(?:password|token|key|secret)[\s=:]*['"]?([^'"\s]+)['"]?/gi,
          '$1[REDACTED]',
        );
      }
    }
  }

  sanitizeObject(sanitized);
  return sanitized;
}

function sanitizeOutput(output: string): string {
  // Redact sensitive information from output
  return output
    .replace(/(?:password|token|key|secret)[\s=:]*['"]?([^'"\s]+)['"]?/gi, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{48}/g, '[API_KEY_REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN_REDACTED]');
}

function extractWorkspaceId(cwd: string): string {
  // Extract workspace identifier from path
  const hash = createHash('sha256').update(cwd).digest('hex');
  return hash.substring(0, 8);
}

async function logToFile(auditLog: AuditLog): Promise<void> {
  const logDir = process.env.AUDIT_LOG_DIR || './logs';
  const logFile = `${logDir}/audit-${new Date().toISOString().split('T')[0]}.jsonl`;

  try {
    // Ensure log directory exists
    await Bun.write(logFile, JSON.stringify(auditLog) + '\n', { createPath: true });
  } catch (error) {
    console.error('Failed to write audit log to file:', error);
  }
}

async function logToDatabase(auditLog: AuditLog): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return; // Skip if no database configured
  }

  try {
    // Send to database (implement based on your database)
    const response = await fetch(process.env.AUDIT_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditLog),
    });

    if (!response.ok) {
      throw new Error(`Database logging failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to log to database:', error);
  }
}

async function logToMetrics(auditLog: AuditLog): Promise<void> {
  if (!process.env.METRICS_URL) {
    return; // Skip if no metrics service configured
  }

  try {
    // Send metrics (e.g., to DataDog, New Relic, etc.)
    const metrics = {
      tool_usage: 1,
      tool_name: auditLog.toolName,
      event_type: auditLog.event,
      session_id: auditLog.sessionId,
      timestamp: auditLog.timestamp,
    };

    await fetch(process.env.METRICS_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.METRICS_TOKEN}`,
      },
      body: JSON.stringify(metrics),
    });
  } catch (error) {
    console.error('Failed to send metrics:', error);
  }
}
```

### Performance Monitoring

Monitor hook execution performance:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

interface PerformanceMetrics {
  sessionId: string;
  toolName: string;
  event: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

runClaudeHook(async (context) => {
  const startTime = performance.now();
  const startCpuUsage = process.cpuUsage();
  const startMemory = process.memoryUsage();

  // Simulate some processing
  await new Promise((resolve) => setTimeout(resolve, 10));

  const endTime = performance.now();
  const endCpuUsage = process.cpuUsage(startCpuUsage);
  const endMemory = process.memoryUsage();

  const metrics: PerformanceMetrics = {
    sessionId: context.sessionId,
    toolName: context.toolName,
    event: context.event,
    startTime,
    endTime,
    duration: endTime - startTime,
    memoryUsage: {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external,
      arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
    },
    cpuUsage: endCpuUsage,
  };

  // Log performance metrics
  console.log(`⏱️ Performance: ${metrics.duration.toFixed(2)}ms`);
  console.log(`🧠 Memory delta: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

  // Alert on slow performance
  if (metrics.duration > 5000) {
    console.warn(`🐌 Slow hook execution: ${metrics.duration.toFixed(2)}ms`);

    // Send alert in production
    if (process.env.NODE_ENV === 'production') {
      await sendPerformanceAlert(metrics);
    }
  }

  // Send metrics to monitoring service
  if (process.env.MONITORING_ENABLED === 'true') {
    await sendMetrics(metrics);
  }

  return HookResults.success('Performance monitoring completed', {
    duration: metrics.duration,
    memoryDelta: metrics.memoryUsage.heapUsed,
  });
});

async function sendPerformanceAlert(metrics: PerformanceMetrics): Promise<void> {
  try {
    await fetch(process.env.ALERT_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert: 'Slow Hook Execution',
        tool: metrics.toolName,
        duration: metrics.duration,
        sessionId: metrics.sessionId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to send performance alert:', error);
  }
}

async function sendMetrics(metrics: PerformanceMetrics): Promise<void> {
  try {
    await fetch(process.env.METRICS_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.METRICS_TOKEN}`,
      },
      body: JSON.stringify({
        metric: 'hook_performance',
        value: metrics.duration,
        tags: {
          tool: metrics.toolName,
          event: metrics.event,
          session: metrics.sessionId,
        },
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    console.error('Failed to send metrics:', error);
  }
}
```

## Integration Examples

### Builder Pattern with Multiple Hooks

Complex hook composition using the builder pattern:

```typescript
#!/usr/bin/env bun

import { HookBuilder, middleware, runClaudeHook, HookResults } from '@outfitter/hooks-core';

// Security hook for Bash commands
const bashSecurityHook = HookBuilder.forPreToolUse()
  .forTool('Bash')
  .withPriority(100)
  .withTimeout(10000)
  .withMiddleware(middleware.logging('info'))
  .withMiddleware(middleware.timing())
  .withHandler(async (context) => {
    const { command } = context.toolInput as { command: string };

    const dangerousPatterns = [/rm\s+-rf\s+\//, /sudo.*rm/, /curl.*\|\s*sh/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return HookResults.block(`Blocked dangerous command: ${pattern.source}`);
      }
    }

    return HookResults.success('Bash security check passed');
  })
  .build();

// Universal audit hook
const universalAuditHook = HookBuilder.forPostToolUse()
  .withPriority(50)
  .withMiddleware(middleware.logging('debug'))
  .withHandler(async (context) => {
    console.log(`📝 Audit: ${context.toolName} executed successfully`);

    // Log to audit system
    await logAuditEvent(context);

    return HookResults.success('Audit logged');
  })
  .build();

// File formatting hook
const formatHook = HookBuilder.forPostToolUse()
  .forTool('Write')
  .withTimeout(30000)
  .withCondition((context) => {
    const { file_path } = context.toolInput as { file_path: string };
    return file_path.match(/\.(ts|tsx|js|jsx|json|md)$/) !== null;
  })
  .withHandler(async (context) => {
    const { file_path } = context.toolInput as { file_path: string };

    try {
      // Format the file
      const { $ } = await import('bun');
      await $`bunx prettier --write ${file_path}`;

      return HookResults.success(`Formatted ${file_path}`);
    } catch (error) {
      return HookResults.success(`Skipped formatting ${file_path}: ${error}`);
    }
  })
  .build();

// Main runtime that orchestrates all hooks
runClaudeHook(async (context) => {
  const results: Array<{ hook: string; result: any }> = [];

  try {
    // Run pre-tool hooks
    if (context.event === 'PreToolUse') {
      if (context.toolName === 'Bash') {
        const result = await bashSecurityHook.handler(context);
        results.push({ hook: 'bash-security', result });

        if (result.block) {
          return result; // Block execution
        }
      }
    }

    // Run post-tool hooks
    if (context.event === 'PostToolUse') {
      // Universal audit (runs for all tools)
      const auditResult = await universalAuditHook.handler(context);
      results.push({ hook: 'universal-audit', result: auditResult });

      // File formatting (only for Write tool)
      if (context.toolName === 'Write') {
        const formatResult = await formatHook.handler(context);
        results.push({ hook: 'format', result: formatResult });
      }
    }

    const successful = results.filter((r) => r.result.success).length;
    const failed = results.filter((r) => !r.result.success).length;

    return HookResults.success(
      `Executed ${results.length} hooks: ${successful} successful, ${failed} failed`,
      { results, successful, failed },
    );
  } catch (error) {
    return HookResults.failure('Hook orchestration failed', error);
  }
});

async function logAuditEvent(context: any): Promise<void> {
  // Implement your audit logging here
  console.log(`Audit: ${context.toolName} in session ${context.sessionId}`);
}
```

### Declarative Configuration Example

Complete project setup using declarative configuration:

```typescript
#!/usr/bin/env bun

import { defineHook, HookResults, middleware, runClaudeHook } from '@outfitter/hooks-core';

// Define all project hooks declaratively
const projectHooks = [
  // Universal security check (all tools)
  defineHook({
    event: 'PreToolUse',
    handler: async (context) => {
      console.log(`🛡️ Universal security check for ${context.toolName}`);

      // Basic security validation
      if (context.toolName === 'Bash') {
        const { command } = context.toolInput as { command: string };

        if (command.includes('format C:') || command.includes('rm -rf /')) {
          return HookResults.block('Dangerous system command blocked');
        }
      }

      return HookResults.success('Universal security check passed');
    },
    priority: 100,
    middleware: [middleware.logging('info')],
  }),

  // Bash-specific monitoring (production only)
  defineHook({
    event: 'PreToolUse',
    tool: 'Bash',
    handler: async (context) => {
      console.log(`🐚 Bash command monitoring`);

      const { command } = context.toolInput as { command: string };

      // Enhanced bash validation
      const suspiciousPatterns = [/chmod\s+777/, /sudo\s+su/, /wget.*\|\s*bash/, /curl.*\|\s*bash/];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(command)) {
          console.warn(`⚠️ Suspicious bash pattern detected: ${pattern.source}`);

          if (process.env.NODE_ENV === 'production') {
            return HookResults.block(`Suspicious bash command blocked in production`);
          }
        }
      }

      return HookResults.success('Bash monitoring completed');
    },
    condition: (ctx) => process.env.NODE_ENV === 'production',
    timeout: 5000,
  }),

  // File formatting after writes
  defineHook({
    event: 'PostToolUse',
    tool: 'Write',
    handler: async (context) => {
      const { file_path } = context.toolInput as { file_path: string };
      console.log(`🎨 Auto-formatting: ${file_path}`);

      try {
        if (file_path.match(/\.(ts|tsx|js|jsx)$/)) {
          const { $ } = await import('bun');
          await $`bunx prettier --write ${file_path}`.quiet();
          await $`bunx eslint --fix ${file_path}`.quiet();
        }

        return HookResults.success(`Formatted ${file_path}`);
      } catch (error) {
        // Don't fail if formatting fails
        return HookResults.success(`Skipped formatting ${file_path}: ${error}`);
      }
    },
    timeout: 30000,
    condition: (ctx) => process.env.AUTO_FORMAT === 'true',
  }),

  // Session initialization
  defineHook({
    event: 'SessionStart',
    handler: async (context) => {
      console.log(`🚀 Session started: ${context.sessionId}`);
      console.log(`📁 Working directory: ${context.cwd}`);

      // Initialize session-specific settings
      const sessionInfo = {
        id: context.sessionId,
        startTime: new Date().toISOString(),
        workingDirectory: context.cwd,
        environment: process.env.NODE_ENV || 'development',
      };

      // Save session info for audit purposes
      if (process.env.AUDIT_SESSIONS === 'true') {
        await saveSessionInfo(sessionInfo);
      }

      return HookResults.success('Session initialized');
    },
    timeout: 5000,
  }),

  // Session cleanup
  defineHook({
    event: 'Stop',
    handler: async (context) => {
      console.log(`🛑 Session ending: ${context.sessionId}`);

      // Cleanup temporary files
      try {
        const { $ } = await import('bun');
        await $`find ${context.cwd} -name "*.tmp" -delete`.quiet();
        await $`find ${context.cwd} -name ".claude-temp-*" -delete`.quiet();
      } catch (error) {
        console.warn('⚠️ Cleanup failed:', error);
      }

      return HookResults.success('Session cleanup completed');
    },
    timeout: 10000,
  }),
];

// Runtime that executes appropriate hooks based on context
runClaudeHook(async (context) => {
  const applicableHooks = projectHooks.filter((hook) => {
    // Check if hook applies to this event
    if (hook.event !== context.event) {
      return false;
    }

    // Check tool scoping
    if (hook.tool && hook.tool !== context.toolName) {
      return false;
    }

    // Check condition
    if (hook.condition && !hook.condition(context)) {
      return false;
    }

    return true;
  });

  // Sort by priority (higher first)
  applicableHooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  console.log(
    `🔧 Executing ${applicableHooks.length} hooks for ${context.event}:${context.toolName}`,
  );

  // Execute hooks in order
  for (const hook of applicableHooks) {
    try {
      const result = await hook.handler(context);

      if (!result.success) {
        console.error(`❌ Hook failed: ${result.message}`);

        if (result.block) {
          return result; // Block execution
        }
      } else {
        console.log(`✅ Hook passed: ${hook.event}${hook.tool ? `:${hook.tool}` : ''}`);
      }
    } catch (error) {
      console.error(`💥 Hook crashed:`, error);

      if (context.event === 'PreToolUse') {
        return HookResults.failure('Hook execution failed', error);
      }
    }
  }

  return HookResults.success(`Executed ${applicableHooks.length} hooks successfully`);
});

async function saveSessionInfo(sessionInfo: any): Promise<void> {
  // Implement session tracking
  const logFile = `./logs/sessions-${new Date().toISOString().split('T')[0]}.jsonl`;
  await Bun.write(logFile, JSON.stringify(sessionInfo) + '\n', { createPath: true });
}
```

## Advanced Patterns

### Custom Middleware

Create reusable middleware for common functionality:

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import type { Middleware, HookContext, HookResult } from '@outfitter/hooks-core';

// Custom rate limiting middleware
const rateLimitMiddleware = (maxRequestsPerMinute: number): Middleware => {
  const requests = new Map<string, number[]>();

  return async (context: HookContext, next: () => Promise<HookResult>) => {
    const key = `${context.sessionId}:${context.toolName}`;
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Get recent requests for this session/tool
    const recentRequests = requests.get(key) || [];
    const recentRequestsWithinMinute = recentRequests.filter((time) => now - time < oneMinute);

    if (recentRequestsWithinMinute.length >= maxRequestsPerMinute) {
      return HookResults.block(
        `Rate limit exceeded: ${maxRequestsPerMinute} requests per minute for ${context.toolName}`,
      );
    }

    // Record this request
    recentRequestsWithinMinute.push(now);
    requests.set(key, recentRequestsWithinMinute);

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      for (const [sessionKey, times] of requests.entries()) {
        const validTimes = times.filter((time) => now - time < oneMinute);
        if (validTimes.length === 0) {
          requests.delete(sessionKey);
        } else {
          requests.set(sessionKey, validTimes);
        }
      }
    }

    return await next();
  };
};

// Custom caching middleware
const cacheMiddleware = (ttlMs: number = 60000): Middleware => {
  const cache = new Map<string, { result: HookResult; expires: number }>();

  return async (context: HookContext, next: () => Promise<HookResult>) => {
    // Create cache key based on context
    const cacheKey = createCacheKey(context);
    const now = Date.now();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      console.log(`💾 Cache hit for ${context.toolName}`);
      return {
        ...cached.result,
        metadata: {
          ...cached.result.metadata,
          cached: true,
          cacheHit: true,
        },
      };
    }

    // Execute hook
    const result = await next();

    // Cache successful results
    if (result.success && !result.block) {
      cache.set(cacheKey, {
        result,
        expires: now + ttlMs,
      });
    }

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      for (const [key, entry] of cache.entries()) {
        if (entry.expires <= now) {
          cache.delete(key);
        }
      }
    }

    return result;
  };
};

// Custom retry middleware
const retryMiddleware = (maxRetries: number = 3, delayMs: number = 1000): Middleware => {
  return async (context: HookContext, next: () => Promise<HookResult>) => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await next();

        if (result.success || attempt === maxRetries) {
          return {
            ...result,
            metadata: {
              ...result.metadata,
              attempts: attempt + 1,
              retried: attempt > 0,
            },
          };
        }

        lastError = result;

        // Wait before retry
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          console.log(
            `⏳ Retrying after error in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return HookResults.failure(`Failed after ${maxRetries + 1} attempts`, lastError);
  };
};

// Example hook using custom middleware
runClaudeHook(async (context) => {
  // Apply custom middleware
  const withMiddleware = applyMiddleware([
    rateLimitMiddleware(10), // Max 10 requests per minute
    cacheMiddleware(30000), // Cache for 30 seconds
    retryMiddleware(2, 500), // Retry up to 2 times with 500ms delay
  ]);

  return await withMiddleware(context, async () => {
    // Your hook logic here
    if (context.toolName === 'Bash') {
      const { command } = context.toolInput as { command: string };

      // Simulate some validation that might fail
      if (Math.random() < 0.3) {
        return HookResults.failure('Random validation failure for testing');
      }

      return HookResults.success(`Validated: ${command}`);
    }

    return HookResults.success('Hook executed successfully');
  });
});

// Utility functions
function createCacheKey(context: HookContext): string {
  return `${context.event}:${context.toolName}:${JSON.stringify(context.toolInput)}`;
}

function applyMiddleware(middlewares: Middleware[]) {
  return async (context: HookContext, handler: () => Promise<HookResult>): Promise<HookResult> => {
    let index = 0;

    const next = async (): Promise<HookResult> => {
      if (index >= middlewares.length) {
        return await handler();
      }

      const middleware = middlewares[index++];
      return await middleware(context, next);
    };

    return await next();
  };
}
```

---

**Build production-ready hooks with these real-world examples!** 🛠️

Next steps:

- [API Reference](../api-reference/) - Complete API documentation
- [Configuration Guide](../configuration.md) - Advanced configuration patterns
- [Architecture Guide](../architecture.md) - Understand the system design
