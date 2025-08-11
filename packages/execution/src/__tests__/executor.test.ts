/**
 * @outfitter/execution - Hook executor tests
 */

import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { TestProtocol, createProtocol } from '@outfitter/protocol';
import type { HookContext, HookResult, HookHandler } from '@outfitter/types';

import {
  HookExecutor,
  executeHook,
  createDevelopmentExecutor,
  createProductionExecutor,
  type ExecutionOptions,
} from '../executor';

import { MetricsCollector } from '../metrics';

describe('HookExecutor', () => {
  let mockProtocol: TestProtocol;
  let mockInput: unknown;
  
  beforeEach(() => {
    mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
      session_id: 'test-session-123',
      cwd: '/tmp',
      environment: { PATH: '/usr/bin' },
    };
    
    mockProtocol = createProtocol('test', { input: mockInput }) as TestProtocol;
  });

  describe('constructor', () => {
    test('should create executor with default options', () => {
      const executor = new HookExecutor(mockProtocol);
      expect(executor).toBeInstanceOf(HookExecutor);
    });

    test('should create executor with custom options', () => {
      const options: ExecutionOptions = {
        timeout: 5000,
        collectMetrics: false,
        exitProcess: false,
      };
      
      const executor = new HookExecutor(mockProtocol, options);
      expect(executor).toBeInstanceOf(HookExecutor);
    });
  });

  describe('execute', () => {
    test('should execute successful hook handler', async () => {
      const handler: HookHandler = async (context) => {
        expect(context.event).toBe('PreToolUse');
        expect(context.toolName).toBe('Bash');
        return { success: true, message: 'Hook executed successfully' };
      };
      
      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      expect(mockProtocol.output).toBeDefined();
      expect(mockProtocol.output?.success).toBe(true);
      expect(mockProtocol.output?.message).toBe('Hook executed successfully');
    });

    test('should handle handler that returns failure', async () => {
      const handler: HookHandler = async () => {
        return { success: false, message: 'Hook failed', block: true };
      };
      
      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      expect(mockProtocol.output).toBeDefined();
      expect(mockProtocol.output?.success).toBe(false);
      expect(mockProtocol.output?.message).toBe('Hook failed');
      expect(mockProtocol.output?.block).toBe(true);
    });

    test('should handle handler that throws error', async () => {
      const handler: HookHandler = async () => {
        throw new Error('Handler threw an error');
      };
      
      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      expect(mockProtocol.output).toBeDefined();
      expect(mockProtocol.output?.success).toBe(false);
      expect(mockProtocol.output?.message).toBe('Handler threw an error');
    });

    test('should handle timeout', async () => {
      const handler: HookHandler = async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true };
      };
      
      const executor = new HookExecutor(mockProtocol, {
        timeout: 50, // 50ms timeout
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      expect(mockProtocol.output).toBeDefined();
      expect(mockProtocol.output?.success).toBe(false);
      expect(mockProtocol.output?.message).toContain('timed out after 50ms');
    });

    test('should normalize different handler return types', async () => {
      const testCases = [
        { input: null, expected: { success: true, message: 'Handler completed successfully' } },
        { input: undefined, expected: { success: true, message: 'Handler completed successfully' } },
        { input: true, expected: { success: true } },
        { input: false, expected: { success: false, block: true } },
        { input: 'success message', expected: { success: true, message: 'success message' } },
        { input: { success: true, message: 'custom' }, expected: { success: true, message: 'custom' } },
      ];
      
      for (const testCase of testCases) {
        const handler: HookHandler = async () => testCase.input;
        
        const executor = new HookExecutor(mockProtocol, {
          exitProcess: false,
          collectMetrics: false,
        });
        
        await executor.execute(handler);
        
        expect(mockProtocol.output?.success).toBe(testCase.expected.success);
        if (testCase.expected.message) {
          expect(mockProtocol.output?.message).toBe(testCase.expected.message);
        }
        if ('block' in testCase.expected) {
          expect(mockProtocol.output?.block).toBe(testCase.expected.block);
        }
      }
    });

    test('should collect metrics when enabled', async () => {
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
      expect(metric.event).toBe('PreToolUse');
      expect(metric.toolName).toBe('Bash');
      expect(metric.success).toBe(true);
      expect(metric.timing.duration).toBeGreaterThan(0);
    });

    test('should validate results when enabled', async () => {
      const handler: HookHandler = async () => {
        // Return invalid result (missing success field)
        return { message: 'test' } as any;
      };
      
      const executor = new HookExecutor(mockProtocol, {
        exitProcess: false,
        validateResults: true,
      });
      
      await executor.execute(handler);
      
      expect(mockProtocol.output?.success).toBe(false);
      expect(mockProtocol.output?.message).toContain('boolean success field');
    });

    test('should handle protocol read errors', async () => {
      const errorProtocol = createProtocol('test', { input: null }) as TestProtocol;
      
      // Mock readInput to throw
      errorProtocol.readInput = async () => {
        throw new Error('Failed to read input');
      };
      
      const handler: HookHandler = async () => ({ success: true });
      
      const executor = new HookExecutor(errorProtocol, {
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      // Should still try to write error
      expect(errorProtocol.error).toBeDefined();
    });

    test('should handle protocol parse errors', async () => {
      const errorProtocol = createProtocol('test', { input: mockInput }) as TestProtocol;
      
      // Mock parseContext to throw
      errorProtocol.parseContext = async () => {
        throw new Error('Failed to parse context');
      };
      
      const handler: HookHandler = async () => ({ success: true });
      
      const executor = new HookExecutor(errorProtocol, {
        exitProcess: false,
        collectMetrics: false,
      });
      
      await executor.execute(handler);
      
      expect(errorProtocol.error).toBeDefined();
    });
  });
});

describe('Convenience functions', () => {
  test('executeHook should work with minimal setup', async () => {
    const mockInput = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'echo "test"' },
      session_id: 'test-123',
      cwd: '/tmp',
      environment: {},
    };
    
    const protocol = createProtocol('test', { input: mockInput });
    const handler: HookHandler = async () => ({ success: true, message: 'Test passed' });
    
    await executeHook(protocol, handler, { exitProcess: false });
    
    const testProtocol = protocol as TestProtocol;
    expect(testProtocol.output?.success).toBe(true);
    expect(testProtocol.output?.message).toBe('Test passed');
  });

  test('createDevelopmentExecutor should use development defaults', () => {
    const protocol = createProtocol('test', { input: {} });
    const executor = createDevelopmentExecutor(protocol, { timeout: 5000 });
    
    expect(executor).toBeInstanceOf(HookExecutor);
    // Can't easily test the internal options, but we can verify it doesn't throw
  });

  test('createProductionExecutor should use production defaults', () => {
    const protocol = createProtocol('test', { input: {} });
    const executor = createProductionExecutor(protocol, { timeout: 60000 });
    
    expect(executor).toBeInstanceOf(HookExecutor);
    // Can't easily test the internal options, but we can verify it doesn't throw
  });
});

