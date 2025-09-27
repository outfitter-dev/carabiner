# Why Carabiner: Real-World Hook Examples

This document demonstrates how Carabiner transforms Claude Code hooks from shell scripts into type-safe, performant, and shareable TypeScript modules. Each example shows the traditional approach versus the Carabiner approach, highlighting improvements in security, performance, ergonomics, and shareability.

## Table of Contents

1. [Security Examples](#security-examples)
2. [Performance Examples](#performance-examples)
3. [Ergonomics Examples](#ergonomics-examples)
4. [Shareability Examples](#shareability-examples)

---

## Security Examples

### 1. Sensitive File Protection

**Use Case**: Prevent Claude from accessing environment files and secrets

#### Before (Shell Script)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo $CLAUDE_FILE_PATHS | grep -E '(\\.env|secrets/|private\\.key)' && echo 'Access denied' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

**Problems**:

- ❌ **Security**: Shell injection vulnerability if file paths contain special characters
- ❌ **Security**: No validation of grep patterns, could be bypassed with clever naming
- ❌ **Ergonomics**: Cryptic bash one-liner, hard to maintain
- ❌ **Shareability**: Platform-dependent (grep flags vary across systems)

#### After (Carabiner)

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';
import type { ToolHookContext } from '@carabiner/types';

// Create a hook for the Read tool
export const protectSensitiveFilesRead = createHook.preToolUse(
  'Read',
  async (context: ToolHookContext) => {
    const sensitivePatterns = [
      /\.env(\.|$)/,
      /\/secrets?\//,
      /\.(key|pem|crt|pfx)$/,
      /\/(\.?ssh|gpg)\//,
    ];

    const filePath = context.toolInput.file_path;
    const isRestricted = sensitivePatterns.some((pattern) => pattern.test(filePath));

    if (isRestricted) {
      return HookResults.block(
        `Access denied: ${filePath} matches restricted pattern`,
        true, // suppress output
      );
    }

    return HookResults.success();
  },
);

// Create a similar hook for the Edit tool
export const protectSensitiveFilesEdit = createHook.preToolUse(
  'Edit',
  async (context: ToolHookContext) => {
    // Reuse the same logic (or extract to shared function)
    const sensitivePatterns = [
      /\.env(\.|$)/,
      /\/secrets?\//,
      /\.(key|pem|crt|pfx)$/,
      /\/(\.?ssh|gpg)\//,
    ];

    const filePath = context.toolInput.file_path;
    const isRestricted = sensitivePatterns.some((pattern) => pattern.test(filePath));

    if (isRestricted) {
      return HookResults.block(`Access denied: ${filePath} matches restricted pattern`, true);
    }

    return HookResults.success();
  },
);
```

**Benefits**:

- ✅ **Security**: No shell injection possible, pure TypeScript validation
- ✅ **Security**: Regex patterns are explicit and testable
- ✅ **Ergonomics**: Clear, readable code with proper error messages
- ✅ **Shareability**: Works identically on all platforms

---

### 2. Git Branch Protection

**Use Case**: Prevent destructive operations on protected branches

#### Before (Shell Script)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | grep -E 'git.*(push.*--force|reset.*--hard)' && BRANCH=$(git branch --show-current) && [ \"$BRANCH\" = \"main\" ] && echo 'Dangerous operation on main branch!' && exit 2 || exit 0"
          }
        ]
      }
    ]
  }
}
```

**Problems**:

- ❌ **Security**: Complex shell pipeline prone to escaping issues
- ❌ **Performance**: Spawns multiple processes (jq, grep, git)
- ❌ **Ergonomics**: Nearly impossible to understand at a glance
- ❌ **Shareability**: Requires jq installation, git in PATH

#### After (Carabiner)

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';
import type { ToolHookContext } from '@carabiner/types';
import { execSync } from 'child_process';

export const protectMainBranch = createHook.preToolUse('Bash', async (context: ToolHookContext) => {
  const command = context.toolInput.command;
  const dangerousOps = [
    /git\s+push.*--force/,
    /git\s+reset.*--hard/,
    /git\s+branch.*-[dD]/,
    /git\s+clean.*-f/,
  ];

  const isDangerous = dangerousOps.some((op) => op.test(command));

  if (isDangerous) {
    try {
      // Get current branch using git command
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

      if (branch === 'main' || branch === 'master') {
        return HookResults.block(`Dangerous operation blocked on ${branch} branch`, true);
      }

      // Warn for dangerous operations on other branches
      return HookResults.warn(
        `⚠️ Dangerous git operation detected: ${command.substring(0, 50)}...`,
      );
    } catch (error) {
      // Not in a git repo, allow the command
      return HookResults.success();
    }
  }

  return HookResults.success();
});
```

**Benefits**:

- ✅ **Security**: Safe command validation with TypeScript
- ✅ **Performance**: Only runs git command when needed
- ✅ **Ergonomics**: Clear intent with readable code
- ✅ **Shareability**: Cross-platform with standard Node.js APIs

---

## Performance Examples

### 3. Smart Test Runner

**Use Case**: Automatically run relevant tests when files change

#### Before (Shell Script)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo $CLAUDE_TOOL_INPUT | jq -r '.file_path') && [ \"${FILE##*.}\" = \"ts\" ] && npm test $(echo $FILE | sed 's/\\.ts$/.test.ts/') 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**Problems**:

- ❌ **Performance**: Runs on every edit, even documentation
- ❌ **Performance**: No caching or intelligent test selection
- ❌ **Ergonomics**: Complex string manipulation in bash

#### After (Carabiner)

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';
import type { ToolHookContext } from '@carabiner/types';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Cache for test results
const testCache = new Map<string, { timestamp: number; passed: boolean }>();

export const smartTestRunner = createHook.postToolUse('Edit', async (context: ToolHookContext) => {
  const filePath = context.toolInput.file_path;

  // Only run for TypeScript source files
  if (!filePath.endsWith('.ts') || filePath.includes('.test.')) {
    return HookResults.skip();
  }

  // Check if test file exists
  const testPath = filePath.replace(/\.ts$/, '.test.ts');
  if (!fs.existsSync(testPath)) {
    return HookResults.skip('No test file found');
  }

  // Check cache (5-minute TTL)
  const cached = testCache.get(testPath);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return HookResults.success(`Tests cached: ${cached.passed ? 'passing' : 'failing'}`);
  }

  try {
    // Run tests for the specific file
    execSync(`npm test -- ${testPath}`, { stdio: 'pipe' });

    testCache.set(testPath, { timestamp: Date.now(), passed: true });
    return HookResults.success(`✅ Tests passed for ${path.basename(testPath)}`);
  } catch (error) {
    testCache.set(testPath, { timestamp: Date.now(), passed: false });
    return HookResults.warn(`⚠️ Tests failed for ${path.basename(testPath)}`);
  }
});
```

**Benefits**:

- ✅ **Performance**: Smart filtering and caching
- ✅ **Performance**: Only tests relevant files
- ✅ **Ergonomics**: Clear logic with proper error handling

---

## Ergonomics Examples

### 4. Automated Code Formatter

**Use Case**: Format code after edits

#### Before (Shell Script)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(echo $CLAUDE_TOOL_INPUT | jq -r '.file_path') && case \"${FILE##*.}\" in ts|tsx|js|jsx) npx prettier --write \"$FILE\" ;; py) black \"$FILE\" ;; rs) rustfmt \"$FILE\" ;; esac"
          }
        ]
      }
    ]
  }
}
```

**Problems**:

- ❌ **Ergonomics**: Unreadable case statement
- ❌ **Ergonomics**: No error handling
- ❌ **Shareability**: Assumes specific formatters installed

#### After (Carabiner)

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';
import type { ToolHookContext } from '@carabiner/types';
import { execSync } from 'child_process';
import * as path from 'path';

// Formatter configuration
const formatters = {
  typescript: { extensions: ['.ts', '.tsx'], command: 'npx prettier --write' },
  javascript: { extensions: ['.js', '.jsx'], command: 'npx prettier --write' },
  python: { extensions: ['.py'], command: 'black' },
  rust: { extensions: ['.rs'], command: 'rustfmt' },
};

export const autoFormat = createHook.postToolUse('Edit', async (context: ToolHookContext) => {
  const filePath = context.toolInput.file_path;
  const ext = path.extname(filePath);

  // Find appropriate formatter
  const formatter = Object.values(formatters).find((f) => f.extensions.includes(ext));

  if (!formatter) {
    return HookResults.skip(`No formatter configured for ${ext} files`);
  }

  try {
    execSync(`${formatter.command} "${filePath}"`, { stdio: 'pipe' });
    return HookResults.success(`✨ Formatted ${path.basename(filePath)}`);
  } catch (error) {
    // Don't fail the hook if formatting fails
    return HookResults.warn(`Could not format ${path.basename(filePath)}`);
  }
});
```

