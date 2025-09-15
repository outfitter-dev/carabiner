#!/usr/bin/env bun

/**
 * Browse and discover Carabiner hooks
 * Similar to npx shadcn-ui@latest init
 *
 * Usage:
 *   carabiner browse                # Interactive browser
 *   carabiner search bash           # Search for hooks
 *   carabiner info bash-validator   # Get hook details
 */

import { confirm, input, select } from "@inquirer/prompts";
import type { HookManifest } from "../types/manifest";
import { installHook } from "./add";

const REGISTRY_URL = "https://registry.carabiner.dev";
const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * Featured hooks for quick discovery
 */
const FEATURED_HOOKS = [
  {
    name: "bash-validator",
    description: "Validates bash commands and suggests safer alternatives",
    category: "security",
  },
  {
    name: "commit-helper",
    description: "Helps write better commit messages",
    category: "git",
  },
  {
    name: "test-runner",
    description: "Automatically runs tests before code changes",
    category: "testing",
  },
  {
    name: "security-scanner",
    description: "Scans for security vulnerabilities",
    category: "security",
  },
  {
    name: "formatter",
    description: "Auto-formats code with Prettier/Biome",
    category: "code-quality",
  },
  {
    name: "dependency-checker",
    description: "Checks for outdated or vulnerable dependencies",
    category: "dependencies",
  },
];

/**
 * Categories for browsing
 */
const CATEGORIES = {
  security: "Security & validation",
  git: "Git & version control",
  testing: "Testing & quality",
  "code-quality": "Code quality & formatting",
  dependencies: "Dependency management",
  documentation: "Documentation generation",
  performance: "Performance optimization",
  deployment: "Deployment & CI/CD",
  custom: "Custom & experimental",
};

/**
 * Search for hooks
 */
async function searchHooks(
  query: string
): Promise<Array<{ name: string; description: string }>> {
  // Try local registry first
  try {
    const response = await fetch(
      `${REGISTRY_URL}/search?q=${encodeURIComponent(query)}`
    );
    if (response.ok) {
      const results = await response.json();
      return results.hooks || [];
    }
  } catch {
    // Registry might not exist yet
  }

  // Search npm for @carabiner/* packages
  try {
    const response = await fetch(
      `${NPM_REGISTRY}/-/v1/search?text=@carabiner+${encodeURIComponent(query)}+keywords:carabiner-hook`
    );
    if (response.ok) {
      const data = await response.json();
      return data.objects.map((obj: any) => ({
        name: obj.package.name.replace("@carabiner/hook-", ""),
        description: obj.package.description,
      }));
    }
  } catch {
    // npm search failed
  }

  // Return featured hooks that match
  return FEATURED_HOOKS.filter(
    (hook) =>
      hook.name.includes(query.toLowerCase()) ||
      hook.description.toLowerCase().includes(query.toLowerCase())
  );
}

/**
 * Get hook details
 */
async function getHookInfo(hookName: string): Promise<HookManifest | null> {
  // Try registry
  try {
    const response = await fetch(
      `${REGISTRY_URL}/hooks/${hookName}/manifest.json`
    );
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Not in registry
  }

  // Try npm
  const pkgName = hookName.startsWith("@carabiner/")
    ? hookName
    : `@carabiner/hook-${hookName}`;

  try {
    const response = await fetch(`${NPM_REGISTRY}/${pkgName}/latest`);
    if (response.ok) {
      const pkg = await response.json();
      return (
        pkg.carabiner?.manifest || {
          name: hookName,
          version: pkg.version,
          description: pkg.description,
          author: pkg.author,
          source: `npm:${pkgName}`,
          tags: pkg.keywords,
        }
      );
    }
  } catch {
    // Not on npm
  }

  return null;
}

/**
 * Interactive hook browser
 */
