/**
 * Tests for markdown formatter hook
 */

import { describe, expect, test, beforeEach, spyOn, mock } from 'bun:test';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import { createMarkdownFormatterHook } from '../hooks/markdown-formatter.js';
import { createToolHookContext } from '@outfitter/types';

// Create mocks
let mockExecSync: ReturnType<typeof mock>;
let mockExistsSync: ReturnType<typeof mock>;

describe('markdown formatter hook', () => {
  beforeEach(() => {
    // Reset and create spies for each test
    mockExistsSync = spyOn(fs, 'existsSync');
    mockExecSync = spyOn(childProcess, 'execSync');
    
    // Default mock implementations
    mockExistsSync.mockReturnValue(true);
    mockExecSync.mockReturnValue('');
  });
  
  describe('event filtering', () => {
    test('should only process PostToolUse events', async () => {
      const hook = createMarkdownFormatterHook();
      
      // Test with PreToolUse event - should pass through
      const preContext = createToolHookContext(
        'PreToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const preResult = await hook(preContext);
      expect(preResult.success).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('should only process file editing tools', async () => {
      const hook = createMarkdownFormatterHook();
      
      // Test with non-file-editing tool
      const context = createToolHookContext(
        'PostToolUse',
        'Bash',
        { command: 'ls' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('file pattern matching', () => {
    test('should process .md files by default', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) return '';
        return 'Formatted';
      });
      
      const hook = createMarkdownFormatterHook();
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'README.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
    });

    test('should process .mdx files by default', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) return '';
        return 'Formatted';
      });
      
      const hook = createMarkdownFormatterHook();
      
      const context = createToolHookContext(
        'PostToolUse',
        'Write',
        { file_path: 'component.mdx', content: '# MDX Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
    });

    test('should respect custom patterns', async () => {
      const hook = createMarkdownFormatterHook({
        patterns: ['*.markdown', '*.mdown']
      });
      
      const mdContext = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      // .md file should not match custom patterns
      const mdResult = await hook(mdContext);
      expect(mdResult.success).toBe(true);
      // Since .md doesn't match our custom patterns, formatter should not be called
      
      // Reset mock call count
      mockExecSync.mockClear();
      
      // .markdown file should match
      const markdownContext = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.markdown', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) return '';
        return 'Formatted';
      });
      
      const markdownResult = await hook(markdownContext);
      expect(markdownResult.success).toBe(true);
      // Now it should have been called for the .markdown file
      expect(mockExecSync).toHaveBeenCalled();
    });
  });

  describe('formatter selection', () => {
    test('should auto-detect markdownlint if available', async () => {
      let formatterUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') return '/usr/bin/markdownlint-cli2';
        if (cmd === 'which prettier') throw new Error('not found');
        if (cmd.includes('markdownlint-cli2')) {
          formatterUsed = 'markdownlint';
          return 'Formatted with markdownlint';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ formatter: 'auto' });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('markdownlint');
      expect(result.metadata?.formatter).toBe('markdownlint');
    });

    test('should fall back to prettier if markdownlint not available', async () => {
      let formatterUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') throw new Error('not found');
        if (cmd === 'which prettier') return '/usr/bin/prettier';
        if (cmd.includes('prettier')) {
          formatterUsed = 'prettier';
          return 'Formatted with prettier';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ formatter: 'auto' });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('prettier');
      expect(result.metadata?.formatter).toBe('prettier');
    });

    test('should respect explicit formatter preference', async () => {
      let formatterUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') return '/usr/bin/markdownlint-cli2';
        if (cmd === 'which prettier') return '/usr/bin/prettier';
        if (cmd.includes('prettier')) {
          formatterUsed = 'prettier';
          return 'Formatted with prettier';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ formatter: 'prettier' });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('prettier');
    });

    test('should fail if no formatter available', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('which')) throw new Error('not found');
        return '';
      });
      
      const hook = createMarkdownFormatterHook();
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No markdown formatter available');
    });
  });

  describe('formatting options', () => {
    test('should use --fix flag for markdownlint when autoFix is true', async () => {
      let commandUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') return '/usr/bin/markdownlint-cli2';
        if (cmd === 'which prettier') throw new Error('not found');
        if (cmd.includes('markdownlint-cli2')) {
          commandUsed = cmd;
          return 'Fixed';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ autoFix: true });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      await hook(context);
      expect(commandUsed).toContain('--fix');
    });

    test('should use --write flag for prettier when autoFix is true', async () => {
      let commandUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') throw new Error('not found');
        if (cmd === 'which prettier') return '/usr/bin/prettier';
        if (cmd.includes('prettier')) {
          commandUsed = cmd;
          return 'Fixed';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ autoFix: true });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      await hook(context);
      expect(commandUsed).toContain('--write');
    });

    test('should use --check flag for prettier when autoFix is false', async () => {
      let commandUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') throw new Error('not found');
        if (cmd === 'which prettier') return '/usr/bin/prettier';
        if (cmd.includes('prettier')) {
          commandUsed = cmd;
          return 'Checked';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({ autoFix: false });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      await hook(context);
      expect(commandUsed).toContain('--check');
      expect(commandUsed).not.toContain('--write');
    });

    test('should pass additional arguments', async () => {
      let commandUsed = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') return '/usr/bin/markdownlint-cli2';
        if (cmd.includes('markdownlint-cli2')) {
          commandUsed = cmd;
          return 'Fixed';
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook({
        additionalArgs: ['--config', '.markdownlint.json']
      });
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      await hook(context);
      expect(commandUsed).toContain('--config');
      expect(commandUsed).toContain('.markdownlint.json');
    });
  });

  describe('error handling', () => {
    test('should handle missing file gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const hook = createMarkdownFormatterHook();
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'nonexistent.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('File not found');
    });

    test('should handle formatter errors gracefully', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'which markdownlint-cli2') return '/usr/bin/markdownlint-cli2';
        if (cmd.includes('markdownlint-cli2')) {
          throw new Error('Formatting failed: invalid syntax');
        }
        return '';
      });
      
      const hook = createMarkdownFormatterHook();
      
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {}
        }
      );
      
      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to format with markdownlint');
    });
  });
});