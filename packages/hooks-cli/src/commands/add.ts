#!/usr/bin/env bun

/**
 * Add command for installing Carabiner hooks
 * Similar to shadcn/ui's add command
 *
 * Usage:
 *   carabiner add bash-validator
 *   carabiner add @username/custom-hook
 *   carabiner add https://github.com/user/hook
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { HookManifest } from "../types/manifest";

const REGISTRY_URL = "https://registry.carabiner.dev/hooks";
const NPM_REGISTRY = "https://registry.npmjs.org";

interface HookRegistry {
  name: string;
  description: string;
  author: string;
  version: string;
  source: string;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Fetch hook from registry
 */
async function fetchFromRegistry(
  hookName: string
): Promise<HookRegistry | null> {
  try {
    // Try Carabiner registry first
    const response = await fetch(`${REGISTRY_URL}/${hookName}.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // Registry might not exist yet
  }

  // Try npm registry
  if (hookName.startsWith("@") || hookName.includes("/")) {
    // User specified exact package name
    try {
      const response = await fetch(`${NPM_REGISTRY}/${hookName}/latest`);
      if (response.ok) {
        const pkg = await response.json();
        return {
          name: hookName,
          description: pkg.description,
          author:
            typeof pkg.author === "object"
              ? pkg.author?.name || ""
              : pkg.author || "",
          version: pkg.version,
          source: `npm:${hookName}`,
          dependencies: pkg.carabiner?.dependencies,
          tags: pkg.keywords,
        };
      }
    } catch (error) {
      // Not found with exact name
    }
  } else {
    // Try official @carabiner/ scope first
    try {
      const officialName = `@carabiner/hook-${hookName}`;
      const response = await fetch(`${NPM_REGISTRY}/${officialName}/latest`);
      if (response.ok) {
        const pkg = await response.json();
        return {
          name: hookName,
          description: pkg.description,
          author:
            typeof pkg.author === "object"
              ? pkg.author?.name || ""
              : pkg.author || "",
          version: pkg.version,
          source: `npm:${officialName}`,
          dependencies: pkg.carabiner?.dependencies,
          tags: pkg.keywords,
        };
      }
    } catch {
      // Not in official registry
    }

    // Search for community packages
    try {
      const searchUrl = `${NPM_REGISTRY}/-/v1/search?text=carabiner-hook-${hookName}+keywords:carabiner-hook`;
      const response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.objects.length > 0) {
          const pkg = data.objects[0].package;
          console.log(`Found community hook: ${pkg.name}`);
          return {
            name: hookName,
            description: pkg.description,
            author:
              typeof pkg.author === "object"
                ? pkg.author?.name || ""
                : pkg.author || "",
            version: pkg.version,
            source: `npm:${pkg.name}`,
            dependencies: pkg.carabiner?.dependencies,
            tags: pkg.keywords,
          };
        }
      }
    } catch {
      // No community packages found
    }
  }

  return null;
}

/**
 * Fetch hook from GitHub
 */
async function fetchFromGitHub(url: string): Promise<string | null> {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return null;
  }

  const [, owner, repo] = match;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/index.ts`;

  try {
    const response = await fetch(rawUrl);
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Try index.js
    const jsUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/index.js`;
    const response = await fetch(jsUrl);
    if (response.ok) {
      return await response.text();
    }
  }

  return null;
}

/**
 * Install a hook
 */
export async function installHook(
  hookName: string,
  options: {
    global?: boolean;
    force?: boolean;
    withDependencies?: boolean;
  } = {}
) {
  const targetDir = options.global
    ? join(homedir(), ".carabiner", "hooks")
    : join(process.cwd(), ".carabiner", "hooks");

  // Ensure directory exists
  mkdirSync(targetDir, { recursive: true });

  console.log(`📦 Installing ${hookName}...`);

  // Check if hook already exists
  const parts = hookName.split("/");
  const hookBaseName = parts.at(-1) || hookName;
  const hookDir = join(targetDir, hookBaseName);
  if (existsSync(hookDir) && !options.force) {
    console.error("❌ Hook already exists. Use --force to overwrite.");
    return false;
  }

  // Fetch hook content
  let hookContent: string | null = null;
  let metadata: HookRegistry | null = null;

  // Try different sources
  if (hookName.startsWith("http")) {
    // Direct URL
    hookContent = await fetchFromGitHub(hookName);
  } else {
    // Try registry
    metadata = await fetchFromRegistry(hookName);
    if (metadata) {
      if (metadata.source.startsWith("npm:")) {
        // Install from npm
        const pkgName = metadata.source.replace("npm:", "");
        console.log(`  Installing from npm: ${pkgName}`);

        const proc = Bun.spawn(["bun", "add", pkgName], {
          cwd: targetDir,
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          console.error(`Failed to install npm package: ${stderr}`);
          return false;
        }

        // Copy hook files
        const nodeModulesPath = join(targetDir, "node_modules", pkgName);
        if (existsSync(nodeModulesPath)) {
          const pkgJson = JSON.parse(
            readFileSync(join(nodeModulesPath, "package.json"), "utf-8")
          );
          const main = pkgJson.main || "index.js";
          hookContent = readFileSync(join(nodeModulesPath, main), "utf-8");
        }
      } else if (metadata.source.startsWith("http")) {
        hookContent = await fetchFromGitHub(metadata.source);
      }
    }
  }

  if (!hookContent) {
    console.error(`❌ Could not find hook: ${hookName}`);
    return false;
  }

  // Create hook directory
  mkdirSync(hookDir, { recursive: true });

  // Write hook file
  const hookFile = join(hookDir, "index.js");
  writeFileSync(hookFile, hookContent);

  // Write manifest
  const manifest: HookManifest = {
    name: metadata?.name || hookName,
    version: metadata?.version || "latest",
    description: metadata?.description || "",
    author: metadata?.author || "",
    source: metadata?.source || hookName,
    installedAt: new Date().toISOString(),
    dependencies: metadata?.dependencies || [],
  };

  writeFileSync(
    join(hookDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // Install dependencies if requested
  const deps = manifest.dependencies ?? [];
  if (options.withDependencies && deps.length > 0) {
    console.log("  Installing dependencies...");
    for (const dep of deps) {
      await installHook(dep, { ...options, withDependencies: false });
    }
  }

  console.log(`✅ Installed ${hookName} to ${hookDir}`);

  // Show usage instructions
  console.log(`
To use this hook, add to your .claude/settings.json:

{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "carabiner ${basename(hookDir)}",
        "timeout": 5
      }]
    }]
  }
}
`);

  return true;
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const hookName = args[0];

  if (!hookName) {
    console.error("Usage: carabiner add <hook-name>");
    process.exit(1);
  }

  const options = {
    global: args.includes("--global") || args.includes("-g"),
    force: args.includes("--force") || args.includes("-f"),
    withDependencies: !args.includes("--no-deps"),
  };

  installHook(hookName, options)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`Installation failed: ${error.message}`);
      process.exit(1);
    });
}
