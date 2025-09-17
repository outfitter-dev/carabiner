# Tracking: Hook Provider Adapter Migration (v0.2 Stack)

This note tracks overall progress across the `gt-v0.2/` stack. Update the checklist as work lands.

## Branch Status

- [x] `gt-v0.2/docs-setup-adapter-vision` – architecture plan committed (PR #95)
- [x] `gt-v0.2/feat-hooks-core-provider-interface`
- [ ] `gt-v0.2/refactor-runtime-use-adapter`
- [ ] `gt-v0.2/refactor-testing-adapter-mocks`
- [ ] `gt-v0.2/refactor-examples-adapter-runtime`
- [ ] `gt-v0.2/docs-provider-howto`

## Test / Checks Expectations

| Branch | Primary Commands |
| --- | --- |
| `docs-setup-adapter-vision` | `bun run lint:md` |
| `feat-hooks-core-provider-interface` | `bun run type-check`; `bun test --filter hooks-core` |
| `refactor-runtime-use-adapter` | `bun run type-check`; `bun test` (affected packages) |
| `refactor-testing-adapter-mocks` | `bun run typecheck --filter hooks-testing`; `bun test --filter hooks-testing`; `bun run type-check` |
| `refactor-examples-adapter-runtime` | `bun run typecheck --filter=@carabiner/hooks-examples`; `bun test --filter=@carabiner/hooks-examples` |
| `docs-provider-howto` | `bun run lint:md` |

Update this file as branches land so future agents have a single reference.

## Runtime Adapter Slice Notes

- **2025-09-18** — In progress.
  - `runClaudeHook`, `executeHook`, and `safeHookExecution` now resolve the active provider and operate on the normalized `HookContext`. Results are converted back via the adapter before hitting stdout.
  - `HookHandler`, `HookContext`, `HookResults`, the builder, and registry were updated to work with the normalized context and carry provider metadata.
  - Unit tests cover the new context flow and metadata propagation (`packages/hooks-core/src/__tests__/runtime.test.ts`).
  - Documentation work to finalize for this branch: expand `docs/adapter-runtime-refactor.md` with the new execution diagram, refresh `packages/hooks-core/README.md` runtime section, and add CLI guidance for `createHookContext` overrides.
  - Before submitting: run `bun run type-check` (expecting legacy failures outside hooks-core) and `bun test --filter hooks-core`.
