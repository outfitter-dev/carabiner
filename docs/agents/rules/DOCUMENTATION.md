# Documentation Rules

## README Standards

### Package README Structure

````markdown
# Package Name

Brief description of what this package does.

## Installation

```bash
bun add @org/package-name
```

## Usage

```typescript
import { feature } from '@org/package-name';

// Basic example
const result = feature(options);
```

## API Reference

### `feature(options: Options): Result`

Description of the function.

**Parameters:**

- `options` - Configuration object
  - `option1` - Description
  - `option2` - Description

**Returns:** Description of return value

## TypeScript

Full TypeScript support with exported types.

```typescript
import type { Options, Result } from '@org/package-name';
```

## License

MIT
````

### App README Structure

- Project overview
- Prerequisites
- Environment setup
- Development instructions
- Deployment guide
- Architecture decisions

## Code Documentation

### JSDoc Standards

````typescript
/**
 * Processes user authentication with OAuth provider
 *
 * @param provider - OAuth provider name (github, google)
 * @param credentials - User credentials object
 * @returns Promise resolving to authenticated user
 * @throws {AuthError} When authentication fails
 *
 * @example
 * ```ts
 * const user = await authenticate('github', {
 *   token: 'ghp_xxxx'
 * });
 * ```
 */
export async function authenticate(
  provider: OAuthProvider,
  credentials: Credentials,
): Promise<User> {
  // Implementation
}
````

### Type Documentation

```typescript
/**
 * Configuration options for the API client
 */
export interface ApiConfig {
  /** Base URL for API requests */
  baseUrl: string;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Custom headers to include with each request */
  headers?: Record<string, string>;

  /** Enable request/response logging */
  debug?: boolean;
}
```

## API Documentation

### TypeDoc Configuration

```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs",
  "plugin": ["typedoc-plugin-markdown"],
  "githubPages": false,
  "readme": "README.md",
  "excludePrivate": true,
  "excludeInternal": true
}
```

### Documentation Generation

```bash
# Generate HTML docs
bunx typedoc

# Generate Markdown docs
bunx typedoc --plugin typedoc-plugin-markdown
```

## Changelog Management

### Changeset Usage

```bash
# Add a changeset
bunx changeset add

# Version packages
bunx changeset version

# Publish packages
bunx changeset publish
```

### Changelog Format

```markdown
# Changelog

## 2.0.0

### Major Changes

- **Breaking:** Renamed `process()` to `transform()`
- **Breaking:** Removed deprecated `legacyMode` option

### Minor Changes

- Added support for streaming transforms
- New `batch()` method for bulk operations

### Patch Changes

- Fixed memory leak in transform pipeline
- Improved error messages for invalid input
```

## Architecture Documentation

### Decision Records (ADR)

```markdown
# ADR-001: Use Bun as Runtime

## Status

Accepted

## Context

We need a fast JavaScript runtime that supports TypeScript natively.

## Decision

Use Bun instead of Node.js for better performance and developer experience.

## Consequences

- Faster test execution
- Native TypeScript support
- Some Node.js packages may be incompatible
```

### Diagrams

- Use Mermaid for architecture diagrams
- ASCII diagrams for simple flows
- Link to Figma/Excalidraw for complex visuals
- Keep diagrams versioned with code

## Inline Documentation

### Component Documentation

````typescript
/**
 * Button component with multiple variants
 *
 * @component
 * @example
 * ```tsx
 * <Button variant="primary" size="large">
 *   Click me
 * </Button>
 * ```
 */
export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  ...props
}) => {
  // Implementation
};
````

### Complex Logic

```typescript
// Calculate the fibonacci sequence using dynamic programming
// Time complexity: O(n), Space complexity: O(1)
function fibonacci(n: number): number {
  if (n <= 1) return n;

  let prev = 0;
  let curr = 1;

  // Use iteration instead of recursion to avoid stack overflow
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }

  return curr;
}
```

## Documentation Tools

### Documentation Site

- Use Astro Starlight for comprehensive docs

## Best Practices

### Writing Style

- Use active voice
- Keep sentences concise
- Include practical examples
- Explain the "why" not just "how"

### Maintenance

- Update docs with code changes
- Review docs in PRs
- Test code examples
- Keep dependencies current
