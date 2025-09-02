#!/usr/bin/env bun

/**
 * Claude Code Hook: Bash Command Validator
 * =========================================
 *
 * This hook runs as a PreToolUse hook for the Bash tool and validates bash commands
 * against a set of rules before execution, suggesting more efficient alternatives.
 *
 * This is a TypeScript port of Anthropic's Python example:
 * https://github.com/anthropics/claude-code/blob/main/examples/hooks/bash_command_validator_example.py
 *
 * Credit: Original implementation by Anthropic
 *
 * Installation:
 * 1. Build this file: bun build ./bash-command-validator.ts --outfile=./bash-command-validator.js
 * 2. Add to your Claude Code hooks configuration:
 *
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Bash",
 *         "hooks": [
 *           {
 *             "type": "command",
 *             "command": "bun /path/to/bash-command-validator.js"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

import { HookExecutor } from "@carabiner/execution";
import { StdinProtocol } from "@carabiner/protocol";
import type { HookHandler } from "@carabiner/types";

// Define validation rules as an array of [regex pattern, message] tuples
export const VALIDATION_RULES: [RegExp, string][] = [
	[
		/^grep\b(?!.*\|)/,
		"Use 'rg' (ripgrep) instead of 'grep' for better performance and features",
	],
	[
		/^find\s+\S+\s+-name\b/,
		"Use 'rg --files | rg pattern' or 'rg --files -g pattern' instead of 'find -name' for better performance",
	],
	// Additional rules for common inefficient patterns
	[
		/^cat\s+.*\|\s*grep\b/,
		"Use 'rg pattern file' directly instead of 'cat file | grep pattern'",
	],
	[
		/^ls\s+.*\|\s*grep\b/,
		"Use 'ls pattern*' or 'find' with proper flags instead of 'ls | grep'",
	],
	[
		/^ps\s+aux\s*\|\s*grep\b/,
		"Use 'pgrep' or 'pidof' instead of 'ps aux | grep' for finding processes",
	],
];

/**
 * Validates a bash command against the defined rules
 */
export function validateCommand(command: string): string[] {
	const issues: string[] = [];

	// Split compound commands (&&, ||, ;) and test each part
	const commandParts = command.split(/(?:&&|\|\||;)/);

	for (const part of commandParts) {
		const trimmedPart = part.trim();
		for (const [pattern, message] of VALIDATION_RULES) {
			if (pattern.test(trimmedPart) && !issues.includes(message)) {
				// Only add unique messages
				issues.push(message);
			}
		}
	}

	return issues;
}

/**
 * Main hook handler
 */
export const bashCommandValidatorHook: HookHandler = (context) => {
	// Only process Bash tool events
	if (!("toolName" in context) || context.toolName !== "Bash") {
		return {
			success: true,
		};
	}

	const command = context.toolInput?.command as string | undefined;

	// If no command provided, continue without validation
	if (!command) {
		return {
			success: true,
		};
	}

	// Validate the command
	const issues = validateCommand(command);

	if (issues.length > 0) {
		// Format issues as bullet points
		const errorMessage = issues.map((issue) => `• ${issue}`).join("\n");

		return {
			success: false,
			block: true,
			message: errorMessage,
			data: {
				modifiedInput: {
					...context.toolInput,
					_validation_errors: issues,
				},
			},
		};
	}

	return {
		success: true,
	};
};

// Main execution
async function main() {
	const protocol = new StdinProtocol();
	const executor = new HookExecutor(protocol);

	await executor.execute(bashCommandValidatorHook);
}

// Run if executed directly
if (import.meta.main) {
	main().catch((_error) => {
		process.exit(1);
	});
}
