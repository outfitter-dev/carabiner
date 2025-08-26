/**
 * @outfitter/protocol - HTTP Protocol Implementation
 *
 * Implements an HTTP-based protocol that can receive hook inputs via POST
 * requests and return results as HTTP responses. Useful for webhook-style
 * integrations and web-based hook execution.
 */

import {
  parseClaudeHookInput,
  validateAndCreateBrandedInput,
} from '@carabiner/schemas';
import type {
  DirectoryPath,
  HookContext,
  HookResult,
  NotificationEvent,
  SessionId,
  ToolHookEvent,
  ToolInput,
  TranscriptPath,
} from '@carabiner/types';
import {
  createNotificationContext,
  createToolHookContext,
  createUserPromptContext,
} from '@carabiner/types';
import type { HookProtocol } from '../interface';
import { ProtocolInputError, ProtocolParseError } from '../interface';

/**
 * Configuration options for HttpProtocol
 */
export type HttpProtocolOptions = {
  /**
   * Maximum request body size in bytes
   * @default 1048576 (1MB)
   */
  maxBodySize?: number;

  /**
   * Custom headers to include in responses
   * @default {}
   */
  responseHeaders?: Record<string, string>;

  /**
   * Whether to include detailed error information in responses
   * @default true
   */
  includeErrorDetails?: boolean;

  /**
   * CORS configuration
   * @default undefined
   */
  cors?: {
    origin?: string | string[] | boolean;
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
  };
};

/**
 * Protocol implementation for HTTP-based hook execution
 *
 * This protocol allows hooks to be executed over HTTP, enabling webhook-style
 * integrations and web-based hook execution environments.
 *
 * @example
 * ```typescript
 * const protocol = new HttpProtocol(request, {
 *   cors: { origin: '*', methods: ['POST'] }
 * });
 *
 * // Use with hook executor
 * const executor = new HookExecutor(protocol);
 * await executor.execute(myHookHandler);
 * const response = protocol.getResponse();
 * ```
 */
export class HttpProtocol implements HookProtocol {
  private result?: HookResult;
  private error?: Error;

  constructor(
    private readonly request: Request,
    private readonly options: HttpProtocolOptions = {}
  ) {}

  /**
   * Read JSON input from HTTP request body
   */
  async readInput(): Promise<unknown> {
    try {
      const contentType = this.request.headers.get('content-type');

      if (!contentType?.includes('application/json')) {
        throw new ProtocolInputError(
          'Request must have Content-Type: application/json'
        );
      }

      const bodySize = this.request.headers.get('content-length');
      const maxSize = this.options.maxBodySize ?? 1_048_576; // 1MB default

      if (bodySize && Number.parseInt(bodySize, 10) > maxSize) {
        throw new ProtocolInputError(
          `Request body too large. Maximum size: ${maxSize} bytes`
        );
      }

      const body = await this.readBodyWithLimit(this.request, maxSize);

      if (!body.trim()) {
        throw new ProtocolInputError('Request body is empty');
      }

      try {
        return JSON.parse(body);
      } catch (parseError) {
        throw new ProtocolInputError(
          'Failed to parse JSON from request body',
          parseError
        );
      }
    } catch (error) {
      if (error instanceof ProtocolInputError) {
        throw error;
      }
      throw new ProtocolInputError(
        'Failed to read input from HTTP request',
        error
      );
    }
  }

