# Testing Rules

## Test Philosophy

- **Test everything critical**: Core runtime, execution engine, configuration management
- **Design for testability**: Make illegal states unrepresentable through types
- **Fast feedback loops**: Unit tests <50ms, integration <2s, E2E <5m
- **Test behavior, not implementation**: Refactors shouldn't break tests
- **Coverage is a tool, not a goal**: Focus on meaningful tests over percentage

## Test Runners

### Bun Test (Primary)

- Use `bun test` for all tests by default
- Leverages Bun's speed and built-in features
- No additional dependencies needed
- Supports TypeScript out of the box
- Native coverage support with `--coverage`

### Vitest (When Needed)

- Use for advanced features (UI, snapshots, complex mocking)
- Compatible with Vite ecosystem
- Better watch mode and reporting
- Use `@vitest/coverage-v8` for coverage

## File Conventions

### Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `tests/integration/*.test.ts`
- Edge cases: `tests/edge-cases/*.test.ts`
- Performance tests: `tests/performance/*.test.ts`
- Error path tests: `tests/error-paths/*.test.ts`
- Production tests: `tests/production/*.test.ts`
- Test utilities: `test-utils.ts` or `testing/`

### Location

- **Unit tests**: Co-located with source files
- **Integration tests**: `tests/integration/` at monorepo root
- **Other test categories**: `tests/` subdirectories at monorepo root
- **Shared utilities**: Package-level `test-utils/` directories

## Test Structure

### Bun Test Pattern

```typescript
import { describe, expect, test, beforeEach, afterAll } from 'bun:test';

describe('FeatureName', () => {
  beforeEach(() => {
    // Setup - runs before each test
  });

  afterAll(() => {
    // Cleanup - runs after all tests
  });

  describe('Happy Path', () => {
    test('should handle valid input correctly', async () => {
      // Arrange
      const input = createValidInput();
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Error Cases', () => {
    test('should handle invalid input gracefully', async () => {
      // Arrange
      const invalidInput = null;
      
      // Act & Assert
      await expect(functionUnderTest(invalidInput))
        .rejects.toThrow('Invalid input');
    });
  });
});
```

### TypeScript in Tests

- Use strict types in tests too
- Type test fixtures and mocks properly
- Leverage `satisfies` for type safety
- Use `@types/bun` for Bun test types
- Never use `any` - even in tests

## Testing Categories

### 1. Unit Tests (`**/*.test.ts`)
- **Coverage**: Individual functions and classes
- **Timeout**: 5 seconds
- **Execution**: Parallel
- **Focus**: Business logic, utilities, pure functions
- **Target**: >90% line coverage

### 2. Integration Tests (`tests/integration/`)
- **Coverage**: Cross-package workflows
- **Timeout**: 30 seconds
- **Execution**: Sequential (to avoid conflicts)
- **Focus**: Package boundaries and data flow
- **Examples**: hooks-cli → hooks-config → hooks-core

### 3. Edge Case Tests (`tests/edge-cases/`)
- **Coverage**: Boundary conditions and unusual inputs
- **Timeout**: 60 seconds
- **Scenarios**:
  - Large JSON payloads (>1MB)
  - Unusual character encodings (UTF-8, UTF-16, binary)
  - Memory pressure situations
  - Deep nesting and complex data structures

### 4. Performance Tests (`tests/performance/`)
- **Coverage**: Performance benchmarks and memory usage
- **Timeout**: 2 minutes
- **Targets**:
  - Hook execution performance (<5ms average)
  - Concurrent execution (50+ parallel hooks)
  - Memory leak detection
  - Startup time measurements

### 5. Error Path Tests (`tests/error-paths/`)
- **Coverage**: Error handling and failure scenarios
- **Timeout**: 30 seconds
- **Scenarios**:
  - Invalid input validation
  - Timeout handling
  - Resource exhaustion
  - Security violations
  - Network failures

### 6. Production Tests (`tests/production/`)
- **Coverage**: Real-world production scenarios
- **Timeout**: 3 minutes
- **Validation**:
  - Binary distribution testing
  - Cross-platform compatibility
  - Production logging verification
  - Security hardening validation
  - Enterprise configuration patterns

