# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha] - 2025-08-28

### 🎉 Initial Alpha Release

First public release of Carabiner - a type-safe hooks framework for AI assistants.

### Added

#### Core Features
- **Type-Safe Hook System**: Full TypeScript support with compile-time validation
- **Multiple APIs**: Function-based, Builder pattern, and Declarative approaches
- **Event Support**: PreToolUse, PostToolUse, PreResponse, PostResponse, OnError
- **Hook Registry**: Centralized registration and management
- **Execution Engine**: Efficient hook execution with timeout support

#### Security
- **File Access Validator**: Protect sensitive files and patterns
- **Git Safety Validator**: Enforce git best practices
- **Environment-Specific Protections**: Different rules for dev/prod

#### Testing
- **Mock Framework**: Complete testing utilities
- **Mock Context Creation**: Easy test setup
- **Mock Registry**: Deterministic test execution
- **Coverage Support**: Built-in coverage reporting

#### Pre-Built Hooks
- **Markdown Formatter**: Auto-format markdown files
- **Security Scanner**: Validate file operations
- **Test Runner**: Auto-run tests after changes
- **Git Validator**: Enforce commit standards

#### Developer Experience
- **Full IntelliSense Support**: Complete IDE integration
- **Comprehensive Documentation**: Getting started guide and API docs
- **Example Implementations**: Ready-to-use examples
- **Monorepo Structure**: Clean package organization

### Packages Released

- `@carabiner/types` - Type definitions and interfaces
- `@carabiner/hooks-core` - Core hook functionality
- `@carabiner/execution` - Hook execution engine
- `@carabiner/hooks-testing` - Testing utilities
- `@carabiner/hooks-validators` - Security validators
- `@carabiner/hooks-registry` - Pre-built hooks collection
- `@carabiner/registry` - Hook registry implementation
- `@carabiner/hooks-config` - Configuration management
- `@carabiner/error-management` - Error handling system
- `@carabiner/protocol` - Communication protocol
- `@carabiner/schemas` - JSON schemas
- `@carabiner/plugins` - Plugin system

### Technical Details

- Built with Bun v1.2.20
- TypeScript 5.9.2 with strict mode
- Turbo for monorepo management
- Ultracite for code quality
- 100% test coverage on critical paths

### Known Issues

- Binary distribution not yet available
- Some advanced configuration options still in development

### Contributors

- Matt Galligan ([@galligan](https://github.com/galligan)) - Project lead

---

For questions and support, please use [GitHub Discussions](https://github.com/outfitter-dev/carabiner/discussions).