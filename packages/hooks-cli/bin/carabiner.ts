#!/usr/bin/env bun

/**
 * Carabiner Hook Runner - Bun Native
 *
 * Build standalone binary with:
 * bun build --compile --target=bun --outfile=carabiner ./bin/carabiner.ts
 *
 * This creates a single executable that includes Bun runtime,
 * so users don't need Node or Bun installed.
 */

const args = Bun.argv.slice(2);

// Help text
if (args[0] === "--help" || args[0] === "-h") {
  // Prefer help from source so it's always in sync
  const { renderHelp } = await import("../src/help.ts");
  console.log(renderHelp());
  process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
  console.log("Carabiner v0.1.0-alpha (Bun runtime)");
  process.exit(0);
}

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Find hook implementation
function findHook(hookName: string): string | null {
  const locations = [
    // Project-specific
    path.join(process.cwd(), ".carabiner", "hooks", hookName, "index.js"),
    path.join(process.cwd(), ".carabiner", "hooks", `${hookName}.js`),
    // Global
    path.join(os.homedir(), ".carabiner", "hooks", hookName, "index.js"),
    path.join(os.homedir(), ".carabiner", "hooks", `${hookName}.js`),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }

  return null;
}

// List available hooks
function listHooks(): void {
  const hooks = new Map<string, string>();

  // Check project hooks
  const projectDir = path.join(process.cwd(), ".carabiner", "hooks");
  if (fs.existsSync(projectDir)) {
    for (const entry of fs.readdirSync(projectDir)) {
      const stat = fs.statSync(path.join(projectDir, entry));
      if (stat.isDirectory() || entry.endsWith(".js")) {
        const name = entry.replace(/\.js$/, "");
        hooks.set(name, "project");
      }
    }
  }

  // Check global hooks
  const globalDir = path.join(os.homedir(), ".carabiner", "hooks");
  if (fs.existsSync(globalDir)) {
    for (const entry of fs.readdirSync(globalDir)) {
      const stat = fs.statSync(path.join(globalDir, entry));
      if (
        (stat.isDirectory() || entry.endsWith(".js")) &&
        !hooks.has(entry.replace(/\.js$/, ""))
      ) {
        const name = entry.replace(/\.js$/, "");
        hooks.set(name, "global");
      }
    }
  }

  if (hooks.size === 0) {
    console.log("No hooks found.");
    console.log("Run 'carabiner init' to set up hooks");
  } else {
    console.log("Available hooks:");
    for (const [name, location] of hooks) {
      console.log(`  ${name} (${location})`);
    }
  }
}

// Initialize project
function initProject(): void {
  const dirs = [".carabiner", ".carabiner/hooks"];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created ${dir}/`);
    }
  }

  // Create example hook
  const exampleHook = path.join(".carabiner", "hooks", "example.js");
  if (!fs.existsSync(exampleHook)) {
    const example = `#!/usr/bin/env node
// Example Carabiner hook

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);

  // Your hook logic here
  console.log(JSON.stringify({
    status: 'success',
    message: 'Example hook executed'
  }));
});
`;
    fs.writeFileSync(exampleHook, example);
    console.log("Created example hook");
  }

  console.log("\n✅ Carabiner initialized!");
  console.log("Next: Configure Claude Code to use 'carabiner <hook-name>'");
}

// Main execution
async function main() {
  const command = args[0];

  if (!command) {
    console.error(
      JSON.stringify({
        status: "failure",
        message: "No hook command provided",
        blocking: true,
      })
    );
    process.exit(1);
  }

  if (command === "list") {
    listHooks();
    return;
  }

  if (command === "init") {
    initProject();
    return;
  }

  // Run hook
  const hookPath = findHook(command);
  if (!hookPath) {
    console.error(
      JSON.stringify({
        status: "failure",
        message: `Hook '${command}' not found`,
        blocking: true,
      })
    );
    process.exit(1);
  }

  // Read stdin
  const stdin = await Bun.stdin.text();

  // Write stdin to a unique temp file for passing to the subprocess
  const tempFile = `/tmp/carabiner-input-${process.pid}-${Date.now()}.json`;
  await Bun.write(tempFile, stdin);

  // Execute hook with Bun for better performance
  const proc = Bun.spawn(
    [hookPath.endsWith(".ts") ? "bun" : "node", hookPath],
    {
      stdin: Bun.file(tempFile),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const output = await (proc.stdout as any).text();
  const error = await (proc.stderr as any).text();

  // Clean up temp file
  try {
    fs.unlinkSync(tempFile);
  } catch {
    // Ignore cleanup errors
  }

  // Output JSON result
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
  }

  if (error && proc.exitCode !== 0) {
    console.error(error);
  }

  process.exit(proc.exitCode || 0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
