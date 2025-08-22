# Carabiner Documentation

Welcome to the comprehensive documentation for Carabiner, the production-ready TypeScript library for building Claude Code hooks. This documentation provides everything you need to build robust, type-safe, and maintainable hooks.

## 📚 Documentation Structure

### 🚀 Getting Started

**New to Carabiner? Start here.**

- **[Getting Started Guide](getting-started.md)** - Install, create your first hook, and understand the basics
- **[CLI Reference](cli-reference.md)** - Master the command-line tools with examples
- **[Configuration Guide](configuration.md)** - Complete configuration reference and patterns

### 📖 Developer Guide

**Everything you need to build production hooks.**

- **[API Reference](api-reference/)** - Complete API documentation for all packages
- **[Architecture Guide](architecture.md)** - System design, concepts, and patterns
- **[Examples & Tutorials](examples/)** - Real-world scenarios and best practices

### 🔧 Operations & Support

**Deploy, troubleshoot, and maintain your hooks.**

- **[Troubleshooting Guide](troubleshooting.md)** - Common issues and solutions
- **[Migration Guides](migration-guides.md)** - Version upgrade instructions

### 📦 Package Documentation

**Detailed documentation for each package.**

- **[Core Package](../packages/hooks-core/README.md)** - Runtime, types, and execution engine
- **[CLI Tools](../packages/hooks-cli/README.md)** - Development and management tools
- **[Validators](../packages/hooks-validators/README.md)** - Security and validation rules
- **[Testing Framework](../packages/hooks-testing/README.md)** - Testing utilities and mocks
- **[Configuration](../packages/hooks-config/README.md)** - Settings and template management
- **[Working Examples](../packages/examples/README.md)** - Complete working examples

## 🚀 Quick Start

Ready to build your first hook? Here's the fastest path to success:

### 1. Installation

Choose your installation method:

**Binary (Recommended)**:

```bash
# Install standalone binary - no dependencies required
curl -fsSL https://raw.githubusercontent.com/outfitter-dev/carabiner/main/scripts/install.sh | bash

# Verify installation
claude-hooks --version
```

**Library Development**:

```bash
# Install core library for TypeScript development
npm install @outfitter/hooks-core

# Install full development suite
npm install @outfitter/hooks-core @outfitter/hooks-cli @outfitter/hooks-validators @outfitter/hooks-testing
```

### 2. Initialize Your Project

```bash
# Create hooks with security template
claude-hooks init --template security --typescript --strict

# Or minimal setup
claude-hooks init --template minimal
```

### 3. Create Your First Hook

```typescript
#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@outfitter/hooks-core';

runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} usage`);

  // Tool-specific validation
  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    if (command.includes('rm -rf /')) {
      return HookResults.block('Dangerous command blocked for safety!');
    }

    console.log(`✅ Bash command approved: ${command}`);
  }

  return HookResults.success('Validation passed');
});
```

### 4. Test Your Hook

```bash
# Test with CLI
claude-hooks test --hook ./your-hook.ts

