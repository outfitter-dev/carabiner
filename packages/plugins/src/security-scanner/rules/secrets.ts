/**
 * @file rules/secrets.ts
 * @description Secret detection security rules
 */

import type { SecurityRule } from "../types/index.js";

/**
 * Security rules for detecting hardcoded secrets
 */
export const secretRules: SecurityRule[] = [
	{
		id: "hardcoded-api-key",
		name: "Hardcoded API Key",
		pattern: "(api[_-]?key|apikey)\\s*[:=]\\s*[\"'][a-zA-Z0-9]{10,}[\"']",
		flags: "gi",
		severity: "critical",
		category: "secrets",
		description: "Hardcoded API key detected",
		remediation:
			"Move API keys to environment variables or secure configuration",
	},
	{
		id: "aws-access-key",
		name: "AWS Access Key",
		pattern: "AKIA[0-9A-Z]{16}",
		severity: "critical",
		category: "secrets",
		description: "AWS Access Key ID detected",
		remediation:
			"Remove AWS credentials and use IAM roles or environment variables",
	},
	{
		id: "private-key",
		name: "Private Key",
		pattern: "-----BEGIN [A-Z]+ PRIVATE KEY-----",
		severity: "critical",
		category: "secrets",
		description: "Private key detected",
		remediation: "Remove private keys from code and store securely",
	},
	{
		id: "password-hardcoded",
		name: "Hardcoded Password",
		pattern: "(password|passwd|pwd)\\s*[:=]\\s*[\"'][^\"'\\s]{4,}[\"']",
		flags: "gi",
		severity: "high",
		category: "secrets",
		description: "Hardcoded password detected",
		remediation:
			"Use environment variables or secure configuration for passwords",
	},
	{
		id: "jwt-token",
		name: "JWT Token",
		pattern: "eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*",
		severity: "high",
		category: "secrets",
		description: "JWT token detected",
		remediation: "Avoid hardcoding JWT tokens in source code",
	},
];