## Coverage Requirements

### Critical Paths (100% Coverage Required)
- `packages/hooks-core/src/runtime.ts`
- `packages/execution/src/executor.ts`
- `packages/hooks-core/src/logging/logger.ts`
- `packages/hooks-config/src/config.ts`

### Package-Specific Targets

| Package | Line Coverage | Function Coverage | Branch Coverage |
|---------|---------------|-------------------|-----------------|
| hooks-core | >95% | >98% | >90% |
| execution | >90% | >95% | >85% |
| hooks-config | >90% | >95% | >85% |
| hooks-cli | >85% | >90% | >80% |
| types | >95% | >98% | >90% |
| protocol | >90% | >95% | >85% |

### Running Coverage

```bash
# Bun native coverage
bun test --coverage

# With HTML report
bun test --coverage --coverage-reporter=html

# Vitest coverage
vitest run --coverage

# Full test suite with coverage
bun run test:coverage
```

## Testing Patterns

### Arrange-Act-Assert

```typescript
test('user can perform action', () => {
  // Arrange - Set up test data
  const user = createMockUser();
  const input = createValidInput();

  // Act - Perform the action
  const result = performAction(user, input);

  // Assert - Verify the outcome
  expect(result.success).toBe(true);
  expect(result.userId).toBe(user.id);
});
```

### Test Isolation

- Each test must be independent
- Clean up side effects in `afterEach`
- Use fresh fixtures for each test
- Avoid shared mutable state
- Reset global state between tests

### Error Testing

```typescript
test('should handle errors gracefully', async () => {
  // Test the error path explicitly
  const badInput = { invalid: true };
  
  // Verify error is thrown
  await expect(riskyOperation(badInput))
    .rejects.toThrow(ValidationError);
  
  // Verify error details
  try {
    await riskyOperation(badInput);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.details).toContain('invalid');
  }
});
```

## Mocking Strategy

### Bun Mocks

```typescript
import { mock, spyOn } from 'bun:test';

// Function mocks
const mockedFn = mock(() => 'mocked');
expect(mockedFn).toHaveBeenCalled();
expect(mockedFn).toHaveBeenCalledWith(expectedArg);

// Module spying
const spy = spyOn(console, 'log');
// ... code that calls console.log
expect(spy).toHaveBeenCalledTimes(1);
```

### Module Mocking Rules

- Mock at module boundaries only
- Use dependency injection when possible
- Never mock implementation details
- Mock external services, not internal modules
- Provide type-safe mocks

```typescript
// Good: Mock external dependency
const mockApiClient = {
  fetch: mock((url: string) => Promise.resolve({ data: 'test' }))
} satisfies ApiClient;

// Bad: Mocking internal implementation
// Don't mock private methods or internal utilities
```

## Test Utilities

### Test Workspace Management

```typescript
class TestWorkspace {
  private tempDir: string;
  
  async setup(): Promise<void> {
    this.tempDir = await createTempDirectory();
  }
  
  createHooksConfig(config: HookConfiguration): string {
    const path = join(this.tempDir, '.hooks/config.ts');
    writeFileSync(path, generateConfig(config));
    return path;
  }
  
  createHookFile(filename: string, content: string): string {
    const path = join(this.tempDir, '.hooks', filename);
    writeFileSync(path, content);
    return path;
  }
  
  async cleanup(): Promise<void> {
    await rm(this.tempDir, { recursive: true });
  }
}
```

### Performance Benchmarking

```typescript
import { bench, group } from 'bun:test';

group('hook execution performance', () => {
  bench('single hook', async () => {
    await executeHook(simpleHook);
  });
  
  bench('parallel hooks', async () => {
    await Promise.all(hooks.map(executeHook));
  });
  
  bench('sequential hooks', async () => {
    for (const hook of hooks) {
      await executeHook(hook);
    }
  });
});
```

### Error Simulation

