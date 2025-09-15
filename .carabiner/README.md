# Carabiner Hook Directory

This directory contains local Carabiner hooks for this project.

## Structure

```
.carabiner/
├── hooks/
│   └── my-custom-hook/     # Your custom hook
│       └── index.js
└── config.json            # Hook configuration (optional)
```

## Using Hooks with Claude Code

After installing the Carabiner CLI globally (`npm install -g @carabiner/hooks-cli`), you can use hooks in your Claude Code settings:

### Example `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "carabiner my-hook",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "carabiner audit-logger",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

## Available Commands

```bash
# List all available hooks
carabiner list

# Run a specific hook (usually called by Claude Code)
echo '{"hook_event_name":"PreToolUse",...}' | carabiner my-hook

# Install a hook from npm (coming soon)
carabiner install @carabiner/security-guard
```

## Creating Custom Hooks

1. Create a new directory in `.carabiner/hooks/`
2. Add an `index.js` file that reads from stdin and writes to stdout
3. The hook should accept JSON input and return JSON output

### Example Hook Structure:

```javascript
#!/usr/bin/env node

// Read input from stdin
let inputData = '';
process.stdin.on('data', (chunk) => (inputData += chunk));
process.stdin.on('end', () => {
  const input = JSON.parse(inputData);

  // Your hook logic here
  const result = {
    status: 'success', // or 'failure'
    message: 'Hook executed',
    blocking: false, // true to block the action
    data: {}, // optional data to return
  };

  console.log(JSON.stringify(result));
});
```

## Hook Search Order

When running `carabiner <hook-name>`, the CLI searches in this order:

1. `.carabiner/hooks/<hook-name>/` (project-specific)
2. `~/.carabiner/hooks/<hook-name>/` (user global)
3. Built-in hooks from `@carabiner/examples` (if installed)

## Current Hooks

Place your custom hooks in the `.carabiner/hooks/` directory. Each hook should be in its own subdirectory with an `index.js` file.