  /**
   * Read request body with size limit enforcement
   */
  private async readBodyWithLimit(
    req: Request,
    maxSize: number
  ): Promise<string> {
    // If the runtime doesn't expose a readable stream, fall back to text()
    const stream = req.body;
    if (!stream) {
      const text = await req.text();
      if (text.length > maxSize) {
        throw new ProtocolInputError(
          `Request body too large. Maximum size: ${maxSize} bytes`
        );
      }
      return text;
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      // Read incrementally and enforce the cap
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          total += value.byteLength;
          if (total > maxSize) {
            throw new ProtocolInputError(
              `Request body too large. Maximum size: ${maxSize} bytes`
            );
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    // Concatenate and decode
    const merged = (() => {
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return out;
    })();

    return new TextDecoder('utf-8').decode(merged);
  }

  /**
   * Parse and validate raw input into typed hook context
   */
  async parseContext(input: unknown): Promise<HookContext> {
    try {
      // First validate with Zod schemas
      const claudeInput = parseClaudeHookInput(input);

      // Then create branded types and context
      const validatedInput = await validateAndCreateBrandedInput(claudeInput);

      return this.createTypedContext(validatedInput);
    } catch (error) {
      if (error instanceof Error) {
        throw new ProtocolParseError(
          `Failed to parse hook context: ${error.message}`,
          error
        );
      }
      throw new ProtocolParseError('Failed to parse hook context');
    }
  }

  /**
   * Store result for later HTTP response generation
   */
  async writeOutput(result: HookResult): Promise<void> {
    this.result = result;
  }

  /**
   * Store error for later HTTP response generation
   */
  async writeError(error: Error): Promise<void> {
    this.error = error;
  }

  /**
   * Generate HTTP response from stored result or error
   */
  getResponse(): Response {
    const headers = this.buildResponseHeaders();

    if (this.error) {
      return this.buildErrorResponse(headers);
    }

    if (this.result) {
      return this.buildSuccessResponse(headers);
    }

    return this.buildNoResultResponse(headers);
  }

  /**
   * Build response headers with CORS support
   */
  private buildResponseHeaders(): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.options.responseHeaders,
    });

    if (this.options.cors) {
      this.addCorsHeaders(headers);
    }