# Or test manually
echo '{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls -la"},"cwd":"/tmp","transcript_path":"/tmp/transcript.md"}' | bun your-hook.ts
```

### 5. Next Steps

- **[Complete Tutorial](getting-started.md)** - Step-by-step guide with explanations
- **[Real Examples](examples/)** - Production-ready patterns and best practices
- **[API Reference](api-reference/)** - Explore all available APIs

## 🏗️ Library Architecture

The Claude Code Hooks library is organized into focused packages:

### Core Packages

- **[@claude-code/hooks-core](../packages/hooks-core/README.md)** - Core types, runtime utilities, and execution engine
- **[@claude-code/hooks-config](../packages/hooks-config/README.md)** - Configuration management and settings generation
- **[@claude-code/hooks-validators](../packages/hooks-validators/README.md)** - Security validators and validation rules
- **[@claude-code/hooks-testing](../packages/hooks-testing/README.md)** - Testing framework and mock utilities
- **[@claude-code/hooks-cli](../packages/hooks-cli/README.md)** - CLI tools for project management

### Supporting Packages

- **[examples](../packages/examples/README.md)** - Comprehensive working examples

## 🎯 Key Features

### ✅ New Stdin-Based Runtime

**Fixed**: Hooks now properly read JSON input from Claude Code via stdin, replacing the broken environment variable approach.

### ✅ Tool Scoping Works

**Fixed**: Hooks can now properly target specific tools or run universally, as originally designed.

### ✅ Type Safety

Full TypeScript strict mode with comprehensive type checking for all hook contexts and tool inputs.

### ✅ Multiple APIs

- **Function-based**: Simple and direct
- **Builder pattern**: Fluent interface for complex hooks
- **Declarative**: Configuration-driven approach

### ✅ Production Ready

- Comprehensive error handling
- Performance optimization
- Security validation
- Complete test coverage

## 📖 Documentation Guidelines

This documentation follows these principles:

### Writing Style

- **Active voice**: "Create a hook" instead of "A hook can be created"
- **Concise sentences**: Clear, direct explanations
- **Practical examples**: Every concept includes working code
- **Provide the rationale**: Context and reasoning, not just instructions

### Code Examples

- **Complete and runnable**: Examples work as-is
- **Type-safe**: Full TypeScript with proper types
- **Real-world focused**: Practical scenarios, not toy examples
- **Error handling**: Proper error handling patterns included

### Structure

- **Progressive disclosure**: Simple concepts first, advanced topics later
- **Cross-references**: Links between related concepts
- **Searchable**: Clear headings and consistent terminology
- **Maintainable**: Documentation that evolves with the code

## 🤝 Contributing to Documentation

### Adding New Documentation

1. **Follow the structure**: Place files in appropriate subdirectories
2. **Use consistent formatting**: Follow existing patterns
3. **Include examples**: Every feature needs working code examples
4. **Test examples**: Ensure all code examples actually work
5. **Link appropriately**: Add cross-references to related sections

### Updating Existing Documentation

1. **Keep examples current**: Update code when APIs change
2. **Maintain accuracy**: Verify information is still correct
3. **Improve clarity**: Simplify explanations where possible
4. **Add missing information**: Fill gaps as you discover them

### Documentation Standards

- **Markdown format**: Use GitHub-flavored Markdown
- **Code blocks**: Use appropriate language identifiers
- **Links**: Use relative links for internal documentation
- **Images**: Place in `assets/` subdirectories
- **Version info**: Note when features were added/changed

## 🔄 Recent Changes

### v2.0.0 - Major Runtime Fixes

- **Fixed runtime**: Switched from environment variables to stdin-based JSON input
- **Fixed tool scoping**: Hooks now properly target specific tools
- **Updated context**: Changed `workspacePath` → `cwd` to match Claude Code
- **Improved types**: More precise TypeScript definitions
- **Better testing**: Comprehensive test framework and examples

### Migration from v1.x

See the [Migration Guide](./migration-guide.md) for detailed information on upgrading from previous versions.

## 🌟 Key Features

### ✅ Production Ready

- **Type Safety**: Full TypeScript strict mode with comprehensive type checking
- **Error Handling**: Graceful error handling with detailed error messages
- **Performance**: Optimized execution with timeout controls and middleware
- **Security**: Environment-specific validation and audit logging
- **Testing**: Complete test coverage with mocking framework

### ✅ Runtime Architecture (v2.0)

- **Stdin-Based Runtime**: Proper JSON input processing from Claude Code
- **Tool Scoping**: Hooks correctly target specific tools or run universally
- **Context Properties**: Aligned with Claude Code's actual JSON structure
- **Improved Types**: More precise TypeScript definitions

### ✅ Multiple APIs

Choose the approach that fits your needs:

- **Function-Based**: Simple and direct for straightforward hooks
- **Builder Pattern**: Fluent interface for complex hooks with middleware
- **Declarative**: Configuration-driven approach for managing multiple hooks

### ✅ Comprehensive Tooling

- **CLI Tools**: Project scaffolding, testing, and development workflows
- **Templates**: Security, formatting, audit, and custom templates
- **Development Server**: Hot reloading and real-time testing
- **Configuration Management**: Environment-specific settings

## 🎯 Use Cases

### Security & Compliance

- **Command Validation**: Block dangerous bash commands and patterns
- **File Access Control**: Restrict file operations to safe locations
- **Audit Logging**: Comprehensive logging for compliance and debugging
- **Environment-Specific Rules**: Different security levels for dev/prod

### Development Workflows

- **Auto-Formatting**: Format code after file writes and edits
- **Linting Integration**: Run ESLint and other tools automatically
- **Git Integration**: Auto-commit changes and push to remote
- **Build Validation**: Run TypeScript compilation and tests

### Monitoring & Analytics

- **Performance Tracking**: Monitor hook execution times and resource usage
- **Usage Analytics**: Track tool usage patterns and frequencies
- **Error Reporting**: Capture and report hook failures
- **Health Monitoring**: System health checks and alerting

## 📞 Getting Help & Support

### 📖 Documentation Resources

Start with these comprehensive guides:

- **[Getting Started](getting-started.md)** - Complete tutorial from installation to deployment
- **[Troubleshooting](troubleshooting.md)** - Common issues and step-by-step solutions
- **[Examples](examples/)** - Real-world patterns and production-ready code
- **[API Reference](api-reference/)** - Complete API documentation

### 🆘 Quick Help

**Hook not executing?**

1. Check file permissions: `chmod +x your-hook.ts`
2. Validate configuration: `claude-hooks config validate`
3. Test manually: `echo '{...}' | bun your-hook.ts`

**TypeScript errors?**

1. Check imports: `import { runClaudeHook } from '@outfitter/hooks-core'`
2. Verify types: `bun run typecheck`
3. Use type guards: `if (isBashToolInput(context.toolInput)) { ... }`

**Performance issues?**

1. Add timing: `claude-hooks test --verbose`
2. Check timeouts: `claude-hooks config get PreToolUse.*.timeout`
3. Profile hooks: Add middleware.timing()

### 🐛 Report Issues

When reporting bugs, include:

```bash
# System info
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "Bun: $(bun --version)"
echo "CLI: $(claude-hooks --version)"

