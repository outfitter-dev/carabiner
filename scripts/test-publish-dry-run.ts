#!/usr/bin/env bun

/**
 * Test script to verify npm publishing configuration
 * Performs dry-run checks without actually publishing
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
  publishConfig?: {
    access?: string;
    registry?: string;
  };
  files?: string[];
  license?: string;
  main?: string;
  types?: string;
  exports?: Record<string, any>;
};

function testPackagePublishability() {
  const packagesDir = join(process.cwd(), "packages");
  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name !== "CLAUDE.md" && name !== "examples"); // Skip non-package dirs

  console.log("🔍 Testing npm publishing configuration...\n");

  const results: { name: string; status: "pass" | "fail"; issues: string[] }[] =
    [];

  for (const packageDir of packageDirs) {
    const packagePath = join(packagesDir, packageDir);
    const packageJsonPath = join(packagePath, "package.json");

    if (!existsSync(packageJsonPath)) {
      console.log(`⚠️  ${packageDir}: No package.json found`);
      continue;
    }

    try {
      const packageJson: PackageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf8")
      );
      const issues: string[] = [];

      // Skip private packages
      if (packageJson.private) {
        console.log(
          `⏭️  ${packageJson.name ?? packageDir}: Skipping private package`
        );
        continue;
      }
      if (packageJson.name === "@carabiner/hooks-examples") {
        console.log(`⏭️  ${packageJson.name}: Skipping per repo policy`);
        continue;
      }

      // Check required fields
      if (!packageJson.name?.startsWith("@carabiner/")) {
        issues.push("Package name should start with @carabiner/");
      }

      if (!packageJson.publishConfig?.access) {
        issues.push("Missing publishConfig.access");
      } else if (packageJson.publishConfig.access !== "public") {
        issues.push('publishConfig.access should be "public"');
      }
      if (!packageJson.publishConfig?.registry) {
        issues.push("Missing publishConfig.registry");
      } else if (
        !/^https:\/\/registry\.npmjs\.org\/?$/.test(
          packageJson.publishConfig.registry
        )
      ) {
        issues.push(
          'publishConfig.registry should be "https://registry.npmjs.org/"'
        );
      }

      if (!packageJson.files?.includes("LICENSE")) {
        issues.push("LICENSE not included in files array");
      }

      if (!packageJson.files?.includes("README.md")) {
        issues.push("README.md not included in files array");
      }

      const hasDist = packageJson.files?.some(
        (f) => f.replace(/\/$/, "") === "dist"
      );
      if (!hasDist) {
        issues.push("dist not included in files array");
      }

      if (!packageJson.license) {
        issues.push("Missing license field");
      }

      if (!(packageJson.main || packageJson.exports)) {
        issues.push("Missing main or exports field");
      }

      const status = issues.length === 0 ? "pass" : "fail";
      results.push({ name: packageJson.name, status, issues });

      if (status === "pass") {
        console.log(`✅ ${packageJson.name}: Ready for publishing`);
      } else {
        console.log(`❌ ${packageJson.name}: Issues found`);
        issues.forEach((issue) => console.log(`   • ${issue}`));
      }
    } catch (error) {
      console.log(`❌ ${packageDir}: Error reading package.json - ${error}`);
      results.push({
        name: packageDir,
        status: "fail",
        issues: ["Error reading package.json"],
      });
    }
  }

  console.log("\n📊 Summary:");
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log("\n🎉 All packages are ready for npm publishing!");
    return true;
  }
  console.log("\n🔧 Fix the issues above before publishing.");
  return false;
}

// Run the test
try {
  const success = testPackagePublishability();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error("Error running publish test:", error);
  process.exit(1);
}
