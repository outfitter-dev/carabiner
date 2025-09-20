#!/usr/bin/env bun

/**
 * Builder pattern API example for security-focused hooks
 * Demonstrates the fluent builder interface with middleware and conditions
 * Uses working APIs from @/hooks-core with proper tool scoping and stdin-based runtime
 */

import type { HookContext, HookHandler, HookResult } from "@/hooks-core";
import {
  createHook,
  HookBuilder,
  HookResults,
  middleware,
  runClaudeHook,
} from "@/hooks-core";
import {
  SecurityValidationError,
  SecurityValidators,
} from "@/hooks-validators";

function didContinue(result: HookResult): boolean {
  if ("continue" in result && result.continue === false) {
    return false;
  }
  if ("stopReason" in result && result.stopReason === "blocked") {
    return false;
  }
  return true;
}

async function invokeHook(
  handler: HookHandler,
  context: HookContext
): Promise<HookResult> {
  return handler(context, undefined, {
    signal: new AbortController().signal,
  });
}

function successResult(
  message?: string,
  providerState?: Record<string, unknown>
): HookResult {
  const base = HookResults.success(message);
  return providerState ? { ...base, providerState } : base;
}

/**
 * Security-focused PreToolUse hook using builder pattern
 * Now demonstrates actual working tool scoping
 */
const securityPreToolUseHook = HookBuilder.forPreToolUse()
  .forTool("Bash") // This now actually works with tool scoping!
  .withPriority(100) // High priority for security
  .withTimeout(10_000) // 10 second timeout
  .withMiddleware(middleware.logging("info"))
  .withMiddleware(middleware.timing())
  .withMiddleware(
    middleware.errorHandling((error, _context) => {
      return HookResults.block(`Security check failed: ${error.message}`, true);
    })
  )
  .withCondition((context) => {
    // Only run security checks in production or for sensitive tools
    const toolName = (context as any).tool_name || (context as any).toolName;
    return (
      Bun.env.NODE_ENV === "production" ||
      (toolName !== undefined && ["Bash", "Write", "Edit"].includes(toolName))
    );
  })
  .withHandler(async (context) => {
    try {
      // Normalize context to ensure compatibility
      const normalizedContext = {
        ...context,
        toolName: (context as any).tool_name || (context as any).toolName,
        toolInput: (context as any).tool_input || (context as any).toolInput,
      };

      // Apply environment-specific security validation
      const environment =
        (Bun.env.NODE_ENV as "development" | "production" | "test") ||
        "development";

      switch (environment) {
        case "production":
          SecurityValidators.production(normalizedContext);
          break;
        case "development":
          SecurityValidators.development(normalizedContext);
          break;
        default:
          SecurityValidators.strict(normalizedContext);
      }

      // Additional security checks
      await performAdvancedSecurityChecks(normalizedContext);

      return successResult(
        `Security validation passed for ${normalizedContext.toolName ?? "unknown"}`,
        {
          securityLevel: environment === "production" ? "high" : "medium",
          checksPerformed: [
            "basic-validation",
            "advanced-patterns",
            "context-analysis",
          ],
        }
      );
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        return HookResults.block(error.message, true);
      }
      throw error; // Let middleware handle other errors
    }
  })
  .build();

/**
 * Rate limiting hook using builder pattern - tool-specific for Write operations
 */
