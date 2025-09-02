#!/usr/bin/env bun

/**
 * Declarative API example for Claude Code hooks
 * Demonstrates configuration-driven hook definitions with clean separation of concerns
 * Uses corrected imports, stdin-based runtime, and proper context properties
 */

import type {
	DeclarativeHookConfig,
	HookContext,
	HookResult,
} from "@/hooks-core";
import {
	defineHook,
	HookResults,
	middleware,
	registerHooks,
	runClaudeHook,
} from "@/hooks-core";
import {
	SecurityValidators,
	ValidationError,
	validateToolInput,
} from "@/hooks-validators";

/**
 * Development environment hooks configuration
 */
const developmentHooks: DeclarativeHookConfig[] = [
	// Basic PreToolUse validation
	{
		event: "PreToolUse",
		handler: (context) => {
			// Apply lenient validation for development
			try {
				SecurityValidators.development(context);
				return HookResults.success("Development validation passed");
			} catch (_error) {
				return HookResults.success(
					"Development validation completed with warnings",
				);
			}
		},
		priority: 50,
		enabled: true,
		timeout: 5000,
		middleware: [middleware.logging("debug"), middleware.timing()],
	},

	// File formatting after writes/edits
	{
		event: "PostToolUse",
		tool: "Write",
		handler: async (context) => {
			const filePath = (context.toolInput as { file_path?: string })?.file_path;
			if (!filePath) {
				return HookResults.success("No file to format");
			}

			try {
				await formatFile(filePath);
				return HookResults.success(`File formatted: ${filePath}`);
			} catch (error) {
				return HookResults.failure(
					`Formatting failed: ${error instanceof Error ? error.message : error}`,
				);
			}
		},
		enabled: true,
		timeout: 30_000,
	},

	// Development session initialization
	{
		event: "SessionStart",
		handler: async (context) => {
			// Display helpful development information
			await displayDevInfo(context.cwd);

			return HookResults.success("Development session initialized");
		},
		enabled: true,
		timeout: 10_000,
		middleware: [middleware.logging("info")],
	},
];

/**
 * Production environment hooks configuration
 */
const productionHooks: DeclarativeHookConfig[] = [
	// Strict security validation
	{
		event: "PreToolUse",
		handler: (context) => {
			try {
				// Apply strict security validation
				SecurityValidators.production(context);

				// Additional production checks
				performProductionChecks(context);

				return HookResults.success("Production security validation passed", {
					securityLevel: "strict",
					environment: "production",
				});
			} catch (error) {
				return HookResults.block(
					`Security validation failed: ${error instanceof Error ? error.message : error}`,
				);
			}
		},
		priority: 100,
		enabled: true,
		timeout: 10_000,
		middleware: [
			middleware.logging("warn"),
			middleware.errorHandling(),
			middleware.timing(),
		],
	},

	// Production audit logging
	{
		event: "PostToolUse",
		handler: async (context) => {
			await auditLog({
				timestamp: new Date().toISOString(),
				sessionId: context.sessionId,
				toolName: context.toolName,
				cwd: context.cwd,
				success: true, // PostToolUse implies successful execution
				environment: "production",
			});

			return HookResults.success("Audit log recorded");
		},
		enabled: true,
		timeout: 5000,
		priority: 10, // Low priority, run after other post-processing
	},

	// Restricted session management
	{
		event: "SessionStart",
		handler: async (context) => {
			// Validate session in production
			const sessionValidation = validateProductionSession(context);
			if (!sessionValidation.valid) {
				return HookResults.failure(
					sessionValidation.reason ?? "Session validation failed",
				);
			}

			await auditLog({
				timestamp: new Date().toISOString(),
				sessionId: context.sessionId,
				event: "session-start",
				cwd: context.cwd,
				environment: "production",
			});

			return HookResults.success("Production session initialized");
		},
		enabled: true,
		timeout: 15_000,
	},
];

/**
 * Testing environment hooks configuration
 */
const testingHooks: DeclarativeHookConfig[] = [
	// Test-friendly validation
	{
		event: "PreToolUse",
		handler: (context) => {
			// Use test-specific validation
			SecurityValidators.test(context);

			return HookResults.success("Test validation passed");
		},
		enabled: true,
		timeout: 3000,
		condition: (_context) => {
			// Only run if in test environment
			return Bun.env.NODE_ENV === "test" || Bun.env.CI === "true";
		},
	},

	// Test result capture
	{
		event: "PostToolUse",
		handler: (context) => {
			// Capture test execution data
			const _testData = {
				toolName: context.toolName,
				success: true,
				timestamp: new Date().toISOString(),
				outputSize: (() => {
					if (!context.toolResponse) {
						return 0;
					}
					const response = context.toolResponse as
						| string
						| Record<string, unknown>;
					if (typeof response === "string") {
						return response.length;
					}
					return JSON.stringify(response).length;
				})(),
			};

			return HookResults.success("Test data captured");
		},
		enabled: true,
		timeout: 2000,
	},
];

