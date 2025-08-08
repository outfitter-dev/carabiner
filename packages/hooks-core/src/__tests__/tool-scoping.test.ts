/**
 * Comprehensive tests for tool scoping architecture fix
 * Validates that the critical bug where forTool() calls are ignored is resolved
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { createHook, HookBuilder, HookRegistry } from '../index.ts';
import type { HookResult } from '../types.ts';

// Mock context helper that matches the actual HookContext structure
function createMockContext(
  event: 'PreToolUse' | 'PostToolUse',
  options: { toolName?: string } = {}
) {
  return {
    event,
    toolName: options.toolName || 'Bash',
    sessionId: 'test-session-123',
    transcriptPath: '/test/transcript',
    cwd: process.cwd(),
    toolInput: { command: 'echo test' },
    environment: {},
    rawInput: {
      session_id: 'test-session-123',
      transcript_path: '/test/transcript',
      cwd: process.cwd(),
      hook_event_name: event,
      tool_name: options.toolName || 'Bash',
      tool_input: { command: 'echo test' },
    },
  } as any;
}

describe('Tool Scoping Fix - Registry Core', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test('tool-specific hooks only execute for specified tool', async () => {
    const bashHandler = mock().mockResolvedValue({ success: true });

    const bashHook = HookBuilder.forPreToolUse()
      .forTool('Bash')
      .withHandler(bashHandler)
      .build();

    registry.register(bashHook);

    // Should execute for Bash
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    expect(bashHandler).toHaveBeenCalledTimes(1);

    // Should NOT execute for Write
    bashHandler.mockClear();
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );
    expect(bashHandler).not.toHaveBeenCalled();
  });

  test('universal hooks execute for all tools', async () => {
    const universalHandler = mock().mockResolvedValue({ success: true });

    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(universalHandler)
      .build();

    registry.register(universalHook);

    // Should execute for any tool
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);

    universalHandler.mockClear();
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);

    universalHandler.mockClear();
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Edit' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
  });

  test('mixed universal and tool-specific hooks execute correctly', async () => {
    const universalHandler = mock().mockResolvedValue({ success: true });
    const bashHandler = mock().mockResolvedValue({ success: true });
    const writeHandler = mock().mockResolvedValue({ success: true });

    registry.register(
      HookBuilder.forPreToolUse().withHandler(universalHandler).build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool('Bash')
        .withHandler(bashHandler)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool('Write')
        .withHandler(writeHandler)
        .build()
    );

    // For Bash: both universal and bash-specific should run
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).toHaveBeenCalledTimes(1);
    expect(writeHandler).not.toHaveBeenCalled();

    // For Write: universal and write-specific should run
    universalHandler.mockClear();
    bashHandler.mockClear();
    writeHandler.mockClear();
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).not.toHaveBeenCalled();
    expect(writeHandler).toHaveBeenCalledTimes(1);

    // For Edit: only universal should run
    universalHandler.mockClear();
    bashHandler.mockClear();
    writeHandler.mockClear();
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Edit' })
    );
    expect(universalHandler).toHaveBeenCalledTimes(1);
    expect(bashHandler).not.toHaveBeenCalled();
    expect(writeHandler).not.toHaveBeenCalled();
  });

  test('hook priority works correctly with mixed universal and tool-specific hooks', async () => {
    const results: string[] = [];

    const universalLow = mock().mockImplementation(async () => {
      results.push('universal-low');
      return { success: true };
    });

    const universalHigh = mock().mockImplementation(async () => {
      results.push('universal-high');
      return { success: true };
    });

    const bashLow = mock().mockImplementation(async () => {
      results.push('bash-low');
      return { success: true };
    });

    const bashHigh = mock().mockImplementation(async () => {
      results.push('bash-high');
      return { success: true };
    });

    // Register hooks with different priorities
    registry.register(
      HookBuilder.forPreToolUse()
        .withHandler(universalLow)
        .withPriority(1)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .withHandler(universalHigh)
        .withPriority(10)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool('Bash')
        .withHandler(bashLow)
        .withPriority(2)
        .build()
    );
    registry.register(
      HookBuilder.forPreToolUse()
        .forTool('Bash')
        .withHandler(bashHigh)
        .withPriority(5)
        .build()
    );

    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );

    // Should execute in priority order: universal-high(10), bash-high(5), bash-low(2), universal-low(1)
    expect(results).toEqual([
      'universal-high',
      'bash-high',
      'bash-low',
      'universal-low',
    ]);
  });

  test('registry stores hooks with correct keys', () => {
    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(mock())
      .build();
    const bashHook = HookBuilder.forPreToolUse()
      .forTool('Bash')
      .withHandler(mock())
      .build();

    registry.register(universalHook);
    registry.register(bashHook);

    // Should have different hook counts for different tools
    const bashHooks = registry.getHooks('PreToolUse', 'Bash');
    const writeHooks = registry.getHooks('PreToolUse', 'Write');
    const universalOnly = registry.getHooks('PreToolUse');

    expect(bashHooks).toHaveLength(2); // universal + bash-specific
    expect(writeHooks).toHaveLength(1); // only universal
    expect(universalOnly).toHaveLength(1); // only universal when no tool specified
  });
});

describe('Tool Scoping Fix - Builder Pattern', () => {
  test('builder includes tool field in output', () => {
    const bashHook = HookBuilder.forPreToolUse()
      .forTool('Bash')
      .withHandler(mock())
      .build();

    expect(bashHook.tool).toBe('Bash');
    expect(bashHook.event).toBe('PreToolUse');

    const universalHook = HookBuilder.forPreToolUse()
      .withHandler(mock())
      .build();

    expect(universalHook.tool).toBeUndefined();
    expect(universalHook.event).toBe('PreToolUse');
  });

  test('builder supports method chaining with forTool', () => {
    const hook = HookBuilder.forPreToolUse()
      .forTool('Write')
      .withPriority(5)
      .withHandler(mock())
      .enabled(true)
      .build();

    expect(hook.tool).toBe('Write');
    expect(hook.priority).toBe(5);
    expect(hook.enabled).toBe(true);
    expect(hook.event).toBe('PreToolUse');
  });
});

describe('Tool Scoping Fix - Function-Based API', () => {
  test('createHook.preToolUse supports both universal and tool-specific syntax', () => {
    // Universal hook syntax
    const universalHook = createHook.preToolUse(mock());
    expect(universalHook.tool).toBeUndefined();
    expect(universalHook.event).toBe('PreToolUse');

    // Tool-specific syntax
    const bashHook = createHook.preToolUse('Bash', mock());
    expect(bashHook.tool).toBe('Bash');
    expect(bashHook.event).toBe('PreToolUse');
  });

  test('createHook.postToolUse supports both universal and tool-specific syntax', () => {
    // Universal hook syntax
    const universalHook = createHook.postToolUse(mock());
    expect(universalHook.tool).toBeUndefined();
    expect(universalHook.event).toBe('PostToolUse');

    // Tool-specific syntax
    const writeHook = createHook.postToolUse('Write', mock());
    expect(writeHook.tool).toBe('Write');
    expect(writeHook.event).toBe('PostToolUse');
  });

  test('createHook throws error when tool specified without handler', () => {
    expect(() => {
      createHook.preToolUse('Bash' as any);
    }).toThrow('Handler is required when tool is specified');

    expect(() => {
      createHook.postToolUse('Write' as any);
    }).toThrow('Handler is required when tool is specified');
  });
});

describe('Tool Scoping Fix - Integration Tests', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test('real-world scenario: logging hooks with tool-specific overrides', async () => {
    const logs: string[] = [];

    // Universal logging hook (logs all tools)
    const universalLogger = createHook.preToolUse(async (context) => {
      logs.push(`[UNIVERSAL] ${context.event} for ${context.toolName}`);
      return { success: true };
    });

    // Bash-specific enhanced logging
    const bashLogger = createHook.preToolUse('Bash', async (context) => {
      logs.push(`[BASH-SPECIFIC] Enhanced logging for ${context.toolName}`);
      return { success: true };
    });

    registry.register(universalLogger);
    registry.register(bashLogger);

    // Test Bash execution (should trigger both)
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    expect(logs).toContain('[UNIVERSAL] PreToolUse for Bash');
    expect(logs).toContain('[BASH-SPECIFIC] Enhanced logging for Bash');

    logs.length = 0; // Clear logs

    // Test Write execution (should trigger only universal)
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );
    expect(logs).toContain('[UNIVERSAL] PreToolUse for Write');
    expect(logs).not.toContain('[BASH-SPECIFIC]');
  });

  test('security validation scenario: block dangerous commands only for Bash', async () => {
    const _results: HookResult[] = [];

    // Universal hook (allows all)
    const universalHook = createHook.preToolUse(async () => {
      return { success: true, message: 'Universal validation passed' };
    });

    // Bash-specific security hook (blocks rm -rf)
    const bashSecurityHook = createHook.preToolUse(
      'Bash',
      async (context: any) => {
        const command = context.toolInput?.command || '';
        if (command.includes('rm -rf')) {
          return {
            success: false,
            block: true,
            message: 'Dangerous command blocked',
          };
        }
        return { success: true, message: 'Bash security check passed' };
      }
    );

    registry.register(universalHook);
    registry.register(bashSecurityHook);

    // Test safe Bash command (should pass both)
    const safeBashContext = createMockContext('PreToolUse', {
      toolName: 'Bash',
    });
    safeBashContext.toolInput = { command: 'echo "hello world"' };
    const safeBashResults = await registry.execute(safeBashContext);
    expect(safeBashResults).toHaveLength(2);
    expect(safeBashResults.every((r) => r.success)).toBe(true);

    // Test dangerous Bash command (should be blocked)
    const dangerousBashContext = createMockContext('PreToolUse', {
      toolName: 'Bash',
    });
    dangerousBashContext.toolInput = { command: 'rm -rf /' };
    const dangerousBashResults = await registry.execute(dangerousBashContext);
    expect(dangerousBashResults).toHaveLength(2);
    expect(dangerousBashResults[0].success).toBe(true); // Universal passes
    expect(dangerousBashResults[1].success).toBe(false); // Bash security blocks
    expect(dangerousBashResults[1].block).toBe(true);

    // Test Write tool with dangerous-looking content (should pass - no Bash security)
    const writeContext = createMockContext('PreToolUse', { toolName: 'Write' });
    writeContext.toolInput = { file_path: 'script.sh', content: 'rm -rf /' };
    const writeResults = await registry.execute(writeContext);
    expect(writeResults).toHaveLength(1); // Only universal hook
    expect(writeResults[0].success).toBe(true);
  });

  test('performance monitoring: tool-specific vs universal hooks', async () => {
    let universalExecutions = 0;
    let bashExecutions = 0;
    let writeExecutions = 0;

    // Universal performance monitor
    registry.register(
      createHook.preToolUse(async () => {
        universalExecutions++;
        return { success: true };
      })
    );

    // Bash-specific monitor
    registry.register(
      createHook.preToolUse('Bash', async () => {
        bashExecutions++;
        return { success: true };
      })
    );

    // Write-specific monitor
    registry.register(
      createHook.preToolUse('Write', async () => {
        writeExecutions++;
        return { success: true };
      })
    );

    // Execute for different tools
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );
    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Edit' })
    );

    // Universal should execute for all
    expect(universalExecutions).toBe(3);

    // Tool-specific should execute only for their tools
    expect(bashExecutions).toBe(1);
    expect(writeExecutions).toBe(1);
  });
});

describe('Tool Scoping Fix - Error Scenarios', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  test('blocking failure in tool-specific hook stops execution', async () => {
    const results: string[] = [];

    // Universal hook
    registry.register(
      createHook.preToolUse(async () => {
        results.push('universal');
        return { success: true };
      })
    );

    // Bash hook that blocks
    registry.register(
      createHook.preToolUse('Bash', async () => {
        results.push('bash-blocker');
        return { success: false, block: true, message: 'Blocked by bash hook' };
      })
    );

    // Another bash hook (should not execute due to blocking)
    registry.register(
      createHook.preToolUse('Bash', async () => {
        results.push('bash-after-blocker');
        return { success: true };
      })
    );

    await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );

    expect(results).toContain('universal');
    expect(results).toContain('bash-blocker');
    expect(results).not.toContain('bash-after-blocker'); // Should be blocked
  });

  test('error handling preserves tool scoping', async () => {
    const results: string[] = [];

    // Universal hook that throws
    registry.register(
      createHook.preToolUse(async () => {
        results.push('universal-error');
        throw new Error('Universal hook error');
      })
    );

    // Bash hook that should still execute despite universal error
    registry.register(
      createHook.preToolUse('Bash', async () => {
        results.push('bash-after-error');
        return { success: true };
      })
    );

    const hookResults = await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );

    expect(results).toContain('universal-error');
    expect(results).not.toContain('bash-after-error'); // Execution stopped due to blocking error

    expect(hookResults).toHaveLength(1);
    expect(hookResults[0].success).toBe(false);
    expect(hookResults[0].block).toBe(true); // PreToolUse errors should block
  });
});

describe('Tool Scoping Fix - Backward Compatibility', () => {
  test('existing hook patterns work unchanged', async () => {
    const registry = new HookRegistry();

    // Old pattern: builder without forTool (should be universal)
    const oldBuilderHook = HookBuilder.forPreToolUse()
      .withHandler(mock().mockResolvedValue({ success: true }))
      .build();

    registry.register(oldBuilderHook);

    // Should work for any tool
    const bashResult = await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Bash' })
    );
    const writeResult = await registry.execute(
      createMockContext('PreToolUse', { toolName: 'Write' })
    );

    expect(bashResult).toHaveLength(1);
    expect(writeResult).toHaveLength(1);
    expect(bashResult[0].success).toBe(true);
    expect(writeResult[0].success).toBe(true);
  });

  test('manual hook registry entries work with new system', () => {
    const registry = new HookRegistry();

    // Manual registry entry (old style - no tool field)
    registry.register({
      event: 'PreToolUse',
      handler: mock().mockResolvedValue({ success: true }),
      priority: 0,
      enabled: true,
      // No tool field - should be universal
    });

    const bashHooks = registry.getHooks('PreToolUse', 'Bash');
    const writeHooks = registry.getHooks('PreToolUse', 'Write');

    expect(bashHooks).toHaveLength(1);
    expect(writeHooks).toHaveLength(1);
  });
});
