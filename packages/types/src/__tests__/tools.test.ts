/**
 * Tests for tool input types and type guards
 */

import { describe, expect, test } from 'bun:test';
import {
  type BashToolInput,
  type EditToolInput,
  type GlobToolInput,
  type GrepToolInput,
  isBashToolInput,
  isEditToolInput,
  isGlobToolInput,
  isGrepToolInput,
  isLSToolInput,
  isMultiEditToolInput,
  isNotebookEditToolInput,
  isReadToolInput,
  isTodoWriteToolInput,
  isWebFetchToolInput,
  isWebSearchToolInput,
  isWriteToolInput,
  type LSToolInput,
  type MultiEditInput,
  type NotebookEditToolInput,
  type ReadToolInput,
  type TodoWriteToolInput,
  type ToolInputMap,
  type WebFetchToolInput,
  type WebSearchToolInput,
  type WriteToolInput,
} from '../tools.js';

describe('BashToolInput', () => {
  test('identifies valid Bash tool input', () => {
    const validInputs: BashToolInput[] = [
      { command: 'ls -la' },
      { command: 'echo "hello"', description: 'Print hello' },
      { command: 'npm test', description: 'Run tests', timeout: 30_000 },
    ];

    for (const input of validInputs) {
      expect(isBashToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Bash tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { description: 'No command' },
      { command: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isBashToolInput(input)).toBe(false);
    }

    // Empty string is technically valid for the type guard (runtime validation happens elsewhere)
    expect(isBashToolInput({ command: '' })).toBe(true);
  });
});

describe('WriteToolInput', () => {
  test('identifies valid Write tool input', () => {
    const validInputs: WriteToolInput[] = [
      { file_path: '/tmp/test.txt', content: 'Hello world' },
      { file_path: '/home/user/file.js', content: '' },
      {
        file_path: '/project/src/index.ts',
        content: 'export const hello = "world";',
      },
    ];

    for (const input of validInputs) {
      expect(isWriteToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Write tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { file_path: '/tmp/test.txt' }, // missing content
      { content: 'Hello' }, // missing file_path
      { file_path: 123, content: 'test' }, // wrong type
      { file_path: '/tmp/test.txt', content: 456 }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(isWriteToolInput(input)).toBe(false);
    }
  });
});

describe('EditToolInput', () => {
  test('identifies valid Edit tool input', () => {
    const validInputs: EditToolInput[] = [
      {
        file_path: '/tmp/test.txt',
        old_string: 'old text',
        new_string: 'new text',
      },
      {
        file_path: '/home/user/file.js',
        old_string: 'const x = 1',
        new_string: 'const x = 2',
        replace_all: true,
      },
    ];

    for (const input of validInputs) {
      expect(isEditToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Edit tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { file_path: '/tmp/test.txt', old_string: 'old' }, // missing new_string
      { file_path: '/tmp/test.txt', new_string: 'new' }, // missing old_string
      { old_string: 'old', new_string: 'new' }, // missing file_path
      { file_path: 123, old_string: 'old', new_string: 'new' }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(isEditToolInput(input)).toBe(false);
    }
  });
});

describe('ReadToolInput', () => {
  test('identifies valid Read tool input', () => {
    const validInputs: ReadToolInput[] = [
      { file_path: '/tmp/test.txt' },
      { file_path: '/home/user/file.js', limit: 100 },
      { file_path: '/project/src/index.ts', limit: 50, offset: 10 },
    ];

    for (const input of validInputs) {
      expect(isReadToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Read tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { limit: 100 }, // missing file_path
      { file_path: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isReadToolInput(input)).toBe(false);
    }
  });
});

describe('MultiEditInput', () => {
  test('identifies valid MultiEdit tool input', () => {
    const validInputs: MultiEditInput[] = [
      {
        file_path: '/tmp/test.txt',
        edits: [
          { old_string: 'old1', new_string: 'new1' },
          { old_string: 'old2', new_string: 'new2', replace_all: true },
        ],
      },
      {
        file_path: '/home/user/file.js',
        edits: [{ old_string: 'const x = 1', new_string: 'const x = 2' }],
      },
    ];

    for (const input of validInputs) {
      expect(isMultiEditToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid MultiEdit tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { file_path: '/tmp/test.txt' }, // missing edits
      { edits: [] }, // missing file_path
      { file_path: '/tmp/test.txt', edits: 'not array' }, // wrong type
      { file_path: 123, edits: [] }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(isMultiEditToolInput(input)).toBe(false);
    }
  });
});

describe('GlobToolInput', () => {
  test('identifies valid Glob tool input', () => {
    const validInputs: GlobToolInput[] = [
      { pattern: '*.ts' },
      { pattern: '**/*.js', path: '/project/src' },
      { pattern: 'test-*.json' },
    ];

    for (const input of validInputs) {
      expect(isGlobToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Glob tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { path: '/project' }, // missing pattern
      { pattern: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isGlobToolInput(input)).toBe(false);
    }
  });
});

describe('GrepToolInput', () => {
  test('identifies valid Grep tool input', () => {
    const validInputs: GrepToolInput[] = [
      { pattern: 'search term' },
      { pattern: 'function\\s+\\w+', path: '/project/src' },
      {
        pattern: 'TODO',
        glob: '*.ts',
        output_mode: 'content',
        head_limit: 10,
        multiline: true,
      },
    ];

    for (const input of validInputs) {
      expect(isGrepToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid Grep tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { path: '/project' }, // missing pattern
      { pattern: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isGrepToolInput(input)).toBe(false);
    }
  });
});

describe('LSToolInput', () => {
  test('identifies valid LS tool input', () => {
    const validInputs: LSToolInput[] = [
      { path: '/tmp' },
      { path: '/project/src', ignore: ['node_modules', '.git'] },
    ];

    for (const input of validInputs) {
      expect(isLSToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid LS tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { ignore: ['node_modules'] }, // missing path
      { path: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isLSToolInput(input)).toBe(false);
    }
  });
});

describe('TodoWriteToolInput', () => {
  test('identifies valid TodoWrite tool input', () => {
    const validInputs: TodoWriteToolInput[] = [
      {
        todos: [
          { content: 'Implement feature', status: 'pending', id: '1' },
          { content: 'Write tests', status: 'in_progress', id: '2' },
        ],
      },
      {
        todos: [{ content: 'Fix bug', status: 'completed', id: 'bug-123' }],
      },
    ];

    for (const input of validInputs) {
      expect(isTodoWriteToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid TodoWrite tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { todos: 'not array' }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isTodoWriteToolInput(input)).toBe(false);
    }

    // Empty array is technically valid for the type guard (runtime validation happens elsewhere)
    expect(isTodoWriteToolInput({ todos: [] })).toBe(true);
  });
});

describe('WebFetchToolInput', () => {
  test('identifies valid WebFetch tool input', () => {
    const validInputs: WebFetchToolInput[] = [
      { url: 'https://example.com', prompt: 'Extract the main content' },
      { url: 'http://api.example.com/data', prompt: 'Get the JSON response' },
    ];

    for (const input of validInputs) {
      expect(isWebFetchToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid WebFetch tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { url: 'https://example.com' }, // missing prompt
      { prompt: 'Extract content' }, // missing url
      { url: 123, prompt: 'test' }, // wrong type
      { url: 'https://example.com', prompt: 456 }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(isWebFetchToolInput(input)).toBe(false);
    }
  });
});

describe('WebSearchToolInput', () => {
  test('identifies valid WebSearch tool input', () => {
    const validInputs: WebSearchToolInput[] = [
      { query: 'TypeScript hooks' },
      {
        query: 'Claude Code integration',
        allowed_domains: ['docs.anthropic.com'],
        blocked_domains: ['spam.com'],
      },
    ];

    for (const input of validInputs) {
      expect(isWebSearchToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid WebSearch tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { allowed_domains: ['example.com'] }, // missing query
      { query: 123 }, // wrong type
      'not an object',
    ];

    for (const input of invalidInputs) {
      expect(isWebSearchToolInput(input)).toBe(false);
    }
  });
});

describe('NotebookEditToolInput', () => {
  test('identifies valid NotebookEdit tool input', () => {
    const validInputs: NotebookEditToolInput[] = [
      { notebook_path: '/tmp/notebook.ipynb', new_source: 'print("hello")' },
      {
        notebook_path: '/project/analysis.ipynb',
        new_source: '# Analysis\n\nThis is markdown',
        cell_id: 'cell-123',
        cell_type: 'markdown',
        edit_mode: 'replace',
      },
    ];

    for (const input of validInputs) {
      expect(isNotebookEditToolInput(input)).toBe(true);
    }
  });

  test('rejects invalid NotebookEdit tool input', () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      { notebook_path: '/tmp/notebook.ipynb' }, // missing new_source
      { new_source: 'code' }, // missing notebook_path
      { notebook_path: 123, new_source: 'code' }, // wrong type
      { notebook_path: '/tmp/notebook.ipynb', new_source: 456 }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(isNotebookEditToolInput(input)).toBe(false);
    }
  });
});

describe('Type system consistency', () => {
  test('ToolInputMap keys match type guards', () => {
    // This test ensures we haven't missed any tools
    const expectedTools = [
      'Bash',
      'Edit',
      'MultiEdit',
      'Write',
      'Read',
      'Glob',
      'Grep',
      'LS',
      'TodoWrite',
      'WebFetch',
      'WebSearch',
      'NotebookEdit',
    ] as const;

    // Check that ToolInputMap has all expected keys
    type ToolInputMapKeys = keyof ToolInputMap;
    const toolMapKeys: ToolInputMapKeys[] = expectedTools;

    // This should compile without issues
    expect(toolMapKeys.length).toBe(12);
  });

  test('readonly arrays are properly typed', () => {
    const editInput: EditToolInput = {
      file_path: '/test.txt',
      old_string: 'old',
      new_string: 'new',
    };

    const multiEditInput: MultiEditInput = {
      file_path: '/test.txt',
      edits: [
        { old_string: 'old1', new_string: 'new1' },
        { old_string: 'old2', new_string: 'new2' },
      ],
    };

    // These should satisfy the readonly constraints
    expect(editInput.file_path).toBe('/test.txt');
    expect(multiEditInput.edits).toHaveLength(2);
  });
});
