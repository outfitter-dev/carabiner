# Central Logger & Fixture Test Rollout Plan

_Last updated: September 24, 2025_

## Current Stack Snapshot (bottom → top)

1. `gt/feat_add_example_documentation`
2. `gt/chore_update_docs_to_proper_package_naming`
3. `gt/refactor-ensure-claude-code-sdk-compliance`
4. `gt/feat-types-align-with-Claude-Code-SDK-types-and-schemas`
5. `gt/feat-context-add-environment-variables-and-new-context-fields`
6. `gt/feat-protocol-handle-stop_hook_active-and-new-input-parsing`
7. `gt/feat-execution-implement-timeouts-exit-codes-and-JSON-handling`
8. `gt/feat-config-add-multi-hook-support-and-MCP-validation`
9. `gt/test-integration-add-Claude-Code-compliance-test-suite`
10. `gt/docs-add-migration-guide-and-compliance-examples`

The new work will sit on top of the stack to avoid re-ordering the existing Graphite branches. Each slice below is intended to be its own PR.

## 1. Unified Logger Adapter (`gt/infra-unified-logger`)

**Base branch:** `gt/docs-add-migration-guide-and-compliance-examples`

### Goals

- Provide a single entry point for creating loggers and allow consumers to inject their own implementation (e.g., Winston, console).
- Ensure all packages (`hooks-core`, `execution`, `protocol`, `config`) obtain loggers through this adapter.

### Tasks

1. Add `setLoggerFactory` (or `configureLogger`) to `packages/hooks-core/src/logging/factory.ts` that lets callers supply a custom factory returning `Logger` instances.
2. Default to the existing Pino-backed `ProductionLogger`. Cache should respect overrides.
3. Export the new configuration API from `@carabiner/hooks-core` (`packages/hooks-core/src/index.ts`).
4. Update any direct `createLogger(...)` calls outside the logging module (if present) to funnel through helper methods so the override is honored.
5. Add documentation + example snippet showing how to swap the logger (`docs/architecture.md`, `docs/guides/getting-started.md`).
6. Unit test: extend `packages/hooks-core/src/logging/__tests__/logging.test.ts` to assert that setting a custom factory returns the injected logger and that cache resets correctly.

### Notes

- When future branches (protocol/execution/config) request `executionLogger` or `configLogger`, they automatically receive the custom logger.
- No schema or type changes expected, so existing branches will simply rebase on top of this new API.

## 2. Fixture-Driven Protocol & Execution Tests (`gt/tests-expand-fixtures`)

**Base branch:** `gt/infra-unified-logger`

### Goals

- Exercise HTTP protocol parsing/serialization using the same fixture set as stdin tests.
- Cover the new `HookProcessResult` contract in the execution package with deterministic command results.

### Tasks

1. Add `tests/spec/protocol-http.test.ts` that:
   - Reads `tests/fixtures/events/*.json` to simulate incoming requests.
   - Uses `HttpProtocol` to parse body → context.
   - Serializes a sample `HookResult` and asserts on the response (status codes 200/400/500).
2. Add `tests/spec/execution-process.test.ts` (or extend existing execution spec) that stubs `executeWithTimeout` and verifies:
   - exitCode 0 → `continue: true`
   - exitCode 1 → `continue: false`, `stopReason` undefined, stderr passthrough
   - exitCode 2 → `stopReason: "blocked"`
3. Reuse existing fixture data where possible to avoid duplication.
4. Update `bun test` config if needed so the new specs run with the rest of the suite.

## 3. Documentation & Example Alignment (`gt/docs-logger-alignment`)

**Base branch:** `gt/tests-expand-fixtures`

### Goals

- Ensure all top-level docs/examples reference the new logger API and the Claude-compliant result shape (`continue`, `stopReason`).

### Tasks

1. Update README, `GETTING-STARTED.md`, architecture, troubleshooting, and CLI docs to import the shared logger (`import { coreLogger } from '@carabiner/hooks-core'`) or demonstrate configuring a custom logger.
2. Replace legacy `success` examples with `continue`/`stopReason` output.
3. Update `examples/` code snippets to use `coreLogger` or `createHookLogger` instead of raw `console.log` where appropriate (leave purely illustrative snippets alone if they intentionally show console output).
4. Add a changelog entry or note in the migration doc about the new logger override.
5. Smoke-test by running `bun run check` and the affected example scripts (if practical).

### Status

- ✅ Added architecture and getting started documentation covering `setLoggerFactory`
- ✅ Updated README highlights to mention the logger factory override
- ✅ Verified targeted logging tests and typechecks (`bun test packages/hooks-core/src/logging/__tests__/logging.test.ts`, `turbo typecheck --filter=@carabiner/hooks-core --filter=@carabiner/hooks-config`)

## 4. Lefthook Automation (`gt/devx-lefthook-lint`)

**Base branch:** `gt/docs-logger-alignment`

### Goals

- Ensure linting runs before commit/push to keep formatting consistent.

### Tasks

1. Extend `.lefthook.yml`:
   - **pre-commit:** add a `lint` command that runs `bun run check` (can be gated with `{staged_files}` optimisation later if needed).
   - **pre-push:** add a `lint` command ahead of `build/typecheck/test`.
2. Document the hooks in `CONTRIBUTING.md` so contributors know what runs automatically.
3. Verify by running `lefthook run pre-commit --all` and `lefthook run pre-push --all` locally.

### Status

- ✅ `lefthook.yml` now runs `bun run check` during pre-commit and pre-push before the existing build/typecheck/test commands.

## 5. Documentation Summary (`gt/docs-logger-plan`)

**Base branch:** `gt/devx-lefthook-lint`

Capture the above in human-readable form (this note) and link it from the top-level `AGENTS.md` or the current work section. Outline:

- Why we introduced the logger adapter.
- Testing strategy additions.
- Updated docs/examples.
- New developer workflow (lefthook changes).

## Open Questions / Follow-Ups

- Do we want environment-based defaults for the custom logger hook (e.g., allow configuring via env var)? Not in scope for now, but note in the docs.
- After landing the logging adapter, consider whether the example console calls should migrate to the shared logger or remain illustrative.
- Ensure Graphite branch order is updated in Graphite after adding new branches (each new slice should be created with `gt create` off the branch noted above).
