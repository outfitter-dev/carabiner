# Runtime Adapter Refactor Notes

_Last updated: September 18, 2025_

## Goals

- Route all stdin decoding and execution through the provider adapters introduced in `gt-v0.2/feat-hooks-core-provider-interface`.
- Deliver a single normalized `HookContext` to hook handlers, collecting provider metadata and tool details in one place.
- Guarantee that every hook result is converted back to the provider-specific payload before it leaves the process.
- Preserve backwards compatibility for helper utilities (`createHookContext`, `HookResults`, builder APIs) while surfacing metadata needed for future providers.

## Execution Flow

1. **stdin → Provider Adapter**
   - `runClaudeHook` reads stdin, parses JSON, and resolves the active adapter (explicit `provider` / `providerId`, otherwise the default).
   - The adapter’s `fromProviderInput` returns a `NormalizedHookContext`; we wrap this as a `HookContext` (`context.toolName`, `context.toolInput`, metadata).

2. **Handler Invocation**
   - `executeHook` accepts a `HookHandler` and the normalized context.
   - We attach timing/metadata (duration, timestamp, provider info) to every `HookResult`, even on failures/timeouts.
   - `safeHookExecution` mirrors the same behavior for defensive handler execution.

3. **Result Serialization**
   - Hook handlers return `HookResult` (compatible with `HookJSONOutput`).
   - Before writing to stdout we call `adapter.toProviderOutput(result, context)` so providers can adjust the payload (e.g., Claude JSON shape).
   - Fallback errors still go through the adapter when possible so downstream runtimes receive valid provider JSON.

## Key Type Changes

- `HookHandler` now receives `HookContext` and returns `HookResult | Promise<HookResult>`.
- `HookContext` wraps the normalized provider context and adds convenience aliases (`toolName`, `toolInput`, `toolResponse`, `rawInput`).
- `HookExecutionOptions` accepts `providerId` or an explicit `provider` instance for advanced scenarios.
- `HookResults` helper now returns `HookResult` (still compatible with Claude’s `HookJSONOutput`).
- The builder/registry operate on `HookContext`, preserving existing APIs (`forTool`, conditional hooks, middleware) while capturing provider metadata.

## Compatibility Shims

- `createHookContext` continues to accept raw `HookInput` **or** a hook event string. Passing an event string builds a minimal `HookInput` using environment variables and optional overrides for quick scripting.
- `isBashToolInput`, `createBashInput`, and other helpers remain unchanged for tests and fixtures.
- Existing hooks that relied on `return HookResults.success(...)` require no changes.

## Testing & Validation

- New/updated unit tests live in `packages/hooks-core/src/__tests__/runtime.test.ts` and cover:
  - `createHookContext` event shorthand
  - Metadata propagation from `executeHook` / `safeHookExecution`
  - Adapter-backed execution through `runClaudeHook`
- Run locally before submitting:
  - `bun test --filter hooks-core`
  - `bun run type-check` (expect unrelated legacy issues outside this slice)

## Follow-ups

- `packages/hooks-testing` needs to swap to the normalized context helpers (`gt-v0.2/refactor-testing-adapter-mocks`).
- Examples package should rely on `HookContext` (await `gt-v0.2/refactor-examples-adapter-runtime`).
- Documenting multi-provider selection (`docs-provider-howto`).

---

Questions? Drop notes in `.agents/notes/20250917-hook-adapter-tracking.md` under the runtime slice.
