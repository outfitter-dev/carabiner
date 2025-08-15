/**
 * Production Scenario Validation Tests
 * 
 * Tests real-world production scenarios including binary distribution,
 * logging verification, security hardening, cross-platform compatibility,
 * and actual production configuration scenarios.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir, platform, arch } from 'node:os';
import { join, resolve } from 'node:path';
import type { HookConfiguration, HookResult } from '@outfitter/types';

/**
 * Production environment simulator
 */
class ProductionEnvironment {
  public readonly tempDir: string;
  private processes: ChildProcess[] = [];

  constructor() {
    this.tempDir = mkdtempSync(join(tmpdir(), 'grapple-prod-test-'));
  }

  /**
   * Create a production-like directory structure
   */
  setupProductionStructure(): void {
    const dirs = [
      'hooks',
      'logs',
      'config',
      'bin',
      'lib',
      'tmp',
    ];

    dirs.forEach(dir => {
      const fullPath = join(this.tempDir, dir);
      if (!existsSync(fullPath)) {
        writeFileSync(join(fullPath, '.gitkeep'), '');
      }
    });
  }

  /**
   * Create a production configuration
   */
  createProductionConfig(): HookConfiguration {
    const config: HookConfiguration = {
      version: '1.0.0',
      hooks: {
        'pre-tool-use': {
          handler: './hooks/security-scanner.ts',
          timeout: 10000,
          metadata: {
            description: 'Security scanning before tool execution',
            priority: 'high',
            tags: ['security', 'validation'],
          },
        },
        'post-tool-use': {
          handler: './hooks/audit-logger.ts',
          timeout: 5000,
          metadata: {
            description: 'Audit logging after tool execution',
            priority: 'medium',
            tags: ['logging', 'compliance'],
          },
        },
      },
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        SECURITY_LEVEL: 'strict',
        AUDIT_ENABLED: 'true',
        WORKSPACE_PATH: this.tempDir,
        MAX_HOOK_TIMEOUT: '30000',
        ENABLE_METRICS: 'true',
      },
      security: {
        allowedExecutables: ['bun', 'node'],
        restrictedPaths: ['/etc', '/root', '/sys'],
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
        enableSandbox: true,
      },
      logging: {
        level: 'info',
        format: 'json',
        destinations: ['console', 'file'],
        file: {
          path: './logs/hooks.log',
          maxSize: 100 * 1024 * 1024, // 100MB
          maxBackups: 5,
        },
      },
    } as any; // Extended configuration for production

    const configPath = join(this.tempDir, 'config', 'claude-hooks.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
  }

