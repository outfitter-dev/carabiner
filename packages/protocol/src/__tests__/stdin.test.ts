/**
 * Tests for StdinProtocol
 */

import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { StdinProtocol, StdinProtocolFactory } from '../protocols/stdin.js';
import { ProtocolInputError, ProtocolOutputError, ProtocolParseError } from '../interface.js';

describe('StdinProtocol', () => {
  let originalStdin: typeof process.stdin;
  let originalStdout: typeof process.stdout;
  let originalStderr: typeof process.stderr;
  
  beforeEach(() => {
    originalStdin = process.stdin;
    originalStdout = process.stdout;
    originalStderr = process.stderr;
  });
  
  afterEach(() => {
    process.stdin = originalStdin;
    process.stdout = originalStdout;
    process.stderr = originalStderr;
  });

  describe('readInput', () => {
    test('should read JSON from stdin successfully', async () => {
      const testInput = { test: 'data' };
      const mockStdin = createMockReadableStream(JSON.stringify(testInput));
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol();
      const result = await protocol.readInput();
      
      expect(result).toEqual(testInput);
    });

    test('should throw ProtocolInputError on empty input', async () => {
      const mockStdin = createMockReadableStream('');
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol();
      
      await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
    });

    test('should throw ProtocolInputError on invalid JSON', async () => {
      const mockStdin = createMockReadableStream('invalid json');
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol();
      
      await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
    });

    test('should timeout after configured time', async () => {
      const mockStdin = createMockReadableStream('', { delay: 100 });
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol({ inputTimeout: 50 });
      
      await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);
    });
  });

  describe('parseContext', () => {
    test('should parse valid tool hook input', async () => {
      const input = {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/test/dir',
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'echo "test"' },
      };

      const protocol = new StdinProtocol();
      const context = await protocol.parseContext(input);
      
      expect(context.event).toBe('PreToolUse');
      expect(context.sessionId).toBeDefined();
      expect(context.transcriptPath).toBeDefined();
      expect(context.cwd).toBeDefined();
    });

    test('should parse valid user prompt input', async () => {
      const input = {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.md',
        cwd: '/test/dir',
        hook_event_name: 'UserPromptSubmit',
        prompt: 'Test prompt',
      };

      const protocol = new StdinProtocol();
      const context = await protocol.parseContext(input);
      
      expect(context.event).toBe('UserPromptSubmit');
    });

    test('should throw ProtocolParseError on invalid input', async () => {
      const input = { invalid: 'input' };

      const protocol = new StdinProtocol();
      
      await expect(protocol.parseContext(input)).rejects.toThrow(ProtocolParseError);
    });
  });

  describe('writeOutput', () => {
    test('should write result to stdout', async () => {
      const mockStdout = createMockWritableStream();
      process.stdout = mockStdout as any;

      const protocol = new StdinProtocol();
      const result = { success: true, message: 'Test success' };
      
      await protocol.writeOutput(result);
      
      expect(mockStdout.writtenData).toBe(JSON.stringify(result));
    });

    test('should pretty print when configured', async () => {
      const mockStdout = createMockWritableStream();
      process.stdout = mockStdout as any;

      const protocol = new StdinProtocol({ prettyOutput: true });
      const result = { success: true, message: 'Test success' };
      
      await protocol.writeOutput(result);
      
      expect(mockStdout.writtenData).toBe(JSON.stringify(result, null, 2));
    });

    test('should throw ProtocolOutputError on write failure', async () => {
      const mockStdout = createMockWritableStream({ shouldError: true });
      process.stdout = mockStdout as any;

      const protocol = new StdinProtocol();
      const result = { success: true, message: 'Test' };
      
      await expect(protocol.writeOutput(result)).rejects.toThrow(ProtocolOutputError);
    });
  });

  describe('writeError', () => {
    test('should write error to stderr', async () => {
      const mockStderr = createMockWritableStream();
      process.stderr = mockStderr as any;

      const protocol = new StdinProtocol();
      const error = new Error('Test error');
      
      await protocol.writeError(error);
      
      const written = JSON.parse(mockStderr.writtenData);
      expect(written.error).toBe('Test error');
      expect(written.type).toBe('Error');
    });

    test('should include stack trace by default', async () => {
      const mockStderr = createMockWritableStream();
      process.stderr = mockStderr as any;

      const protocol = new StdinProtocol();
      const error = new Error('Test error');
      // Ensure stack trace exists
      if (error.stack === undefined) {
        error.stack = 'Error: Test error\n    at test';
      }
      
      await protocol.writeError(error);
      
      const written = JSON.parse(mockStderr.writtenData);
      expect(written.stack).toBeDefined();
    });

    test('should exclude stack trace when configured', async () => {
      const mockStderr = createMockWritableStream();
      process.stderr = mockStderr as any;

      const protocol = new StdinProtocol({ includeErrorStack: false });
      const error = new Error('Test error');
      
      await protocol.writeError(error);
      
      const written = JSON.parse(mockStderr.writtenData);
      expect(written.stack).toBeUndefined();
    });
  });
});

describe('StdinProtocolFactory', () => {
  test('should create StdinProtocol instances', () => {
    const factory = new StdinProtocolFactory();
    const protocol = factory.create({ inputTimeout: 5000 });
    
    expect(protocol).toBeInstanceOf(StdinProtocol);
    expect(factory.type).toBe('stdin');
  });
});

// Mock helper functions
function createMockReadableStream(data: string, options: { delay?: number } = {}) {
  const chunks = [Buffer.from(data)];
  let index = 0;

  return {
    async *[Symbol.asyncIterator]() {
      if (options.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      while (index < chunks.length) {
        yield chunks[index++];
      }
    },
  };
}

function createMockWritableStream(options: { shouldError?: boolean } = {}) {
  return {
    writtenData: '' as string,
    write(data: string, callback?: (error?: Error) => void) {
      if (options.shouldError) {
        const error = new Error('Mock write error');
        if (callback) callback(error);
        return false;
      }
      
      this.writtenData += data;
      if (callback) callback();
      return true;
    },
  };
}