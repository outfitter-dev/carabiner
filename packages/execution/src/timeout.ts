/**
 * @outfitter/execution - Timeout and process execution for Claude Code compliance
 *
 * This module provides timeout-aware process execution with proper signal handling,
 * exit code semantics, and graceful shutdown behavior as required by Claude Code.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { executionLogger } from "@carabiner/hooks-core";

const logger = executionLogger.child({ component: "timeout" });

/**
 * Result of command execution with timeout support
 */
export type ExecutionResult = {
  /** Standard output from the process */
  readonly stdout: string;

  /** Standard error from the process */
  readonly stderr: string;

  /** Exit code of the process (0 = success, 2 = blocking, others = non-blocking warnings) */
  readonly exitCode: number;

  /** Whether the process was terminated due to timeout */
  readonly timedOut: boolean;
};

/**
 * Hook configuration for execution
 */
export type Hook = {
  readonly command: string;
  readonly args: string[];
  readonly timeout?: number;
};

/**
 * Execute a command with timeout support and proper signal handling
 *
 * Implements Claude Code compliant timeout behavior:
 * - SIGTERM sent on timeout
 * - 5 second grace period for graceful shutdown
 * - SIGKILL sent if process doesn't exit
 * - Default timeout of 60 seconds as per spec
 *
 * @param command - Command to execute
 * @param args - Command arguments
 * @param timeout - Timeout in milliseconds (default: 60000)
 * @returns Promise resolving to execution result
 */
export async function executeWithTimeout(
  command: string,
  args: string[],
  timeout = 60_000 // Default 60s as per spec
): Promise<ExecutionResult> {
  logger.debug("Executing command with timeout", {
    command,
    args,
    timeout,
  });

  const child: ChildProcess = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killTimer: NodeJS.Timeout | undefined;

  // Set timeout for SIGTERM -> SIGKILL progression
  const timer = setTimeout(() => {
    logger.warn("Process timeout reached, sending SIGTERM", {
      command,
      args,
      timeout,
    });

    timedOut = true;
    child.kill("SIGTERM");

    // Give 5s for graceful shutdown, then SIGKILL
    killTimer = setTimeout(() => {
      const stillRunning = child.exitCode === null;
      if (stillRunning) {
        logger.warn("Process did not exit gracefully, sending SIGKILL", {
          command,
          args,
        });
        child.kill("SIGKILL");
      }
    }, 5000);
  }, timeout);

  // Collect output
  if (child.stdout) {
    child.stdout.on("data", (data) => {
      stdout += data;
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (data) => {
      stderr += data;
    });
  }

  return new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }

      const exitCode = code ?? 1;

      logger.debug("Process exited", {
        command,
        args,
        exitCode,
        signal,
        timedOut,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      resolve({ stdout, stderr, exitCode, timedOut });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      if (killTimer) {
        clearTimeout(killTimer);
      }

      logger.error("Process error", {
        command,
        args,
        error: error.message,
      });

      resolve({
        stdout,
        stderr: `${stderr}\nProcess error: ${error.message}`,
        exitCode: 1,
        timedOut,
      });
    });
  });
}

/**
 * Execute a hook with proper timeout and error handling
 *
 * Implements Claude Code compliant hook execution with:
 * - Exit code 2 blocks execution and sends stderr to Claude
 * - Exit code 1 (and other non-zero, non-2) are non-blocking warnings
 * - Exit code 0 indicates success
 *
 * @param hook - Hook configuration to execute
 * @param context - Hook context for logging
 * @returns Promise that resolves on success or throws on blocking errors
 */
export type HookProcessResult = ExecutionResult & {
  readonly continue: boolean;
  readonly blocked: boolean;
  readonly stopReason?: string;
};

export async function executeHookProcess(
  hook: Hook,
  context?: { event?: { type?: string } }
): Promise<HookProcessResult> {
  const result = await executeWithTimeout(
    hook.command,
    hook.args,
    hook.timeout
  );

  logger.debug("Hook execution completed", {
    command: hook.command,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    context: context?.event?.type,
  });

  // CRITICAL: Exit code 2 is blocking
  if (result.exitCode === 2) {
    logger.error("Hook blocked execution with exit code 2", {
      command: hook.command,
      stderr: result.stderr,
    });
    return {
      ...result,
      continue: false,
      blocked: true,
      stopReason: "blocked",
    };
  }

  // Non-zero exit codes (except 2) are non-blocking warnings
  if (result.exitCode !== 0 && result.exitCode !== 2) {
    logger.warn(`Hook exited with code ${result.exitCode}`, {
      command: hook.command,
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }

  if (result.exitCode === 0) {
    logger.debug("Hook executed successfully", {
      command: hook.command,
      stdoutLength: result.stdout.length,
    });
  }

  return {
    ...result,
    continue: result.exitCode !== 2,
    blocked: false,
    stopReason: result.exitCode === 0 ? undefined : "warning",
  };
}
