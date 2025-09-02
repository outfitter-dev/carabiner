/**
 * Case conversion utilities
 */

const WORD_SPLIT_REGEX = /[-_\s]+/;

/**
 * Convert string to PascalCase
 */
export function pascalCase(str: string): string {
	return str
		.split(WORD_SPLIT_REGEX)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

/**
 * Convert string to camelCase
 */
export function camelCase(str: string): string {
	const pascalCased = pascalCase(str);
	return pascalCased.charAt(0).toLowerCase() + pascalCased.slice(1);
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
	return str
		.split(WORD_SPLIT_REGEX)
		.map((word) => word.toLowerCase())
		.join("-");
}

/**
 * Convert string to snake_case
 */
export function snakeCase(str: string): string {
	return str
		.split(WORD_SPLIT_REGEX)
		.map((word) => word.toLowerCase())
		.join("_");
}
