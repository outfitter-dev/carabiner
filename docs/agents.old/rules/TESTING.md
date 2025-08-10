# Testing Rules

## Test Runners

### Bun Test (Primary)

- Use `bun test` for unit tests by default
- Leverages Bun's speed and built-in features
- No additional dependencies needed
- Supports TypeScript out of the box

### Vitest (When Needed)

- Use for advanced features (UI, snapshots, complex mocking)
- Compatible with Vite ecosystem
- Better watch mode and reporting
- Use `@vitest/coverage-v8` for coverage

## File Conventions

### Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`
- Test utilities: `test-utils.ts` or `testing/`

### Location

- Colocate tests with source files
- Alternative: `__tests__/` directories
- E2E tests in `tests/` at package root
- Shared test utilities in `test-utils/`

## Test Structure

### Bun Test Pattern

```typescript
import { describe, expect, test, beforeEach } from 'bun:test';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  test('should handle specific case', () => {
    expect(result).toBe(expected);
  });
});
```

### TypeScript in Tests

- Use strict types in tests too
- Type test fixtures and mocks
- Leverage `satisfies` for type safety
- Use `@types/bun` for Bun test types

## Testing Patterns

### Arrange-Act-Assert

```typescript
test('user can login', () => {
  // Arrange
  const user = createMockUser();

  // Act
  const result = login(user);

  // Assert
  expect(result.success).toBe(true);
});
```

### Test Isolation

- Each test should be independent
- Clean up side effects in `afterEach`
- Use fresh fixtures for each test
- Avoid shared mutable state

## Mocking Strategy

### Bun Mocks

```typescript
import { mock } from 'bun:test';

const mockedFn = mock(() => 'mocked');
expect(mockedFn).toHaveBeenCalled();
```

### Module Mocking

- Mock at module boundaries
- Use dependency injection when possible
- Avoid mocking implementation details
- Mock external services, not internal modules

## Coverage Requirements

### Thresholds

- Minimum 80% coverage for utilities
- 90% for critical business logic
- Exclude generated files
- Focus on branch coverage

### Running Coverage

```bash
# Bun native coverage
bun test --coverage

# Vitest coverage
vitest run --coverage
```

## Performance Testing

### Benchmarks

```typescript
import { bench, group } from 'bun:test';

group('array methods', () => {
  bench('map', () => {
    [1, 2, 3].map((x) => x * 2);
  });
});
```

### Load Testing

- Use Bun's speed for stress tests
- Test with production-like data
- Monitor memory usage
- Set performance budgets

## E2E Testing

### Tools

- Playwright for browser testing
- Bun test for API testing
- Real database for integration tests
- Docker for test environments

### Best Practices

- Test user journeys, not implementation
- Use data-testid attributes
- Parallel test execution
- Retry flaky tests sparingly
