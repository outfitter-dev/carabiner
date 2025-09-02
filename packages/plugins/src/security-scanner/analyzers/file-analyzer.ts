/**
 * @file analyzers/file-analyzer.ts
 * @description File content security analysis
 */

import { applyRuleToContent } from "../matchers/content-matcher.js";
import type {
	SecurityFinding,
	SecurityRule,
	SecurityScannerConfig,
} from "../types/index.js";

/**
 * Analyze file content for security issues
 */
export function analyzeFileContent(
	content: string,
	filePath: string,
	rules: SecurityRule[],
	config: SecurityScannerConfig,
): SecurityFinding[] {
	const findings: SecurityFinding[] = [];

	for (const rule of rules) {
		const ruleFindings = applyRuleToContent(content, filePath, rule, config);
		findings.push(...ruleFindings);
	}

	return findings;
}

/**
 * Check if file content exceeds size limit
 */
export function exceedsSizeLimit(content: string, maxSize: number): boolean {
	return content.length > maxSize;
}

/**
 * Extract sensitive information patterns from content
 */
export function extractSensitivePatterns(content: string): string[] {
	const patterns = [
		/(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{4,}["']/gi,
		/(?:api[_-]?key|apikey)\s*[:=]\s*["'][a-zA-Z0-9]{10,}["']/gi,
		/AKIA[0-9A-Z]{16}/g,
	];

	const found: string[] = [];
	for (const pattern of patterns) {
		const matches = content.match(pattern);
		if (matches) {
			found.push(...matches);
		}
	}

	return found;
}
