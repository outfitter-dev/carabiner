/**
 * @file matchers/content-matcher.ts
 * @description Content-specific matching logic
 */

import type {
	SecurityFinding,
	SecurityRule,
	SecurityScannerConfig,
} from "../types/index.js";
import { getSeverityLevel } from "../types/index.js";
import { isFileTypeSupported } from "./pattern-matcher.js";
import { executeRegex, matchesToFindings } from "./regex-matcher.js";

/**
 * Check if rule should be applied based on severity threshold
 */
export function shouldApplyRule(
	rule: SecurityRule,
	config: SecurityScannerConfig,
): boolean {
	return (
		getSeverityLevel(rule.severity) >= getSeverityLevel(config.minSeverity)
	);
}

/**
 * Apply security rule to content and return findings
 */
export function applyRuleToContent(
	content: string,
	filePath: string,
	rule: SecurityRule,
	config: SecurityScannerConfig,
): SecurityFinding[] {
	// Skip rule if it doesn't apply to this file type
	if (!isFileTypeSupported(filePath, rule.fileTypes)) {
		return [];
	}

	// Skip if severity is below minimum
	if (!shouldApplyRule(rule, config)) {
		return [];
	}

	const matches = executeRegex(content, rule);
	return matchesToFindings(matches, rule);
}
