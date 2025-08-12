# Security Rules

## Environment Variables

### Storage

- Never commit `.env` files
- Use `.env.example` for documentation
- Store secrets in CI/CD secret stores
- Use platform environment variables in production

### Access Patterns

```typescript
// Type-safe environment access
const env = {
  API_KEY: process.env.API_KEY!,
  DATABASE_URL: process.env.DATABASE_URL!,
} satisfies Record<string, string>;

// Validate at startup
if (!env.API_KEY) {
  throw new Error('API_KEY is required');
}
```

### Bun Environment

```typescript
// Bun provides typed env access
if (Bun.env.NODE_ENV === 'production') {
  // Production-only code
}
```

## Dependency Security

### Package Auditing

```bash

# Check for vulnerabilities

bun audit

# Update dependencies safely

bun update --save

```

### Lock File Security

- Always commit `bun.lockb`
- Use `--frozen-lockfile` in CI
- Review lock file changes in PRs
- Pin dependencies for security patches

### Third-Party Packages

- Verify package authenticity
- Check weekly download counts
- Review maintenance status
- Prefer packages with TypeScript types

## Authentication Patterns

### Token Storage

- Use secure HTTP-only cookies
- Implement token rotation
- Set appropriate expiration
- Never store tokens in localStorage

### Password Handling

```typescript
// Use Bun's built-in password hashing
const hashedPassword = await Bun.password.hash(password);
const isValid = await Bun.password.verify(password, hashedPassword);
```

### Session Management

- Use secure session stores
- Implement CSRF protection
- Set secure cookie flags
- Regular session cleanup

## API Security

### Input Validation

```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
});

// Validate all inputs
const validated = userSchema.parse(untrustedInput);
```

### Rate Limiting

- Implement per-IP rate limits
- Use sliding window algorithm
- Different limits per endpoint
- Return 429 status appropriately

### CORS Configuration

```typescript
// Strict CORS for production
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  credentials: true,
  optionsSuccessStatus: 200,
};
```

## Data Protection

### Encryption

- Encrypt sensitive data at rest
- Use TLS for data in transit
- Implement field-level encryption
- Secure key management

### SQL Injection Prevention

```typescript
// Always use parameterized queries
const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

// Never concatenate user input
// BAD: `WHERE id = ${userId}`
```

### XSS Prevention

- Sanitize all user input
- Use Content Security Policy
- Escape HTML entities
- Validate on both client and server

## TypeScript Security

### Type Safety

```typescript
// Use branded types for sensitive data
type UserId = string & { __brand: 'UserId' };
type ApiKey = string & { __brand: 'ApiKey' };

// Prevents mixing up sensitive parameters
function authenticate(userId: UserId, apiKey: ApiKey) {
  // Type-safe implementation
}
```

### Strict Null Checks

- Enable `strictNullChecks`
- Handle all error cases
- No unsafe type assertions
- Validate external data

## Error Handling

### Information Disclosure

```typescript
// Production error handler
if (process.env.NODE_ENV === 'production') {
  // Generic error message
  return { error: 'An error occurred' };
} else {
  // Detailed error in development
  return { error: err.message, stack: err.stack };
}
```

### Logging

- Never log sensitive data
- Sanitize error messages
- Use structured logging
- Implement log rotation

## Build Security

### Source Maps

- Disable source maps in production
- Use private source map hosting
- Implement access controls
- Monitor for exposed maps

### Bundle Analysis

```bash

# Check bundle for secrets

bun build --analyze

# Scan for exposed keys

grep -r "sk_" dist/

```

## Security Headers

### Essential Headers

```typescript
// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
```
