declare module "@carabiner/error-management" {
	export const ErrorCode: Record<string, number>;
	export class ConfigurationError extends Error {
		constructor(message: string, code?: number, details?: unknown);
	}
	export function reportError(error: unknown): Promise<void>;
	export function executeWithBoundary<T>(
		op: () => Promise<T>,
		boundaryName: string,
		options?: unknown,
		operationId?: string,
	): Promise<T>;
}
