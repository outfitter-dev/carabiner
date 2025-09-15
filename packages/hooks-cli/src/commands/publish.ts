#!/usr/bin/env bun

/**
 * Publish command for sharing Carabiner hooks
 *
 * Usage:
 *   carabiner publish               # Publish current directory as hook
 *   carabiner publish ./my-hook     # Publish specific directory
 *   carabiner publish --npm         # Publish to npm registry
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { HookManifest } from "../types/manifest";

/**
 * Create package.json for npm publishing
 */
function createPackageJson(manifest: HookManifest): Record<string, any> {
  const base = manifest.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const pkgName = manifest.name.startsWith("@carabiner/")
    ? manifest.name.toLowerCase()
    : `@carabiner/hook-${base}`;

  return {
    name: pkgName,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license || "MIT",
    main: manifest.files?.main || "index.js",
    types: manifest.files?.types,
    keywords: [
      "carabiner",
      "carabiner-hook",
      "claude-code",
      "hooks",
      ...(manifest.tags || []),
    ],
    files: ["index.js", "index.ts", "manifest.json", "README.md", "LICENSE"],
    repository: manifest.repository,
    carabiner: {
      manifest,
    },
    engines: {
      node: ">=22.0.0",
    },
    publishConfig: {
      access: "public",
    },
  };
}

/**
 * Validate hook before publishing
 */
async function validateHook(
  hookDir: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check for required files
  if (
    !(
      existsSync(join(hookDir, "index.js")) ||
      existsSync(join(hookDir, "index.ts"))
    )
  ) {
    errors.push("Missing index.js or index.ts file");
  }

  if (!existsSync(join(hookDir, "manifest.json"))) {
    errors.push("Missing manifest.json file");
  }

  // Validate manifest
  try {
    const manifest: HookManifest = JSON.parse(
      readFileSync(join(hookDir, "manifest.json"), "utf-8")
    );

    if (!manifest.name) {
      errors.push("Manifest missing 'name' field");
    }
    if (!manifest.version) {
      errors.push("Manifest missing 'version' field");
    }
    if (!manifest.description) {
      errors.push("Manifest missing 'description' field");
    }

    // Validate version format (strict semver check)
    if (
      !/^\d+\.\d+\.\d+(-[a-zA-Z0-9\-.]+)?(\+[a-zA-Z0-9\-.]+)?$/.test(
        manifest.version
      )
    ) {
      errors.push(
        "Invalid version format (should be valid semver like 1.0.0, 1.0.0-alpha.1, or 1.0.0+build.1)"
      );
    }
  } catch (error) {
    errors.push(`Invalid manifest.json: ${error}`);
  }

  // Test hook execution
  try {
    const testInput = JSON.stringify({
      hook_event_name: "PreToolUse",
      tool: "Test",
      session_id: "test",
      timestamp: new Date().toISOString(),
    });

    const hookPath = existsSync(join(hookDir, "index.ts"))
      ? join(hookDir, "index.ts")
      : join(hookDir, "index.js");

    const proc = Bun.spawn(
      [hookPath.endsWith(".ts") ? "bun" : "node", hookPath],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    proc.stdin.write(testInput);
    proc.stdin.end();

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      controller.abort();
    }, 5000);

    const output = await new Response(proc.stdout).text().catch(() => "");
    const exitCode = await proc.exited.catch(() => -1);
    clearTimeout(timeout);

    if (exitCode !== 0) {
      errors.push("Hook failed test execution");
    }

    try {
      JSON.parse(output);
    } catch {
      errors.push("Hook does not return valid JSON");
    }
  } catch (error) {
    errors.push(`Hook execution test failed: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Publish hook to npm
 */
async function publishToNpm(hookDir: string): Promise<boolean> {
  const manifest: HookManifest = JSON.parse(
    readFileSync(join(hookDir, "manifest.json"), "utf-8")
  );

  // Create package.json
  const pkgPath = join(hookDir, "package.json");
  if (existsSync(pkgPath)) {
    console.error("package.json already exists; refusing to overwrite. Specify fields in manifest.json or remove package.json.");
    return false;
  }
  const packageJson = createPackageJson(manifest, hookDir);
  writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2));

  // Create README if not exists
  if (!existsSync(join(hookDir, "README.md"))) {
    const readme = `# ${manifest.name}

${manifest.description}

## Installation

\`\`\`bash
carabiner add ${manifest.name}
\`\`\`

## Usage

Add to your \`.claude/settings.json\`:

\`\`\`json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "carabiner ${basename(manifest.name)}",
        "timeout": 5
      }]
    }]
  }
}
\`\`\`

${
  manifest.examples
    ? "## Examples\n\n" +
      manifest.examples
        .map(
          (ex) =>
            `### ${ex.name}\n\n${ex.description}\n\n\`\`\`json\n${JSON.stringify(ex.config, null, 2)}\n\`\`\``
        )
        .join("\n\n")
    : ""
}

