# Claude Code Hooks Documentation Index

> **Sources**:
>
> - [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
> - [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)

This index provides an organized overview of Claude Code hooks documentation and serves as the authoritative reference for common information shared across guides.

## Documentation Structure

### 📖 **[Overview](./claude-code-hooks-overview.md)**

- What hooks are and why they're useful
- Quick start guide (3 steps to get running)
- Available hook events and their behaviors
- Basic configuration examples
- Security considerations and common use cases

### 🔧 **[TypeScript Implementation](./claude-code-hooks-typescript.md)**

- Complete TypeScript development setup
- Type definitions and interfaces
- Template hooks for different events
- Advanced patterns and utilities
- Testing and debugging frameworks

### ⚙️ **[Configuration Guide](./claude-code-hooks-configuration.md)**

- Settings hierarchy and file locations
- Hook configuration options
- Environment-specific configurations
- Pattern matching and conditional execution
- Configuration validation

### 🔍 **[Troubleshooting](./claude-code-hooks-troubleshooting.md)**

- Common issues and solutions
- Debugging techniques
- Performance optimization
- Security guidelines
- Testing strategies

## Quick Reference

### Hook Events (Authoritative List)

| Event | Description | Exit Code Behavior | Context Variables |
| --- | --- | --- | --- |
| `PreToolUse` | Before tool execution | Any non-zero exit blocks tool, shows stderr | All except during SessionStart |
| `PostToolUse` | After successful tool execution | Non-zero = failed, no blocking | `TOOL_OUTPUT` available |
| `UserPromptSubmit` | When user submits prompt | Non-zero = failed, no blocking | `USER_PROMPT` available |
| `SessionStart` | New session initialization | Non-zero = failed, no blocking | `CLAUDE_TOOL_NAME` empty |
| `Stop` | Claude Code finishes responding | Non-zero = failed, no blocking | Standard context |
| `SubagentStop` | Subagent finishes responding | Non-zero = failed, no blocking | Standard context |
| `Notification` | System notifications | Non-zero = failed, no blocking | Context-dependent |
| `PreCompact` | Before context compaction | Non-zero = failed, no blocking | Standard context |

> **Note**: All matching hooks run **in parallel** by default.

### Tool Names (Claude Code v0.4+)

| Tool           | Purpose                  |
| -------------- | ------------------------ |
| `Bash`         | Shell command execution  |
| `Edit`         | Single file editing      |
| `Write`        | File creation/writing    |
| `Read`         | File reading             |
| `MultiEdit`    | Multiple file edits      |
| `NotebookEdit` | Jupyter notebook editing |
| `Glob`         | File pattern matching    |
| `Grep`         | Text searching           |
| `LS`           | Directory listing        |
| `Task`         | Subagent task execution  |
| `WebFetch`     | Web content fetching     |
| `WebSearch`    | Web searching            |
| `Search`       | General search           |
| `Git`          | Git operations           |
| `Make`         | Build operations         |

> **Note**: Tool set evolves with Claude Code versions. Use `"*"` to match any tool not explicitly listed.

### Settings Hierarchy (Highest to Lowest Precedence)

1. **Command Line**: Direct CLI arguments (highest precedence)
2. **Project Local**: `.claude/settings.local.json` (personal, not committed)
3. **Project Shared**: `.claude/settings.json` (team-shared, committed)
4. **User Global**: `~/.claude/settings.json`
5. **Enterprise Managed**: Platform-specific policy files (lowest precedence)

### Environment Variables

| Variable | Availability | Description |
| --- | --- | --- |
| `CLAUDE_SESSION_ID` | All hooks | Current session identifier |
| `CLAUDE_TOOL_NAME` | Most hooks | Tool being used (empty in SessionStart) |
| `CLAUDE_PROJECT_DIR` | All hooks (v0.3+) | Current workspace path |
| `TOOL_INPUT` | Tool hooks | JSON string of tool parameters |
| `TOOL_OUTPUT` | PostToolUse only | Tool output (≤32kB, not available in detached hooks) |
| `USER_PROMPT` | UserPromptSubmit only | User's prompt text |

## Configuration Template

Minimal hook configuration (`.claude/settings.json`):

<details>
<summary>Click to expand basic configuration template</summary>

```json
{
  "hooks": {
    "PreToolUse": {
      "*": {
        "command": "bun run hooks/universal-validator.ts",
        "timeoutMs": 5000
      },
      "Bash": {
        "command": "bun run hooks/bash-validator.ts",
        "timeoutMs": 10000
      }
    },
    "PostToolUse": {
      "Write": {
        "command": "bun run hooks/format-after-write.ts",
        "timeoutMs": 30000
      },
      "Edit": {
        "command": "bun run hooks/format-after-edit.ts",
        "timeoutMs": 30000
      }
    },
    "SessionStart": {
      "command": "bun run hooks/session-init.ts",
      "timeoutMs": 10000
    }
  }
}
```

</details>

## Runtime Limits and Behavior

### Concurrency and Performance

- **Max concurrent hooks**: 4 hooks run simultaneously; additional hooks are queued
- **Environment payload limit**: Combined size of all environment variables ≤ 256 kB (excess is truncated)
- **Tool output limit**: `TOOL_OUTPUT` is truncated at 32 kB
- **Detached hooks**: Use `"detached": true` to run asynchronously without waiting; logs saved to `.claude/detached-logs/<hook-id>.log`

### Network and Security Context

- **Full network access**: Hooks inherit network permissions and can make HTTP requests
- **Secret environment variables**: Hooks receive existing secrets like `OPENAI_API_KEY`, `AWS_*` - sanitize if needed
- **Disable hooks**: Use `--no-hooks` CLI flag or remove `"hooks"` block from settings

## Security Checklist

> **🚨 CRITICAL**: Hooks execute with same permissions as Claude Code (often full disk access on macOS)

- [ ] Input validation for all user-provided data
- [ ] Allow-list commands (avoid deny-list approaches)
- [ ] Path restrictions to workspace only
- [ ] Timeout limits (default: 60000ms per invocation)
- [ ] Secure error handling with appropriate exit codes
- [ ] Regular security audits of hook scripts
- [ ] Minimal necessary permissions

## Version Compatibility

| Feature            | Minimum Claude Code Version |
| ------------------ | --------------------------- |
| Basic hooks        | v0.1+                       |
| Async hooks        | v0.2+                       |
| Multiple matchers  | v0.2+                       |
| CLAUDE_PROJECT_DIR | v0.3+                       |
| Tool name updates  | v0.4+                       |

## Getting Help

### Common Issues

1. **Hook not executing**: Check settings file syntax and hierarchy
2. **Timeout errors**: Increase timeout or optimize hook performance
3. **Permission errors**: Verify file paths and workspace permissions
4. **Environment variables missing**: Check hook event context compatibility

### Debugging Commands

```bash
# Test hook configuration
bun run hooks/debug-hook.ts

# Validate settings syntax
cat .claude/settings.json | json_pp

# Check hook script permissions
ls -la hooks/

# View hook execution traces
tail -f .claude/hook-trace.log
```

For detailed troubleshooting, see the [Troubleshooting Guide](./claude-code-hooks-troubleshooting.md).

---

> Last updated: Based on Claude Code hooks documentation as of 2024
>
> **Feedback**: Found an issue or have suggestions? Please check the latest official documentation at [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/hooks)