**Benefits**:

- ✅ **Ergonomics**: Clean, extensible formatter configuration
- ✅ **Ergonomics**: Proper error handling
- ✅ **Shareability**: Easy to customize formatters

---

## Shareability Examples

### 5. Team Coding Standards Enforcer

**Use Case**: Enforce team-specific coding standards

#### Before (Shell Script)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Check standards...' && sleep 1 && exit 0"
          }
        ]
      }
    ]
  }
}
```

**Problems**:

- ❌ **Shareability**: Can't actually implement complex standards
- ❌ **Shareability**: No way to share configuration
- ❌ **Ergonomics**: Limited to simple shell commands

#### After (Carabiner)

```typescript
import { createHook, HookResults } from '@carabiner/hooks-core';
import type { ToolHookContext } from '@carabiner/types';

// NOTE: These features demonstrate planned functionality
// Team standards configuration (could be loaded from team config)
interface TeamStandards {
  maxLineLength: number;
  requireJSDoc: boolean;
  prohibitedPatterns: RegExp[];
  requiredHeaders: string[];
}

const teamStandards: TeamStandards = {
  maxLineLength: 100,
  requireJSDoc: true,
  prohibitedPatterns: [
    /console\.(log|debug)/,
    /any\s*:/, // No 'any' types
    /var\s+/, // Use const/let
  ],
  requiredHeaders: ['@author', '@description'],
};