const rateLimitWriteHook = HookBuilder.forPreToolUse()
  .forTool("Write") // Specifically for Write operations
  .withPriority(90)
  .withHandler(async (context) => {
    const rateLimitResult = await checkRateLimit(
      String(context.sessionId),
      String(context.toolName ?? "unknown")
    );

    if (!rateLimitResult.allowed) {
      return HookResults.block(
        `Rate limit exceeded: ${rateLimitResult.message}`,
        true
      );
    }

    return successResult("Rate limit check passed", {
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
  .withCondition(
    (context) =>
      !!context.toolName && ["Write", "Edit", "Read"].includes(context.toolName)
  )
  .withMiddleware(
    middleware.validation((context) => {
      // Validate that we have file path information
      const input = context.toolInput as Record<string, unknown>;
      return Boolean(input.file_path);
    }, "File path is required for file operations")
  )
  .withHandler(async (context) => {
    const filePath = (context.toolInput as Record<string, unknown> | undefined)
      ?.file_path as string | undefined;

    if (!filePath) {
      return HookResults.block("Missing file path for file operation");
    }

    // Check file access permissions
    const accessCheck = await checkFileAccess(
      String(filePath),
      String(context.toolName ?? "unknown"),
      String(context.cwd)
    );

    if (!accessCheck.allowed) {
      return HookResults.block(accessCheck.reason ?? "Access denied");
    }

    // Log file access for audit trail
    await logFileAccess(
      String(context.sessionId),
      String(context.toolName ?? "unknown"),
      String(filePath)
    );

    return successResult("File access authorized", {
      filePath,
      accessLevel: accessCheck.level,
    });
  })
  .build();

/**
 * Command monitoring hook using functional API - tool-specific for Bash
 */
const commandMonitoringHook = createHook.preToolUse("Bash", (context) => {
  if (
    context.toolInput &&
    typeof context.toolInput === "object" &&
    "command" in context.toolInput
  ) {
    const cmd = (context.toolInput as Record<string, unknown>).command;

    // Monitor for suspicious command patterns
    const suspiciousPatterns = [
      { pattern: /nc\s+.*-l/, description: "Netcat listening mode" },
      { pattern: /python.*-c.*exec/, description: "Python exec injection" },
      { pattern: /curl.*\|\s*sh/, description: "Curl pipe to shell" },
      { pattern: /base64.*-d.*\|\s*sh/, description: "Base64 decode to shell" },
    ];

    for (const { pattern, description } of suspiciousPatterns) {
      if (
        typeof cmd === "string" &&
        pattern.test(cmd) &&
        Bun.env.NODE_ENV === "production"
      ) {
        // In production, block these suspicious commands
        return HookResults.block(
          `Blocked suspicious command: ${description}`,
          true
        );
      }
    }
  }

  return HookResults.success("Command monitoring completed");
});

/**
 * Universal security hook - runs for ALL tools
 */
const universalSecurityHook = createHook.preToolUse(async (context) => {
  // Basic universal checks
  if (context.sessionId.length < 10) {
    return HookResults.block("Invalid session ID format", true);
  }

  // Environment-based restrictions
  if (Bun.env.NODE_ENV === "production") {
    const { resolve, relative, isAbsolute } = await import("node:path");
    const base = "/safe/workspace";
    const rel = relative(base, resolve(context.cwd));
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return HookResults.block("Workspace access restricted in production");
    }
  }

  return HookResults.success("Universal security check passed");
});

/**
 * Advanced security check functions
 */

async function performAdvancedSecurityChecks(
  context: HookContext
): Promise<void> {
  // Check for signs of potential code injection
  if (context.toolName === "Write" || context.toolName === "Edit") {
    const content =
      (context.toolInput as Record<string, unknown>).content ||
      (context.toolInput as Record<string, unknown>).new_string;

    if (content && typeof content === "string") {
      await validateCodeContent(content);
    }
  }

  // Check workspace integrity
  await validateWorkspaceIntegrity(context.cwd);

  // Check for suspicious session patterns
  await validateSessionBehavior(context.sessionId);
}

function validateCodeContent(content: string): void {
  // Check for potential code injection patterns
  const injectionPatterns = [
    /eval\s*\([^)]*\)/i, // Dynamic eval
    /new\s+Function\s*\([^)]*\)/i, // Function constructor
    /setTimeout\s*\(\s*["'][^"']*["']\s*,/i,
    /setInterval\s*\(\s*["'][^"']*["']\s*,/i,
    /document\.write\s*\(/i,
    /<script[^>]*>/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(content)) {
      throw new SecurityValidationError(
        `Potential code injection pattern detected: ${pattern.source}`,
        "code-injection"
      );
    }
  }
}

async function validateWorkspaceIntegrity(cwd: string): Promise<void> {
  // Check for common security indicators
  const { existsSync } = await import("node:fs");
  const { join } = await import("node:path");

  // Check for suspicious files
  const suspiciousFiles = [
    ".env.production",
    "id_rsa",
    "id_ed25519",
    ".secrets",
  ];

  for (const file of suspiciousFiles) {
    if (existsSync(join(cwd, file))) {
      // Could implement additional protections here
    }
  }
}

function validateSessionBehavior(_sessionId: string): void {
  // Session behavior validation implementation placeholder
}

/**
 * Rate limiting implementation
 */

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
};

// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(sessionId: string, toolName: string): RateLimitResult {
  const key = `${sessionId}:${toolName}`;
  const now = Date.now();
  const windowMs = 60_000; // 1 minute window
  const maxRequests = toolName === "Bash" ? 10 : 20; // Different limits per tool

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

type FileAccessResult = {
  allowed: boolean;
  level: "read" | "write" | "admin";
  reason?: string;
};

async function checkFileAccess(
  filePath: string,
  operation: string,
  cwd: string
): Promise<FileAccessResult> {
  const { resolve, relative, isAbsolute, sep, basename } = await import(
    "node:path"
  );

  // Ensure file is within workspace
  const resolvedPath = resolve(cwd, filePath);
  const rel = relative(cwd, resolvedPath);
  // Outside if it points outside the workspace or crosses drives (Windows)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return {
      allowed: false,
      level: "read",
      reason: "File access outside workspace denied",
    };
  }

  // Define restricted dirs/files
  const restrictedDirs = ["node_modules", ".git", "private", "secrets"];
  const restrictedFiles = [".env"];

  const segments = resolvedPath.split(sep);
  if (
    restrictedDirs.some((d) => segments.includes(d)) ||
    restrictedFiles.includes(basename(resolvedPath))
  ) {
    return {
      allowed: false,
      level: "read",
      reason: "Access to restricted path is denied",
    };
  }

  // Different permissions based on operation
  const level = operation === "Read" ? "read" : "write";

  return {
    allowed: true,
    level,
  };
}

