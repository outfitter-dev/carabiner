import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ClaudeHooksCli } from "../cli";

test("CLI reports version from package.json in dev", async () => {
	// Ensure env injection path is not used
	const prev = process.env.CLI_VERSION;
	process.env.CLI_VERSION = undefined;

	const cli = new ClaudeHooksCli() as unknown as {
		config: { version: string };
	};
	const reported = cli.config.version;

	const pkgPath = join(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"..",
		"package.json",
	);
	const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as {
		version: string;
	};

	expect(reported).toBe(pkg.version);

	// Restore env
	if (prev !== undefined) {
		process.env.CLI_VERSION = prev;
	}
});
