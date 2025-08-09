# Claude Code Hooks Documentation

Welcome to the comprehensive documentation for the Claude Code Hooks TypeScript library. This documentation provides everything you need to build production-ready, type-safe hooks for Claude Code.

## 📚 Documentation Structure

### [Getting Started](./guides/getting-started.md)

- Installation and setup
- First hook creation
- Basic concepts and terminology

### [Core Concepts](./guides/core-concepts.md)

- Hook events and lifecycle
- Tool scoping and targeting
- Runtime architecture changes

### [Migration Guide](./migration-guide.md)

- Upgrading from legacy hooks
- Runtime changes and improvements

### Resources

- [Configuration Reference](./resources/claude-code-hooks-configuration.md) - Complete configuration options
- [Hook Overview](./resources/claude-code-hooks-overview.md) - Hook system overview
- [TypeScript Integration](./resources/claude-code-hooks-typescript.md) - TypeScript usage patterns
- [Troubleshooting](./resources/claude-code-hooks-troubleshooting.md) - Common issues and solutions
- [Feature Index](./resources/claude-code-hooks-index.md) - Complete feature reference

### Planning Documents

- [TypeScript Library Plan](./plans/claude-code-hooks-typescript-library.md) - Project planning and architecture

## 🚀 Quick Start

### 1. Installation

```bash
# Install core library
bun add @claude-code/hooks-core

# Install additional packages as needed
bun add @claude-code/hooks-validators
bun add --dev @claude-code/hooks-testing
npm install -g @claude-code/hooks-cli
```

### 2. Initialize Project

```bash
# Initialize hooks in your project
claude-hooks init --template security
```

### 3. Create Your First Hook

```typescript
#!/usr/bin/env bun
import { runClaudeHook, HookResults } from '@claude-code/hooks-core';

runClaudeHook(async (context) => {
  console.log(`🔍 Validating ${context.toolName} usage`);

  if (context.toolName === 'Bash') {
    const { command } = context.toolInput as { command: string };

    if (command.includes('rm -rf /')) {
      return HookResults.block('Dangerous command blocked!');
    }
  }

  return HookResults.success('Validation passed');
});
```

### 4. Test Your Hook

```bash
# Test the hook
echo '{"session_id":"test","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls -la"},"cwd":"/tmp","transcript_path":"/tmp/transcript.md"}' | bun your-hook.ts
```

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
- **Explain the why**: Context and reasoning, not just instructions

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

## 📞 Getting Help

### Documentation Issues

- **Missing information**: File an issue describing what's missing
- **Incorrect information**: Submit a PR with corrections
- **Unclear explanations**: Suggest improvements in issues

### Code Issues

- **Bug reports**: Use the issue template with reproduction steps
- **Feature requests**: Describe the use case and proposed API
- **Questions**: Start with discussions before filing issues

### Community Resources

- **GitHub Discussions**: Ask questions and share patterns
- **Issue Tracker**: Report bugs and request features
- **Contributing Guide**: Learn how to contribute code and documentation

## 📋 Next Steps

Choose your path based on your experience level:

### New to Claude Code Hooks

1. Read [Getting Started](./guides/getting-started.md)
2. Try the [Examples](../packages/examples/README.md)
3. Explore the [Core Concepts](./guides/core-concepts.md)

### Experienced Developer

1. Check [Migration Guide](./migration-guide.md) for v2.0 changes
2. Review [Configuration Reference](./resources/claude-code-hooks-configuration.md)
3. Explore the [TypeScript Integration Guide](./resources/claude-code-hooks-typescript.md)

### Contributor

1. Review the package structure and examples
2. Check [Project Planning](./plans/claude-code-hooks-typescript-library.md)
3. Explore the [Troubleshooting Guide](./resources/claude-code-hooks-troubleshooting.md)

---

**Happy Hook Building!** 🎣
