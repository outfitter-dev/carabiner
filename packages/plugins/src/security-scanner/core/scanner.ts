/**
 * @file core/scanner.ts
 * @description Main security scanning orchestration
 */

import { analyzeCommand } from "../analyzers/command-analyzer.js";
import {
	analyzeFileContent,
	exceedsSizeLimit,
} from "../analyzers/file-analyzer.js";
import type { AnalyzerToolInput } from "../analyzers/tool-analyzer.js";
import {
	extractBashCommand,
	extractEditContent,
	extractMultiEditContent,
	extractWriteContent,
} from "../analyzers/tool-analyzer.js";
import { ruleRegistry } from "../rules/index.js";
import type { ScanResult, SecurityRule } from "../types/index.js";
import { SecurityScannerConfigManager } from "./config.js";
import { SecurityReporter } from "./reporter.js";

/**
 * Main security scanner orchestrator
 */
export class SecurityScanner {
	private readonly configManager: SecurityScannerConfigManager;
	private readonly reporter: SecurityReporter;
	private readonly rules: SecurityRule[];

	constructor(config: Record<string, unknown> = {}) {
		this.configManager = new SecurityScannerConfigManager(config);
		this.reporter = new SecurityReporter();
		this.rules = ruleRegistry.combineWithCustomRules(
			this.configManager.getCustomRules(),
		);
	}

	/**
	 * Scan bash command for security issues
	 */
	async scanCommand(command: string): Promise<ScanResult> {
		if (!this.configManager.shouldScanCommands()) {
			return { findings: [], scanned: false };
		}

		const findings = analyzeCommand(command, this.rules);
		return { findings, scanned: true };
	}

	/**
	 * Scan file content for security issues
	 */
	async scanFileContent(
		content: string,
		filePath: string,
	): Promise<ScanResult> {
		if (!this.configManager.shouldScanFiles()) {
			return { findings: [], scanned: false };
		}

		const fileCheck = this.configManager.shouldScanFile(filePath);
		if (!fileCheck.shouldScan) {
			return {
				findings: [],
				scanned: false,
				skipped: true,
				skipReason: fileCheck.reason,
			};
		}

		if (exceedsSizeLimit(content, this.configManager.getMaxFileSize())) {
			return {
				findings: [],
				scanned: false,
				skipped: true,
				skipReason: "File too large",
			};
		}

		const findings = analyzeFileContent(
			content,
			filePath,
			this.rules,
			this.configManager.getConfig(),
		);

		return { findings, scanned: true };
	}

	/**
	 * Scan tool usage for security issues
	 */
	async scanTool(
		toolName: string,
		toolInput: AnalyzerToolInput,
	): Promise<ScanResult> {
		if (toolName === "Bash") {
			return await this.scanBashTool(toolInput);
		}

		if (["Write", "Edit", "MultiEdit"].includes(toolName)) {
			return await this.scanFileTool(toolName, toolInput);
		}

		return { findings: [], scanned: true };
	}

	/**
	 * Scan Bash tool for security issues
	 */
	private async scanBashTool(
		toolInput: AnalyzerToolInput,
	): Promise<ScanResult> {
		const command = extractBashCommand(toolInput);
		if (!command) {
			return { findings: [], scanned: true };
		}

		return await this.scanCommand(command);
	}

	/**
	 * Scan file-related tools for security issues
	 */
	private async scanFileTool(
		toolName: string,
		toolInput: AnalyzerToolInput,
	): Promise<ScanResult> {
		const filePath = toolInput.file_path;
		if (!filePath) {
			return { findings: [], scanned: true };
		}

		const content = await this.extractToolContent(
			toolName,
			toolInput,
			filePath,
		);
		if (!content) {
			return { findings: [], scanned: true };
		}

		return await this.scanFileContent(content, filePath);
	}

	/**
	 * Extract content from different file tools
	 */
	private async extractToolContent(
		toolName: string,
		toolInput: AnalyzerToolInput,
		filePath: string,
	): Promise<string> {
		switch (toolName) {
			case "Write":
				return extractWriteContent(toolInput);
			case "Edit":
				return await extractEditContent(toolInput, filePath);
			case "MultiEdit":
				return await extractMultiEditContent(toolInput, filePath);
			default:
				return "";
		}
	}

	/**
	 * Generate scan report
	 */
	generateReport(scanResult: ScanResult) {
		const { findings } = scanResult;
		// Get current config for future use
		// const config = this.configManager.getConfig();
		const blockingConfig = this.configManager.getBlockingConfig();

		if (findings.length === 0) {
			return {
				success: true,
				message: "No security issues detected",
				metadata: { scanned: true, findings: [] },
			};
		}

		if (this.configManager.shouldLogFindings()) {
			this.reporter.logFindings(findings);
		}

		const blocked = this.reporter.shouldBlock(
			findings,
			blockingConfig.blockOnCritical,
			blockingConfig.blockOnHigh,
		);

		return {
			success: !blocked,
			block: blocked,
			message: this.reporter.generateMessage(findings, blocked),
			metadata: this.reporter.generateMetadata(findings, blocked),
		};
	}
}
