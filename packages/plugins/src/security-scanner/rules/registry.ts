/**
 * @file rules/registry.ts
 * @description Security rule registry and management
 */

import type { SecurityRule } from "../types/index.js";
import { commandRules } from "./commands.js";
import { injectionRules } from "./injection.js";
import { secretRules } from "./secrets.js";

/**
 * Additional built-in security rules
 */
const miscRules: SecurityRule[] = [
	{
		id: "debug-mode",
		name: "Debug Mode Enabled",
		pattern: "(debug|DEBUG)\\s*[:=]\\s*(true|True|TRUE|1)",
		flags: "gi",
		severity: "medium",
		category: "configuration",
		description: "Debug mode enabled in configuration",
		remediation: "Disable debug mode in production environments",
	},
	{
		id: "insecure-http",
		name: "Insecure HTTP URL",
		pattern: "http://[^\\s\"'<>]+",
		severity: "low",
		category: "network",
		description: "Insecure HTTP URL detected",
		remediation: "Use HTTPS URLs for secure communication",
		fileTypes: ["js", "ts", "py", "java", "go", "php"],
	},
	{
		id: "weak-crypto",
		name: "Weak Cryptographic Algorithm",
		pattern: "\\b(md5|sha1|des|rc4)\\b",
		flags: "gi",
		severity: "medium",
		category: "cryptography",
		description: "Weak cryptographic algorithm detected",
		remediation: "Use stronger cryptographic algorithms like SHA-256 or AES",
	},
];

/**
 * Built-in security rules registry
 */
export class SecurityRuleRegistry {
	private rules: SecurityRule[] = [];

	constructor() {
		this.loadBuiltInRules();
	}

	/**
	 * Load all built-in security rules
	 */
	private loadBuiltInRules(): void {
		this.rules = [
			...secretRules,
			...injectionRules,
			...commandRules,
			...miscRules,
		];
	}

	/**
	 * Get all built-in rules
	 */
	getBuiltInRules(): SecurityRule[] {
		return [...this.rules];
	}

	/**
	 * Get rules by category
	 */
	getRulesByCategory(category: string): SecurityRule[] {
		return this.rules.filter((rule) => rule.category === category);
	}

	/**
	 * Get command-specific rules
	 */
	getCommandRules(): SecurityRule[] {
		return this.rules.filter(
			(rule) =>
				rule.category === "dangerous-commands" || rule.category === "injection",
		);
	}

	/**
	 * Combine built-in rules with custom rules
	 */
	combineWithCustomRules(customRules: SecurityRule[]): SecurityRule[] {
		return [...this.rules, ...customRules];
	}
}

/**
 * Default registry instance
 */
export const ruleRegistry = new SecurityRuleRegistry();
