/**
 * Tests for markdown formatter hook
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type mock,
  spyOn,
  test,
} from 'bun:test';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import { createToolHookContext } from '@carabiner/types';
import { createMarkdownFormatterHook } from '../hooks/markdown-formatter.js';

// Create mocks
let mockExecFileSync: ReturnType<typeof mock>;
let mockExistsSync: ReturnType<typeof mock>;

// Helper function to create a mock implementation for command checking
function createMockImplementation(
  availableCommands: string[] = ['markdownlint-cli2']
) {
  return (command: string, args?: string[]) => {
    // Unix-style command checking
    if (command === 'command' && args?.[0] === '-v') {
      const cmd = args[1];
      return availableCommands.includes(cmd) ? `/usr/bin/${cmd}` : '';
    }
    // Windows-style command checking
    if (command === 'where') {
      const cmd = args?.[0];
      return availableCommands.includes(cmd)
        ? `C:\\Program Files\\${cmd}.exe`
        : '';
    }
    // Actual formatter execution - handle both the command name and when executing with full path
    if (
      command === 'markdownlint-cli2' ||
      command === 'prettier' ||
      command.includes('markdownlint-cli2') ||
      command.includes('prettier')
    ) {
      return 'Formatted';
    }
    return '';
  };
}

describe('markdown formatter hook', () => {
  beforeEach(() => {
    // Reset and create spies for each test
    mockExistsSync = spyOn(fs, 'existsSync');
    mockExecFileSync = spyOn(childProcess, 'execFileSync');

    // Default mock implementations
    mockExistsSync.mockReturnValue(true);
    mockExecFileSync.mockReturnValue('');
  });

  afterEach(() => {
    mockExistsSync.mockRestore();
    mockExecFileSync.mockRestore();
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
          environment: {},
        }
      );

      const preResult = await hook(preContext);
      expect(preResult.success).toBe(true);
      expect(mockExecFileSync).not.toHaveBeenCalled();
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
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });
  });

  describe('file pattern matching', () => {
    test('should process .md files by default', async () => {
      mockExecFileSync.mockImplementation(createMockImplementation());

      const hook = createMarkdownFormatterHook();

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: '/test/README.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalled();
    });

    test('should process .mdx files by default', async () => {
      mockExecFileSync.mockImplementation(createMockImplementation());

      const hook = createMarkdownFormatterHook();

      const context = createToolHookContext(
        'PostToolUse',
        'Write',
        { file_path: 'component.mdx', content: '# MDX Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalled();
    });

    test('should respect custom patterns', async () => {
      const hook = createMarkdownFormatterHook({
        patterns: ['*.markdown', '*.mdown'],
      });

      const mdContext = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      // .md file should not match custom patterns
      const mdResult = await hook(mdContext);
      expect(mdResult.success).toBe(true);
      // Since .md doesn't match our custom patterns, formatter should not be called

      // Reset mock call count
      mockExecFileSync.mockClear();

      // .markdown file should match
      const markdownContext = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.markdown', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      mockExecFileSync.mockImplementation(createMockImplementation());

      const markdownResult = await hook(markdownContext);
      expect(markdownResult.success).toBe(true);
      // Now it should have been called for the .markdown file
      expect(mockExecFileSync).toHaveBeenCalled();
    });
  });

  describe('formatter selection', () => {
    test('should auto-detect markdownlint if available', async () => {
      let formatterUsed = '';
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2')
              return '/usr/bin/markdownlint-cli2';
            if (args[1] === 'prettier') throw new Error('not found');
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2')
              return 'C:\\Program Files\\markdownlint-cli2.exe';
            if (args?.[0] === 'prettier') throw new Error('not found');
          }
          // Formatter execution
          if (command === 'markdownlint-cli2') {
            formatterUsed = 'markdownlint';
            return 'Formatted with markdownlint';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ formatter: 'auto' });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('markdownlint');
      expect(result.data?.formatter).toBe('markdownlint');
    });

    test('should fall back to prettier if markdownlint not available', async () => {
      let formatterUsed = '';
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2') throw new Error('not found');
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2') throw new Error('not found');
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // npx fallback checking
          if (command === 'npx') {
            const toolArg = args?.[1];
            if (toolArg === 'markdownlint-cli2') throw new Error('not found');
            if (toolArg === 'prettier') return 'prettier version';
          }
          // Formatter execution
          if (command === 'prettier') {
            formatterUsed = 'prettier';
            return 'Formatted with prettier';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ formatter: 'auto' });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('prettier');
      expect(result.data?.formatter).toBe('prettier');
    });

    test('should respect explicit formatter preference', async () => {
      let formatterUsed = '';
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking - both are available
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2')
              return '/usr/bin/markdownlint-cli2';
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2')
              return 'C:\\Program Files\\markdownlint-cli2.exe';
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // Formatter execution
          if (command === 'prettier') {
            formatterUsed = 'prettier';
            return 'Formatted with prettier';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ formatter: 'prettier' });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('prettier');
    });

    test('should fail if no formatter available', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          if (command === 'command' || command === 'where' || command === 'npx')
            throw new Error('not found');
          return '';
        }
      );

      const hook = createMarkdownFormatterHook();

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No markdown formatter available');
    });
  });

  describe('formatting options', () => {
    test('should use --fix flag for markdownlint when autoFix is true', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2')
              return '/usr/bin/markdownlint-cli2';
            if (args[1] === 'prettier') throw new Error('not found');
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2')
              return 'C:\\Program Files\\markdownlint-cli2.exe';
            if (args?.[0] === 'prettier') throw new Error('not found');
          }
          // Formatter execution
          if (command === 'markdownlint-cli2') {
            return 'Fixed';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ autoFix: true });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      await hook(context);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'markdownlint-cli2',
        expect.arrayContaining(['--fix']),
        expect.any(Object)
      );
    });

    test('should use --write flag for prettier when autoFix is true', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2') throw new Error('not found');
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2') throw new Error('not found');
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // npx fallback checking
          if (command === 'npx') {
            const toolArg = args?.[1];
            if (toolArg === 'markdownlint-cli2') throw new Error('not found');
            if (toolArg === 'prettier') return 'prettier version';
          }
          // Formatter execution
          if (command === 'prettier') {
            return 'Fixed';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ autoFix: true });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      await hook(context);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier',
        expect.arrayContaining(['--write']),
        expect.any(Object)
      );
    });

    test('should use --check flag for prettier when autoFix is false', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2') throw new Error('not found');
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2') throw new Error('not found');
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // npx fallback checking
          if (command === 'npx') {
            const toolArg = args?.[1];
            if (toolArg === 'markdownlint-cli2') throw new Error('not found');
            if (toolArg === 'prettier') return 'prettier version';
          }
          // Formatter execution
          if (command === 'prettier') {
            return 'Checked';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ autoFix: false });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      await hook(context);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier',
        expect.arrayContaining(['--check']),
        expect.any(Object)
      );
      expect(mockExecFileSync).not.toHaveBeenCalledWith(
        'prettier',
        expect.arrayContaining(['--write']),
        expect.any(Object)
      );
    });

    test('should pass additional arguments', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (
            command === 'command' &&
            args?.[0] === '-v' &&
            args[1] === 'markdownlint-cli2'
          )
            return '/usr/bin/markdownlint-cli2';
          if (command === 'where' && args?.[0] === 'markdownlint-cli2')
            return 'C:\\Program Files\\markdownlint-cli2.exe';
          // Formatter execution
          if (command === 'markdownlint-cli2') {
            return 'Fixed';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({
        additionalArgs: ['--config', '.markdownlint.json'],
      });

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      await hook(context);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'markdownlint-cli2',
        expect.arrayContaining(['--config', '.markdownlint.json']),
        expect.any(Object)
      );
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
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('File not found');
    });

    test('should handle formatter errors gracefully', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (
            command === 'command' &&
            args?.[0] === '-v' &&
            args[1] === 'markdownlint-cli2'
          )
            return '/usr/bin/markdownlint-cli2';
          if (command === 'where' && args?.[0] === 'markdownlint-cli2')
            return 'C:\\Program Files\\markdownlint-cli2.exe';
          // Formatter execution
          if (command === 'markdownlint-cli2') {
            throw new Error('Formatting failed: invalid syntax');
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook();

      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );

      const result = await hook(context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to format with markdownlint');
    });

    test('should accept toolInput.path as an alternative to file_path', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockImplementation(createMockImplementation());
      const hook = createMarkdownFormatterHook();
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { path: 'alternate.md', content: '# Test' } as any,
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );
      const result = await hook(context);
      expect(result.success).toBe(true);
    });
  });

  describe('additional test coverage', () => {
    test('should process MultiEdit and NotebookEdit tools', async () => {
      mockExecFileSync.mockImplementation(createMockImplementation());
      const hook = createMarkdownFormatterHook();
      for (const tool of ['MultiEdit', 'NotebookEdit'] as const) {
        const ctx = createToolHookContext(
          'PostToolUse',
          tool,
          { file_path: 'doc.md', content: '# T' },
          {
            sessionId: 'test-session' as any,
            transcriptPath: '/tmp/transcript.md' as any,
            cwd: '/test' as any,
            environment: {},
          }
        );
        const result = await hook(ctx);
        expect(result.success).toBe(true);
      }
      expect(mockExecFileSync).toHaveBeenCalled();
    });

    test('should prefer markdownlint over prettier in auto mode when both exist', async () => {
      let formatterUsed = '';
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking - both are available
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2')
              return '/usr/bin/markdownlint-cli2';
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2')
              return 'C:\\Program Files\\markdownlint-cli2.exe';
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // Formatter execution
          if (command === 'markdownlint-cli2') {
            formatterUsed = 'markdownlint';
            return 'Formatted with markdownlint';
          }
          return '';
        }
      );

      const hook = createMarkdownFormatterHook({ formatter: 'auto' });
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );
      const result = await hook(context);
      expect(result.success).toBe(true);
      expect(formatterUsed).toBe('markdownlint');
      expect(result.data?.formatter).toBe('markdownlint');
    });

    test('should pass additional arguments to prettier', async () => {
      mockExecFileSync.mockImplementation(
        (command: string, args?: string[]) => {
          // Command checking
          if (command === 'command' && args?.[0] === '-v') {
            if (args[1] === 'markdownlint-cli2') throw new Error('not found');
            if (args[1] === 'prettier') return '/usr/bin/prettier';
          }
          if (command === 'where') {
            if (args?.[0] === 'markdownlint-cli2') throw new Error('not found');
            if (args?.[0] === 'prettier')
              return 'C:\\Program Files\\prettier.exe';
          }
          // Formatter execution
          if (command === 'prettier') {
            return 'Fixed';
          }
          return '';
        }
      );
      const hook = createMarkdownFormatterHook({
        formatter: 'prettier',
        additionalArgs: ['--prose-wrap', 'always', '--print-width', '100'],
        autoFix: true,
      });
      const context = createToolHookContext(
        'PostToolUse',
        'Edit',
        { file_path: 'test.md', content: '# Test' },
        {
          sessionId: 'test-session' as any,
          transcriptPath: '/tmp/transcript.md' as any,
          cwd: '/test' as any,
          environment: {},
        }
      );
      await hook(context);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'prettier',
        expect.arrayContaining([
          '--prose-wrap',
          'always',
          '--print-width',
          '100',
        ]),
        expect.any(Object)
      );
    });
  });
});
