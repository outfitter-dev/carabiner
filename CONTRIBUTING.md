# Contributing to Carabiner

Thank you for your interest in contributing to Carabiner! This document provides guidelines and instructions for contributing to the project.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our code of conduct: be respectful, inclusive, and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

- **Bun**: v1.2.20 or higher
- **Node.js**: v20 or higher (for compatibility)
- **Git**: For version control

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/carabiner.git
   cd carabiner
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Run Tests**
   ```bash
   bun test
   ```

4. **Build All Packages**
   ```bash
   turbo build
   ```

## 📝 Development Workflow

### Branch Strategy

We use a trunk-based development approach with Graphite for stacking PRs:

- Branch from `main`
- Use descriptive branch names: `feat/`, `fix/`, `docs/`, `chore/`
- Keep branches short-lived (< 3 days)
- Stack related changes using Graphite (`gt` command)

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(api): resolve timeout issue  
docs: update readme
chore: update dependencies
test: add missing tests
```

### Code Quality

All code must pass:

1. **Type Checking**: `bun run typecheck`
2. **Linting**: Automatic via Ultracite/Biome
3. **Tests**: `bun test` with >80% coverage
4. **Build**: `turbo build` must succeed

## 🧪 Testing

### Writing Tests

```typescript
import { test, expect } from 'bun:test';

test('descriptive test name', async () => {
  // Arrange
  const input = createTestInput();
  
  // Act
  const result = await functionUnderTest(input);
  
  // Assert
  expect(result).toBe(expectedValue);
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run with coverage
bun test --coverage

# Run specific package tests
turbo test --filter=@carabiner/hooks-core
```

## 📦 Package Development

### Creating a New Package

1. Create directory: `packages/your-package/`
2. Add `package.json`:
   ```json
   {
     "name": "@carabiner/your-package",
     "version": "0.1.0-alpha",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "test": "bun test",
       "typecheck": "tsc --noEmit"
     }
   }
   ```
3. Add `tsconfig.json` extending root config
4. Implement and test your package

### Package Guidelines

- Keep packages focused and single-purpose
- Export TypeScript types
- Provide comprehensive tests
- Document public APIs with JSDoc
- Follow existing patterns

## 🐛 Reporting Issues

### Before Submitting

1. Search existing issues
2. Check documentation
3. Verify with latest version

### Issue Template

```markdown
## Description
Clear description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. ...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Carabiner version: 
- Bun version:
- OS:
```

## 🎯 Pull Request Process

### Before Submitting

1. **Test Locally**: All tests must pass
2. **Update Docs**: If behavior changes
3. **Add Tests**: For new features
4. **Clean History**: Squash related commits

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Tests pass locally
- [ ] Added new tests
- [ ] Coverage maintained/improved

## Checklist
- [ ] Code follows style guide
- [ ] Self-reviewed
- [ ] Updated documentation
- [ ] No console.logs
```

### Review Process

1. Automated checks run (lint, test, build)
2. CodeRabbit provides initial review
3. Maintainer review
4. Address feedback
5. Merge via squash

## 📚 Documentation

### Where to Document

- **API Changes**: Update JSDoc comments
- **New Features**: Add to README and examples
- **Configuration**: Update docs/configuration.md
- **Breaking Changes**: Add to CHANGELOG

### Documentation Style

- Use clear, concise language
- Include code examples
- Explain "why" not just "what"
- Keep examples runnable

## 🏗️ Architecture Guidelines

### Design Principles

1. **Type Safety First**: No `any` types
2. **Fail Fast**: Validate early
3. **Composition**: Prefer composition over inheritance
4. **Testability**: Design for testing
5. **Performance**: Measure, don't guess

### Code Style

- Use Ultracite/Biome formatting (automatic)
- Prefer functional style where appropriate
- Keep functions small and focused
- Use descriptive variable names
- Comment complex logic

## 🚢 Release Process

We use semantic versioning and automated releases:

1. Changes accumulate on `main`
2. Release PR created with version bumps
3. Packages published to npm
4. GitHub release created

## 💬 Getting Help

- **Discord**: [Join our community](https://discord.gg/carabiner)
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: For bugs and feature requests

## 🙏 Recognition

Contributors are recognized in:
- Release notes
- README acknowledgments
- GitHub contributors list

Thank you for contributing to Carabiner!