```typescript
class ErrorSimulator {
  static createTimeoutHandler(delayMs: number): HookHandler {
    return async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      throw new Error('Operation timed out');
    };
  }
  
  static createUnreliableHandler(failureRate: number): HookHandler {
    return async () => {
      if (Math.random() < failureRate) {
        throw new Error('Random failure');
      }
      return { success: true };
    };
  }
  
  static createMemoryLeakHandler(): HookHandler {
    const leakedData: any[] = [];
    return async () => {
      // Intentionally leak memory for testing
      leakedData.push(new Array(1000000).fill('leak'));
      return { size: leakedData.length };
    };
  }
}
```

## Performance Testing

### Benchmarks

```typescript
import { bench, group } from 'bun:test';

group('critical operations', () => {
  bench('hook parsing', () => {
    parseHookConfiguration(complexConfig);
  });
  
  bench('hook execution', async () => {
    await executeHook(standardHook);
  });
  
  // Set baseline expectations
  bench('must be under 5ms', async () => {
    const start = performance.now();
    await criticalOperation();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5);
  });
});
```

### Memory Testing

```typescript
test('should not leak memory', async () => {
  const initialMemory = process.memoryUsage().heapUsed;
  
  // Run operation multiple times
  for (let i = 0; i < 1000; i++) {
    await operation();
  }
  
  // Force garbage collection (if available)
  if (global.gc) global.gc();
  
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryGrowth = finalMemory - initialMemory;
  
  // Allow some growth but not excessive
  expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

## Security Testing

### Security Validation Scenarios

```typescript
describe('Security', () => {
  test('prevents path traversal', async () => {
    const maliciousPath = '../../../etc/passwd';
    await expect(loadFile(maliciousPath))
      .rejects.toThrow('Invalid path');
  });
  
  test('prevents command injection', async () => {
    const maliciousInput = '; rm -rf /';
    const result = await executeCommand(maliciousInput);
    expect(result.sanitized).toBe(true);
  });
  
  test('sanitizes user input', () => {
    const xssAttempt = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(xssAttempt);
    expect(sanitized).not.toContain('<script>');
  });
  
  test('validates permissions', async () => {
    const unprivilegedUser = createUser({ role: 'guest' });
    await expect(performAdminAction(unprivilegedUser))
      .rejects.toThrow('Insufficient permissions');
  });
  
  test('prevents secret exposure', () => {
    const config = { apiKey: 'secret123', data: 'public' };
    const logged = prepareForLogging(config);
    expect(logged.apiKey).toBe('[REDACTED]');
    expect(logged.data).toBe('public');
  });
});
```

## Cross-Platform Testing

### Platform Matrix

- **Linux**: Ubuntu Latest (Primary CI)
- **macOS**: macOS Latest
- **Windows**: Windows Latest
- **Node.js**: 18.x, 20.x, 21.x
- **Bun**: Latest stable

### Platform-Specific Tests

```typescript
import { platform } from 'os';

describe('Path handling', () => {
  test('handles platform-specific paths', () => {
    const separator = platform() === 'win32' ? '\\' : '/';
    const path = joinPath('folder', 'file.txt');
    expect(path).toContain(separator);
  });
  
  test('normalizes line endings', () => {
    const text = 'line1\r\nline2\nline3';
    const normalized = normalizeLineEndings(text);
    const expectedEnding = platform() === 'win32' ? '\r\n' : '\n';
    expect(normalized).toContain(expectedEnding);
  });
});
```

## Test Commands

### Quick Commands

```bash
# Run all unit and integration tests
bun run test

# Run comprehensive test suite
bun run test:comprehensive

# Run with coverage
bun run test:coverage

# Run specific category
bun run test:performance
bun run test:production
bun run test:edge-cases
bun run test:security

# Run full test suite (all categories)
bun run test:full

# Watch mode for development
bun test --watch
```

### Environment-Specific Testing

```bash
# Development (fast feedback)
NODE_ENV=development bun run test:comprehensive

# CI/CD (complete validation)
CI=true bun run test:full

# Production (thorough validation)
NODE_ENV=production bun run test:production

# Debug mode
DEBUG=* bun test

