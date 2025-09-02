/**
 * Commitlint configuration
 * Ensures conventional commit format for all commit messages
 * @see https://www.conventionalcommits.org/
 */

export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		// Enforce lowercase for scope, subject, type
		"scope-case": [2, "always", "lower-case"],
		"subject-case": [2, "always", "lower-case"],
		"type-case": [2, "always", "lower-case"],

		// No empty subject
		"subject-empty": [2, "never"],

		// No period at end of subject
		"subject-full-stop": [2, "never", "."],

		// Type must be one of the following
		"type-enum": [
			2,
			"always",
			[
				"feat", // New feature
				"fix", // Bug fix
				"docs", // Documentation changes
				"style", // Code style changes (formatting, missing semicolons, etc)
				"refactor", // Code refactoring without changing functionality
				"perf", // Performance improvements
				"test", // Adding or updating tests
				"build", // Build system or external dependencies changes
				"ci", // CI configuration changes
				"chore", // Other changes that don't modify src or test files
				"revert", // Revert a previous commit
			],
		],
	},
};
