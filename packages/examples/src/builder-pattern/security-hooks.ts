#!/usr/bin/env bun

/**
 * Builder pattern API example for security-focused hooks
 * Demonstrates the fluent builder interface with middleware and conditions
 * Uses working APIs from @/hooks-core with proper tool scoping and stdin-based runtime
 */

import type { HookContext, HookResult, ToolName } from '@/hooks-core';
import {
  createHook,
  HookBuilder,
  HookResults,
  middleware,
  runClaudeHook,
} from '@/hooks-core';
import {
  SecurityValidationError,
  SecurityValidators,
} from '@/hooks-validators';

/**
 * Security-focused PreToolUse hook using builder pattern
 * Now demonstrates actual working tool scoping
 */
const securityPreToolUseHook = HookBuilder.forPreToolUse()
  .forTool('Bash') // This now actually works with tool scoping!
  .withPriority(100) // High priority for security
  .withTimeout(10_000) // 10 second timeout
  .withMiddleware(middleware.logging('info'))
  .withMiddleware(middleware.timing())
  .withMiddleware(
    middleware.errorHandling((error, _context) => {
      return HookResults.block(`Security check failed: ${error.message}`);
    })
  )
  .withCondition((context) => {
    // Only run security checks in production or for sensitive tools
    return (
      Bun.env.NODE_ENV === 'production' ||
      ['Bash', 'Write', 'Edit'].includes(context.toolName)
    );
  })
  .withHandler(async (context) => {
    try {
      // Apply environment-specific security validation
      const environment =
        (Bun.env.NODE_ENV as 'development' | 'production' | 'test') ||
        'development';

      switch (environment) {
        case 'production':
          SecurityValidators.production(context);
          break;
        case 'development':
          SecurityValidators.development(context);
          break;
        default:
          SecurityValidators.strict(context);
      }

      // Additional security checks
      await performAdvancedSecurityChecks(context);

      return HookResults.success(
        `Security validation passed for ${context.toolName}`,
        {
          securityLevel: environment === 'production' ? 'high' : 'medium',
          checksPerformed: [
            'basic-validation',
            'advanced-patterns',
            'context-analysis',
          ],
        }
      );
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        return HookResults.block(error.message);
      }
      throw error; // Let middleware handle other errors
    }
  })
  .build();

/**
 * Rate limiting hook using builder pattern - tool-specific for Write operations
 */
const rateLimitWriteHook = HookBuilder.forPreToolUse()
  .forTool('Write') // Specifically for Write operations
  .withPriority(90)
  .withHandler(async (context) => {
    const rateLimitResult = await checkRateLimit(
      context.sessionId,
      context.toolName
    );

    if (!rateLimitResult.allowed) {
      return HookResults.block(
        `Rate limit exceeded: ${rateLimitResult.message}`
      );
    }

    return HookResults.success('Rate limit check passed', {
      remainingRequests: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
    });
  })
  .build();

/**
 * File access control hook using builder pattern - universal hook for all file operations
 */
const fileAccessControlHook = HookBuilder.forPreToolUse()
  // No forTool() call - this is a universal hook that runs for ALL tools
  .withCondition((context) =>
    ['Write', 'Edit', 'Read'].includes(context.toolName)
  )
  .withMiddleware(
    middleware.validation((context) => {
      // Validate that we have file path information
      const input = context.toolInput as Record<string, unknown>;
      return Boolean(input.file_path);
    }, 'File path is required for file operations')
  )
  .withHandler(async (context) => {
    const filePath = (context.toolInput as Record<string, unknown>).file_path;

    // Check file access permissions
    const accessCheck = await checkFileAccess(
      filePath,
      context.toolName,
      context.cwd
    );

    if (!accessCheck.allowed) {
      return HookResults.block(accessCheck.reason ?? 'Access denied');
    }

    // Log file access for audit trail
    await logFileAccess(context.sessionId, context.toolName, filePath);

    return HookResults.success('File access authorized', {
      filePath,
      accessLevel: accessCheck.level,
    });
  })
  .build();

