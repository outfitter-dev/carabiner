/**
 * Tests for tool input validation schemas
 */

import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  bashToolInputSchema,
  editToolInputSchema,
  getToolInputSchema,
  globToolInputSchema,
  grepToolInputSchema,
  lsToolInputSchema,
  multiEditInputSchema,
  notebookEditToolInputSchema,
  readToolInputSchema,
  safeValidateToolInput,
  todoWriteToolInputSchema,
  toolInputSchemas,
  validateToolInput,
  webFetchToolInputSchema,
  webSearchToolInputSchema,
  writeToolInputSchema,
} from '../tools.js';

describe('bashToolInputSchema', () => {
  test('validates valid Bash inputs', () => {
    const validInputs = [
      { command: 'ls -la' },
      { command: 'echo "hello"', description: 'Print hello' },
      { command: 'npm test', description: 'Run tests', timeout: 30_000 },
    ];

    for (const input of validInputs) {
      expect(() => bashToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Bash inputs', () => {
    const invalidInputs = [
      {}, // missing command
      { command: '' }, // empty command
      { command: 123 }, // wrong type
      { command: 'ls', timeout: -5 }, // negative timeout
      { command: 'ls', timeout: 'invalid' }, // wrong timeout type
    ];

    for (const input of invalidInputs) {
      expect(() => bashToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('writeToolInputSchema', () => {
  test('validates valid Write inputs', () => {
    const validInputs = [
      { file_path: '/tmp/test.txt', content: 'Hello world' },
      { file_path: '/home/user/file.js', content: '' }, // empty content allowed
      { file_path: '/project/src/index.ts', content: 'export const x = 1;' },
    ];

    for (const input of validInputs) {
      expect(() => writeToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Write inputs', () => {
    const invalidInputs = [
      {}, // missing both fields
      { file_path: '/tmp/test.txt' }, // missing content
      { content: 'Hello' }, // missing file_path
      { file_path: 'relative/path.txt', content: 'test' }, // non-absolute path
      { file_path: '', content: 'test' }, // empty path
      { file_path: 123, content: 'test' }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(() => writeToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('editToolInputSchema', () => {
  test('validates valid Edit inputs', () => {
    const validInputs = [
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
      {
        file_path: '/project/file.ts',
        old_string: '',
        new_string: 'added text',
      },
    ];

    for (const input of validInputs) {
      expect(() => editToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Edit inputs', () => {
    const invalidInputs = [
      {}, // missing all fields
      { file_path: '/tmp/test.txt', old_string: 'old' }, // missing new_string
      { file_path: '/tmp/test.txt', new_string: 'new' }, // missing old_string
      { old_string: 'old', new_string: 'new' }, // missing file_path
      { file_path: 'relative.txt', old_string: 'old', new_string: 'new' }, // non-absolute path
      { file_path: 123, old_string: 'old', new_string: 'new' }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(() => editToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('multiEditInputSchema', () => {
  test('validates valid MultiEdit inputs', () => {
    const validInputs = [
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
      expect(() => multiEditInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid MultiEdit inputs', () => {
    const invalidInputs = [
      {}, // missing all fields
      { file_path: '/tmp/test.txt' }, // missing edits
      { edits: [] }, // missing file_path
      { file_path: '/tmp/test.txt', edits: [] }, // empty edits array
      {
        file_path: 'relative.txt',
        edits: [{ old_string: 'old', new_string: 'new' }],
      }, // non-absolute path
      { file_path: '/tmp/test.txt', edits: 'not array' }, // wrong edits type
    ];

    for (const input of invalidInputs) {
      expect(() => multiEditInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('readToolInputSchema', () => {
  test('validates valid Read inputs', () => {
    const validInputs = [
      { file_path: '/tmp/test.txt' },
      { file_path: '/home/user/file.js', limit: 100 },
      { file_path: '/project/src/index.ts', limit: 50, offset: 10 },
      { file_path: '/tmp/file.txt', offset: 0 }, // zero offset allowed
    ];

    for (const input of validInputs) {
      expect(() => readToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Read inputs', () => {
    const invalidInputs = [
      {}, // missing file_path
      { file_path: 'relative.txt' }, // non-absolute path
      { file_path: '/tmp/test.txt', limit: -1 }, // negative limit
      { file_path: '/tmp/test.txt', offset: -1 }, // negative offset
      { file_path: '/tmp/test.txt', limit: 'invalid' }, // wrong type
    ];

    for (const input of invalidInputs) {
      expect(() => readToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('globToolInputSchema', () => {
  test('validates valid Glob inputs', () => {
    const validInputs = [
      { pattern: '*.ts' },
      { pattern: '**/*.js', path: '/project/src' },
      { pattern: 'test-*.json', path: '' }, // empty path allowed
    ];

    for (const input of validInputs) {
      expect(() => globToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Glob inputs', () => {
    const invalidInputs = [
      {}, // missing pattern
      { pattern: '' }, // empty pattern
      { pattern: 123 }, // wrong type
      { path: '/project' }, // missing pattern
    ];

    for (const input of invalidInputs) {
      expect(() => globToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('grepToolInputSchema', () => {
  test('validates valid Grep inputs', () => {
    const validInputs = [
      { pattern: 'search term' },
      { pattern: 'function\\s+\\w+', path: '/project/src' },
      {
        pattern: 'TODO',
        glob: '*.ts',
        output_mode: 'content',
        head_limit: 10,
        multiline: true,
      },
      { pattern: 'test', output_mode: 'files_with_matches' },
      { pattern: 'error', output_mode: 'count' },
    ];

    for (const input of validInputs) {
      expect(() => grepToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid Grep inputs', () => {
    const invalidInputs = [
      {}, // missing pattern
      { pattern: '' }, // empty pattern
      { pattern: 'test', output_mode: 'invalid' }, // invalid output_mode
      { pattern: 'test', head_limit: -1 }, // negative head_limit
      { pattern: 'test', multiline: 'true' }, // wrong multiline type
    ];

    for (const input of invalidInputs) {
      expect(() => grepToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('lsToolInputSchema', () => {
  test('validates valid LS inputs', () => {
    const validInputs = [
      { path: '/tmp' },
      { path: '/project/src', ignore: ['node_modules', '.git'] },
      { path: '/home', ignore: [] }, // empty ignore array allowed
    ];

    for (const input of validInputs) {
      expect(() => lsToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid LS inputs', () => {
    const invalidInputs = [
      {}, // missing path
      { path: 'relative/path' }, // non-absolute path
      { path: '' }, // empty path
      { path: '/tmp', ignore: 'not array' }, // wrong ignore type
    ];

    for (const input of invalidInputs) {
      expect(() => lsToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('todoWriteToolInputSchema', () => {
  test('validates valid TodoWrite inputs', () => {
    const validInputs = [
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
      expect(() => todoWriteToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid TodoWrite inputs', () => {
    const invalidInputs = [
      {}, // missing todos
      { todos: [] }, // empty todos array
      { todos: 'not array' }, // wrong type
      { todos: [{ content: 'task', status: 'invalid', id: '1' }] }, // invalid status
      { todos: [{ content: '', status: 'pending', id: '1' }] }, // empty content
      { todos: [{ content: 'task', status: 'pending', id: '' }] }, // empty id
    ];

    for (const input of invalidInputs) {
      expect(() => todoWriteToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('webFetchToolInputSchema', () => {
  test('validates valid WebFetch inputs', () => {
    const validInputs = [
      { url: 'https://example.com', prompt: 'Extract the main content' },
      { url: 'http://api.example.com/data', prompt: 'Get the JSON response' },
      { url: 'https://docs.site.com/api', prompt: 'Parse documentation' },
    ];

    for (const input of validInputs) {
      expect(() => webFetchToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid WebFetch inputs', () => {
    const invalidInputs = [
      {}, // missing both fields
      { url: 'https://example.com' }, // missing prompt
      { prompt: 'Extract content' }, // missing url
      { url: 'not-a-url', prompt: 'test' }, // invalid URL
      { url: 'https://example.com', prompt: '' }, // empty prompt
      { url: 123, prompt: 'test' }, // wrong url type
    ];

    for (const input of invalidInputs) {
      expect(() => webFetchToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('webSearchToolInputSchema', () => {
  test('validates valid WebSearch inputs', () => {
    const validInputs = [
      { query: 'TypeScript hooks' },
      {
        query: 'Claude Code integration',
        allowed_domains: ['docs.anthropic.com'],
        blocked_domains: ['spam.com'],
      },
      { query: 'search term', allowed_domains: [] }, // empty arrays allowed
    ];

    for (const input of validInputs) {
      expect(() => webSearchToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid WebSearch inputs', () => {
    const invalidInputs = [
      {}, // missing query
      { query: '' }, // empty query
      { query: 'test', allowed_domains: 'not array' }, // wrong type
      { query: 'test', blocked_domains: ['valid.com', 123] }, // invalid domain in array
    ];

    for (const input of invalidInputs) {
      expect(() => webSearchToolInputSchema.parse(input)).toThrow(z.ZodError);
    }
  });
});

describe('notebookEditToolInputSchema', () => {
  test('validates valid NotebookEdit inputs', () => {
    const validInputs = [
      { notebook_path: '/tmp/notebook.ipynb', new_source: 'print("hello")' },
      {
        notebook_path: '/project/analysis.ipynb',
        new_source: '# Analysis\n\nThis is markdown',
        cell_id: 'cell-123',
        cell_type: 'markdown',
        edit_mode: 'replace',
      },
      {
        notebook_path: '/notebooks/test.ipynb',
        new_source: '',
        cell_type: 'code',
      },
    ];

    for (const input of validInputs) {
      expect(() => notebookEditToolInputSchema.parse(input)).not.toThrow();
    }
  });

  test('rejects invalid NotebookEdit inputs', () => {
    const invalidInputs = [
      {}, // missing required fields
      { notebook_path: '/tmp/notebook.ipynb' }, // missing new_source
      { new_source: 'code' }, // missing notebook_path
      { notebook_path: '/tmp/notebook.txt', new_source: 'code' }, // not .ipynb
      { notebook_path: 'relative.ipynb', new_source: 'code' }, // non-absolute path
      {
        notebook_path: '/tmp/notebook.ipynb',
        new_source: 'code',
        cell_type: 'invalid',
      }, // invalid cell_type
      {
        notebook_path: '/tmp/notebook.ipynb',
        new_source: 'code',
        edit_mode: 'invalid',
      }, // invalid edit_mode
    ];

    for (const input of invalidInputs) {
      expect(() => notebookEditToolInputSchema.parse(input)).toThrow(
        z.ZodError
      );
    }
  });
});

describe('toolInputSchemas map', () => {
  test('contains all expected schemas', () => {
    const expectedKeys = [
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
    ];

    for (const key of expectedKeys) {
      expect(toolInputSchemas).toHaveProperty(key);
      expect(
        toolInputSchemas[key as keyof typeof toolInputSchemas]
      ).toBeInstanceOf(z.ZodObject);
    }
  });
});

describe('getToolInputSchema', () => {
  test('returns correct schema for tool name', () => {
    expect(getToolInputSchema('Bash')).toBe(bashToolInputSchema);
    expect(getToolInputSchema('Write')).toBe(writeToolInputSchema);
    expect(getToolInputSchema('Edit')).toBe(editToolInputSchema);
  });
});

describe('validateToolInput', () => {
  test('validates and returns parsed input', () => {
    const input = { command: 'ls -la', timeout: 5000 };
    const result = validateToolInput('Bash', input);

    expect(result).toEqual(input);
  });

  test('throws on invalid input', () => {
    const input = { command: 123 }; // invalid type

    expect(() => validateToolInput('Bash', input)).toThrow(z.ZodError);
  });
});

describe('safeValidateToolInput', () => {
  test('returns success for valid input', () => {
    const input = { file_path: '/tmp/test.txt', content: 'hello' };
    const result = safeValidateToolInput('Write', input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  test('returns error for invalid input', () => {
    const input = { file_path: 123 }; // invalid type
    const result = safeValidateToolInput('Write', input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });
});