    return headers;
  }

  /**
   * Add CORS headers to response
   */
  private addCorsHeaders(headers: Headers): void {
    const {
      origin,
      methods,
      headers: corsHeaders,
      credentials,
    } = this.options.cors!;

    if (origin !== undefined) {
      this.setCorsOriginHeader(headers, origin);
    }

    if (methods) {
      headers.set('Access-Control-Allow-Methods', methods.join(', '));
    }

    if (corsHeaders) {
      headers.set('Access-Control-Allow-Headers', corsHeaders.join(', '));
    }

    if (credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  /**
   * Set CORS origin header based on configuration
   */
  private setCorsOriginHeader(
    headers: Headers,
    origin: string | string[] | boolean
  ): void {
    if (origin === true) {
      headers.set('Access-Control-Allow-Origin', '*');
    } else if (typeof origin === 'string') {
      headers.set('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      // For arrays, we'd need the original request origin to match
      // This is a simplified implementation
      headers.set('Access-Control-Allow-Origin', origin[0] || '*');
    }
  }

  /**
   * Build error response
   */
  private buildErrorResponse(headers: Headers): Response {
    const errorBody = this.options.includeErrorDetails
      ? {
          error: this.error?.message,
          type: this.error?.name,
          ...(this.error?.stack && { stack: this.error?.stack }),
        }
      : { error: 'Hook execution failed' };

    return new Response(JSON.stringify(errorBody), {
      status: 500,
      headers,
    });
  }

  /**
   * Build success response
   */
  private buildSuccessResponse(headers: Headers): Response {
    const status = this.result?.success ? 200 : 400;
    return new Response(JSON.stringify(this.result), {
      status,
      headers,
    });
  }

  /**
   * Build no result response
   */
  private buildNoResultResponse(headers: Headers): Response {
    return new Response(JSON.stringify({ error: 'No result available' }), {
      status: 500,
      headers,
    });
  }

  /**
   * Handle preflight CORS requests
   */
  static createOptionsResponse(options: HttpProtocolOptions = {}): Response {
    const headers = new Headers();

    if (options.cors) {
      HttpProtocol.addOptionsResponseCorsHeaders(headers, options.cors);
    }

    return new Response(null, {
      status: 204,
      headers,
    });
  }

  /**
   * Add CORS headers for OPTIONS response
   */
  private static addOptionsResponseCorsHeaders(
    headers: Headers,
    corsConfig: NonNullable<HttpProtocolOptions['cors']>
  ): void {
    const { origin, methods, headers: corsHeaders, credentials } = corsConfig;

    HttpProtocol.setOptionsOriginHeader(headers, origin);
    HttpProtocol.setOptionsMethodsHeader(headers, methods);
    HttpProtocol.setOptionsHeadersHeader(headers, corsHeaders);

    if (credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }

  /**
   * Set origin header for OPTIONS response
   */
  private static setOptionsOriginHeader(
    headers: Headers,
    origin: string | string[] | boolean | undefined
  ): void {
    if (origin === undefined) {
      return;
    }

    if (origin === true) {
      headers.set('Access-Control-Allow-Origin', '*');
    } else if (typeof origin === 'string') {
      headers.set('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      headers.set('Access-Control-Allow-Origin', origin.join(', '));
    }
  }

  /**
   * Set methods header for OPTIONS response
   */
  private static setOptionsMethodsHeader(
    headers: Headers,
    methods: string[] | undefined
  ): void {
    if (methods) {
      headers.set('Access-Control-Allow-Methods', methods.join(', '));
    } else {
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
  }

  /**
   * Set headers header for OPTIONS response
   */
  private static setOptionsHeadersHeader(
    headers: Headers,
    corsHeaders: string[] | undefined
  ): void {
    if (corsHeaders) {
      headers.set('Access-Control-Allow-Headers', corsHeaders.join(', '));
    } else {
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }
  }

  /**
   * Create typed context from validated Claude input
   */
  private createTypedContext(input: Record<string, unknown>): HookContext {
    const environment = this.extractEnvironment();
    const commonProps = this.extractCommonContextProps(input, environment);

    if ('tool_name' in input) {
      return this.createToolContext(input, commonProps);
    }

    if ('prompt' in input) {
      return this.createPromptContext(input, commonProps);
    }

    if ('notification' in input) {
      return this.createNotificationContext(input, commonProps);
    }

    throw new ProtocolParseError(
      `Unsupported hook event: ${String(input.hook_event_name)}`
    );
  }

  /**
   * Extract common context properties
   */
  private extractCommonContextProps(
    input: Record<string, unknown>,
    environment: Record<string, string>
  ) {
    return {
      sessionId: input.sessionId as SessionId,
      transcriptPath: input.transcriptPath as TranscriptPath,
      cwd: input.cwd as DirectoryPath,
      environment,
      matcher: input.matcher as string | undefined,
    };
  }

  /**
   * Create tool hook context
   */
  private createToolContext(
    input: Record<string, unknown>,
    commonProps: {
      sessionId: SessionId;
      transcriptPath: TranscriptPath;
      cwd: DirectoryPath;
      environment: Record<string, string>;
      matcher?: string;
    }
  ): HookContext {
    return createToolHookContext(
      input.hook_event_name as ToolHookEvent,
      input.tool_name as string,
      input.tool_input as ToolInput,
      commonProps,
      input.tool_response as Record<string, unknown> | undefined
    );
  }

  /**
   * Create user prompt context
   */
  private createPromptContext(
    input: Record<string, unknown>,
    commonProps: {
      sessionId: SessionId;
      transcriptPath: TranscriptPath;
      cwd: DirectoryPath;
      environment: Record<string, string>;
      matcher?: string;
    }
  ): HookContext {
    return createUserPromptContext(input.prompt as string, commonProps);
  }

  /**
   * Create notification context
   */
  private createNotificationContext(
    input: Record<string, unknown>,
    commonProps: {
      sessionId: SessionId;
      transcriptPath: TranscriptPath;
      cwd: DirectoryPath;
      environment: Record<string, string>;
      matcher?: string;
    }
  ): HookContext {
    return createNotificationContext(
      input.hook_event_name as NotificationEvent,
      commonProps,
      input.notification as string | undefined
    );
  }

  /**
   * Extract environment variables from request headers or provide defaults
   */
  private extractEnvironment(): Record<string, string> {
    const environment: Record<string, string> = {};

    // Extract from custom headers (e.g., X-Env-*)
    for (const [key, value] of this.request.headers.entries()) {
      if (key.toLowerCase().startsWith('x-env-')) {
        const envKey = key.substring(6).toUpperCase().replace(/-/g, '_');
        environment[envKey] = value;
      }
    }

    // Add some defaults
    environment.PROTOCOL_TYPE = 'http';
    environment.REQUEST_METHOD = this.request.method;
    environment.REQUEST_URL = this.request.url;

    return environment;
  }
}

/**
 * Factory for creating HttpProtocol instances
 */
export class HttpProtocolFactory {
  readonly type = 'http';

  create({
    request,
    options,
  }: {
    request: Request;
    options?: HttpProtocolOptions;
  }): HookProtocol {
    return new HttpProtocol(request, options);
  }
}
