#!/usr/bin/env node
/**
 * Extract the Bun version from package.json packageManager field
 * This ensures CI always uses the exact same version as specified in the project
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

if (packageJson.packageManager) {
  // packageManager format is "bun@1.2.20"
  const match = packageJson.packageManager.match(/bun@(.+)/);
  if (match) {
    process.stdout.write(`${match[1]}\n`);
    process.exit(0);
  }
}

// Fallback to engines.bun if packageManager not found
if (packageJson.engines?.bun) {
  process.stdout.write(`${String(packageJson.engines.bun)}\n`);
  process.exit(0);
}

process.stderr.write("Could not determine Bun version from package.json\n");
process.exit(1);