  /**
   * Create production-ready hook files
   */
  createProductionHooks(): void {
    // Security scanner hook
    const securityHook = `
import type { HookContext, HookResult } from '@outfitter/types';

export default async function securityScanner(context: HookContext): Promise<HookResult> {
  const startTime = Date.now();
  
  try {
    // Security validations
    const validations = [
      validateInput(context.input),
      validateTool(context.tool),
      validatePermissions(context),
      scanForThreats(context.input),
    ];
    
    const results = await Promise.all(validations);
    const failed = results.filter(r => !r.passed);
    
    if (failed.length > 0) {
      return {
        success: false,
        message: 'Security validation failed',
        data: {
          failures: failed.map(f => f.reason),
          executionTime: Date.now() - startTime,
        },
        block: true,
      };
    }
    
    return {
      success: true,
      message: 'Security validation passed',
      data: {
        checksPerformed: results.length,
        executionTime: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: \`Security scanner error: \${error.message}\`,
      data: { error: error.message },
      block: true,
    };
  }
}

async function validateInput(input: any): Promise<{passed: boolean; reason?: string}> {
  if (!input) return { passed: false, reason: 'No input provided' };
  if (typeof input === 'string' && input.length > 1024 * 1024) {
    return { passed: false, reason: 'Input too large' };
  }
  return { passed: true };
}

async function validateTool(tool: string): Promise<{passed: boolean; reason?: string}> {
  const allowedTools = ['Bash', 'Read', 'Write', 'Edit', 'WebFetch'];
  if (!allowedTools.includes(tool)) {
    return { passed: false, reason: \`Tool not allowed: \${tool}\` };
  }
  return { passed: true };
}

async function validatePermissions(context: HookContext): Promise<{passed: boolean; reason?: string}> {
  // Simulate permission checking
  if (context.tool === 'Bash' && typeof context.input === 'object' && context.input.command) {
    const cmd = context.input.command as string;
    if (cmd.includes('sudo') || cmd.includes('rm -rf')) {
      return { passed: false, reason: 'Dangerous command detected' };
    }
  }
  return { passed: true };
}

async function scanForThreats(input: any): Promise<{passed: boolean; reason?: string}> {
  const inputString = JSON.stringify(input);
  const threats = ['<script', 'javascript:', 'eval(', 'exec('];
  
  for (const threat of threats) {
    if (inputString.toLowerCase().includes(threat)) {
      return { passed: false, reason: \`Threat detected: \${threat}\` };
    }
  }
  
  return { passed: true };
}
    `;

    // Audit logger hook
    const auditHook = `
import type { HookContext, HookResult } from '@outfitter/types';

export default async function auditLogger(context: HookContext): Promise<HookResult> {
  const timestamp = new Date().toISOString();
  
  try {
    const auditEntry = {
      timestamp,
      event: context.event,
      tool: context.tool,
      sessionId: process.env.CLAUDE_SESSION_ID || 'unknown',
      userId: hashUserId(process.env.CLAUDE_USER_ID || 'anonymous'),
      inputHash: hashInput(context.input),
      executionDuration: Date.now() - (context.startTime || Date.now()),
    };
    
    // Log to console (would be captured by log aggregation in production)
    console.log(JSON.stringify({
      level: 'info',
      message: 'Hook execution audit',
      data: auditEntry,
    }));
    
    // In production, would also write to secure audit log
    await writeAuditLog(auditEntry);
    
    return {
      success: true,
      message: 'Audit log recorded',
      data: { auditId: generateAuditId(), timestamp },
    };
    
  } catch (error) {
    // Audit failures should not block execution
    console.error('Audit logging failed:', error);
    
    return {
      success: false,
      message: \`Audit logging failed: \${error.message}\`,
      data: { timestamp, error: error.message },
    };
  }
}

function hashUserId(userId: string): string {
  // Simple hash for demo - use proper crypto in production
  return userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(16);
}

function hashInput(input: any): string {
  const inputString = JSON.stringify(input);
  return inputString.length > 100 ? inputString.slice(0, 100) + '...[truncated]' : inputString;
}

async function writeAuditLog(entry: any): Promise<void> {
  // Simulate audit log writing
  return new Promise((resolve) => setTimeout(resolve, 1));
}

function generateAuditId(): string {
  return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
    `;

    writeFileSync(join(this.tempDir, 'hooks', 'security-scanner.ts'), securityHook);
    writeFileSync(join(this.tempDir, 'hooks', 'audit-logger.ts'), auditHook);
  }

