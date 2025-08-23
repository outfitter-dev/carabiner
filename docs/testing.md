# Testing Guide

This guide covers how to write and run tests for the Carabiner monorepo, a TypeScript library for building type-safe Claude Code hooks.

## Quick Start

### Running Tests

The most common test commands you'll need:

```bash
# Run all tests
bun run test

# Run tests with coverage report
bun run test:coverage

# Run tests in watch mode during development
bun test --watch

# Run tests for a specific package
bun test packages/hooks-core
```

## Test Categories

Carabiner uses a comprehensive testing strategy with six distinct test categories:

### Unit Tests

Located alongside source files (`*.test.ts`), these test individual functions and classes in isolation.

```bash
# Run only unit tests
bun test --test-name-pattern="unit"
```

### Integration Tests

Located in `tests/integration/`, these verify that different packages work together correctly.

```bash
# Run integration tests
bun run test:integration
```

### Edge Case Tests

Located in `tests/edge-cases/`, these test boundary conditions like large payloads, unusual encodings, and memory pressure.

```bash
# Run edge case tests
bun run test:edge-cases
```

### Performance Tests

Located in `tests/performance/`, these ensure the system meets performance requirements.

```bash
# Run performance benchmarks
bun run test:performance
```

### Error Path Tests

Located in `tests/error-paths/`, these verify proper error handling and graceful failure.

```bash
# Run error path tests
bun run test:error-paths
```

### Production Tests

Located in `tests/production/`, these validate real-world scenarios including binary distribution and cross-platform compatibility.

```bash
# Run production tests
bun run test:production
```

## Writing Tests

### Basic Test Structure

Tests use Bun's built-in test runner with a familiar syntax:

```typescript
import { describe, test, expect } from 'bun:test';

describe('MyFeature', () => {
  test('should work correctly', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Testing Async Code

```typescript
test('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

test('should reject with error', async () => {
  await expect(failingAsyncFunction()).rejects.toThrow('Expected error message');
});
```

### Using Test Fixtures

Create consistent test data using factory functions:

```typescript
// test-utils.ts
export const createTestUser = () => ({
  id: crypto.randomUUID(),
  email: `test-${Date.now()}@example.com`,
  name: 'Test User',
});

// my-feature.test.ts
import { createTestUser } from './test-utils';

test('should process user', () => {
  const user = createTestUser();
  const result = processUser(user);
  expect(result.userId).toBe(user.id);
});
```

### Mocking Dependencies

```typescript
import { mock } from 'bun:test';

test('should call external service', async () => {
  const mockFetch = mock(() => Promise.resolve({ data: 'test' }));

  const service = new MyService({ fetch: mockFetch });
  await service.getData();

  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://api.example.com');
});
```

## Test Organization

### File Naming Conventions

- **Unit tests**: `feature.test.ts` or `feature.spec.ts`
- **Integration tests**: `feature.integration.test.ts`
- **Test utilities**: `test-utils.ts` or `testing/helpers.ts`

### Directory Structure

```
packages/
  hooks-core/
    src/
      runtime.ts
      runtime.test.ts      # Unit test co-located with source
    test-utils/           # Package-specific test utilities
tests/
  integration/            # Cross-package integration tests
  edge-cases/            # Boundary condition tests
  performance/           # Performance benchmarks
  error-paths/          # Error handling tests
  production/           # Production scenario tests
```

## Coverage Requirements

### Viewing Coverage Reports

```bash
# Generate coverage report
bun test --coverage

# Generate HTML coverage report
bun test --coverage --coverage-reporter=html
# Open coverage/index.html in your browser
```

### Coverage Targets

Different packages have different coverage requirements:

- **Core packages** (hooks-core, execution): >90% line coverage
- **Configuration packages**: >90% line coverage
- **CLI packages**: >85% line coverage
- **Type definition packages**: >95% line coverage

Critical paths require 100% coverage:

- Runtime execution
- Configuration loading
- Error handling
- Security validation

## Debugging Tests

### Running Specific Tests

```bash
# Run a single test file
bun test path/to/specific.test.ts

# Run tests matching a pattern
bun test --test-name-pattern="should handle errors"

# Stop on first failure
bun test --bail
```

### Debugging with Inspector

```bash
# Run tests with debugger
bun test --inspect

# Then connect with Chrome DevTools or VS Code debugger
```

### Verbose Output

```bash
# See detailed test output
bun test --verbose
```

## CI/CD Integration

Tests run automatically in GitHub Actions:

- **Pull Requests**: Unit and integration tests must pass
- **Main Branch**: Full test suite including performance tests
- **Releases**: All tests plus security scanning

### Running CI Tests Locally

```bash
# Run the same tests as CI
CI=true bun run test:full

# Run quick PR validation
bun run test:ci
```

## Performance Testing

### Writing Benchmarks

```typescript
import { bench, group } from 'bun:test';

group('performance', () => {
  bench('fast operation', () => {
    performFastOperation();
  });

  bench('slow operation', () => {
    performSlowOperation();
  });
});
```

### Running Benchmarks

```bash
# Run all benchmarks
bun run test:performance

# Compare results over time
bun run test:performance --json > results.json
```

## Common Testing Patterns

### Testing Error Conditions

```typescript
test('should validate input', async () => {
  // Test invalid input
  await expect(myFunction(null)).rejects.toThrow('Input cannot be null');

  // Test specific error type
  try {
    await myFunction(invalidData);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe('INVALID_INPUT');
  }
});
```

### Testing Event Emitters

```typescript
test('should emit events', async () => {
  const emitter = new MyEmitter();
  const handler = mock();

  emitter.on('data', handler);
  emitter.process('test');

  expect(handler).toHaveBeenCalledWith({ data: 'test' });
});
```

### Testing with Timeouts

```typescript
test(
  'should timeout appropriately',
  async () => {
    const promise = operationWithTimeout(1000);

    // Fast-forward time
    await Bun.sleep(1100);

    await expect(promise).rejects.toThrow('Operation timed out');
  },
  { timeout: 2000 },
); // Test timeout
```

## Best Practices

### DO's

- ✅ Write tests as you develop features
- ✅ Keep tests simple and focused
- ✅ Use descriptive test names
- ✅ Clean up resources after tests
- ✅ Test both success and failure cases
- ✅ Run tests before committing

### DON'Ts

- ❌ Don't test implementation details
- ❌ Don't use production data in tests
- ❌ Don't ignore flaky tests
- ❌ Don't skip tests without explanation
- ❌ Don't mock everything

## Troubleshooting

### Common Issues

**Tests timing out**

- Increase the timeout: `test('slow test', async () => {...}, { timeout: 10000 })`
- Check for missing `await` statements
- Verify async operations complete

**Flaky tests**

- Ensure proper test isolation
- Use fixed timestamps/random seeds
- Check for race conditions

**Coverage gaps**

- Run `bun test --coverage` to identify untested code
- Focus on error paths and edge cases
- Consider if the code needs testing or removal

## Additional Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://testingjavascript.com/)
- [Contributing Guide](../CONTRIBUTING.md)

## Getting Help

If you encounter issues:

1. Check the [troubleshooting guide](./troubleshooting.md)
2. Search existing [GitHub issues](https://github.com/outfitter-dev/carabiner/issues)
3. Ask in discussions or create a new issue

Remember: Good tests make refactoring safe and development faster!
