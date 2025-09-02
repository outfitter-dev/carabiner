/**
 * @file matchers/pattern-matcher.ts
 * @description Pattern matching utilities for file paths
 */

/**
 * Check if file matches patterns
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
	return patterns.some((pattern) => {
		const regex = new RegExp(
			pattern.replace(/\*/g, ".*").replace(/\?/g, "."),
			"i",
		);
		return regex.test(filePath);
	});
}

/**
 * Extract file extension from path
 */
export function getFileExtension(filePath: string): string {
	const match = filePath.match(/\.([^.]+)$/);
	return match?.[1]?.toLowerCase() || "";
}

/**
 * Check if file type is supported by rule
 */
export function isFileTypeSupported(
	filePath: string,
	supportedTypes?: string[],
): boolean {
	if (!supportedTypes || supportedTypes.length === 0) {
		return true;
	}

	const fileExt = getFileExtension(filePath);
	return supportedTypes.includes(fileExt);
}