/**
 * Universal hooks that run in all environments
 * Demonstrates both universal (no tool specified) and tool-specific hooks
 */
const universalHooks: DeclarativeHookConfig[] = [
	// Input validation for all tools (universal hook)
	{
		event: "PreToolUse",
		// No tool specified - this runs for ALL tools
		handler: async (context) => {
			// Validate tool input structure
			const validation = await validateToolInput(
				context.toolName,
				context.toolInput,
				context,
			);

			if (!validation.valid) {
				const errors = validation.errors.map((e) => e.message).join(", ");
				return HookResults.block(`Input validation failed: ${errors}`);
			}

			if (validation.warnings && validation.warnings.length > 0) {
				const _warnings = validation.warnings.map((w) => w.message).join(", ");
			}

			return HookResults.success("Input validation passed", {
				warnings: validation.warnings?.length ?? 0,
				toolScoping: "This universal hook runs for ALL tools",
			});
		},
		priority: 80,
		enabled: true,
		timeout: 5000,
	},

	// Bash-specific command monitoring (tool-specific hook)
	{
		event: "PreToolUse",
		tool: "Bash", // This hook ONLY runs for Bash commands
		handler: (context) => {
			const command = (context.toolInput as Record<string, unknown>)?.command;
			if (command) {
				// Monitor command patterns
				const suspiciousPatterns = [
					{ pattern: /rm\s+-rf\s+\//, description: "Root deletion attempt" },
					{ pattern: /sudo\s+/, description: "Sudo usage detected" },
					{ pattern: /curl.*\|\s*sh/, description: "Curl pipe to shell" },
				];

				for (const { pattern, description } of suspiciousPatterns) {
					if (pattern.test(command) && Bun.env.NODE_ENV === "production") {
						return HookResults.block(`Blocked: ${description}`);
					}
				}
			}

			return HookResults.success("Bash command monitoring completed", {
				toolScoping: "This hook only runs for Bash commands",
			});
		},
		priority: 90,
		enabled: true,
		timeout: 3000,
	},

	// Performance monitoring for all tools (universal hook)
	{
		event: "PostToolUse",
		handler: (context) => {
			// Note: In the real implementation, metadata would be on the result, not context
			// This is just for demonstration purposes
			const outputSize = (() => {
				if (!context.toolResponse) {
					return 0;
				}
				const response = context.toolResponse as
					| string
					| Record<string, unknown>;
				if (typeof response === "string") {
					return response.length;
				}
				return JSON.stringify(response).length;
			})();

			// Warn about large outputs
			if (outputSize > 100_000) {
				// Large output warning would be logged here
			}

			return HookResults.success("Performance monitoring completed", {
				outputSize,
				large: outputSize > 100_000,
				toolScoping: "This universal hook runs for ALL tools",
			});
		},
		enabled: true,
		timeout: 1000,
		priority: 20,
	},
];

/**
 * Environment-specific hook configurations
 */
const environmentConfigs = {
	development: developmentHooks,
	production: productionHooks,
	test: testingHooks,
};

/**
 * Get hooks for current environment
 */
function getHooksForEnvironment(): DeclarativeHookConfig[] {
	const env =
		(Bun.env.NODE_ENV as keyof typeof environmentConfigs) || "development";
	const envHooks = environmentConfigs[env] || developmentHooks;

	return [...envHooks, ...universalHooks];
}

/**
 * Initialize and register all hooks
 */
function initializeHooks(): void {
	const hookConfigs = getHooksForEnvironment();
	const hooks = hookConfigs.map((config) => defineHook(config));

	registerHooks(hooks);

	// Log hook summary
	const eventCounts = hooks.reduce(
		(acc, hook) => {
			acc[hook.event] = (acc[hook.event] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);
	for (const [_event, _count] of Object.entries(eventCounts)) {
		// Hook event counts logged during initialization
	}

	// Log tool scoping info
	const _toolSpecificCount = hooks.filter((h) => h.tool).length;
	const _universalCount = hooks.filter((h) => !h.tool).length;
}

/**
 * Example: Run the declarative configuration as a single hook
 */
async function runDeclarativeHooks(context: HookContext): Promise<HookResult> {
	const hookConfigs = getHooksForEnvironment();
	const relevantHooks = hookConfigs
		.filter(
			(config) =>
				config.event === context.event &&
				(!config.tool || config.tool === context.toolName) &&
				(!config.condition || config.condition(context)),
		)
		.sort((a, b) => (b.priority || 0) - (a.priority || 0));

	const results: Array<{ type: string; success: boolean; message: string }> =
		[];

	for (const hookConfig of relevantHooks) {
		try {
			const result = await hookConfig.handler(context);
			results.push({
				type: hookConfig.tool ? `${hookConfig.tool}-specific` : "universal",
				success: result.success,
				message: result.message,
			});

			// If any hook blocks, stop execution
			if (!result.success && result.block) {
				return result;
			}
		} catch (error) {
			const errorResult = HookResults.failure(
				`Hook execution failed: ${error instanceof Error ? error.message : error}`,
			);
			results.push({
				type: hookConfig.tool ? `${hookConfig.tool}-specific` : "universal",
				success: false,
				message: errorResult.message,
			});
		}
	}

	return HookResults.success(
		`Declarative hooks completed for ${context.toolName}`,
		{
			hookResults: results,
			toolScoping: `Ran ${relevantHooks.length} hooks based on tool scoping`,
		},
	);
}

/**
 * Utility functions
 */

async function formatFile(filePath: string): Promise<void> {
	const { spawn } = await import("node:child_process");
	const { extname } = await import("node:path");

	const ext = extname(filePath);

	// Only format supported file types
	if (![".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html"].includes(ext)) {
		return;
	}

	return new Promise((resolve, reject) => {
		const format = spawn(
			"bunx",
			["@biomejs/biome", "format", "--write", filePath],
			{
				stdio: "pipe",
			},
		);

		format.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Format failed with code ${code}`));
			}
		});

		format.on("error", reject);
	});
}

async function displayDevInfo(cwd: string): Promise<void> {
	const { existsSync } = await import("node:fs");
	const { readFile } = await import("node:fs/promises");
	const { join } = await import("node:path");

	// Show project info if package.json exists
	const packagePath = join(cwd, "package.json");
	if (existsSync(packagePath)) {
		try {
			const packageContent = await readFile(packagePath, "utf-8");
			const packageJson = JSON.parse(packageContent);

			if (packageJson.scripts) {
				const _scripts = Object.keys(packageJson.scripts);
			}
		} catch (_error) {
			// Error reading package.json - continue without project info
		}
	}

	// Show git branch if available
	try {
		const { spawn } = await import("node:child_process");
		const git = spawn("git", ["branch", "--show-current"], {
			cwd,
			stdio: "pipe",
		});

		let branch = "";
		git.stdout?.on("data", (data) => {
			branch += data.toString().trim();
		});

		git.on("close", (code) => {
			if (code === 0 && branch) {
				// Git branch information available for display
			}
		});
	} catch {
		// Git not available or not a git repo
	}
}

function performProductionChecks(context: HookContext): void {
	// Check for production-specific restrictions
	if (context.toolName === "Bash") {
		const command = (context.toolInput as Record<string, unknown>)?.command;
		if (command) {
			const productionBlockedPatterns = [
				/rm\s+-rf/,
				/sudo/,
				/curl.*\|\s*sh/,
				/wget.*\|\s*sh/,
				/npm\s+publish/,
				/git\s+push.*--force/,
			];

			for (const pattern of productionBlockedPatterns) {
				if (pattern.test(command)) {
					throw new ValidationError(
						`Production-blocked command pattern: ${pattern.source}`,
					);
				}
			}
		}
	}

	// Check workspace restrictions
	const restrictedPaths = ["node_modules", ".git", "dist", "build"];
	if (context.toolName === "Write" || context.toolName === "Edit") {
		const filePath = (context.toolInput as Record<string, unknown>)?.file_path;
		if (filePath && restrictedPaths.some((path) => filePath.includes(path))) {
			throw new ValidationError(
				`Production write access denied to: ${filePath}`,
			);
		}
	}
}

function validateProductionSession(context: HookContext): {
	valid: boolean;
	reason?: string;
} {
	// In production, might check:
	// - User authentication
	// - Session limits
	// - Time-based restrictions

	// For this example, just basic validation
	if (!context.sessionId || context.sessionId.length < 10) {
		return {
			valid: false,
			reason: "Invalid session ID for production environment",
		};
	}

	return { valid: true };
}

async function auditLog(_entry: Record<string, unknown>): Promise<void> {
	// Audit logging implementation placeholder
}

/**
 * Main execution using proper stdin-based runtime
 */
if (import.meta.main) {
	initializeHooks();

	// Use the new stdin-based runtime
	runClaudeHook(runDeclarativeHooks, {
		outputMode: "exit-code",
		logLevel: "info",
	});
}

export {
	developmentHooks,
	productionHooks,
	testingHooks,
	universalHooks,
	getHooksForEnvironment,
	initializeHooks,
	runDeclarativeHooks,
};
