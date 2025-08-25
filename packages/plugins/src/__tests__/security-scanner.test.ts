/**
 * @file security-scanner.test.ts
 * @description Tests for security scanner plugin
 */

import { describe, expect, test } from 'bun:test';
import type { HookContext } from '@carabiner/types';
import { securityScannerPlugin } from '../security-scanner/index';

const createBashContext = (command: string): HookContext =>
  ({
    event: 'PreToolUse',
    toolName: 'Bash',
    toolInput: { command },
    sessionId: 'test-session' as any,
    transcriptPath: '/tmp/transcript' as any,
    cwd: '/test/repo' as any,
    environment: {},
  }) as any;

const createWriteContext = (filePath: string, content: string): HookContext =>
  ({
    event: 'PreToolUse',
    toolName: 'Write',
    toolInput: { file_path: filePath, content },
    sessionId: 'test-session' as any,
    transcriptPath: '/tmp/transcript' as any,
    cwd: '/test/repo' as any,
    environment: {},
  }) as any;

describe('Security Scanner Plugin', () => {
  describe('Basic Functionality', () => {
    test('should have correct plugin metadata', async () => {
      expect(securityScannerPlugin.name).toBe('security-scanner');
      expect(securityScannerPlugin.version).toBe('1.0.0');
      expect(securityScannerPlugin.events).toContain('PreToolUse');
      expect(securityScannerPlugin.tools).toContain('Bash');
      expect(securityScannerPlugin.tools).toContain('Write');
      expect(securityScannerPlugin.priority).toBe(85);
    });

    test('should ignore unsupported tools', async () => {
      const context = {
        event: 'PreToolUse',
        toolName: 'Read',
        sessionId: 'test' as any,
        transcriptPath: '/tmp/test' as any,
        cwd: '/test' as any,
        environment: {},
      } as any;

      const result = await securityScannerPlugin.apply(context);
      expect(result.success).toBe(true);
    });

    test('should handle empty commands', async () => {
      const context = createBashContext('');
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Command Security Scanning', () => {
    test('should detect dangerous bash commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'dd if=/dev/zero of=/dev/sda',
        'sudo rm -rf /',
        'chmod 777 /',
        'shutdown now',
      ];

      for (const command of dangerousCommands) {
        const context = createBashContext(command);
        const result = await securityScannerPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.block).toBe(true);
        expect(result.message).toContain('Security issues found');
      }
    });

    test('should allow safe bash commands', async () => {
      const safeCommands = [
        'ls -la',
        'cat file.txt',
        'grep pattern file.txt',
        'find . -name "*.js"',
      ];

      for (const command of safeCommands) {
        const context = createBashContext(command);
        const result = await securityScannerPlugin.apply(context);

        expect(result.success).toBe(true);
        expect(result.message).toContain('No security issues');
      }
    });

    test('should detect command injection patterns', async () => {
      const injectionCommands = [
        'system("rm -rf /")',
        'exec($userInput)',
        'shell_exec($dangerous)',
        'passthru($command)',
      ];

      for (const command of injectionCommands) {
        const context = createBashContext(command);
        const result = await securityScannerPlugin.apply(context);

        expect(result.success).toBe(false);
        expect(result.metadata?.findings).toBeInstanceOf(Array);
      }
    });
  });

  describe('File Content Scanning', () => {
    test('should detect hardcoded API keys', async () => {
      const content = `
        const config = {
          apiKey: "sk-1234567890abcdef",
          database: "production"
        };
      `;

      const context = createWriteContext('/test/config.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
      expect(result.metadata?.findings).toBeInstanceOf(Array);
      expect(
        (result.metadata?.findings as any[]).some(
          (f) => f.category === 'secrets' && f.id === 'hardcoded-api-key'
        )
      ).toBe(true);
    });

    test('should detect AWS access keys', async () => {
      const content = `
        export const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
        export const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
      `;

      const context = createWriteContext('/test/aws-config.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.metadata?.findings).toBeInstanceOf(Array);
    });

    test('should detect private keys', async () => {
      const content = `
        -----BEGIN RSA PRIVATE KEY-----
        MIIEpAIBAAKCAQEA...
        -----END RSA PRIVATE KEY-----
      `;

      const context = createWriteContext('/test/key.pem', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should detect hardcoded passwords', async () => {
      const content = `
        const database = {
          host: 'localhost',
          user: 'admin',
          password: 'super_secret_password_123'
        };
      `;

      const context = createWriteContext('/test/db-config.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.metadata?.highFindings).toBeGreaterThan(0);
    });

    test('should detect JWT tokens', async () => {
      const content = `
        const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      `;

      const context = createWriteContext('/test/auth.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.metadata?.highFindings).toBeGreaterThan(0);
    });

    test('should detect SQL injection patterns', async () => {
      const content = `
        const query = "SELECT * FROM users WHERE id = " + userId + "'";
        const deleteQuery = "DELETE FROM table WHERE " + "name = '" + userInput;
      `;

      const context = createWriteContext('/test/database.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.metadata?.findings).toBeInstanceOf(Array);
    });

    test('should detect weak cryptographic algorithms', async () => {
      const content = `
        import md5 from 'crypto-js/md5';
        import sha1 from 'crypto-js/sha1';
        
        const hash = md5(password);
        const signature = sha1(data);
      `;

      const context = createWriteContext('/test/crypto.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(true); // Medium severity by default
      expect(result.message).toContain('Security issues found');
    });

    test('should detect insecure HTTP URLs', async () => {
      const content = `
        const apiUrl = "http://api.example.com/data";
        fetch("http://insecure-endpoint.com");
      `;

      const context = createWriteContext('/test/api.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(true); // Low severity by default
      expect(result.metadata?.findings).toBeInstanceOf(Array);
    });

    test('should detect path traversal vulnerabilities', async () => {
      const content = `
        const filePath = req.query.path;
        fs.readFile("../../../etc/passwd", callback);
        res.sendFile(path.join(__dirname, "../", userPath));
      `;

      const context = createWriteContext('/test/server.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
    });

    test('should allow safe code', async () => {
      const content = `
        import bcrypt from 'bcrypt';
        import https from 'https';
        
        const hashedPassword = await bcrypt.hash(password, 10);
        https.get('https://secure-api.example.com', callback);
      `;

      const context = createWriteContext('/test/secure.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No security issues');
    });
  });

  describe('Configuration', () => {
    test('should respect minimum severity level', async () => {
      const config = {
        minSeverity: 'high' as const,
      };

      const content = `
        const apiUrl = "http://api.example.com"; // Low severity
      `;

      const context = createWriteContext('/test/api.js', content);
      const result = await securityScannerPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No security issues');
    });

    test('should respect blocking configuration', async () => {
      const config = {
        blockOnCritical: false,
        blockOnHigh: false,
      };

      const content = `
        const apiKey = "sk-1234567890abcdef"; // Critical severity
      `;

      const context = createWriteContext('/test/config.js', content);
      const result = await securityScannerPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Security issues found');
    });

    test('should use custom security rules', async () => {
      const config = {
        customRules: [
          {
            id: 'custom-secret',
            name: 'Company API Key',
            pattern: 'COMPANY_[A-Z0-9]{32}',
            severity: 'critical' as const,
            category: 'secrets',
            description: 'Company API key detected',
          },
        ],
      };

      const content = `
        const apiKey = "COMPANY_ABC123DEF456GHI789JKL012MNO345PQ";
      `;

      const context = createWriteContext('/test/company.js', content);
      const result = await securityScannerPlugin.apply(context, config);

      expect(result.success).toBe(false);
      expect(result.block).toBe(true);
      expect(result.metadata?.findings).toBeInstanceOf(Array);
    });

    test('should respect file pattern filters', async () => {
      const config = {
        includePatterns: ['*.js', '*.ts'],
        excludePatterns: ['*.test.*'],
      };

      const content = `const apiKey = "sk-1234567890abcdef";`;

      // Should scan .js files
      const jsContext = createWriteContext('/test/config.js', content);
      const jsResult = await securityScannerPlugin.apply(jsContext, config);
      expect(jsResult.success).toBe(false);

      // Should skip .test.js files
      const testContext = createWriteContext('/test/config.test.js', content);
      const testResult = await securityScannerPlugin.apply(testContext, config);
      expect(testResult.success).toBe(true);
      expect(testResult.metadata?.skipped).toBe(true);
    });

    test('should respect file size limits', async () => {
      const config = {
        maxFileSize: 100, // 100 bytes
      };

      const largeContent = 'x'.repeat(200); // 200 bytes
      const context = createWriteContext('/test/large.js', largeContent);
      const result = await securityScannerPlugin.apply(context, config);

      expect(result.success).toBe(true);
      expect(result.message).toContain('too large');
    });

    test('should disable scanning when configured', async () => {
      const config = {
        scanFiles: false,
        scanCommands: false,
      };

      const content = `const apiKey = "sk-1234567890abcdef";`;
      const context = createWriteContext('/test/config.js', content);
      const result = await securityScannerPlugin.apply(context, config);

      expect(result.success).toBe(true);
    });
  });

  describe('Finding Details', () => {
    test('should provide detailed finding information', async () => {
      const content = `
        const config = {
          apiKey: "sk-1234567890abcdef"
        };
      `;

      const context = createWriteContext('/test/config.js', content);
      const result = await securityScannerPlugin.apply(context);

      expect(result.metadata?.findings).toBeInstanceOf(Array);
      const findings = result.metadata?.findings as any[];

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]).toHaveProperty('id');
      expect(findings[0]).toHaveProperty('severity');
      expect(findings[0]).toHaveProperty('title');
      expect(findings[0]).toHaveProperty('category');
    });

    test('should include line numbers in findings', async () => {
      const content = `
        const safe = "this is safe";
        const apiKey = "sk-1234567890abcdef";
        const alsoSafe = "also safe";
      `;

      const context = createWriteContext('/test/multiline.js', content);
      const result = await securityScannerPlugin.apply(context);

      const findings = result.metadata?.findings as any[];
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]).toHaveProperty('line');
      expect(findings[0].line).toBe(3); // API key is on line 3
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid regex patterns gracefully', async () => {
      const config = {
        customRules: [
          {
            id: 'invalid-regex',
            name: 'Invalid Pattern',
            pattern: '[invalid regex(',
            severity: 'high' as const,
            category: 'test',
            description: 'Invalid regex test',
          },
        ],
      };

      const context = createWriteContext('/test/test.js', 'test content');
      const result = await securityScannerPlugin.apply(context, config);

      // Should not crash, should continue with other rules
      expect(result.success).toBe(true);
    });

    test('should handle file read errors gracefully', async () => {
      // This tests the Edit operation path where file might not exist
      const context = {
        event: 'PreToolUse',
        toolName: 'Edit',
        toolInput: {
          file_path: '/non/existent/file.js',
          old_string: 'old',
          new_string: 'new',
        },
        sessionId: 'test' as any,
        transcriptPath: '/tmp/test' as any,
        cwd: '/test' as any,
        environment: {},
      } as any;

      const result = await securityScannerPlugin.apply(context);

      // Should not crash
      expect(result.success).toBe(true);
    });
  });
});
