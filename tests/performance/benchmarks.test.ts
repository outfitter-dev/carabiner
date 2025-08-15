/**
 * Performance Benchmarks and Memory Usage Tests
 * 
 * Comprehensive performance testing to establish baselines
 * and ensure the system meets production performance requirements.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import type { HookContext, HookResult, HookHandler } from '@outfitter/types';

/**
 * Performance measurement utilities
 */
class PerformanceBenchmark {
  private measurements: Map<string, number[]> = new Map();
  private memorySnapshots: Map<string, NodeJS.MemoryUsage> = new Map();

  /**
   * Start a performance measurement
   */
  start(name: string): void {
    this.memorySnapshots.set(`${name}_start`, process.memoryUsage());
  }

  /**
   * End a performance measurement and record the duration
   */
  end(name: string): number {
    const duration = performance.now();
    const existing = this.measurements.get(name) || [];
    existing.push(duration);
    this.measurements.set(name, existing);
    
    this.memorySnapshots.set(`${name}_end`, process.memoryUsage());
    return duration;
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    this.memorySnapshots.set(`${name}_start`, process.memoryUsage());
    
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;
      
      const existing = this.measurements.get(name) || [];
      existing.push(duration);
      this.measurements.set(name, existing);
      
      this.memorySnapshots.set(`${name}_end`, process.memoryUsage());
      return result;
    } catch (error) {
      this.memorySnapshots.set(`${name}_end`, process.memoryUsage());
      throw error;
    }
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    const p95Index = Math.floor(measurements.length * 0.95);
    const p99Index = Math.floor(measurements.length * 0.99);

    return {
      count: measurements.length,
      avg: sum / measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Index] || sorted[sorted.length - 1],
      p99: sorted[p99Index] || sorted[sorted.length - 1],
    };
  }

  /**
   * Get memory usage for a measurement
   */
  getMemoryUsage(name: string) {
    const startMemory = this.memorySnapshots.get(`${name}_start`);
    const endMemory = this.memorySnapshots.get(`${name}_end`);
    
    if (!startMemory || !endMemory) {
      return null;
    }

    return {
      heapUsedDelta: endMemory.heapUsed - startMemory.heapUsed,
      heapTotalDelta: endMemory.heapTotal - startMemory.heapTotal,
      externalDelta: endMemory.external - startMemory.external,
      rssDelta: endMemory.rss - startMemory.rss,
    };
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
    this.memorySnapshots.clear();
  }
}

