# Production Logging System

Enterprise-grade structured JSON logging for the Grapple monorepo with security, performance, and compliance features.

## Features

- **🔒 Security Compliant**: Automatic sanitization of sensitive data
- **⚡ Performance Optimized**: Zero pretty-printing in production, minimal overhead
- **🏗️ Structured**: Consistent JSON logging with correlation IDs
- **🌍 Environment Aware**: Automatic configuration based on NODE_ENV
- **📊 Observable**: Rich contextual data for debugging and monitoring
- **🔄 Correlation**: Request tracing with correlation IDs
- **🎯 Hook-Aware**: Specialized logging for Claude Code hook execution

## Quick Start

```typescript
import { createLogger, createHookLogger } from '@outfitter/hooks-core';

// Basic service logger
const logger = createLogger('my-service');
logger.info('Service started', { port: 3000 });

// Hook execution logger
const hookLogger = createHookLogger('PreToolUse', 'Bash');
hookLogger.startExecution({
  event: 'PreToolUse',
  toolName: 'Bash',
  executionId: 'exec_123',
  sessionId: 'session_abc',
});
```

## Environment Configuration

The logging system automatically configures based on environment:

| Environment   | Log Level | Pretty Print | Console Output |
| ------------- | --------- | ------------ | -------------- |
| `development` | `debug`   | ✅           | ✅             |
| `production`  | `info`    | ❌           | ✅             |
| `test`        | `error`   | ❌           | ❌             |

### Environment Variables

- `LOG_LEVEL`: Override log level (`error`, `warn`, `info`, `debug`, `trace`)
- `NODE_ENV`: Environment detection (`development`, `production`, `test`)
- `DEBUG`: Enable debug mode (`true` forces debug level)
- `--debug`: CLI flag for debug logging
- `--verbose`: CLI flag for verbose info logging

## Logger Types

### Basic Logger

```typescript
import { createLogger } from '@outfitter/hooks-core';

const logger = createLogger('service-name');

logger.error('Something failed', { errorCode: 'E001' });
logger.warn('Warning message', { retries: 3 });
logger.info('Info message', { userId: 'user123' });
logger.debug('Debug info', { query: 'SELECT * FROM users' });
logger.trace('Trace message', { stackTrace: true });
```

### Hook Logger

```typescript
import { createHookLogger, type HookExecutionContext } from '@outfitter/hooks-core';

const hookLogger = createHookLogger('PreToolUse', 'Bash');

const context: HookExecutionContext = {
  event: 'PreToolUse',
  toolName: 'Bash',
  executionId: 'exec_123',
  sessionId: 'session_abc',
};

// Lifecycle logging
hookLogger.startExecution(context);
hookLogger.completeExecution(context, true, performanceMetrics);
hookLogger.failExecution(context, error, performanceMetrics);

// Security events
hookLogger.logSecurityEvent('suspicious_command', 'high', context, {
  command: 'rm -rf /',
  blocked: true,
});

// User actions
hookLogger.logUserAction('validate_input', context, {
  input: 'user command',
  validation: 'passed',
});
```

### CLI Logger

```typescript
import { createCliLogger } from '@outfitter/hooks-core';

const cliLogger = createCliLogger('generate');

cliLogger.info('Starting code generation', {
  template: 'security-hook',
  outputDir: './hooks',
});
```

### Environment-Specific Loggers

```typescript
import {
  createProductionLogger,
  createDevelopmentLogger,
  createTestLogger,
} from '@outfitter/hooks-core';

// Optimized for production (no debug, structured JSON)
const prodLogger = createProductionLogger('api-service');

// Optimized for development (debug enabled, pretty printing)
const devLogger = createDevelopmentLogger('api-service');

// Optimized for tests (minimal output)
const testLogger = createTestLogger('api-service');
```

## Security Features

### Automatic Data Sanitization

The logging system automatically removes or masks sensitive data:

```typescript
const logger = createLogger('auth-service');

// Sensitive data is automatically sanitized
logger.info('User login', {
  username: 'john',
  password: 'secret123', // REMOVED
  email: 'john@example.com', // MASKED: j***@example.com
  apiKey: 'sk-abc123', // REMOVED
  sessionToken: 'token123', // REMOVED
});
```

### Sensitive Field Detection

