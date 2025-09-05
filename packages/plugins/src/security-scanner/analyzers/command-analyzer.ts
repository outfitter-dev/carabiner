/**
 * @file analyzers/command-analyzer.ts
 * @description Command security analysis
 */

import { executeRegex, matchesToFindings } from "../matchers/regex-matcher.js";
import type { SecurityFinding, SecurityRule } from "../types/index.js";

/**
 * Analyze bash command for security issues
 */
export function analyzeCommand(
	command: string,
	rules: SecurityRule[],
): SecurityFinding[] {
	const findings: SecurityFinding[] = [];
	const commandRules = rules.filter(
		(rule) =>
			rule.category === "dangerous-commands" || rule.category === "injection",
	);

	for (const rule of commandRules) {
		const matches = executeRegex(command, rule);
		const ruleFindings = matchesToFindings(matches, rule);
		findings.push(...ruleFindings);
	}

	return findings;
}

/**
 * Check if command contains dangerous patterns
 */
export function isDangerousCommand(command: string): boolean {
	const dangerousPatterns = [
		/rm\s+-rf\s+\//,
		/dd\s+if=\/dev\/zero/,
		/:\(\)\{\|/,
		/shutdown|halt|reboot/,
	];

	return dangerousPatterns.some((pattern) => pattern.test(command));
}