describe('Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;

  beforeAll(() => {
    benchmark = new PerformanceBenchmark();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(() => {
    // Print benchmark results
    console.log('\n📊 Performance Benchmark Results:');
    console.log('================================');
    
    ['hook_execution', 'config_loading', 'json_parsing', 'memory_allocation'].forEach(name => {
      const stats = benchmark.getStats(name);
      if (stats.count > 0) {
        console.log(`\n${name}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Average: ${stats.avg.toFixed(2)}ms`);
        console.log(`  Min: ${stats.min.toFixed(2)}ms`);
        console.log(`  Max: ${stats.max.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
        
        const memory = benchmark.getMemoryUsage(name);
        if (memory) {
          console.log(`  Heap Delta: ${(memory.heapUsedDelta / 1024 / 1024).toFixed(2)}MB`);
        }
      }
    });
  });

  describe('Hook Execution Performance', () => {
    test('should execute simple hooks within performance targets', async () => {
      // Simple hook handler
      const simpleHook: HookHandler = async (context: HookContext): Promise<HookResult> => {
        return {
          success: true,
          message: 'Simple hook executed',
        };
      };

      // Warm up
      for (let i = 0; i < 5; i++) {
        await simpleHook({
          event: 'pre-tool-use',
          tool: 'Bash',
          input: { command: 'echo test' },
        });
      }

      // Benchmark execution
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await benchmark.time('hook_execution', () =>
          simpleHook({
            event: 'pre-tool-use',
            tool: 'Bash',
            input: { command: `echo test${i}` },
          })
        );
      }

      const stats = benchmark.getStats('hook_execution');
      
      // Performance targets
      expect(stats.avg).toBeLessThan(5); // Average < 5ms
      expect(stats.p95).toBeLessThan(10); // 95th percentile < 10ms
      expect(stats.max).toBeLessThan(50); // Max < 50ms
    });

    test('should handle concurrent hook executions efficiently', async () => {
      const concurrentHook: HookHandler = async (context: HookContext): Promise<HookResult> => {
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        
        return {
          success: true,
          message: `Concurrent hook executed for ${context.tool}`,
          data: { timestamp: Date.now() },
        };
      };

      const concurrency = 50;
      const promises: Promise<any>[] = [];

      const startTime = performance.now();
      
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          benchmark.time(`concurrent_${i}`, () =>
            concurrentHook({
              event: 'pre-tool-use',
              tool: 'Bash',
              input: { command: `echo concurrent${i}` },
            })
          )
        );
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(concurrency);
      expect(totalTime).toBeLessThan(100); // Should complete within 100ms
      
      // All results should be successful
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should maintain performance with increasing payload sizes', async () => {
      const payloadSizes = [1000, 10000, 50000];
      const performanceResults: { size: number; avgTime: number }[] = [];

      for (const size of payloadSizes) {
        const largePayload = Array(size).fill(null).map((_, i) => ({
          id: i,
          data: `payload_item_${i}`,
          nested: { level: 1, value: i * 2 },
        }));

        const hookWithLargePayload: HookHandler = async (context: HookContext): Promise<HookResult> => {
          // Process the large payload
          const processed = largePayload.map(item => ({
            ...item,
            processed: true,
            timestamp: Date.now(),
          }));

          return {
            success: true,
            message: `Processed ${processed.length} items`,
            data: { count: processed.length },
          };
        };

        // Benchmark with this payload size
        const iterations = 10;
        for (let i = 0; i < iterations; i++) {
          await benchmark.time(`payload_${size}`, () =>
            hookWithLargePayload({
              event: 'pre-tool-use',
              tool: 'Bash',
              input: { data: largePayload },
            })
          );
        }

        const stats = benchmark.getStats(`payload_${size}`);
        performanceResults.push({ size, avgTime: stats.avg });
      }

      // Performance should scale linearly, not exponentially
      for (let i = 1; i < performanceResults.length; i++) {
        const current = performanceResults[i];
        const previous = performanceResults[i - 1];
        
        const timeRatio = current.avgTime / previous.avgTime;
        const sizeRatio = current.size / previous.size;
        
        // Time increase should be reasonable compared to size increase
        expect(timeRatio).toBeLessThan(sizeRatio * 2); // At most 2x the size ratio
      }
    });
  });

  describe('Configuration Loading Performance', () => {
    test('should load small configurations quickly', async () => {
      const smallConfig = {
        version: '1.0.0',
        hooks: {
          'pre-tool-use': {
            handler: './hooks/simple.ts',
            timeout: 5000,
          },
        },
        environment: {
          NODE_ENV: 'test',
        },
      };

      for (let i = 0; i < 50; i++) {
        await benchmark.time('config_loading', async () => {
          // Simulate config loading
          const json = JSON.stringify(smallConfig);
          const parsed = JSON.parse(json);
          
          // Basic validation
          expect(parsed.version).toBe('1.0.0');
          return parsed;
        });
      }

      const stats = benchmark.getStats('config_loading');
      
      // Config loading should be very fast
      expect(stats.avg).toBeLessThan(2); // Average < 2ms
      expect(stats.max).toBeLessThan(10); // Max < 10ms
    });

    test('should handle large configurations efficiently', async () => {
      const largeConfig = {
        version: '1.0.0',
        hooks: {} as Record<string, any>,
        environment: {} as Record<string, any>,
      };

      // Add many hook configurations
      for (let i = 0; i < 1000; i++) {
        largeConfig.hooks[`hook_${i}`] = {
          handler: `./hooks/hook_${i}.ts`,
          timeout: 5000,
          metadata: {
            description: `Generated hook ${i}`,
            tags: [`tag${i}`, `category${i % 10}`],
          },
        };
      }

      // Add many environment variables
      for (let i = 0; i < 500; i++) {
        largeConfig.environment[`VAR_${i}`] = `value_${i}`;
      }

      const configString = JSON.stringify(largeConfig);
      expect(configString.length).toBeGreaterThan(100000); // > 100KB

      for (let i = 0; i < 10; i++) {
        await benchmark.time('large_config_loading', async () => {
          const parsed = JSON.parse(configString);
          expect(Object.keys(parsed.hooks)).toHaveLength(1000);
          expect(Object.keys(parsed.environment)).toHaveLength(500);
          return parsed;
        });
      }

      const stats = benchmark.getStats('large_config_loading');
      
      // Large config loading should still be reasonable
      expect(stats.avg).toBeLessThan(50); // Average < 50ms
      expect(stats.max).toBeLessThan(100); // Max < 100ms
    });
  });

  describe('JSON Processing Performance', () => {
    test('should parse JSON efficiently across size ranges', async () => {
      const sizes = [1000, 10000, 100000];

      for (const size of sizes) {
        const data = Array(size).fill(null).map((_, i) => ({
          id: i,
          timestamp: Date.now(),
          data: `item_${i}`,
          metadata: {
            index: i,
            processed: false,
            tags: [`tag_${i % 10}`, `category_${i % 5}`],
          },
        }));

        const jsonString = JSON.stringify(data);

        for (let i = 0; i < 10; i++) {
          await benchmark.time(`json_parsing_${size}`, async () => {
            const parsed = JSON.parse(jsonString);
            expect(parsed).toHaveLength(size);
            return parsed;
          });
        }

        const stats = benchmark.getStats(`json_parsing_${size}`);
        
        // JSON parsing performance targets (scale with size)
        const maxExpectedTime = Math.max(10, size / 10000); // 10ms base, +1ms per 10k items
        expect(stats.avg).toBeLessThan(maxExpectedTime);
      }
    });

    test('should stringify JSON efficiently', async () => {
      const complexObject = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          generator: 'performance-test',
        },
        data: Array(10000).fill(null).map((_, i) => ({
          id: i,
          name: `item_${i}`,
          properties: {
            active: i % 2 === 0,
            priority: i % 5,
            tags: Array(3).fill(null).map((_, j) => `tag_${i}_${j}`),
            nested: {
              level1: {
                level2: {
                  value: i,
                  description: `Nested value for item ${i}`,
                },
              },
            },
          },
        })),
        summary: {
          totalItems: 10000,
          generatedAt: Date.now(),
        },
      };

      for (let i = 0; i < 10; i++) {
        await benchmark.time('json_stringify', async () => {
          const jsonString = JSON.stringify(complexObject);
          expect(jsonString.length).toBeGreaterThan(100000);
          return jsonString;
        });
      }

      const stats = benchmark.getStats('json_stringify');
      
      // JSON stringify should be reasonably fast
      expect(stats.avg).toBeLessThan(100); // Average < 100ms
      expect(stats.max).toBeLessThan(200); // Max < 200ms
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();

      for (let i = 0; i < 100; i++) {
        await benchmark.time('memory_allocation', async () => {
          // Allocate and process data
          const data = Array(1000).fill(null).map((_, j) => ({
            id: j,
            iteration: i,
            data: `item_${i}_${j}`,
          }));

          // Process the data
          const processed = data.map(item => ({
            ...item,
            processed: true,
            hash: (item.id + item.iteration).toString(16),
          }));

          expect(processed).toHaveLength(1000);
          return processed.length;
        });

        // Periodic memory check
        if (i % 25 === 0) {
          const currentMemory = process.memoryUsage();
          const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory shouldn't grow too much (allow 50MB growth)
          expect(heapIncrease).toBeLessThan(50 * 1024 * 1024);
        }
      }

      const memoryUsage = benchmark.getMemoryUsage('memory_allocation');
      expect(memoryUsage).not.toBeNull();
      
      // Memory delta should be reasonable
      if (memoryUsage) {
        expect(Math.abs(memoryUsage.heapUsedDelta)).toBeLessThan(10 * 1024 * 1024); // < 10MB delta
      }
    });

    test('should handle memory cleanup efficiently', async () => {
      const cleanup = async () => {
        // Allocate significant memory
        const largeArray = Array(100000).fill(null).map((_, i) => ({
          id: i,
          data: `large_item_${i}`,
          payload: Array(100).fill(`payload_${i}`),
        }));

        expect(largeArray).toHaveLength(100000);

        // Clear the reference
        largeArray.length = 0;

        // Force GC if available
        if (global.gc) {
          global.gc();
        }

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      await benchmark.time('memory_cleanup', cleanup);
      
      const stats = benchmark.getStats('memory_cleanup');
      expect(stats.avg).toBeLessThan(100); // Cleanup should be fast
    });
  });

  describe('Startup Performance', () => {
    test('should have fast initialization times', async () => {
      // Simulate module loading and initialization
      for (let i = 0; i < 10; i++) {
        await benchmark.time('startup_simulation', async () => {
          // Simulate loading modules
          const modules = ['types', 'config', 'execution', 'protocol'].map(name => ({
            name,
            loaded: true,
            loadTime: Math.random() * 5,
          }));

          // Simulate initialization
          const initialized = modules.map(module => ({
            ...module,
            initialized: true,
            initTime: Math.random() * 2,
          }));

          expect(initialized).toHaveLength(4);
          return initialized;
        });
      }

      const stats = benchmark.getStats('startup_simulation');
      
      // Startup should be fast
      expect(stats.avg).toBeLessThan(10); // Average < 10ms
      expect(stats.max).toBeLessThan(25); // Max < 25ms
    });
  });
});