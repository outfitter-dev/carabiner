/**
 * @outfitter/execution - Hook executor tests
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createProtocol, type TestProtocol } from "@carabiner/protocol";
import type { HookHandler } from "@carabiner/types";
import { isToolHookContext } from "@carabiner/types";
import { HookExecutor } from "../executor";
import { MetricsCollector } from "../metrics";

describe("HookExecutor", () => {
	let mockProtocol: TestProtocol;

	beforeEach(() => {
		const mockInput = {
			hook_event_name: "PreToolUse",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
			session_id: "test-session-123",
			transcript_path: "/tmp/transcript.md",
			cwd: "/tmp",
			environment: { PATH: "/usr/bin" },
		};
		mockProtocol = createProtocol("test", { input: mockInput }) as TestProtocol;
	});

	test("should execute hook handler", async () => {
		const handler: HookHandler = (context) => {
			expect(context.event).toBe("PreToolUse");
			if (isToolHookContext(context)) {
				expect(context.toolName).toBe("Bash");
			}
			return { success: true, message: "Hook executed successfully" };
		};

		const executor = new HookExecutor(mockProtocol, {
			exitProcess: false,
			collectMetrics: false,
		});

		await executor.execute(handler);

		expect(mockProtocol.output).toBeDefined();
		expect(mockProtocol.output?.success).toBe(true);
	});

	test("should collect metrics", async () => {
		const metricsCollector = new MetricsCollector();
		const handler: HookHandler = async () => ({ success: true });

		const executor = new HookExecutor(mockProtocol, {
			exitProcess: false,
			collectMetrics: true,
			metricsCollector,
		});

		await executor.execute(handler);

		const metrics = metricsCollector.getMetrics();
		expect(metrics).toHaveLength(1);

		const metric = metrics[0];
		if (metric) {
			expect(metric.event).toBe("PreToolUse");
			expect(metric.toolName).toBe("Bash");
			expect(metric.success).toBe(true);
			expect(metric.timing.duration).toBeGreaterThan(0);
		}
	});

	test("should handle timeout and cleanup timer", async () => {
		// Track if setTimeout and clearTimeout are called properly
		const originalSetTimeout = global.setTimeout;
		const originalClearTimeout = global.clearTimeout;

		let setTimeoutCalled = false;
		let clearTimeoutCalled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		// Mock setTimeout to track calls
		global.setTimeout = ((callback: () => void, ms: number) => {
			setTimeoutCalled = true;
			timeoutId = originalSetTimeout(callback, ms);
			return timeoutId;
		}) as typeof setTimeout;

		// Mock clearTimeout to track cleanup
		global.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
			if (id === timeoutId) {
				clearTimeoutCalled = true;
			}
			originalClearTimeout(id);
		}) as typeof clearTimeout;

		try {
			const handler: HookHandler = async () => {
				// Simulate work that completes before timeout
				await new Promise((resolve) => originalSetTimeout(resolve, 50));
				return { success: true, message: "Completed" };
			};

			const executor = new HookExecutor(mockProtocol, {
				exitProcess: false,
				timeout: 500, // 500ms timeout
				collectMetrics: false,
			});

			await executor.execute(handler);

			// Verify setTimeout was called for the timeout
			expect(setTimeoutCalled).toBe(true);

			// Verify clearTimeout was called to cleanup
			expect(clearTimeoutCalled).toBe(true);

			// Verify the handler succeeded
			expect(mockProtocol.output?.success).toBe(true);
			expect(mockProtocol.output?.message).toBe("Completed");
		} finally {
			// Restore original functions
			global.setTimeout = originalSetTimeout;
			global.clearTimeout = originalClearTimeout;
		}
	});

	test("should cleanup timer even when handler fails", async () => {
		const originalSetTimeout = global.setTimeout;
		const originalClearTimeout = global.clearTimeout;

		let clearTimeoutCalled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		global.setTimeout = ((callback: () => void, ms: number) => {
			timeoutId = originalSetTimeout(callback, ms);
			return timeoutId;
		}) as typeof setTimeout;

		global.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
			if (id === timeoutId) {
				clearTimeoutCalled = true;
			}
			originalClearTimeout(id);
		}) as typeof clearTimeout;

		try {
			const handler: HookHandler = () => {
				throw new Error("Handler failed");
			};

			const executor = new HookExecutor(mockProtocol, {
				exitProcess: false,
				timeout: 500,
				collectMetrics: false,
			});

			await executor.execute(handler);

			// Verify clearTimeout was called even though handler failed
			expect(clearTimeoutCalled).toBe(true);

			// Verify the error was handled
			expect(mockProtocol.output?.success).toBe(false);
			// The error might be in different fields based on the protocol output structure
			expect(mockProtocol.output).toBeDefined();
		} finally {
			global.setTimeout = originalSetTimeout;
			global.clearTimeout = originalClearTimeout;
		}
	});
});