async function browseInteractive() {
  console.log(`
🪝 Carabiner Hook Browser
─────────────────────────
`);

  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "🌟 Browse featured hooks", value: "featured" },
      { name: "📂 Browse by category", value: "category" },
      { name: "🔍 Search for hooks", value: "search" },
      { name: "📦 View installed hooks", value: "installed" },
      { name: "✨ Create new hook", value: "create" },
    ],
  });

  switch (action) {
    case "featured": {
      const hook = await select({
        message: "Select a featured hook:",
        choices: FEATURED_HOOKS.map((h) => ({
          name: `${h.name} - ${h.description}`,
          value: h.name,
        })),
      });

      await showHookDetails(hook);
      break;
    }

    case "category": {
      const category = await select({
        message: "Select a category:",
        choices: Object.entries(CATEGORIES).map(([key, name]) => ({
          name,
          value: key,
        })),
      });

      const hooks = FEATURED_HOOKS.filter((h) => h.category === category);
      if (hooks.length === 0) {
        console.log("No hooks in this category yet.");
        return;
      }

      const hook = await select({
        message: `Select a ${CATEGORIES[category as keyof typeof CATEGORIES]} hook:`,
        choices: hooks.map((h) => ({
          name: `${h.name} - ${h.description}`,
          value: h.name,
        })),
      });

      await showHookDetails(hook);
      break;
    }

    case "search": {
      const query = await input({
        message: "Search for hooks:",
        default: "",
      });

      const results = await searchHooks(query);
      if (results.length === 0) {
        console.log("No hooks found.");
        return;
      }

      const hook = await select({
        message: "Select a hook:",
        choices: results.map((h) => ({
          name: `${h.name} - ${h.description}`,
          value: h.name,
        })),
      });

      await showHookDetails(hook);
      break;
    }

    case "installed": {
      // TODO: List installed hooks
      console.log("Listing installed hooks coming soon!");
      break;
    }

    case "create": {
      console.log(`
To create a new hook:

1. Create a directory for your hook
2. Add index.js or index.ts with your hook logic
3. Create manifest.json with hook metadata
4. Run 'carabiner publish' to share it

Example structure:
  my-hook/
    ├── index.ts
    ├── manifest.json
    └── README.md

Learn more: https://carabiner.dev/docs/creating-hooks
`);
      break;
    }
  }
}

/**
 * Show hook details and offer installation
 */
async function showHookDetails(hookName: string) {
  console.log(`\nFetching details for ${hookName}...`);

  const manifest = await getHookInfo(hookName);
  if (!manifest) {
    console.log("Could not find hook details.");
    return;
  }

  console.log(`
📦 ${manifest.name} v${manifest.version}
─────────────────────────
${manifest.description}

Author: ${typeof manifest.author === "string" ? manifest.author : manifest.author.name}
Source: ${manifest.source}
${manifest.tags ? `Tags: ${manifest.tags.join(", ")}` : ""}

${
  manifest.config
    ? `Configuration:
  Events: ${manifest.config.events?.join(", ") || "All"}
  Tools: ${manifest.config.tools?.join(", ") || "All"}
  Blocking: ${manifest.config.blocking ? "Yes" : "No"}
`
    : ""
}
`);

  const shouldInstall = await confirm({
    message: "Would you like to install this hook?",
    default: true,
  });

  if (shouldInstall) {
    const global = await confirm({
      message: "Install globally? (Otherwise installs to current project)",
      default: false,
    });

    await installHook(hookName, { global, withDependencies: true });
  }
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "search") {
    const query = args.slice(1).join(" ");
    searchHooks(query).then((results) => {
      if (results.length === 0) {
        console.log("No hooks found.");
      } else {
        results.forEach((hook) => {
          console.log(`${hook.name} - ${hook.description}`);
        });
      }
    });
  } else if (command === "info") {
    const hookName = args[1];
    if (!hookName) {
      console.error("Usage: carabiner info <hook-name>");
      process.exit(1);
    }
    showHookDetails(hookName);
  } else {
    browseInteractive();
  }
}
