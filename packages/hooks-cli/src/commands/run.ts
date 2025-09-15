#!/usr/bin/env node

/**
 * Carabiner Hook Runner
 *
 * This command allows running hooks by name:
 * `carabiner run <hook-name>`
 *
 * It searches for hooks in:
 * 1. .carabiner/hooks/<hook-name>/ (project-specific)
 * 2. ~/.carabiner/hooks/<hook-name>/ (global)
 * 3. Built-in hooks from @carabiner/examples
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);

// Removed unused HookConfig to satisfy strict noUnusedLocals

export class HookRunner {
  private readonly projectHooksDir = path.join(
    process.cwd(),
    ".carabiner",
    "hooks"
  );
  private readonly globalHooksDir = path.join(
    os.homedir(),
    ".carabiner",
    "hooks"
  );

  /**
   * Find a hook by name in various locations
   */
  private findHook(hookName: string): string | null {
    const alias = this.resolveAlias(hookName);
    const name = alias ?? hookName;
    // Check project-specific hooks first
    const projectHook = path.join(this.projectHooksDir, name, "index.js");
    if (fs.existsSync(projectHook)) {
      return projectHook;
    }

    // Check global hooks
    const globalHook = path.join(this.globalHooksDir, name, "index.js");
    if (fs.existsSync(globalHook)) {
      return globalHook;
    }

    // Check built-in hooks (if @carabiner/examples is installed)
    try {
      const builtInPath = require.resolve(
        `@carabiner/examples/dist/${name}.js`
      );
      if (fs.existsSync(builtInPath)) {
        return builtInPath;
      }
    } catch {
      // Not found in built-in hooks
    }

    return null;
  }

  private resolveAlias(hookName: string): string | null {
    const aliases: Record<string, string> = {
      "bash-validator": "bash-command-validator",
    };
    return aliases[hookName] ?? null;
  }

  /**
   * Run a hook by name
   */
  async run(hookName: string): Promise<void> {
    const hookPath = this.findHook(hookName);

    if (!hookPath) {
      console.error(
        JSON.stringify({
          status: "failure",
          message: `Hook '${hookName}' not found`,
          blocking: true,
        })
      );
      process.exit(1);
    }

    // Read stdin for hook input
    let inputData = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      inputData += chunk;
    });

    process.stdin.on("end", () => {
      // Run the hook
      const hookProcess = spawn("node", [hookPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Forward input to hook
      hookProcess.stdin.write(inputData);
      hookProcess.stdin.end();

      // Capture output
      let output = "";
      let error = "";

      hookProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      hookProcess.stderr.on("data", (data) => {
        error += data.toString();
      });

      hookProcess.on("close", (code) => {
        // Forward hook output
        if (output) {
          // Try to parse as JSON first
          try {
            const trimmed = output.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
              JSON.parse(trimmed); // Validate it's valid JSON
              console.log(trimmed);
            } else {
              // Try to find first complete JSON object
              const firstBrace = output.indexOf("{");
              if (firstBrace >= 0) {
                let depth = 0;
                let inString = false;
                let isEscaped = false;
                for (let i = firstBrace; i < output.length; i++) {
                  const char = output[i];
                  if (isEscaped) {
                    isEscaped = false;
                  } else {
                    if (char === '"') {
                      inString = !inString;
                    } else if (!inString) {
                      if (char === "{") {
                        depth++;
                      } else if (char === "}") {
                        depth--;
                        if (depth === 0) {
                          const json = output.substring(firstBrace, i + 1);
                          JSON.parse(json); // Validate
                          console.log(json);
                          break;
                        }
                      }
                    }
                    isEscaped = char === "\\";
                  }
                }
              } else {
                console.log(output);
              }
            }
          } catch {
            console.log(output);
          }
        } else if (code !== 0) {
          console.error(
            JSON.stringify({
              status: "failure",
              message: `Hook exited with code ${code}`,
              error: error || undefined,
            })
          );
        } else {
          // Default success
          console.log(
            JSON.stringify({
              status: "success",
              message: `Hook '${hookName}' executed`,
            })
          );
        }

        process.exit(code || 0);
      });
    });
  }

  /**
   * List available hooks
   */
  async list(): Promise<void> {
    const hooks: Array<{ name: string; location: string }> = [];

    // List project hooks
    if (fs.existsSync(this.projectHooksDir)) {
      const projectHooks = fs
        .readdirSync(this.projectHooksDir)
        .filter((name) =>
          fs.statSync(path.join(this.projectHooksDir, name)).isDirectory()
        );

      projectHooks.forEach((name) => {
        hooks.push({ name, location: "project" });
      });
    }

    // List global hooks
    if (fs.existsSync(this.globalHooksDir)) {
      const globalHooks = fs
        .readdirSync(this.globalHooksDir)
        .filter((name) =>
          fs.statSync(path.join(this.globalHooksDir, name)).isDirectory()
        );

      globalHooks.forEach((name) => {
        if (!hooks.find((h) => h.name === name)) {
          hooks.push({ name, location: "global" });
        }
      });
    }

    console.log("Available hooks:");
    hooks.forEach((hook) => {
      console.log(`  ${hook.name} (${hook.location})`);
    });
  }

  /**
   * Install a hook from npm or a local path
   */
  async install(source: string, _hookName?: string): Promise<void> {
    // Implementation for installing hooks
    // This could download from npm, copy from local path, etc.
    console.log(`Installing hook from ${source}...`);
    // TODO: Implement installation logic
  }
}

// CLI entry point
// Check if this file is being run directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/run.js")
) {
  const args = process.argv.slice(2);
  const runner = new HookRunner();

  if (args.length === 0 || args[0] === "list") {
    runner.list();
  } else if (args[0] === "install" && args[1]) {
    runner.install(args[1], args[2]);
  } else {
    // Default to running the hook (args[0] is defined in this branch)
    const cmd = args[0]!;
    runner.run(cmd);
  }
}