# Specific package
bun test packages/hooks-core
```

## CI/CD Integration

### GitHub Actions Pipeline

```yaml
# Quick validation on every PR
on: pull_request
jobs:
  quick-test:
    runs-on: ubuntu-latest
    steps:
      - run: bun test
      - run: bun run typecheck
      - run: bun run lint

# Comprehensive testing on main branch
on:
  push:
    branches: [main]
jobs:
  full-test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - run: bun run test:full
      - run: bun run test:coverage
```

### Quality Gates

1. **PR Requirements**: Unit + Integration tests passing
2. **Main Branch**: Comprehensive test suite passing
3. **Release Candidate**: Full test suite + Production scenarios
4. **Production Release**: All categories + Security validation

## Best Practices

### DO's

- ✅ Write tests before or alongside code (TDD/BDD)
- ✅ Test edge cases and error conditions
- ✅ Use descriptive test names that explain the scenario
- ✅ Keep tests simple and focused on one thing
- ✅ Use test fixtures and factories for consistency
- ✅ Clean up resources in afterEach/afterAll
- ✅ Run tests locally before pushing
- ✅ Test the public API, not implementation details
- ✅ Use snapshot testing sparingly and review changes
- ✅ Profile tests to ensure they're fast

### DON'Ts

- ❌ Don't test third-party library internals
- ❌ Don't use real network calls in unit tests
- ❌ Don't depend on test execution order
- ❌ Don't ignore flaky tests - fix them
- ❌ Don't use magic numbers - use named constants
- ❌ Don't test private methods directly
- ❌ Don't skip tests without documenting why
- ❌ Don't use production credentials in tests
- ❌ Don't let tests become outdated
- ❌ Don't sacrifice test quality for coverage percentage

## Debugging Failed Tests

### Local Debugging

```bash
# Run specific test file
bun test path/to/specific.test.ts

# Run tests matching pattern
bun test --test-name-pattern="should handle"

# Debug with inspector
bun test --inspect

# Verbose output
bun test --verbose

# Stop on first failure
bun test --bail
```

### Common Issues

1. **Timeout Issues**: Increase timeout or optimize code
2. **Flaky Tests**: Add retries or fix race conditions
3. **Memory Leaks**: Check cleanup and circular references
4. **Platform Differences**: Use platform-specific expectations
5. **Async Issues**: Ensure proper await usage

## Test Reporting

### Generated Reports

1. **test-results.json**: Machine-readable results
2. **test-results.html**: Human-readable HTML report
3. **coverage-summary.json**: Coverage data
4. **junit.xml**: CI/CD compatible results

### Coverage Reports

- Line-by-line coverage highlighting
- Function coverage analysis
- Branch coverage visualization
- Uncovered code identification
- Trend analysis over time

## Success Metrics

### Release Readiness

- ✅ >90% test coverage achieved
- ✅ All critical paths at 100% coverage
- ✅ Performance benchmarks within targets
- ✅ Production scenarios validated
- ✅ Security scans clean
- ✅ Cross-platform compatibility confirmed
- ✅ No flaky tests
- ✅ All tests run in <5 minutes total

## Quick Reference

### Test Timeout Guide

| Test Type | Timeout | Parallel | When to Use |
|-----------|---------|----------|-------------|
| Unit | 5s | Yes | Pure functions, utilities |
| Integration | 30s | No | Cross-package flows |
| Edge Case | 60s | Yes | Boundary conditions |
| Performance | 2m | No | Benchmarks, profiling |
| E2E | 5m | No | Full user journeys |

### Coverage Quick Check

```bash
# Check if coverage meets requirements
bun test --coverage | grep "All files" | awk '{
  if ($3 < 90) print "❌ Coverage too low: " $3 "%";
  else print "✅ Coverage acceptable: " $3 "%"
}'
```

### Test Data Generators

```typescript
// Generate test data consistently
const testUser = () => ({
  id: crypto.randomUUID(),
  email: `test-${Date.now()}@example.com`,
  name: 'Test User'
});

const testConfig = (overrides = {}) => ({
  timeout: 5000,
  retries: 3,
  ...overrides
});
```