Automatically removes fields containing:

- `password`, `passwd`, `secret`, `token`, `key`
- `authorization`, `auth`, `cookie`, `session`
- `credentials`, `apiKey`, `accessToken`
- `privateKey`, `ssn`, `credit_card`, `cvv`

### Pattern-Based Sanitization

Detects and masks patterns like:

- Credit card numbers
- Social security numbers
- Email addresses (partial masking)
- API keys and JWT tokens
- Phone numbers

### User ID Hashing

User IDs are automatically hashed for privacy:

```typescript
logger.info('User action', {
  userId: 'user123', // Becomes: user_a1b2c3
});
```

## Performance Monitoring

### Execution Metrics

```typescript
const performanceMetrics = {
  duration: 150, // milliseconds
  memoryBefore: 1024 * 1024, // bytes
  memoryAfter: 1024 * 1024 * 1.2,
  memoryDelta: 1024 * 200,
  cpuUsage: 12.5, // percentage
};

hookLogger.completeExecution(context, true, performanceMetrics);
```

### Automatic Performance Logging

The execution engine automatically logs:

- Execution duration
- Memory usage before/after/delta
- CPU usage
- Phase timing (input, parsing, execution, output)

## Child Loggers and Context

Create child loggers with persistent context:

```typescript
const baseLogger = createLogger('user-service');

// Child logger inherits context
const userLogger = baseLogger.child({
  userId: 'user123',
  sessionId: 'session_abc',
  module: 'authentication',
});

userLogger.info('Login attempt'); // Includes all parent context
userLogger.warn('Invalid password');

// Nested child loggers
const auditLogger = userLogger.child({
  action: 'profile-update',
});
```

## Error Handling

### Structured Error Logging

```typescript
try {
  throw new Error('Database connection failed');
} catch (error) {
  logger.error(error, 'Failed to connect to database', {
    database: 'production',
    retries: 3,
    recovery: 'fallback-to-cache',
  });
}
```

### Error Sanitization

Error objects are automatically sanitized:

- Stack traces only in development
- Error messages sanitized for sensitive data
- Additional error properties included safely

## Log Levels

### Level Hierarchy

1. `error` - Critical errors that need immediate attention
2. `warn` - Warning conditions that should be addressed
3. `info` - General operational messages
4. `debug` - Detailed diagnostic information
5. `trace` - Very detailed diagnostic information

### Level Checking

```typescript
if (logger.isLevelEnabled('debug')) {
  // Expensive debug operations
  const debugData = generateExpensiveDebugData();
  logger.debug('Debug info', debugData);
}
```

## Correlation and Tracing

### Automatic Correlation IDs

Each logger instance gets a unique correlation ID for request tracing:

```typescript
// All logs from this logger will include the same correlationId
const logger = createLogger('api-service');
logger.info('Request started'); // correlationId: uuid-123-abc
logger.info('Processing...'); // correlationId: uuid-123-abc
logger.info('Request completed'); // correlationId: uuid-123-abc
```

### Session Tracking

Hook loggers automatically include session information:

```typescript
const hookLogger = createHookLogger('PreToolUse', 'Bash');
// Includes sessionId from CLAUDE_SESSION_ID environment variable
```

## Production Deployment

### Binary Distribution

In production binaries, the logging system:

- ✅ Uses structured JSON output (no pretty printing)
- ✅ Removes all debug logging
- ✅ Sanitizes all sensitive data
- ✅ Minimizes performance impact
- ✅ Provides observability without security risks

### Configuration for Production

```bash
# Environment variables for production
NODE_ENV=production
LOG_LEVEL=info

# CLI runs with optimized logging
./carabiner generate security-hook
```

### Log Output Format

Production JSON log format:

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "info",
  "message": "Hook execution completed",
  "service": "execution",
  "env": "production",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "event": "PreToolUse",
  "toolName": "Bash",
  "executionId": "exec_1705315800123_a1b2c3",
  "success": true,
  "performance": {
    "duration": "150ms",
    "durationMs": 150,
    "memoryDelta": "0.20MB"
  }
}
```

## Testing

### Test Logger

```typescript
import { createTestLogger, clearLoggerCache } from '@outfitter/hooks-core';

// Silent logger for tests
const logger = createTestLogger('test-service');