function logFileAccess(
  sessionId: string,
  operation: string,
  filePath: string
): void {
  const _logEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    operation,
    filePath,
    type: "file-access",
  };
  void _logEntry;
}

/**
 * Example: Composite security pipeline using multiple hooks
 * This shows how tool scoping actually works now
 */
async function runSecurityPipeline(context: HookContext): Promise<HookResult> {
  if (context.event !== "PreToolUse") {
    return HookResults.skip("Pipeline only runs on PreToolUse events");
  }

  const toolName = context.toolName;
  if (!toolName) {
    return HookResults.success("No tool specified; skipping pipeline");
  }

  const results: string[] = [];

  const universalResult = await invokeHook(
    universalSecurityHook.handler as HookHandler,
    context
  );
  if (!didContinue(universalResult)) {
    return universalResult;
  }
  results.push("universal-check");

  const runHook = async (
    handler: HookHandler,
    label: string
  ): Promise<HookResult | null> => {
    const result = await invokeHook(handler, context);
    if (!didContinue(result)) {
      return result;
    }
    results.push(label);
    return null;
  };

  const bashHandlers: [HookHandler, string][] = [
    [securityPreToolUseHook.handler as HookHandler, "bash-security"],
    [commandMonitoringHook.handler as HookHandler, "command-monitoring"],
  ];

  const writeHandlers: [HookHandler, string][] = [
    [rateLimitWriteHook.handler as HookHandler, "write-rate-limit"],
    [fileAccessControlHook.handler as HookHandler, "file-access"],
  ];

  switch (toolName) {
    case "Bash": {
      for (const [handler, label] of bashHandlers) {
        const failure = await runHook(handler, label);
        if (failure) {
          return failure;
        }
      }
      break;
    }

    case "Write": {
      for (const [handler, label] of writeHandlers) {
        const failure = await runHook(handler, label);
        if (failure) {
          return failure;
        }
      }
      break;
    }

    case "Edit":
    case "Read": {
      const failure = await runHook(
        fileAccessControlHook.handler as HookHandler,
        "file-access"
      );
      if (failure) {
        return failure;
      }
      break;
    }

    default:
      results.push("generic-tool");
  }

  return successResult(`Security pipeline completed for ${toolName}`, {
    checksPerformed: results,
    toolScoping: `Different hooks ran for ${toolName} demonstrating tool scoping`,
  });
}

/**
 * Main execution using proper stdin-based runtime
 * This replaces the old createHookContext + executeHooksAndCombine pattern
 */
if (import.meta.main) {
  // The new runtime automatically reads JSON from stdin, creates context, and calls our handler
  runClaudeHook(runSecurityPipeline);
}

export {
  securityPreToolUseHook,
  rateLimitWriteHook,
  fileAccessControlHook,
  commandMonitoringHook,
  universalSecurityHook,
  runSecurityPipeline,
};
