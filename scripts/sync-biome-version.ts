#!/usr/bin/env bun
/**
 * Synchronizes biome.json schema version with installed biome version
 * This prevents version drift between local and CI environments
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Use direct stdio to avoid cross-package build dependency
import { $ } from "bun";

async function syncBiomeVersion() {
  // Get installed biome version
  const result = await $`bunx biome --version`.quiet();
  const versionMatch = result.stdout
    .toString()
    .match(/Version:\s*(\d+\.\d+\.\d+)/);

  if (!versionMatch) {
    process.stderr.write("Could not determine biome version\n");
    process.exit(1);
  }

  const biomeVersion = versionMatch[1];
  process.stdout.write(`Detected biome version: ${biomeVersion}\n`);

  // Update biome.json
  const biomeConfigPath = resolve(process.cwd(), "biome.json");
  const biomeConfig = JSON.parse(readFileSync(biomeConfigPath, "utf-8"));

  const oldSchema = biomeConfig.$schema;
  // Use full version for exact match with CLI
  const newSchema = `https://biomejs.dev/schemas/${biomeVersion}/schema.json`;

  if (oldSchema !== newSchema) {
    biomeConfig.$schema = newSchema;
    writeFileSync(biomeConfigPath, `${JSON.stringify(biomeConfig, null, 2)}\n`);
    process.stdout.write(
      `✅ Updated biome.json schema from ${oldSchema} to ${newSchema}\n`
    );
  } else {
    process.stdout.write(`✅ Schema already up to date: ${newSchema}\n`);
  }
}

syncBiomeVersion().catch((error) => {
  process.stderr.write(`Error syncing biome version: ${String(error)}\n`);
  process.exit(1);
});