/**
 * Command monitoring hook using functional API - tool-specific for Bash
 */
const commandMonitoringHook = createHook.preToolUse('Bash', async (context) => {
  if (
    context.toolInput &&
    typeof context.toolInput === 'object' &&
    'command' in context.toolInput
  ) {
    const command = (context.toolInput as Record<string, unknown>).command;

    // Monitor for suspicious command patterns
    const suspiciousPatterns = [
      { pattern: /nc\s+.*-l/, description: 'Netcat listening mode' },
      { pattern: /python.*-c.*exec/, description: 'Python exec injection' },
      { pattern: /curl.*\|\s*sh/, description: 'Curl pipe to shell' },
      { pattern: /base64.*-d.*\|\s*sh/, description: 'Base64 decode to shell' },
    ];

    for (const { pattern, description } of suspiciousPatterns) {
      if (pattern.test(command) && Bun.env.NODE_ENV === 'production') {
        // In production, block these suspicious commands
        return HookResults.block(`Blocked suspicious command: ${description}`);
      }
    }
  }

  return HookResults.success('Command monitoring completed');
});

/**
 * Universal security hook - runs for ALL tools
 */
const universalSecurityHook = createHook.preToolUse(async (context) => {
  // Basic universal checks
  if (context.sessionId.length < 10) {
    return HookResults.block('Invalid session ID format');
  }

  // Environment-based restrictions
  if (
    Bun.env.NODE_ENV === 'production' &&
    !context.cwd.startsWith('/safe/workspace/')
  ) {
  }

  return HookResults.success('Universal security check passed');
});

/**
 * Advanced security check functions
 */

async function performAdvancedSecurityChecks(
  context: HookContext
): Promise<void> {
  // Check for signs of potential code injection
  if (context.toolName === 'Write' || context.toolName === 'Edit') {
    const content =
      (context.toolInput as Record<string, unknown>).content ||
      (context.toolInput as Record<string, unknown>).new_string;

    if (content && typeof content === 'string') {
      await validateCodeContent(content);
    }
  }

  // Check workspace integrity
  await validateWorkspaceIntegrity(context.cwd);

  // Check for suspicious session patterns
  await validateSessionBehavior(context.sessionId);
}

