# Package Development Rules

## Package Structure

### Directory Layout

````text

packages/
├── package-name/
│   ├── src/
│   │   └── index.ts
│   ├── dist/            # Build output
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── CHANGELOG.md

```text

### Naming Conventions

- **Internal packages**: Simple names (`utils`, `ui`, `config`)
- **Published packages**: Scoped names (`@org/package-name`)
- **Kebab-case**: Always use kebab-case for package names
- **Descriptive**: Name should clearly indicate purpose

## Package.json Requirements

### Essential Fields

```json
{
  "name": "@org/package-name",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target node",
    "dev": "bun build ./src/index.ts --outdir ./dist --watch",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  }
}

```text

### Dependencies

- Use `workspace:*` for internal dependencies
- Pin external dependencies to exact versions
- Separate `dependencies` from `devDependencies`
- Use `peerDependencies` for framework requirements

## TypeScript Configuration

### Package tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}

```text

### Type Exports

- Always generate `.d.ts` files
- Include source maps for debugging
- Export all public types
- Use `export type` for type-only exports

## Build Configuration

### Bun Build

```bash
bun build ./src/index.ts \
  --outdir ./dist \
  --target node \
  --format esm \
  --minify \
  --sourcemap

```text

### Build Outputs

- ESM format by default
- Include source maps
- Minify for production
- Tree-shake unused code

## Export Patterns

### Index Exports

```typescript
// Explicit exports (preferred)
export { functionA } from './module-a';
export { functionB } from './module-b';
export type { TypeA } from './types';

// Avoid barrel exports
// export * from './module';

```text

### Package Exports Field

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./utils": "./dist/utils.js",
    "./types": "./dist/types.d.ts"
  }
}

```text

## Versioning Strategy

### Semantic Versioning

- MAJOR: Breaking changes
- MINOR: New features (backwards compatible)
- PATCH: Bug fixes

### Changesets

- Create changeset for each change
- Use conventional commit messages
- Group related changes
- Clear, user-facing descriptions

## Documentation

### README Requirements

- Package description and purpose
- Installation instructions
- Basic usage examples
- API documentation
- TypeScript usage

### API Documentation

- JSDoc comments for public APIs
- Examples in comments
- Type information
- Deprecation notices

## Testing

### Test Coverage

- Minimum 80% coverage
- Test all exported functions
- Test TypeScript types
- Integration tests for complex packages

### Test Location

```text

packages/package-name/
├── src/
│   ├── index.ts
│   └── index.test.ts    # Colocated tests
└── tests/               # Integration tests

```text

## Publishing

### Pre-publish Checks

1. Run `publint` for package quality
2. Build and typecheck
3. Run all tests
4. Update CHANGELOG.md
5. Verify exports work

### NPM Scripts

```json
{
  "prepublishOnly": "bun run build && bun run test",
  "postpublish": "git push --follow-tags"
}

```text
````
