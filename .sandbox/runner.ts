#!/usr/bin/env bun

/**
 * Carabiner Sandbox Runner
 * Test and benchmark hooks in an isolated environment
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HookContext, HookResult } from "@carabiner/hooks-core";

const SANDBOX_DIR = join(import.meta.dir);
const HOOKS_DIR = join(SANDBOX_DIR, "hooks");
const FIXTURES_DIR = join(SANDBOX_DIR, "fixtures");
const LOGS_DIR = join(SANDBOX_DIR, "logs");

// Ensure directories exist
[HOOKS_DIR, FIXTURES_DIR, LOGS_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

interface SandboxOptions {
  verbose?: boolean;
  benchmark?: boolean;
  iterations?: number;
  timeout?: number;
}

interface SandboxResult extends HookResult {
  duration?: number;
  averageDuration?: number;
  iterations?: number;
}

/**
 * Run a hook in the sandbox environment
 */
export async function runSandbox(
  hookName: string,
  input: Partial<HookContext>,
  options: SandboxOptions = {}
): Promise<SandboxResult> {
  const hookPath = findHook(hookName);
  if (!hookPath) {
    throw new Error(`Hook '${hookName}' not found in sandbox`);
  }

  const fullInput: HookContext = {
    hook_event_name: "PreToolUse",
    working_directory: SANDBOX_DIR,
    session_id: `sandbox-${Date.now()}`,
    timestamp: new Date().toISOString(),
    tool: "Unknown",
    ...input
  };

  if (options.benchmark) {
    return benchmarkHook(hookPath, fullInput, options);
  }

  return executeHook(hookPath, fullInput, options);
}

/**
 * Execute a hook once
 */
async function executeHook(
  hookPath: string,
  input: HookContext,
  options: SandboxOptions
): Promise<SandboxResult> {
  const startTime = performance.now();

  // Write input to temp file
  const inputFile = join(LOGS_DIR, `input-${Date.now()}.json`);
  writeFileSync(inputFile, JSON.stringify(input, null, 2));

  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 5000;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Hook timed out after ${timeout}ms`));
    }, timeout);

    const child = spawn(hookPath.endsWith(".ts") ? "bun" : "node", [hookPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();

    let output = "";
    let error = "";

    child.stdout.on("data", data => output += data.toString());
    child.stderr.on("data", data => error += data.toString());

    child.on("close", code => {
      clearTimeout(timer);
      const duration = performance.now() - startTime;

      if (options.verbose && error) {
        console.error(`[${hookName}] stderr:`, error);
      }

      // Log execution
      const logEntry = {
        timestamp: new Date().toISOString(),
        hook: hookName,
        duration,
        input,
        output,
        error,
        exitCode: code
      };

      const logFile = join(LOGS_DIR, `${hookName}-${Date.now()}.json`);
      writeFileSync(logFile, JSON.stringify(logEntry, null, 2));

      try {
        const result = JSON.parse(output) as HookResult;
        resolve({ ...result, duration });
      } catch (e) {
        reject(new Error(`Failed to parse hook output: ${output}`));
      }
    });
  });
}

/**
 * Benchmark a hook with multiple iterations
 */
async function benchmarkHook(
  hookPath: string,
  input: HookContext,
  options: SandboxOptions
): Promise<SandboxResult> {
  const iterations = options.iterations || 100;
  const durations: number[] = [];
  let lastResult: HookResult | undefined;

  console.log(`Benchmarking with ${iterations} iterations...`);

  for (let i = 0; i < iterations; i++) {
    if (i % 10 === 0) {
      console.log(`  Progress: ${i}/${iterations}`);
    }

    const result = await executeHook(hookPath, input, { ...options, verbose: false });
    durations.push(result.duration!);
    lastResult = result;
  }

  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const median = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];

  console.log(`
Benchmark Results:
  Iterations: ${iterations}
  Average: ${averageDuration.toFixed(2)}ms
  Median: ${median.toFixed(2)}ms
  Min: ${minDuration.toFixed(2)}ms
  Max: ${maxDuration.toFixed(2)}ms
  `);

  return {
    ...lastResult!,
    averageDuration,
    iterations
  };
}

/**
 * Find a hook in the sandbox
 */
function findHook(hookName: string): string | null {
  const locations = [
    join(HOOKS_DIR, hookName, "index.ts"),
    join(HOOKS_DIR, hookName, "index.js"),
    join(HOOKS_DIR, `${hookName}.ts`),
    join(HOOKS_DIR, `${hookName}.js`),
  ];

  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }

  return null;
}

/**
 * List all sandbox hooks
 */
export function listSandboxHooks(): string[] {
  const hooks: string[] = [];

  if (!existsSync(HOOKS_DIR)) {
    return hooks;
  }

  const entries = Bun.readdir(HOOKS_DIR);
  // @ts-ignore - Bun types
  for (const entry of entries) {
    if (entry.isDirectory() || entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
      hooks.push(entry.name.replace(/\.(ts|js)$/, ""));
    }
  }

  return hooks;
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
Carabiner Sandbox Runner

Usage:
  bun run sandbox <hook-name>              Run a hook
  bun run sandbox bench <hook-name>        Benchmark a hook
  bun run sandbox list                     List available hooks
  bun run sandbox help                     Show this help

Options:
  --verbose                                Show debug output
  --iterations <n>                         Number of benchmark iterations
  --timeout <ms>                           Hook timeout in milliseconds
  --input <file>                           Input fixture file

Examples:
  bun run sandbox bash-validator
  bun run sandbox bench bash-validator --iterations 1000
  bun run sandbox my-hook --input fixtures/tool-inputs/bash.json
    `);
    process.exit(0);
  }

  if (command === "list") {
    const hooks = listSandboxHooks();
    if (hooks.length === 0) {
      console.log("No hooks found in sandbox");
    } else {
      console.log("Available sandbox hooks:");
      hooks.forEach(h => console.log(`  - ${h}`));
    }
    process.exit(0);
  }

  // Parse options
  const options: SandboxOptions = {
    verbose: args.includes("--verbose"),
    benchmark: command === "bench",
    iterations: parseInt(args[args.indexOf("--iterations") + 1] || "100"),
    timeout: parseInt(args[args.indexOf("--timeout") + 1] || "5000")
  };

  const hookName = command === "bench" ? args[1] : command;

  // Load input
  let input: Partial<HookContext> = {};
  const inputIndex = args.indexOf("--input");
  if (inputIndex > -1) {
    const inputFile = args[inputIndex + 1];
    input = JSON.parse(readFileSync(inputFile, "utf-8"));
  }

  // Run the hook
  runSandbox(hookName, input, options)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === "success" ? 0 : 1);
    })
    .catch(err => {
      console.error("Error:", err);
      process.exit(1);
    });
}