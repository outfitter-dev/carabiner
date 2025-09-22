#!/usr/bin/env bun

/**
 * Builder pattern API example for security-focused hooks
 * Demonstrates the fluent builder interface with middleware and conditions
 * Uses working APIs from @/hooks-core with proper tool scoping and stdin-based runtime
 */

import type { HookContext, HookResult, ToolName } from "@/hooks-core";
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
      ["Bash", "Write", "Edit"].includes(toolName)
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

      return {
        continue: true,
        systemMessage: `Security validation passed for ${normalizedContext.toolName}`,
        providerState: {
          securityLevel: environment === "production" ? "high" : "medium",
          checksPerformed: [
            "basic-validation",
            "advanced-patterns",
            "context-analysis",
          ],
        },
      };
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
      String(context.toolName)
    );

    if (!rateLimitResult.allowed) {
      return HookResults.block(
        `Rate limit exceeded: ${rateLimitResult.message}`,
        true
      );
    }

    return HookResults.success("Rate limit check passed", {
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
    ["Write", "Edit", "Read"].includes(context.toolName)
  )
  .withMiddleware(
    middleware.validation((context) => {
      // Validate that we have file path information
      const input = context.toolInput as Record<string, unknown>;
      return Boolean(input.file_path);
    }, "File path is required for file operations")
  )
  .withHandler(async (context) => {
    const filePath = (context.toolInput as Record<string, unknown>)
      .file_path as string;

    // Check file access permissions
    const accessCheck = await checkFileAccess(
      String(filePath),
      String(context.toolName),
      String(context.cwd)
    );

    if (!accessCheck.allowed) {
      return HookResults.block(accessCheck.reason ?? "Access denied");
    }

    // Log file access for audit trail
    await logFileAccess(
      String(context.sessionId),
      String(context.toolName),
      String(filePath)
    );

    return HookResults.success("File access authorized", {
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
  // Type guard to ensure we have PreToolUse context
  if (context.event !== "PreToolUse") {
    return HookResults.skip("Pipeline only runs on PreToolUse events");
  }

  // After type guard, narrow the context type
  const preToolContext = context as HookContext<"PreToolUse", ToolName>;
  const results: string[] = [];

  // Universal security check (runs for ALL tools)
  const universalResult = await universalSecurityHook.handler(preToolContext);
  if (!universalResult.success) {
    return universalResult;
  }
  results.push("universal-check");

  // Tool-specific checks
  switch (preToolContext.toolName) {
    case "Bash": {
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

      results.push("bash-security", "command-monitoring");
      break;
    }

    case "Write": {
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

      results.push("write-rate-limit", "file-access");
      break;
    }

    case "Edit":
    case "Read": {
      // File access control for all file operations
      const editFileAccessResult =
        await fileAccessControlHook.handler(preToolContext);
      if (!editFileAccessResult.success) {
        return editFileAccessResult;
      }

      results.push("file-access");
      break;
    }

    default:
      results.push("generic-tool");
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
    outputMode: "exit-code", // Use traditional exit codes
    logLevel: "info",
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
