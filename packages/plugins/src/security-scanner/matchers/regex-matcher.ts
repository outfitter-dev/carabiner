/**
 * @file matchers/regex-matcher.ts
 * @description Regex pattern matching for security rules
 */

import type { SecurityFinding, SecurityRule } from "../types/index.js";

/**
 * Result of regex matching operation
 */
export type RegexMatch = {
	match: string;
	line: number;
	column: number;
	ruleId: string;
};

/**
 * Execute regex pattern against content and return matches
 */
export function executeRegex(
	content: string,
	rule: SecurityRule,
): RegexMatch[] {
	const matches: RegexMatch[] = [];

	try {
		const flags = rule.flags || "gm";
		const regex = new RegExp(rule.pattern, flags);

		let match: RegExpExecArray | null = regex.exec(content);
		while (match !== null) {
			// Find line number
			const beforeMatch = content.substring(0, match.index);
			const lineNumber = beforeMatch.split("\n").length;
			const columnNumber = beforeMatch.split("\n").pop()?.length || 0;

			matches.push({
				match: match[0],
				line: lineNumber,
				column: columnNumber,
				ruleId: rule.id,
			});

			// Prevent infinite loops with global regex
			if (!flags.includes("g")) {
				break;
			}

			match = regex.exec(content);
		}
	} catch (_error) {}

	return matches;
}

/**
 * Convert regex matches to security findings
 */
export function matchesToFindings(
	matches: RegexMatch[],
	rule: SecurityRule,
): SecurityFinding[] {
	return matches.map((match) => ({
		id: rule.id,
		severity: rule.severity,
		title: rule.name,
		description: rule.description,
		category: rule.category,
		matched: match.match,
		line: match.line,
		column: match.column,
		remediation: rule.remediation,
	}));
}