# Error reproduction
claude-hooks test --verbose --hook ./problematic-hook.ts
```

### 💬 Community Resources

- **[GitHub Discussions](https://github.com/outfitter-dev/carabiner/discussions)** - Ask questions and share patterns
- **[GitHub Issues](https://github.com/outfitter-dev/carabiner/issues)** - Report bugs and request features
- **[Contributing Guide](../CONTRIBUTING.md)** - Learn how to contribute code and documentation

### 🔄 Stay Updated

- **[Migration Guides](migration-guides.md)** - Version upgrade instructions
- **[Release Notes](https://github.com/outfitter-dev/carabiner/releases)** - Latest features and fixes
- **[Roadmap](https://github.com/outfitter-dev/carabiner/projects)** - Upcoming features

## 📋 Next Steps

Choose your path based on your experience level:

### New to Claude Code Hooks

1. Read [Getting Started](./guides/getting-started.md)
2. Try the [Examples](../packages/examples/README.md)
3. Explore the [Core Concepts](./guides/core-concepts.md)

### Experienced Developer

1. Check [Migration Guide](./migration-guide.md) for v2.0 changes
2. Review the [Configuration Reference](./resources/claude-code-hooks-configuration.md)
3. Explore the [TypeScript Integration Guide](./resources/claude-code-hooks-typescript.md)

### Contributor

1. Review the package structure and examples
2. Check [Project Planning](./plans/claude-code-hooks-typescript-library.md)
3. Explore the [Troubleshooting Guide](./resources/claude-code-hooks-troubleshooting.md)

---

**Happy Hook Building!** 🎣