// Clear cache between tests
beforeEach(() => {
  clearLoggerCache();
});
```

### Mock Logging in Tests

```typescript
// Enable logging in specific tests
process.env.ENABLE_TEST_LOGS = 'true';
const logger = createTestLogger('test');
logger.info('This will be visible in tests');
```

## Migration from Old System

### Replace Direct Pino Usage

```typescript
// OLD
import pino from 'pino';
const logger = pino({ level: 'debug' });

// NEW
import { createLogger } from '@outfitter/hooks-core';
const logger = createLogger('service-name');
```

### Replace Manual Logger Configuration

```typescript
// OLD
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? { target: 'pino-pretty' } : undefined,
});

// NEW
const logger = createLogger('service-name');
// Configuration is automatic based on environment
```

### Replace Console Logging

```typescript
// OLD
console.log('User action:', userId, action);
console.error('Error occurred:', error);

// NEW
logger.info('User action', { userId, action });
logger.error(error, 'Error occurred');
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
logger.error('Critical system failure'); // For errors requiring immediate action
logger.warn('Deprecated API usage'); // For conditions that should be addressed
logger.info('User logged in'); // For general operational info
logger.debug('Cache hit for key: user:123'); // For diagnostic info
```

### 2. Include Structured Context

```typescript
// GOOD: Structured context
logger.info('File processed', {
  filename: 'document.pdf',
  size: '2.5MB',
  duration: '1.2s',
  pages: 15,
});

// AVOID: String interpolation
logger.info(`Processed file document.pdf (2.5MB) in 1.2s with 15 pages`);
```

### 3. Use Child Loggers for Context

```typescript
// Create child logger for request context
const requestLogger = logger.child({
  requestId: req.id,
  userId: req.user.id,
  endpoint: req.path,
});

// All subsequent logs include context
requestLogger.info('Request validation passed');
requestLogger.info('Database query executed');
requestLogger.info('Response sent');
```

### 4. Handle Errors Properly

```typescript
// Include error object, descriptive message, and context
try {
  await processFile(filename);
} catch (error) {
  logger.error(error, 'File processing failed', {
    filename,
    size: fileSize,
    retry: false,
    fallback: 'skip-file',
  });
}
```

### 5. Use Performance Logging

```typescript
const startTime = Date.now();
const startMemory = process.memoryUsage().heapUsed;

await performOperation();

logger.info('Operation completed', {
  duration: `${Date.now() - startTime}ms`,
  memoryDelta: `${(process.memoryUsage().heapUsed - startMemory) / 1024 / 1024}MB`,
  operation: 'data-processing',
});
```

## Troubleshooting

### Debug Logging Not Visible

```bash
# Enable debug logging
export DEBUG=true
# OR
export LOG_LEVEL=debug
# OR
./cli-command --debug
```

### Pretty Printing Not Working

Pretty printing is only enabled in development mode:

```bash
export NODE_ENV=development
```

### Logs Not Appearing in Tests

Tests are silent by default. Enable with:

```bash
export ENABLE_TEST_LOGS=true
```

### Performance Issues

In production, ensure:

- `NODE_ENV=production` (disables pretty printing)
- `LOG_LEVEL=info` or higher (disables debug logging)
- No dev dependencies in production build

## Advanced Configuration

### Custom Sanitization

```typescript
import { sanitizeForLogging, type SanitizationOptions } from '@outfitter/hooks-core';

const customOptions: SanitizationOptions = {
  removeFields: ['customSecret', 'internalToken'],
  maskFields: ['customerEmail'],
  sensitivePatterns: [/CUSTOM-\d{10}/g],
  maxStringLength: 500,
  maxDepth: 5,
};

const sanitized = sanitizeForLogging(data, customOptions);
```

### Custom Correlation IDs

```typescript
import { generateCorrelationId } from '@outfitter/hooks-core';

const customId = generateCorrelationId();
const logger = createLogger('service').child({ correlationId: customId });
```

## Performance Impact

The logging system is designed for minimal production impact:

- **Zero** debug logging in production builds
- **Zero** pretty printing overhead in production
- **Minimal** serialization cost (native JSON)
- **Efficient** sanitization (compiled patterns)
- **Lazy** child logger creation
- **Cached** logger instances

Typical overhead: < 0.1ms per log statement in production.