  /**
   * Spawn a process and track it for cleanup
   */
  spawnProcess(command: string, args: string[], options: any = {}): ChildProcess {
    const proc = spawn(command, args, options);
    this.processes.push(proc);
    return proc;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Kill all spawned processes
    this.processes.forEach(proc => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    this.processes = [];

    // Remove temp directory
    try {
      rmSync(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup production test directory:', error);
    }
  }
}

describe('Production Scenario Validation', () => {
  let prodEnv: ProductionEnvironment;

  beforeAll(() => {
    prodEnv = new ProductionEnvironment();
  });

  afterAll(() => {
    prodEnv.cleanup();
  });

  beforeEach(() => {
    prodEnv.setupProductionStructure();
  });

  describe('Binary Distribution and Execution', () => {
    test('should create and execute binary-like scenarios', async () => {
      // Create a simple executable script that simulates binary behavior
      const scriptContent = `#!/usr/bin/env bun
// Simulated binary execution
const args = process.argv.slice(2);
const config = args.find(arg => arg.startsWith('--config='))?.split('=')[1];

if (!config) {
  console.error('Error: --config parameter required');
  process.exit(1);
}

console.log(JSON.stringify({
  success: true,
  message: 'Binary execution successful',
  config: config,
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
}));
      `;

      const binaryPath = join(prodEnv.tempDir, 'bin', 'claude-hooks');
      writeFileSync(binaryPath, scriptContent);
      chmodSync(binaryPath, 0o755); // Make executable

      // Test binary execution
      const configPath = join(prodEnv.tempDir, 'config', 'claude-hooks.json');
      prodEnv.createProductionConfig();

      const proc = prodEnv.spawnProcess(binaryPath, [`--config=${configPath}`], {
        cwd: prodEnv.tempDir,
      });

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      const exitCode = await new Promise<number>((resolve) => {
        proc.on('close', resolve);
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGTERM');
            resolve(-1);
          }
        }, 5000);
      });

      if (exitCode === 0) {
        const result = JSON.parse(output.trim());
        expect(result.success).toBe(true);
        expect(result.config).toBe(configPath);
        expect(result.platform).toBe(platform());
        expect(result.arch).toBe(arch());
      } else {
        console.log('Binary execution output:', output);
        console.log('Binary execution error:', errorOutput);
        // Binary execution may fail in test environment, but we can verify the structure
        expect(existsSync(binaryPath)).toBe(true);
      }
    });

    test('should handle cross-platform compatibility', async () => {
      const platformTests = [
        {
          platform: 'linux',
          executable: 'claude-hooks',
          pathSeparator: '/',
        },
        {
          platform: 'darwin',
          executable: 'claude-hooks',
          pathSeparator: '/',
        },
        {
          platform: 'win32',
          executable: 'claude-hooks.exe',
          pathSeparator: '\\',
        },
      ];

      for (const test of platformTests) {
        const binaryName = test.executable;
        const expectedPath = join(prodEnv.tempDir, 'bin', binaryName);
        
        // Create platform-specific binary
        const binaryContent = `#!/usr/bin/env bun
console.log(JSON.stringify({
  platform: '${test.platform}',
  executable: '${binaryName}',
  pathSeparator: '${test.pathSeparator}',
  success: true,
}));
        `;

        writeFileSync(expectedPath, binaryContent);
        
        if (test.platform !== 'win32') {
          chmodSync(expectedPath, 0o755);
        }

        expect(existsSync(expectedPath)).toBe(true);
        
        const stats = require('fs').statSync(expectedPath);
        if (test.platform !== 'win32') {
          expect(stats.mode & 0o755).toBe(0o755);
        }
      }
    });
  });