export const enforceStandards = createHook.preToolUse('Edit', async (context: ToolHookContext) => {
  const filePath = context.toolInput.file_path;

  // Only check TypeScript/JavaScript files
  if (!/\.(ts|js)x?$/.test(filePath)) {
    return HookResults.skip();
  }

  const newContent = context.toolInput.new_string || '';
  const violations: string[] = [];

  // Check line length
  const lines = newContent.split('\n');
  lines.forEach((line, i) => {
    if (line.length > teamStandards.maxLineLength) {
      violations.push(`Line ${i + 1} exceeds ${teamStandards.maxLineLength} characters`);
    }
  });

  // Check prohibited patterns
  teamStandards.prohibitedPatterns.forEach((pattern) => {
    if (pattern.test(newContent)) {
      violations.push(`Prohibited pattern found: ${pattern.source}`);
    }
  });

  // Check for required headers in new files
  if (context.toolInput.old_string === '' && teamStandards.requireJSDoc) {
    const hasJSDoc = /\/\*\*[\s\S]*?\*\//.test(newContent);
    if (!hasJSDoc) {
      violations.push('Missing JSDoc header comment');
    }
  }

  if (violations.length > 0) {
    return HookResults.block(`Code standards violations:\\n${violations.join('\\n')}`, false);
  }

  return HookResults.success('✅ Code standards check passed');
});
```

**Benefits**:

- ✅ **Shareability**: Configuration can be externalized
- ✅ **Shareability**: Can be published as npm package
- ✅ **Ergonomics**: Clear, maintainable standards
- ✅ **Performance**: Fast, in-process validation

---

## Summary

Carabiner transforms Claude Code hooks from brittle shell scripts into robust, type-safe TypeScript modules that are:

1. **Secure**: No shell injection, proper input validation
2. **Performant**: Smart caching, efficient execution
3. **Ergonomic**: Readable, maintainable, testable code
4. **Shareable**: Cross-platform, packageable, configurable

The examples above demonstrate real-world scenarios where Carabiner's approach provides significant advantages over traditional shell-based hooks.
