/**
 * Tests for StdinProtocol
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  ProtocolInputError,
  ProtocolOutputError,
  ProtocolParseError,
} from '../interface.js';
import { StdinProtocol, StdinProtocolFactory } from '../protocols/stdin.js';

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

    test('should destroy stream on hard timeout', async () => {
      let destroyCalled = false;
      const mockStdin = createMockReadableStream('', {
        delay: 100,
        onDestroy: () => {
          destroyCalled = true;
        },
      });
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol({ inputTimeout: 50 });

      try {
        await protocol.readInput();
      } catch (error) {
        expect(error).toBeInstanceOf(ProtocolInputError);
        expect((error as ProtocolInputError).message).toContain('hard timeout');
      }

      // Give some time for destroy to be called
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(destroyCalled).toBe(true);
    });

    test('should handle multiple timeout scenarios gracefully', async () => {
      const protocol = new StdinProtocol({ inputTimeout: 50 });

      // First timeout
      const mockStdin1 = createMockReadableStream('', { delay: 100 });
      process.stdin = mockStdin1 as any;
      await expect(protocol.readInput()).rejects.toThrow(ProtocolInputError);

      // Second read should work with fresh stream
      const mockStdin2 = createMockReadableStream(
        JSON.stringify({ test: 'data' })
      );
      process.stdin = mockStdin2 as any;
      const result = await protocol.readInput();
      expect(result).toEqual({ test: 'data' });
    });

    test('protocol destroy should clean up active streams', async () => {
      let destroyCalled = false;
      const mockStdin = createMockReadableStream('', {
        delay: 1000,
        onDestroy: () => {
          destroyCalled = true;
        },
      });
      process.stdin = mockStdin as any;

      const protocol = new StdinProtocol({ inputTimeout: 5000 });

      // Start reading (but don't await)
      const start = Date.now();
      const readPromise = protocol.readInput().catch((e) => e);

      // Destroy protocol while read is in progress
      await new Promise((resolve) => setTimeout(resolve, 10));
      protocol.destroy();

      // Wait for promise to reject promptly (well under the configured timeout)
      const error = await readPromise;
      expect(error).toBeInstanceOf(ProtocolInputError);
      expect(error.message).toContain('Protocol destroyed while reading');
      expect(Date.now() - start).toBeLessThan(200);

      expect(destroyCalled).toBe(true);
    });

    test('destroy should be idempotent', async () => {
      const protocol = new StdinProtocol();

      // Should not throw when called multiple times
      protocol.destroy();
      protocol.destroy();
      protocol.destroy();

      // Should still reject read operations after multiple destroy calls
      const mockStdin = createMockReadableStream(
        JSON.stringify({ test: 'data' })
      );
      process.stdin = mockStdin as any;

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

      await expect(protocol.parseContext(input)).rejects.toThrow(
        ProtocolParseError
      );
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

      await expect(protocol.writeOutput(result)).rejects.toThrow(
        ProtocolOutputError
      );
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
function createMockReadableStream(
  data: string,
  options: { delay?: number; onDestroy?: () => void } = {}
) {
  const chunks = [Buffer.from(data)];
  let index = 0;
  let isPaused = false;
  let isDestroyed = false;
  const listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  return {
    readable: true,
    readableLength: data.length,
    async *[Symbol.asyncIterator]() {
      if (options.delay) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }

      while (index < chunks.length && !isDestroyed) {
        yield chunks[index++];
      }
    },
    on(event: string, listener: (...args: any[]) => void) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)?.push(listener);

      // Simulate data events
      if (event === 'data' && data) {
        if (options.delay) {
          setTimeout(() => listener(Buffer.from(data)), options.delay);
        } else {
          process.nextTick(() => listener(Buffer.from(data)));
        }
      }
      if (event === 'end') {
        if (options.delay) {
          setTimeout(() => listener(), options.delay + 10);
        } else {
          process.nextTick(() => listener());
        }
      }
    },
    off(event: string, listener: (...args: any[]) => void) {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    },
    removeListener(event: string, listener: (...args: any[]) => void) {
      this.off(event, listener);
    },
    removeAllListeners() {
      listeners.clear();
    },
    once(event: string, listener: (...args: any[]) => void) {
      const onceWrapper = (...args: any[]) => {
        this.off(event, onceWrapper);
        listener(...args);
      };
      this.on(event, onceWrapper);
    },
    pause() {
      isPaused = true;
    },
    resume() {
      isPaused = false;
    },
    isPaused() {
      return isPaused;
    },
    read(_size?: number) {
      // Simulate reading buffered data
      return null;
    },
    destroy(error?: Error) {
      if (!isDestroyed) {
        isDestroyed = true;
        if (options.onDestroy) {
          options.onDestroy();
        }
        if (error) {
          const errorListeners = listeners.get('error');
          if (errorListeners) {
            errorListeners.forEach((listener) => listener(error));
          }
        }
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
        if (callback) {
          callback(error);
        }
        return false;
      }

      this.writtenData += data;
      if (callback) {
        callback();
      }
      return true;
    },
  };
}