## Author

${typeof manifest.author === "string" ? manifest.author : manifest.author.name}

## License

${manifest.license || "MIT"}
`;
    writeFileSync(join(hookDir, "README.md"), readme);
  }

  console.log(
    `📤 Publishing to npm as ${packageJson.name}@${packageJson.version}...`
  );

  // Run npm publish
  return new Promise((resolve) => {
    const proc = spawn("npm", ["publish", "--access", "public"], {
      cwd: hookDir,
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Publish to GitHub registry (create release)
 */
async function publishToGitHub(hookDir: string): Promise<boolean> {
  const manifest: HookManifest = JSON.parse(
    readFileSync(join(hookDir, "manifest.json"), "utf-8")
  );

  console.log(
    `📤 Creating GitHub release for ${manifest.name}@${manifest.version}...`
  );

  // Use gh CLI to create release
  return new Promise((resolve) => {
    const proc = spawn(
      "gh",
      [
        "release",
        "create",
        `v${manifest.version}`,
        "--title",
        `${manifest.name} v${manifest.version}`,
        "--notes",
        manifest.description,
        ...(existsSync(join(hookDir, "index.js"))
          ? [join(hookDir, "index.js")]
          : []),
        ...(existsSync(join(hookDir, "index.ts"))
          ? [join(hookDir, "index.ts")]
          : []),
        join(hookDir, "manifest.json"),
      ],
      {
        cwd: hookDir,
        stdio: "inherit",
      }
    );

    proc.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Main publish function
 */
export async function publishHook(
  hookDir: string = process.cwd(),
  options: {
    npm?: boolean;
    github?: boolean;
    registry?: string;
  } = {}
) {
  console.log(`🔍 Validating hook in ${hookDir}...`);

  // Validate hook
  const validation = await validateHook(hookDir);
  if (!validation.valid) {
    console.error("❌ Validation failed:");
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    return false;
  }

  console.log("✅ Validation passed");

  // Read manifest
  const manifest: HookManifest = JSON.parse(
    readFileSync(join(hookDir, "manifest.json"), "utf-8")
  );

  // Publish to specified targets
  let success = false;

  if (options.npm) {
    success = await publishToNpm(hookDir);
    if (success) {
      console.log(`✅ Published to npm as @carabiner/hook-${manifest.name}`);
      console.log(`   Install with: carabiner add ${manifest.name}`);
    }
  }

  if (options.github) {
    success = await publishToGitHub(hookDir);
    if (success) {
      console.log(`✅ Created GitHub release v${manifest.version}`);
    }
  }

  if (options.registry) {
    // TODO: Publish to custom Carabiner registry
    console.log("📝 Custom registry publishing coming soon!");
  }

  if (!(options.npm || options.github || options.registry)) {
    console.log(`
Choose a publishing target:
  carabiner publish --npm      Publish to npm registry
  carabiner publish --github   Create GitHub release
  carabiner publish --registry https://registry.carabiner.dev
`);
  }

  return success;
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const hookDir = args.find((arg) => !arg.startsWith("--")) || process.cwd();

  const options = {
    npm: args.includes("--npm"),
    github: args.includes("--github"),
    registry: args.find((arg) => arg.startsWith("--registry="))?.split("=")[1],
  };

  publishHook(hookDir, options).then((success) => {
    process.exit(success ? 0 : 1);
  });
}
