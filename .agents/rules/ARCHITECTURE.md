# Architecture Rules

## TypeScript Configuration

- **Strict Mode**: Full strict checks enabled including `noUncheckedIndexedAccess`
- **Module Resolution**: Bundler mode with `.ts` extension imports allowed
- **Target**: ESNext with Bun globals available

## Code Standards (via Ultracite/Biome)

- Biome configuration extends Ultracite ruleset - do not modify without good reason
- Automatic formatting and linting on pre-commit
- Conventional commit messages enforced via commitlint

## Testing Strategy

- Bun's built-in test runner is the primary choice
- Vitest available as fallback for advanced features
- Tests run in parallel by default, sequential in CI
- Coverage reports generated in `coverage/` directory
