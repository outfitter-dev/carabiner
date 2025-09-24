# @carabiner/error-management

Production-ready error handling system for the Grapple monorepo.

## Features

- **Unified Error Types**: Consistent error classes across all packages
- **Error Recovery**: Retry strategies, circuit breakers, and fallback mechanisms
- **Error Boundaries**: Graceful degradation and fault isolation
- **Error Reporting**: Structured logging with sanitization and monitoring integration
- **Production Ready**: Comprehensive error handling designed for reliability

## Quick Start

```typescript
import {
  GrappleError,
  ErrorCode,
  ErrorCategory,
  reportError,
  setupProductionErrorHandling,
} from '@carabiner/error-management';

// Setup production error handling
setupProductionErrorHandling();

// Use typed errors
try {
  throw new GrappleError(
    'Something went wrong',
    ErrorCode.RUNTIME_EXCEPTION,
    ErrorCategory.RUNTIME,
  );
} catch (error) {
  await reportError(error);
  throw error;
}
```

## Error Recovery

```typescript
import { RetryManager, CircuitBreaker } from '@carabiner/error-management';

// Retry with exponential backoff
const retryManager = new RetryManager({ maxRetries: 3 });
const result = await retryManager.execute(async () => {
  return await someOperation();
});

// Circuit breaker for fault tolerance
const circuitBreaker = new CircuitBreaker();
await circuitBreaker.execute(() => unreliableService());
```

## Error Boundaries

```typescript
import { executeWithBoundary } from '@carabiner/error-management';

const result = await executeWithBoundary(
  async () => await riskyOperation(),
  'risky-operation-boundary',
);
```

## Error Categories

- `CONFIGURATION`: Configuration-related errors
- `RUNTIME`: Runtime execution errors
- `VALIDATION`: Input/output validation errors
- `FILESYSTEM`: File system operation errors
- `NETWORK`: Network and connectivity errors
- `SECURITY`: Security-related violations
- `USER_INPUT`: User input and command errors
- `RESOURCE`: System resource exhaustion
- `AUTH`: Authentication and authorization
- `TIMEOUT`: Timeout and performance issues

## Architecture

This package provides a unified error handling foundation that:

1. **Standardizes** error types and codes across the monorepo
2. **Implements** production-ready recovery mechanisms
3. **Provides** error boundaries for graceful degradation
4. **Enables** comprehensive error reporting and monitoring
5. **Ensures** security through data sanitization

## License

MIT