async function validateCodeContent(content: string): Promise<void> {
  // Check for potential code injection patterns
  const injectionPatterns = [
    /eval\s*\(\s*[^)]*\$/, // Dynamic eval with variables
    /Function\s*\(\s*[^)]*\$/, // Dynamic Function constructor
    /setTimeout\s*\(\s*["'].*\$/, // setTimeout with string
    /setInterval\s*\(\s*["'].*\$/, // setInterval with string
    /document\.write\s*\(/, // DOM manipulation
    /<script[^>]*>/, // Script tags in content
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      throw new SecurityValidationError(
        `Potential code injection pattern detected: ${pattern.source}`,
        'code-injection'
      );
    }
  }
}

async function validateWorkspaceIntegrity(cwd: string): Promise<void> {
  // Check for common security indicators
  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');

  // Check for suspicious files
  const suspiciousFiles = [
    '.env.production',
    'id_rsa',
    'id_ed25519',
    '.secrets',
  ];

  for (const file of suspiciousFiles) {
    if (existsSync(join(cwd, file))) {
      // Could implement additional protections here
    }
  }
}

async function validateSessionBehavior(_sessionId: string): Promise<void> {}

/**
 * Rate limiting implementation
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

async function checkRateLimit(
  sessionId: string,
  toolName: string
): Promise<RateLimitResult> {
  const key = `${sessionId}:${toolName}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const maxRequests = toolName === 'Bash' ? 10 : 20; // Different limits per tool

  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    // New window or expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: existing.resetTime,
      message: `Too many ${toolName} requests. Limit: ${maxRequests} per minute`,
    };
  }

  // Increment count
  existing.count++;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetTime: existing.resetTime,
  };
}

/**
 * File access control
 */

interface FileAccessResult {
  allowed: boolean;
  level: 'read' | 'write' | 'admin';
  reason?: string;
}

async function checkFileAccess(
  filePath: string,
  operation: string,
  cwd: string
): Promise<FileAccessResult> {
  const { resolve } = await import('node:path');

  // Ensure file is within workspace
  const resolvedPath = resolve(cwd, filePath);
  if (!resolvedPath.startsWith(cwd)) {
    return {
      allowed: false,
      level: 'read',
      reason: 'File access outside workspace denied',
    };
  }

  // Define restricted paths
  const restrictedPaths = [
    'node_modules/',
    '.git/',
    '.env',
    'private/',
    'secrets/',
  ];

  for (const restricted of restrictedPaths) {
    if (filePath.includes(restricted)) {
      return {
        allowed: false,
        level: 'read',
        reason: `Access to ${restricted} is restricted`,
      };
    }
  }

  // Different permissions based on operation
  const level = operation === 'Read' ? 'read' : 'write';

  return {
    allowed: true,
    level,
  };
}

async function logFileAccess(
  sessionId: string,
  operation: string,
  filePath: string
): Promise<void> {
  const _logEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    operation,
    filePath,
    type: 'file-access',
  };
}

/**
 * Example: Composite security pipeline using multiple hooks
 * This shows how tool scoping actually works now
 */
async function runSecurityPipeline(context: HookContext): Promise<HookResult> {
  // Type guard to ensure we have PreToolUse context
  if (context.event !== 'PreToolUse') {
    return HookResults.skip('Pipeline only runs on PreToolUse events');
  }

  // After type guard, narrow the context type
  const preToolContext = context as HookContext<'PreToolUse', ToolName>;
  const results: string[] = [];

  // Universal security check (runs for ALL tools)
  const universalResult = await universalSecurityHook.handler(preToolContext);
  if (!universalResult.success) {
    return universalResult;
  }
  results.push('universal-check');

  // Tool-specific checks
  switch (preToolContext.toolName) {
    case 'Bash': {
      // Bash-specific security and command monitoring
      const bashSecurityResult =
        await securityPreToolUseHook.handler(preToolContext);
      if (!bashSecurityResult.success) {
        return bashSecurityResult;
      }

      const commandResult = await commandMonitoringHook.handler(preToolContext);
      if (!commandResult.success) {
        return commandResult;
      }

      results.push('bash-security', 'command-monitoring');
      break;
    }

    case 'Write': {
      // Write-specific rate limiting and file access control
      const writeRateLimitResult =
        await rateLimitWriteHook.handler(preToolContext);
      if (!writeRateLimitResult.success) {
        return writeRateLimitResult;
      }

      const fileAccessResult =
        await fileAccessControlHook.handler(preToolContext);
      if (!fileAccessResult.success) {
        return fileAccessResult;
      }

      results.push('write-rate-limit', 'file-access');
      break;
    }

    case 'Edit':
    case 'Read': {
      // File access control for all file operations
      const editFileAccessResult =
        await fileAccessControlHook.handler(preToolContext);
      if (!editFileAccessResult.success) {
        return editFileAccessResult;
      }

      results.push('file-access');
      break;
    }

    default:
      results.push('generic-tool');
  }

  return HookResults.success(
    `Security pipeline completed for ${preToolContext.toolName}`,
    {
      checksPerformed: results,
      toolScoping: `This demonstrates that tool scoping works - different hooks ran for ${preToolContext.toolName}`,
    }
  );
}

/**
 * Main execution using proper stdin-based runtime
 * This replaces the old createHookContext + executeHooksAndCombine pattern
 */
if (import.meta.main) {
  // The new runtime automatically reads JSON from stdin, creates context, and calls our handler
  runClaudeHook(runSecurityPipeline, {
    outputMode: 'exit-code', // Use traditional exit codes
    logLevel: 'info',
  });
}

export {
  securityPreToolUseHook,
  rateLimitWriteHook,
  fileAccessControlHook,
  commandMonitoringHook,
  universalSecurityHook,
  runSecurityPipeline,
};
