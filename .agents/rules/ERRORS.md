# Error Handling Rules

## Error Types

### Custom Error Classes

```typescript
// Base error class with cause support
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, cause);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', cause?: unknown) {
    super(message, 'AUTH_ERROR', 401, cause);
  }
}
```

### Error Codes

- Use SCREAMING_SNAKE_CASE
- Prefix with domain (AUTH*, VALIDATION*, DB\_)
- Be specific (USER_NOT_FOUND vs NOT_FOUND)
- Document all error codes

## Result Pattern

### Type-Safe Error Handling

```typescript
// Result type for operations that can fail
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Usage
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) {
      return { ok: false, error: new NotFoundError('User not found') };
    }
    return { ok: true, value: user };
  } catch (error) {
    return { ok: false, error: new DatabaseError('Failed to fetch user', error) };
  }
}

// Handling
const result = await fetchUser(id);
if (!result.ok) {
  console.error('Failed:', result.error);
  return;
}
console.log('User:', result.value);
```

### Option Type

```typescript
// For nullable values without errors
type Option<T> = T | null;

// With type guards
function isSome<T>(value: Option<T>): value is T {
  return value !== null;
}
```

## Error Boundaries

### React Error Boundaries

```typescript
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to error reporting service
    errorReporter.log(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Async Error Boundaries

```typescript
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to monitoring service
});

// Bun-specific
Bun.serve({
  error(error) {
    console.error('Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  },
});
```

## API Error Responses

### Consistent Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

// Error response helper
function errorResponse(error: AppError, requestId: string): Response {
  const body: ApiError = {
    error: {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
      ...(process.env.NODE_ENV !== 'production' && {
        details: error.cause,
      }),
    },
  };

  return Response.json(body, {
    status: error.statusCode,
    headers: { 'X-Request-ID': requestId },
  });
}
```

### Validation Errors

```typescript
interface ValidationErrorResponse extends ApiError {
  error: ApiError['error'] & {
    fields?: Record<string, string[]>;
  };
}

// Zod integration
function handleZodError(error: ZodError): ValidationErrorResponse {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      fields: error.flatten().fieldErrors,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  };
}
```

## Logging

### Structured Logging

```typescript
// Use structured logging
const logger = {
  error(message: string, error: unknown, meta?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause,
              }
            : error,
        timestamp: new Date().toISOString(),
        ...meta,
      }),
    );
  },
};
```

### Error Context

```typescript
// Add context to errors
try {
  await processPayment(order);
} catch (error) {
  logger.error('Payment processing failed', error, {
    orderId: order.id,
    userId: order.userId,
    amount: order.total,
    paymentMethod: order.paymentMethod,
  });
  throw new PaymentError('Payment failed', error);
}
```

## Testing Errors

### Error Testing Patterns

```typescript
import { expect, test } from 'bun:test';

test('should throw ValidationError for invalid input', () => {
  expect(() => {
    validateEmail('invalid-email');
  }).toThrow(ValidationError);

  expect(() => {
    validateEmail('invalid-email');
  }).toThrow('Invalid email format');
});

test('should handle async errors', async () => {
  const result = await fetchUser('invalid-id');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBeInstanceOf(NotFoundError);
  }
});
```

## Recovery Strategies

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    delay: number;
    backoff?: number;
  },
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === options.maxAttempts) {
        throw new Error(`Failed after ${options.maxAttempts} attempts`, {
          cause: lastError,
        });
      }

      const delay = options.delay * Math.pow(options.backoff ?? 1, attempt - 1);
      await Bun.sleep(delay);
    }
  }

  throw lastError!;
}
```

### Graceful Degradation

```typescript
// Provide fallback behavior
async function getFeatureFlag(key: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/features/${key}`);
    const data = await response.json();
    return data.enabled;
  } catch (error) {
    logger.warn('Failed to fetch feature flag', error, { key });
    // Return safe default
    return false;
  }
}
```
