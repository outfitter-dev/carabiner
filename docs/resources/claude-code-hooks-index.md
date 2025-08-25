# Claude Code Hooks Documentation Index

> **Sources**:
>
> - [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
> - [Claude Code Settings Documentation](https://docs.anthropic.com/en/docs/claude-code/settings)

This index provides an organized overview of Carabiner hooks documentation and serves as the authoritative reference for common information shared across guides.

## Documentation Structure

### 📖 **[Overview](./carabiner-hooks-overview.md)**

- What hooks are and why they're useful
- Quick start guide (3 steps to get running)
- Available hook events and their behaviors
- Basic configuration examples
- Security considerations and common use cases

### 🔧 **[TypeScript Implementation](./carabiner-hooks-typescript.md)**

- Complete TypeScript development setup
- Type definitions and interfaces
- Template hooks for different events
- Advanced patterns and utilities
- Testing and debugging frameworks

### ⚙️ **[Configuration Guide](./carabiner-hooks-configuration.md)**

- Settings hierarchy and file locations
- Hook configuration options
- Environment-specific configurations
- Pattern matching and conditional execution
- Configuration validation

### 🔍 **[Troubleshooting](./carabiner-hooks-troubleshooting.md)**

- Common issues and solutions
- Debugging techniques
- Performance optimization
- Security guidelines
- Testing strategies

## Quick Reference

### Hook Events (Authoritative List)

| Event | Description | Exit Code Behavior | Context Variables |
| --- | --- | --- | --- |
| `PreToolUse` | Before tool execution | Exit 0: success; Exit 2: blocks tool, stderr to Claude; Other: non-blocking, stderr to user | Tool context available |
| `PostToolUse` | After tool execution | Exit 0: success; Exit 2: stderr to Claude (tool already ran); Other: non-blocking, stderr to user | `CLAUDE_TOOL_OUTPUT` available |
| `UserPromptSubmit` | When user submits prompt | Exit 0: stdout added to context; Exit 2: blocks prompt, erases it, stderr to user; Other: non-blocking | `CLAUDE_NOTIFICATION` available |
| `Stop` | Claude Code finishes responding | Exit 0: success; Exit 2: blocks stoppage, stderr to Claude; Other: non-blocking, stderr to user | Standard context |
| `SubagentStop` | Subagent finishes responding | Exit 0: success; Exit 2: blocks stoppage, stderr to subagent; Other: non-blocking, stderr to user | Standard context |
| `Notification` | System notifications | Exit 0: success; Exit 2 and others: stderr to user only; No blocking | `CLAUDE_NOTIFICATION` available |
| `PreCompact` | Before context compaction | Exit 0: success; Exit 2 and others: stderr to user only; No blocking | Standard context |

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
| CLAUDE_EVENT_TYPE | All hook events | Type of the event (e.g. PreToolUse, Notification) |
| CLAUDE_SESSION_ID | All hook events | Current session identifier |
| CLAUDE_WORKING_DIR | All hook events | Working directory |
| CLAUDE_PROJECT_DIR | Commands spawned by Claude Code | Project directory (workspace path) |
| CLAUDE_TOOL_NAME | PreToolUse, PostToolUse | Name of the tool invoked |
| CLAUDE_TOOL_INPUT | PreToolUse, PostToolUse | JSON string of tool parameters |
| CLAUDE_TOOL_OUTPUT | PostToolUse | Tool output (≤ 32 kB; not available in detached hooks) |
| CLAUDE_TOOL_DURATION | PostToolUse | Duration of tool execution (ms) |
| CLAUDE_FILE_PATHS | PreToolUse, PostToolUse (file tools) | Space-separated list of relevant file paths |
| CLAUDE_NOTIFICATION | Notification | Notification message content |

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

For detailed troubleshooting, see the [Troubleshooting Guide](./carabiner-hooks-troubleshooting.md).

---

> Last updated: Based on Carabiner hooks documentation as of 2024
>
> **Feedback**: Found an issue or have suggestions? Please check the latest official documentation at [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/hooks)
