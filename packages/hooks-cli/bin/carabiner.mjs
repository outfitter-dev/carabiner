#!/usr/bin/env node

/**
 * Carabiner CLI - ESM Version
 * Requires Node.js v22.0.0 or later
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
// Try to load help renderer from compiled sources; fallback later if not found
let renderHelp;
try {
  const helpUrl = new URL('../dist/help.js', import.meta.url);
  const mod = await import(helpUrl.href);
  renderHelp = mod.renderHelp;
} catch {}

// Version check
const nodeVersion = process.versions.node.split(".").map(Number);
if (nodeVersion[0] < 22) {
  console.error("Error: Carabiner CLI requires Node.js v22.0.0 or later");
  console.error(`Current version: v${process.versions.node}`);
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  if (renderHelp) {
    console.log(renderHelp());
  } else {
    console.log(`\nCarabiner - Claude Code Hook Manager\n\nUsage:\n  carabiner <hook-name>           Run a hook by name\n  carabiner [command]             Run a specific command\n\nCommands:\n  run          Run a hook by name (default)\n  list         List available hooks\n  init         Initialize .carabiner directory\n  add          Install a hook (registry, npm, or GitHub)\n  browse       Interactive browser for discovering hooks\n  publish      Validate and publish a hook\n  --version    Show version\n  --help       Show help\n`);
  }
  process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
  console.log("Carabiner v0.1.0-alpha (ESM)");
  process.exit(0);
}

// Find hook implementation
function findHook(hookName) {
  const aliases = { "bash-validator": "bash-command-validator" };
  const name = aliases[hookName] || hookName;
  const locations = [
    // Project-specific
    join(process.cwd(), ".carabiner", "hooks", name, "index.js"),
    join(process.cwd(), ".carabiner", "hooks", name, "index.mjs"),
    join(process.cwd(), ".carabiner", "hooks", `${name}.js`),
    join(process.cwd(), ".carabiner", "hooks", `${name}.mjs`),
    // Global
    join(homedir(), ".carabiner", "hooks", name, "index.js"),
    join(homedir(), ".carabiner", "hooks", name, "index.mjs"),
    join(homedir(), ".carabiner", "hooks", `${name}.js`),
    join(homedir(), ".carabiner", "hooks", `${name}.mjs`),
  ];

  // Check each location
  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }

  // Check for built-in hooks from @carabiner/examples
  try {
    const examplesPath = require.resolve("@carabiner/examples");
    const builtInHook = join(dirname(examplesPath), "dist", `${name}.js`);
    if (existsSync(builtInHook)) {
      return builtInHook;
    }
  } catch {
    // @carabiner/examples not installed
  }

  return null;
}

// List available hooks
function listHooks() {
  const hooks = new Map();

  // Check project hooks
  const projectDir = join(process.cwd(), ".carabiner", "hooks");
  if (existsSync(projectDir)) {
    for (const entry of readdirSync(projectDir)) {
      const stat = statSync(join(projectDir, entry));
      if (
        stat.isDirectory() ||
        entry.endsWith(".js") ||
        entry.endsWith(".mjs")
      ) {
        hooks.set(entry.replace(/\.(m)?js$/, ""), "project");
      }
    }
  }

  // Check global hooks
  const globalDir = join(homedir(), ".carabiner", "hooks");
  if (existsSync(globalDir)) {
    for (const entry of readdirSync(globalDir)) {
      const stat = statSync(join(globalDir, entry));
      if (
        (stat.isDirectory() ||
          entry.endsWith(".js") ||
          entry.endsWith(".mjs")) &&
        !hooks.has(entry.replace(/\.(m)?js$/, ""))
      ) {
        const name = entry.replace(/\.(m)?js$/, "");
        hooks.set(name, "global");
      }
    }
  }

  // Check built-in hooks
  try {
    const examplesPath = require.resolve("@carabiner/examples");
    const distDir = join(dirname(examplesPath), "dist");
    if (existsSync(distDir)) {
      for (const file of readdirSync(distDir)) {
        if (file.endsWith(".js") && !hooks.has(file.replace(".js", ""))) {
          hooks.set(file.replace(".js", ""), "built-in");
        }
      }
    }
  } catch {
    // @carabiner/examples not installed
  }

  if (hooks.size === 0) {
    console.log("No hooks found.");
    console.log('Run "carabiner init" to create a .carabiner directory');
    return;
  }

  console.log("Available hooks:\n");
  for (const [name, location] of hooks) {
    console.log(`  ${name.padEnd(20)} (${location})`);
  }
}

// Initialize project
function initProject() {
  const dir = join(process.cwd(), ".carabiner", "hooks");
  if (existsSync(dir)) {
    console.log(".carabiner directory already exists");
    return;
  }

  mkdirSync(dir, { recursive: true });

  // Create README
  const readme = `# Carabiner Hook Directory

This directory contains local Carabiner hooks for this project.

## Structure

\`\`\`
.carabiner/
├── hooks/
│   └── my-custom-hook/
│       └── index.js
└── config.json (optional)
\`\`\`

## Creating Hooks

1. Create a directory in \`.carabiner/hooks/\`
2. Add an \`index.js\` or \`index.mjs\` file
3. The hook should read JSON from stdin and write JSON to stdout

Example hook:

\`\`\`javascript
// Read input
let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  const input = JSON.parse(inputData);

  // Process and return result
  console.log(JSON.stringify({
    status: 'success',
    message: 'Hook executed'
  }));
});
\`\`\`
`;

  writeFileSync(join(process.cwd(), ".carabiner", "README.md"), readme);
  console.log("Created .carabiner directory structure");
}

// Main execution
async function main() {
  const command = args[0];

  if (command === "list") {
    listHooks();
    return;
  }

  if (command === "init") {
    initProject();
    return;
  }

  // Handle new commands
  if (command === "add") {
    const { add } = await import("../dist/commands/add.js");
    await add(args.slice(1));
    return;
  }

  if (command === "browse") {
    const { browse } = await import("../dist/commands/browse.js");
    await browse(args.slice(1));
    return;
  }

  if (command === "publish") {
    const { publish } = await import("../dist/commands/publish.js");
    await publish(args.slice(1));
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
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString();

  // Execute hook
  const child = spawn("node", [hookPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Pass input
  child.stdin.write(input);
  child.stdin.end();

  // Collect output
  let output = "";
  let error = "";

  child.stdout.on("data", (data) => (output += data.toString()));
  child.stderr.on("data", (data) => (error += data.toString()));

  child.on("close", (code) => {
    // Output JSON result
    if (output) {
      // Try to parse as JSON first
      try {
        const trimmed = output.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          JSON.parse(trimmed); // Validate it's valid JSON
          console.log(trimmed);
        } else {
          // Try to find first complete JSON object
          const firstBrace = output.indexOf('{');
          if (firstBrace >= 0) {
            let depth = 0;
            let inString = false;
            let escape = false;
            for (let i = firstBrace; i < output.length; i++) {
              const char = output[i];
              if (!escape) {
                if (char === '"') inString = !inString;
                else if (!inString) {
                  if (char === '{') depth++;
                  else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                      const json = output.substring(firstBrace, i + 1);
                      JSON.parse(json); // Validate
                      console.log(json);
                      break;
                    }
                  }
                }
                escape = char === '\\';
              } else {
                escape = false;
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

    if (error && code !== 0) {
      console.error(error);
    }

    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