describe('Edge cases', () => {
  test('should handle concurrent executions safely', async () => {
    const protocol1 = createProtocol('test', { input: { hook_event_name: 'PreToolUse', session_id: '1', cwd: '/tmp', environment: {} } });
    const protocol2 = createProtocol('test', { input: { hook_event_name: 'PostToolUse', session_id: '2', cwd: '/tmp', environment: {} } });
    
    const handler1: HookHandler = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { success: true, message: 'Handler 1' };
    };
    
    const handler2: HookHandler = async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return { success: true, message: 'Handler 2' };
    };
    
    const executor1 = new HookExecutor(protocol1, { exitProcess: false });
    const executor2 = new HookExecutor(protocol2, { exitProcess: false });
    
    const [result1, result2] = await Promise.all([
      executor1.execute(handler1),
      executor2.execute(handler2),
    ]);
    
    const testProtocol1 = protocol1 as TestProtocol;
    const testProtocol2 = protocol2 as TestProtocol;
    
    expect(testProtocol1.output?.message).toBe('Handler 1');
    expect(testProtocol2.output?.message).toBe('Handler 2');
  });

  test('should handle memory pressure gracefully', async () => {
    const protocol = createProtocol('test', { 
      input: { 
        hook_event_name: 'PreToolUse',
        session_id: 'memory-test',
        cwd: '/tmp',
        environment: {},
      } 
    });
    
    const handler: HookHandler = async () => {
      // Allocate some memory
      const largeArray = new Array(10000).fill('test data');
      
      // Keep reference to prevent GC
      expect(largeArray.length).toBe(10000);
      
      return { success: true, message: 'Memory test completed' };
    };
    
    const executor = new HookExecutor(protocol, {
      exitProcess: false,
      collectMetrics: true,
    });
    
    await executor.execute(handler);
    
    const testProtocol = protocol as TestProtocol;
    expect(testProtocol.output?.success).toBe(true);
  });
});