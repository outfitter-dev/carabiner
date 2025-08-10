# Performance Rules

## Build Optimization

### Bun Bundler

```bash
# Production build with optimizations
bun build ./src/index.ts \
  --outdir ./dist \
  --minify \
  --target=bun \
  --splitting \
  --sourcemap=external
```

### Bundle Size Limits

- Set size budgets per package
- Use `size-limit` for monitoring
- Tree-shake unused exports
- Analyze with `bun build --analyze`

### Code Splitting

```typescript
// Dynamic imports for lazy loading
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Route-based splitting
const routes = {
  '/admin': () => import('./pages/admin'),
  '/user': () => import('./pages/user'),
};
```

## Runtime Performance

### Bun-Specific Optimizations

```typescript
// Use Bun's native APIs
const file = Bun.file('./large-file.json');
const data = await file.json(); // Faster than fs.readFile

// Native SQLite
import { Database } from 'bun:sqlite';
const db = new Database('app.db');
```

### Memory Management

- Monitor heap usage in development
- Use `--max-old-space-size` if needed
- Implement object pooling for hot paths
- Clear large objects explicitly

### Async Patterns

```typescript
// Prefer Promise.all for parallel operations
const [users, posts, comments] = await Promise.all([fetchUsers(), fetchPosts(), fetchComments()]);

// Use streaming for large data
const stream = Bun.file('./large.csv').stream();
for await (const chunk of stream) {
  // Process chunk
}
```

## Caching Strategies

### Turbo Cache

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "cache": true
    }
  }
}
```

### HTTP Caching

```typescript
// Cache headers for static assets
app.use('/static', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
});

// ETag for dynamic content
res.setHeader('ETag', `"${contentHash}"`);
```

### In-Memory Caching

```typescript
// Simple LRU cache
class LRUCache<T> {
  private cache = new Map<string, T>();
  private maxSize: number;

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recent)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
}
```

## Database Performance

### Query Optimization

```typescript
// Use indexes effectively
CREATE INDEX idx_user_email ON users(email);

// Batch operations
const users = await db.prepare(
  'INSERT INTO users (name, email) VALUES (?, ?)'
).all(userData);

// Connection pooling
const pool = new DatabasePool({ max: 10 });
```

### N+1 Query Prevention

```typescript
// Bad: N+1 queries
const posts = await getPosts();
for (const post of posts) {
  post.author = await getAuthor(post.authorId);
}

// Good: Single query with join
const posts = await db.query(`
  SELECT p.*, u.name as author_name
  FROM posts p
  JOIN users u ON p.author_id = u.id
`);
```

## Frontend Performance

### React Optimization

```typescript
// Memoize expensive computations
const expensiveValue = useMemo(() => computeExpensive(data), [data]);

// Prevent unnecessary re-renders
const MemoizedComponent = memo(Component, (prev, next) => {
  return prev.id === next.id;
});
```

### Asset Optimization

- Use WebP/AVIF for images
- Implement lazy loading
- Compress assets with Brotli
- Use CDN for static files

## Monitoring

### Performance Metrics

```typescript
// Measure critical paths
const start = performance.now();
await criticalOperation();
const duration = performance.now() - start;

if (duration > 100) {
  console.warn(`Slow operation: ${duration}ms`);
}
```

### APM Integration

- Use OpenTelemetry for tracing
- Monitor P95/P99 latencies
- Track memory usage over time
- Alert on performance regression

## Testing Performance

### Benchmarks

```typescript
// Bun benchmark
import { bench, group } from 'bun:test';

group('string operations', () => {
  bench('concat', () => {
    'hello' + 'world';
  });

  bench('template', () => {
    `hello${'world'}`;
  });
});
```

### Load Testing

```bash
# Use autocannon for HTTP load testing
bunx autocannon -c 100 -d 30 http://localhost:3000
```

## Best Practices

### Avoid Premature Optimization

- Profile first, optimize second
- Focus on algorithmic improvements
- Measure impact of changes
- Keep code readable

### Common Pitfalls

- Avoid synchronous file operations
- Don't block the event loop
- Minimize bundle dependencies
- Reduce network waterfalls
