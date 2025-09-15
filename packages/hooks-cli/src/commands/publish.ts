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
function createPackageJson(manifest: HookManifest, hookDir: string): Record<string, any> {
  const base = manifest.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const pkgName = manifest.name.startsWith("@carabiner/")
    ? manifest.name.toLowerCase()
    : `@carabiner/hook-${base}`;

  // Determine main entry point based on actual files
  let mainEntry = "index.js";
  if (manifest.files?.main && existsSync(join(hookDir, manifest.files.main))) {
    mainEntry = manifest.files.main;
  } else if (existsSync(join(hookDir, "dist/index.js"))) {
    mainEntry = "dist/index.js";
  } else if (existsSync(join(hookDir, "index.js"))) {
    mainEntry = "index.js";
  }

  // Build files list based on actual files present
  const filesList: string[] = [];
  const possibleFiles = [
    mainEntry,
    "index.ts",
    "manifest.json",
    "README.md",
    "LICENSE",
    "dist/**/*",
  ];

  for (const file of possibleFiles) {
    if (file.includes("*")) {
      // Handle glob patterns like dist/**/*
      const baseDir = file.split("/")[0];
      if (baseDir && existsSync(join(hookDir, baseDir))) {
        filesList.push(file);
      }
    } else if (existsSync(join(hookDir, file))) {
      filesList.push(file);
    }
  }

  // Add types if they exist
  let typesEntry: string | undefined;
  if (manifest.files?.types && existsSync(join(hookDir, manifest.files.types))) {
    typesEntry = manifest.files.types;
    if (!filesList.includes(typesEntry)) {
      filesList.push(typesEntry);
    }
  } else if (existsSync(join(hookDir, "index.d.ts"))) {
    typesEntry = "index.d.ts";
    if (!filesList.includes(typesEntry)) {
      filesList.push(typesEntry);
    }
  } else if (existsSync(join(hookDir, "dist/index.d.ts"))) {
    typesEntry = "dist/index.d.ts";
    if (!filesList.includes(typesEntry)) {
      filesList.push(typesEntry);
    }
  }

  return {
    name: pkgName,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license || "MIT",
    main: mainEntry,
    types: typesEntry,
    keywords: [
      "carabiner",
      "carabiner-hook",
      "claude-code",
      "hooks",
      ...(manifest.tags || []),
    ],
    files: filesList,
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
  const results: { [key: string]: boolean } = {};
  const targetsRequested: string[] = [];

  if (options.npm) {
    targetsRequested.push('npm');
    results.npm = await publishToNpm(hookDir);
    if (results.npm) {
      console.log(`✅ Published to npm as @carabiner/hook-${manifest.name}`);
      console.log(`   Install with: carabiner add ${manifest.name}`);
    }
  }

  if (options.github) {
    targetsRequested.push('github');
    results.github = await publishToGitHub(hookDir);
    if (results.github) {
      console.log(`✅ Created GitHub release v${manifest.version}`);
    }
  }

  if (options.registry) {
    // TODO: Publish to custom Carabiner registry
    console.log("📝 Custom registry publishing coming soon!");
    // Don't include in results since it's not implemented yet
  }

  if (!(options.npm || options.github || options.registry)) {
    console.log(`
Choose a publishing target:
  carabiner publish --npm      Publish to npm registry
  carabiner publish --github   Create GitHub release
  carabiner publish --registry https://registry.carabiner.dev
`);
    return false; // No targets requested
  }

  // Return true only if all requested publishes succeeded
  const overallSuccess = targetsRequested.length > 0 &&
    targetsRequested.every(target => results[target] === true);

  return overallSuccess;
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
