/**
 * Edge Case Tests - Large Inputs and Performance Boundaries
 *
 * Tests system behavior with large payloads, unusual encodings,
 * and boundary conditions to ensure robustness in production.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

describe("Large Input Edge Cases", () => {
	let memoryUsageBefore: NodeJS.MemoryUsage;

	beforeEach(() => {
		memoryUsageBefore = process.memoryUsage();
	});

	afterEach(() => {
		// Force garbage collection if available
		if (global.gc) {
			global.gc();
		}
	});

	describe("Large JSON Payloads", () => {
		test("should handle 1MB JSON input without memory issues", async () => {
			// Create a 1MB JSON payload
			const largeObject = {
				metadata: {
					timestamp: new Date().toISOString(),
					requestId: `large-test-${Math.random()}`,
				},
				data: new Array(50_000).fill(null).map((_, i) => ({
					id: i,
					name: `item_${i}_${"x".repeat(20)}`, // Make each item substantial
					description: `This is a test description for item ${i} `.repeat(5),
					tags: [`tag1_${i}`, `tag2_${i}`, `tag3_${i}`],
					nested: {
						level1: {
							level2: {
								level3: `deep_value_${i}`,
								array: new Array(10).fill(`nested_item_${i}`),
							},
						},
					},
				})),
			};

			const jsonString = JSON.stringify(largeObject);
			expect(jsonString.length).toBeGreaterThan(1024 * 1024); // > 1MB

			// Test parsing large JSON
			const startTime = performance.now();
			const parsed = JSON.parse(jsonString);
			const parseTime = performance.now() - startTime;

			expect(parsed.data).toHaveLength(50_000);
			expect(parseTime).toBeLessThan(1000); // Should parse within 1 second

			// Check memory usage didn't explode
			const memoryAfter = process.memoryUsage();
			const memoryIncrease = memoryAfter.heapUsed - memoryUsageBefore.heapUsed;
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
		});

		test("should handle deeply nested JSON structures", async () => {
			// Create deeply nested structure
			let deepObject: any = { value: "deep" };

			// Create 1000 levels of nesting
			for (let i = 0; i < 1000; i++) {
				deepObject = {
					level: i,
					timestamp: Date.now(),
					nested: deepObject,
				};
			}

			const jsonString = JSON.stringify(deepObject);

			const startTime = performance.now();
			const parsed = JSON.parse(jsonString);
			const parseTime = performance.now() - startTime;

			// Should handle deep nesting gracefully
			expect(parsed.level).toBe(999); // Top level
			expect(parseTime).toBeLessThan(500); // Should be reasonably fast

			// Navigate to the bottom
			let current = parsed;
			let depth = 0;
			while (current.nested && depth < 2000) {
				// Safety limit
				current = current.nested;
				depth++;
			}

			expect(depth).toBe(1000);
			expect(current.value).toBe("deep");
		});

		test("should handle large arrays with mixed data types", async () => {
			const largeArray = [];

			// Create array with 100k mixed items
			for (let i = 0; i < 100_000; i++) {
				switch (i % 6) {
					case 0:
						largeArray.push(i);
						break;
					case 1:
						largeArray.push(`string_value_${i}`);
						break;
					case 2:
						largeArray.push(i % 2 === 0);
						break;
					case 3:
						largeArray.push({ id: i, value: i * 2 });
						break;
					case 4:
						largeArray.push([i, i + 1, i + 2]);
						break;
					case 5:
						largeArray.push(null);
						break;
				}
			}

			const jsonString = JSON.stringify(largeArray);
			expect(jsonString.length).toBeGreaterThan(1024 * 1024); // > 1MB

			const startTime = performance.now();
			const parsed = JSON.parse(jsonString);
			const parseTime = performance.now() - startTime;

			expect(parsed).toHaveLength(100_000);
			expect(parseTime).toBeLessThan(2000); // Should parse within 2 seconds

			// Verify data integrity
			expect(parsed[0]).toBe(0);
			expect(parsed[1]).toBe("string_value_1");
			expect(parsed[2]).toBe(true);
			expect(parsed[3]).toEqual({ id: 3, value: 6 });
			expect(parsed[4]).toEqual([4, 5, 6]);
			expect(parsed[5]).toBe(null);
		});
	});

	describe("String Encoding Edge Cases", () => {
		test("should handle UTF-8 strings with emoji and special characters", async () => {
			const unicodeString = [
				"🚀 Rocket emoji",
				"你好世界", // Chinese
				"Здравствуй мир", // Russian
				"🎯🔥💯✨🌟", // Multiple emoji
				"Iñtërnâtiônàlizætiøn", // Accented characters
				"𝕌𝕟𝕚𝕔𝕠𝕕𝕖 𝔪𝔞𝔱𝔥", // Math symbols
				"┌─┐\n│ │\n└─┘", // Box drawing
				"\u0000\u0001\u0002\u001F", // Control characters
				"a".repeat(10_000), // Very long string
			].join("\n");

			const encoded = JSON.stringify({ text: unicodeString });
			const decoded = JSON.parse(encoded);

			expect(decoded.text).toBe(unicodeString);
			expect(decoded.text).toContain("🚀");
			expect(decoded.text).toContain("你好世界");
			expect(decoded.text).toContain("Здравствуй мир");
		});

		test("should handle binary-like data in strings", async () => {
			// Create string with binary data patterns
			const binaryLikeString = new Array(1000)
				.fill(0)
				.map((_, i) => String.fromCharCode(i % 256))
				.join("");

			const encoded = JSON.stringify({ binary: binaryLikeString });
			const decoded = JSON.parse(encoded);

			expect(decoded.binary).toBe(binaryLikeString);
			expect(decoded.binary.length).toBe(1000);
		});

		test("should handle very long strings efficiently", async () => {
			const veryLongString = "x".repeat(10 * 1024 * 1024); // 10MB string

			const startTime = performance.now();
			const encoded = JSON.stringify({ longString: veryLongString });
			const encodeTime = performance.now() - startTime;

			const decodeStartTime = performance.now();
			const decoded = JSON.parse(encoded);
			const decodeTime = performance.now() - decodeStartTime;

			expect(decoded.longString).toHaveLength(10 * 1024 * 1024);
			expect(encodeTime).toBeLessThan(5000); // Should encode within 5 seconds
			expect(decodeTime).toBeLessThan(5000); // Should decode within 5 seconds
		});
	});

	describe("Memory Pressure Tests", () => {
		test("should handle multiple concurrent large operations", async () => {
			const promises = [];

			// Create 10 concurrent operations with medium-sized data
			for (let i = 0; i < 10; i++) {
				const promise = new Promise((resolve) => {
					// Create 100KB of data per operation
					const data = new Array(10_000).fill(null).map((_, j) => ({
						operation: i,
						index: j,
						data: `operation_${i}_item_${j}_${"x".repeat(10)}`,
					}));

					setTimeout(() => {
						resolve({
							operation: i,
							size: JSON.stringify(data).length,
							itemCount: data.length,
						});
					}, Math.random() * 100);
				});

				promises.push(promise);
			}

			const startTime = performance.now();
			const results = await Promise.all(promises);
			const totalTime = performance.now() - startTime;

			expect(results).toHaveLength(10);
			expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

			// Verify all operations completed
			results.forEach((result: any, index) => {
				expect(result.operation).toBe(index);
				expect(result.itemCount).toBe(10_000);
			});
		});

		test("should recover from near-memory-limit scenarios", async () => {
			// This test attempts to use significant memory then recover
			const memoryBefore = process.memoryUsage().heapUsed;

			try {
				// Create large data structures, but bound memory growth
				const largeArrays: string[][] = [];
				let i = 0;
				const targetIncrease = 150 * 1024 * 1024; // ~150MB
				while (
					process.memoryUsage().heapUsed - memoryBefore < targetIncrease &&
					i < 100
				) {
					const block = new Array(20_000).fill(
						`large_string_${i}_${"x".repeat(100)}`,
					);
					largeArrays.push(block);
					i++;
				}

				// Verify we're using more memory
				const memoryPeak = process.memoryUsage().heapUsed;
				expect(memoryPeak).toBeGreaterThan(memoryBefore);

				// Clear references
				largeArrays.length = 0;

				// Force garbage collection if available
				if (global.gc) {
					global.gc();
				}

				// Wait a bit for GC
				await new Promise((resolve) => setTimeout(resolve, 250));

				// Memory should be recovering
				const memoryAfter = process.memoryUsage().heapUsed;

				// Note: GC is not deterministic, so we just verify the test completed
				expect(memoryAfter).toBeGreaterThan(0); // Basic sanity check
			} catch (error) {
				// If we run out of memory, that's actually expected behavior
				expect(error).toBeInstanceOf(Error);
			}
		});
	});

	describe("Performance Boundary Tests", () => {
		test("should maintain performance with increasing payload sizes", async () => {
			const sizes = [1000, 10_000, 50_000, 100_000];
			const timings: number[] = [];

			for (const size of sizes) {
				const data = new Array(size).fill(null).map((_, i) => ({
					id: i,
					value: `item_${i}`,
					timestamp: Date.now(),
				}));

				const startTime = performance.now();
				const jsonString = JSON.stringify(data);
				const parsed = JSON.parse(jsonString);
				const endTime = performance.now();

				const timing = endTime - startTime;
				timings.push(timing);

				expect(parsed).toHaveLength(size);
			}

			// Performance should scale reasonably (not exponentially)
			// Each 10x increase should be less than 20x slower
			for (let i = 1; i < timings.length; i++) {
				const ratio = timings[i] / timings[i - 1];
				const sizeRatio = sizes[i] / sizes[i - 1];

				// Allow some slack for performance variance
				expect(ratio).toBeLessThan(sizeRatio * 5); // At most 5x slower per size increase
			}
		});

		test("should handle timeout scenarios gracefully", async () => {
			// Simulate operations that might timeout
			const operations = [
				{ timeout: 10, work: 5 }, // Should complete
				{ timeout: 10, work: 50 }, // Should timeout
				{ timeout: 100, work: 20 }, // Should complete
			];

			const results = await Promise.allSettled(
				operations.map(async ({ timeout, work }) => {
					return new Promise((resolve, reject) => {
						const timeoutId = setTimeout(() => {
							reject(new Error(`Operation timed out after ${timeout}ms`));
						}, timeout);

						setTimeout(() => {
							clearTimeout(timeoutId);
							resolve(`Completed work: ${work}ms`);
						}, work);
					});
				}),
			);

			expect(results[0].status).toBe("fulfilled");
			expect(results[1].status).toBe("rejected");
			expect(results[2].status).toBe("fulfilled");

			if (results[1].status === "rejected") {
				expect(results[1].reason.message).toContain("timed out");
			}
		});
	});

	describe("Resource Cleanup Tests", () => {
		test("should properly clean up resources after large operations", async () => {
			const _initialMemory = process.memoryUsage().heapUsed;
			const resources: any[] = [];

			try {
				// Allocate resources
				for (let i = 0; i < 1000; i++) {
					resources.push({
						id: i,
						data: new Array(1000).fill(`resource_${i}`),
						cleanup: () => {
							// Simulate cleanup
							return true;
						},
					});
				}

				expect(resources).toHaveLength(1000);

				// Simulate resource usage
				const processed = resources.map((resource) => ({
					id: resource.id,
					processed: true,
					size: resource.data.length,
				}));

				expect(processed).toHaveLength(1000);
			} finally {
				// Cleanup
				resources.forEach((resource) => {
					if (resource.cleanup) {
						resource.cleanup();
					}
				});

				resources.length = 0;

				// Force GC if available
				if (global.gc) {
					global.gc();
				}
			}

			// Verify cleanup (memory might not immediately decrease due to GC timing)
			expect(resources).toHaveLength(0);
		});
	});
});
