# Claude Hooks: Repo Review, Gaps, and Action Plan

Date: 2025-08-11 Owner: repo maintainers (@outfitter) Status: actionable notes for next iteration

## Summary

- Monorepo provides a strong TS runtime (`hooks-core`), validators, config, CLI, testing, and a new protocol abstraction.
- Overall direction is solid. A few inconsistencies will surprise users: exports drift, CLI templates, timeout naming, and docs-to-impl gaps.

## Architecture (quick recap)

- Runtime: stdin → `parseStdinInput` → `createHookContext` → `executeHook` (timeout/error) → `outputHookResult`.
- Builder/Registry: `HookBuilder`/`defineHook` produce entries; `HookRegistry` executes universal + tool-scoped hooks (priority-aware).
- Validators: `SecurityValidators.*`, `validateToolInput` and tool schemas.
- Config: `ConfigManager` loads/merges/generates `.claude/settings.json`.
- CLI: `claude-hooks` (init, generate, validate, test).
- Protocol: `@outfitter/protocol` for stdin/http/test I/O decoupling (nice future-proofing).

## Issues Found (with fixes)

1. hooks-core export drift (breaking imports)

- File: `packages/hooks-core/src/index.ts` re-exports non-existent runtime APIs:
  - `createBashContext`, `createFileContext`, `safeHookExecution`, `validateHookContext`
  - Not implemented in `src/runtime.ts` nor present in `dist`.

Option A — remove re-exports (fastest, least risk):

```ts
// packages/hooks-core/src/index.ts (trim to only implemented runtime exports)
export {
  createHookContext,
  executeHook,
  exitWithError,
  exitWithResult, // deprecated but implemented
  getSessionInfo,
  HookLogger,
  HookResults,
  isBashToolInput,
  isClaudeCodeEnvironment,
  isEditToolInput,
  isGlobToolInput,
  isGrepToolInput,
  isLSToolInput,
  isMultiEditToolInput,
  isNotebookEditToolInput,
  isReadToolInput,
  isTodoWriteToolInput,
  isWebFetchToolInput,
  isWebSearchToolInput,
  isWriteToolInput,
  outputHookResult,
  parseHookEnvironment,
  parseStdinInput,
  parseToolInput,
  runClaudeHook,
} from './runtime';
```

Option B — implement missing APIs in `runtime.ts` (prefer later if truly needed). For now, A avoids broken imports.

1. CLI templates use legacy APIs (doesn't match stdin runtime)

- File: `packages/hooks-cli/src/commands/generate.ts`
- Generated hooks call `createHookContext('PreToolUse')` + `exitWithResult`. Prefer `runClaudeHook(handler)`.

Recommended template body:

```ts

#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@claude-code/hooks-core';

async function handler(ctx: HookContext) {
  // Example: simple Bash guard
  if (ctx.event === 'PreToolUse' && ctx.toolName === 'Bash') {
    const input = ctx.toolInput as { command?: string };
    if (input.command?.includes('rm -rf /')) {
      return HookResults.block('Blocked dangerous command');
    }
  }
  return HookResults.success('OK');
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

```

Also switch JSON vs exit-code via `outputMode` if needed.

1. Timeout naming mismatch (docs vs generator)

- Docs and `docs/resources/*` use `timeoutMs` (Claude Code).
- `hooks-config` `DEFAULT_CONFIG` and `generateClaudeSettings` emit `timeout`.

Fix mapping in settings generation:

```ts
// packages/hooks-config/src/config.ts
private processHookConfig(config: ToolHookConfig) {
  const processed: Record<string, unknown> = { command: this.interpolateVariables(config.command) };
  if (config.timeout !== undefined) processed.timeoutMs = config.timeout; // map here
  if (config.detached !== undefined) processed.detached = config.detached;
  return processed;
}

```

Optionally update `README` examples for consistency.

1. Tests vs runtime input model

- Mocks rely on env vars, while runtime uses stdin. Keep mocks (fast), but document the distinction and add a `TestProtocol`-based example to future-proof.

Suggested example (protocol package):

```ts
import { createProtocol } from '@outfitter/protocol';
const protocol = createProtocol('test', {
  input: {
    session_id: 's',
    cwd: process.cwd(),
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'echo ok' },
  },
});
// Use an executor (future) or manually: await protocol.parseContext(await protocol.readInput())
```

## Recommended Small Patches (next PR)

- hooks-core: apply Option A (remove re-exports) to stop import errors.
- hooks-config: emit `timeoutMs` instead of `timeout` in generated settings.
- hooks-cli: update `generate` templates to use `runClaudeHook` and drop deprecated patterns.
- Docs: add a short “Runtime I/O” note clarifying stdin runtime vs testing env.

## CI Guardrails

- Add a smoke import to catch export drift:

```ts
// scripts/smoke-import.ts
import * as core from '@claude-code/hooks-core';
console.log('hooks-core VERSION', core.VERSION);
```

- Script: `"verify:imports": "bun scripts/smoke-import.ts"` and include in `ci:full` locally or via a small Turbo pipeline.

## Example: Minimal PreToolUse Hook (ready-to-copy)

```ts

#!/usr/bin/env bun

import { runClaudeHook, HookResults } from '@claude-code/hooks-core';

await runClaudeHook(
  async (ctx) => {
    if (ctx.event !== 'PreToolUse') return HookResults.skip();
    if (ctx.toolName === 'Bash') {
      const { command } = ctx.toolInput as { command: string };
      if (/rm\s+-rf\s+\//.test(command)) return HookResults.block('Nope');
    }
    return HookResults.success('All checks passed');
  },
  { timeout: 10_000 },
);

```

## Example: Config Manager → Claude settings

```ts
import { ConfigManager } from '@claude-code/hooks-config';
const cm = new ConfigManager(process.cwd());
const config = await cm.load();
const settings = cm.generateClaudeSettings();
// write to .claude/settings.json, Claude Code reads this file
```

## Quick Checklist

- [ ] Remove broken re-exports from `hooks-core/src/index.ts`.
- [ ] Map `timeout` → `timeoutMs` in settings generation.
- [ ] Update CLI generation templates to `runClaudeHook` style.
- [ ] Add smoke import script to CI.
- [ ] Align docs/examples with current runtime and config.

Notes prepared to accelerate a tidy, low-risk patch series.