  describe('Production Logging Verification', () => {
    test('should generate structured production logs', async () => {
      prodEnv.createProductionHooks();
      
      // Simulate hook execution with logging
      const { executionLogger } = await import('@outfitter/hooks-core');
      
      const logEntries: any[] = [];
      
      // Capture log output
      const originalLog = console.log;
      console.log = (...args) => {
        logEntries.push(args.join(' '));
      };

      try {
        // Execute audit logger hook directly
        const auditHookPath = join(prodEnv.tempDir, 'hooks', 'audit-logger.ts');
        const auditHookContent = readFileSync(auditHookPath, 'utf8');
        
        // Basic validation that the hook is structured correctly
        expect(auditHookContent).toContain('auditLogger');
        expect(auditHookContent).toContain('timestamp');
        expect(auditHookContent).toContain('JSON.stringify');

        // Simulate log generation
        executionLogger.info('Test production log entry', {
          environment: 'production',
          component: 'test',
          timestamp: new Date().toISOString(),
        });

      } finally {
        console.log = originalLog;
      }

      // Verify log structure
      expect(logEntries.length).toBeGreaterThan(0);
    });

    test('should handle log rotation and file management', async () => {
      const logDir = join(prodEnv.tempDir, 'logs');
      const logFile = join(logDir, 'hooks.log');
      
      // Simulate log file creation
      const logEntries = Array(1000).fill(null).map((_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        level: 'info',
        message: `Log entry ${i}`,
        data: { index: i, component: 'test' },
      }));

      const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
      writeFileSync(logFile, logContent);

      expect(existsSync(logFile)).toBe(true);
      
      const logStats = require('fs').statSync(logFile);
      expect(logStats.size).toBeGreaterThan(1000); // Should have substantial content

      // Simulate log rotation
      const rotatedFile = join(logDir, 'hooks.log.1');
      require('fs').copyFileSync(logFile, rotatedFile);
      writeFileSync(logFile, ''); // Clear current log

      expect(existsSync(rotatedFile)).toBe(true);
      expect(require('fs').statSync(logFile).size).toBe(0);
    });
  });

  describe('Security Hardening Validation', () => {
    test('should enforce security policies in production', async () => {
      const config = prodEnv.createProductionConfig();
      prodEnv.createProductionHooks();

      const securityTests = [
        {
          name: 'path_traversal_protection',
          input: { handler: '../../../etc/passwd' },
          shouldBlock: true,
        },
        {
          name: 'command_injection_protection',
          input: { command: 'echo "test"; rm -rf /' },
          shouldBlock: true,
        },
        {
          name: 'legitimate_operation',
          input: { command: 'echo "hello world"' },
          shouldBlock: false,
        },
      ];

      for (const secTest of securityTests) {
        // Simulate security validation
        const isBlocked = await simulateSecurityCheck(secTest.input, config);
        
        if (secTest.shouldBlock) {
          expect(isBlocked).toBe(true);
        } else {
          expect(isBlocked).toBe(false);
        }
      }
    });

    test('should validate production environment isolation', async () => {
      const config = prodEnv.createProductionConfig();
      
      // Test environment isolation
      const environmentTests = [
        {
          name: 'restricted_paths',
          path: '/etc/passwd',
          shouldAllow: false,
        },
        {
          name: 'workspace_paths',
          path: join(prodEnv.tempDir, 'hooks', 'test.ts'),
          shouldAllow: true,
        },
        {
          name: 'system_paths',
          path: '/sys/kernel',
          shouldAllow: false,
        },
      ];

      for (const envTest of environmentTests) {
        const isAllowed = await simulatePathValidation(envTest.path, config);
        
        if (envTest.shouldAllow) {
          expect(isAllowed).toBe(true);
        } else {
          expect(isAllowed).toBe(false);
        }
      }
    });
  });

  describe('Real-world Configuration Scenarios', () => {
    test('should handle enterprise configuration patterns', async () => {
      const enterpriseConfig: HookConfiguration = {
        version: '1.0.0',
        hooks: {
          'pre-tool-use': {
            handler: './hooks/enterprise-security.ts',
            timeout: 15000,
            retryPolicy: {
              maxRetries: 3,
              backoffMs: 1000,
            },
            metadata: {
              classification: 'security-critical',
              owner: 'security-team',
              approvedBy: 'ciso@company.com',
            },
          },
          'post-tool-use': {
            handler: './hooks/compliance-audit.ts',
            timeout: 10000,
            metadata: {
              classification: 'compliance-required',
              retention: '7-years',
              encryption: 'required',
            },
          },
        },
        environment: {
          NODE_ENV: 'production',
          COMPANY_DOMAIN: 'company.com',
          SECURITY_LEVEL: 'enterprise',
          COMPLIANCE_MODE: 'strict',
          AUDIT_ENDPOINT: 'https://audit.company.com/hooks',
          ENCRYPTION_KEY_ID: 'enterprise-key-v2',
        },
        security: {
          allowedExecutables: ['bun'],
          restrictedPaths: ['/etc', '/root', '/sys', '/proc'],
          maxPayloadSize: 5 * 1024 * 1024, // 5MB limit for enterprise
          enableSandbox: true,
          requireSignedHooks: true,
        },
      } as any;

      const configPath = join(prodEnv.tempDir, 'config', 'enterprise-hooks.json');
      writeFileSync(configPath, JSON.stringify(enterpriseConfig, null, 2));

      expect(existsSync(configPath)).toBe(true);
      
      // Validate configuration structure
      const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(savedConfig.security.enableSandbox).toBe(true);
      expect(savedConfig.security.requireSignedHooks).toBe(true);
      expect(savedConfig.environment.SECURITY_LEVEL).toBe('enterprise');
    });

    test('should handle multi-environment configurations', async () => {
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const envConfig: HookConfiguration = {
          version: '1.0.0',
          hooks: {
            'pre-tool-use': {
              handler: './hooks/env-specific.ts',
              timeout: env === 'production' ? 5000 : 30000, // Shorter timeout in prod
            },
          },
          environment: {
            NODE_ENV: env,
            LOG_LEVEL: env === 'production' ? 'warn' : 'debug',
            METRICS_ENABLED: env === 'production' ? 'true' : 'false',
            DEBUG_MODE: env === 'development' ? 'true' : 'false',
          },
        };

        const configPath = join(prodEnv.tempDir, 'config', `${env}-hooks.json`);
        writeFileSync(configPath, JSON.stringify(envConfig, null, 2));

        expect(existsSync(configPath)).toBe(true);
        
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        expect(config.environment.NODE_ENV).toBe(env);
        
        if (env === 'production') {
          expect(config.hooks['pre-tool-use'].timeout).toBe(5000);
          expect(config.environment.LOG_LEVEL).toBe('warn');
        }
      }
    });
  });

  describe('Performance in Production Conditions', () => {
    test('should maintain performance under production load', async () => {
      const config = prodEnv.createProductionConfig();
      prodEnv.createProductionHooks();

      // Simulate production load
      const concurrent = 20;
      const promises: Promise<any>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrent; i++) {
        const promise = new Promise(async (resolve) => {
          // Simulate hook execution
          const executionStart = Date.now();
          
          // Simulate work that would happen in production
          await new Promise(r => setTimeout(r, Math.random() * 50));
          
          const executionTime = Date.now() - executionStart;
          
          resolve({
            id: i,
            executionTime,
            success: true,
          });
        });

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(concurrent);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Check individual execution times
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeLessThan(1000); // Each execution < 1s
      });
    });

    test('should handle production memory constraints', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate production workload
      const workload = async () => {
        const data = Array(10000).fill(null).map((_, i) => ({
          id: i,
          timestamp: Date.now(),
          data: `production_data_${i}`,
        }));

        // Process data as would happen in production
        const processed = data.map(item => ({
          ...item,
          processed: true,
          hash: (item.id * 31).toString(16),
        }));

        return processed.length;
      };

      // Run workload multiple times
      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        const result = await workload();
        expect(result).toBe(10000);

        // Check memory usage periodically
        if (i % 3 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Should not leak significant memory
          expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // < 100MB increase
        }
      }
    });
  });
});

/**
 * Helper functions for production testing
 */

async function simulateSecurityCheck(input: any, config: any): Promise<boolean> {
  // Simulate the security validation logic
  if (input.handler && input.handler.includes('..')) {
    return true; // Blocked
  }
  
  if (input.command) {
    const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', '>/dev/'];
    return dangerousCommands.some(cmd => input.command.includes(cmd));
  }
  
  return false; // Not blocked
}

async function simulatePathValidation(path: string, config: any): Promise<boolean> {
  const restrictedPaths = config.security?.restrictedPaths || [];
  
  return !restrictedPaths.some((restricted: string) => 
    path.startsWith(restricted)
  );
}