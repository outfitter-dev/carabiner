/**
 * @file types/findings.ts
 * @description Security finding types and interfaces
 */

/**
 * Security finding severity levels
 */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Security finding interface
 */
export type SecurityFinding = {
	id: string;
	severity: Severity;
	title: string;
	description: string;
	category: string;
	matched: string;
	line?: number;
	column?: number;
	remediation?: string;
};

/**
 * Security scan result
 */
export type ScanResult = {
	findings: SecurityFinding[];
	scanned: boolean;
	skipped?: boolean;
	skipReason?: string;
	error?: string;
};

/**
 * Get severity level numeric value for comparison
 */
export function getSeverityLevel(severity: Severity): number {
	const levels = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };
	return levels[severity] || 0;
}
