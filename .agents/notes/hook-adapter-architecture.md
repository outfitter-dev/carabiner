# Universal Hook Provider Architecture Plan

## Goals

- Share types seamlessly with the official Claude Code SDK so authors can drop in existing Claude hooks without friction.
- Provide an abstraction layer that lets Carabiner support additional hook runtimes/SDKs in the future without rewriting user hooks.
- Keep the runtime ergonomics consistent (builder API, helper utilities, testing) regardless of the underlying provider.
- Maintain small, green, stackable PRs while migrating the codebase.

## Current State (September 17, 2025)

- `@carabiner/hooks-core` exports builder/runtime utilities that assume the legacy Carabiner context (`toolName`, `toolInput`, `HookResults.success`, etc.).
- The integration branch (PR #94) updated internals to reference Claude Code SDK types but examples, testing utilities, and adapters still rely on the legacy contract.
- No provider abstraction exists; Claude-specific types leak through the runtime and helper layers.

## Proposed Architecture

### Provider Adapter Layer

- Introduce a new package (working title: `@carabiner/hooks-adapter`) responsible for translating between provider-specific payloads and Carabiner's normalized hook context.
- Define a provider-neutral `HookContext` surface (event, tool metadata, environment, raw input) that mirrors the Claude SDK shape today but is owned by Carabiner.
- Expose conversion utilities:
  - `fromProviderInput(providerInput): HookContext`
  - `toProviderOutput(hookResult): ProviderOutput`
  - Provider metadata (name, version, capabilities) for diagnostics.
- Ship a default Claude adapter plugin implementing these conversions using the official SDK types (`@anthropic-ai/claude-code`).

### Runtime Updates

- `runClaudeHook` becomes `runHookWithProvider(adapter, handler, options)`;
  - Provide a convenience `runClaudeHook = runHookWithProvider(claudeAdapter, ...)` for backwards compatibility.
- Internal execution pipeline (`executeHook`, builder middleware, logging) depends solely on the normalized `HookContext`/`HookJSONOutput` returned by the adapter, not directly on Claude SDK types.

### Plugin Registration

- Export a registry (`registerHookProvider`, `getDefaultProvider`) so future SDKs can plug in.
- Allow consumers to opt-out of the default Claude plugin if they want a different provider.
- Persist provider selection via configuration (e.g., environment variable or config file) with CLI overrides for future tooling.

## Migration Strategy

1. **Adapter Scaffolding (No Behaviour Change)**
   - Introduce the adapter interface and default Claude implementation.
   - Keep existing runtime exports but pass everything through the adapter internally.

2. **Runtime & Builder Refactor**
   - Update `runClaudeHook`, `HookBuilder`, `executeHook`, and registry functions to operate on the normalized context.
   - Provide compatibility shims so existing hooks using `HookResults` keep working.

3. **Testing & Utilities Alignment**
   - Refactor `@carabiner/hooks-testing` to work off the normalized context (new mock creators using adapters).
   - Update example tests to assert against `continue/stopReason/systemMessage` instead of legacy `success/block`.

4. **Example Package Migration**
   - Port scripts (`auto-formatter`, `bash-command-validator`, etc.) to use the adapter-based runtime, ensuring README instructions and CLI flows stay consistent.

5. **Documentation & Guides**
   - Update documentation to explain providers, the default Claude plugin, and how to add custom ones.

6. **Optional Future Providers**
   - Template for introducing an additional provider (e.g., hypothetical `@openai/codex-hooks`).

## Testing Philosophy

- Ensure each adapter returns valid Claude SDK outputs (snapshot tests comparing JSON payloads).
- Keep existing integration tests (Bun + mock inputs) green at every step.
- Introduce provider-agnostic tests that run against the normalized context to guard the abstractions.

## Risks & Mitigations

- **Risk:** Breaking existing hooks mid-migration.
  - _Mitigation:_ Maintain compatibility exports (`HookResults`) until final step; document deprecations.
- **Risk:** Increased complexity in runtime code.
  - _Mitigation:_ Keep adapters small, unit-test translation logic, and limit provider-specific branching.
- **Risk:** Stack drift / long-running PRs.
  - _Mitigation:_ Slice work into small Graphite PRs (see plan below) with independent CI.

## Next Steps

- Implement adapter package and default Claude plugin.
- Update runtime entry points to use the adapter.
- Refactor testing utilities and examples sequentially.

## Appendix: Terminology

- **Provider**: An implementation that knows how to translate between Carabiner's normalized hook context and a specific runtime/SDK (Claude, future SDKs).
- **Adapter**: The code that performs the translation; shipped as part of a provider.
- **Normalized Context**: The provider-neutral data structure consumed by hook authors.

---

# Graphite Stack Outline

Each step targets a small, green PR. Later steps depend on earlier ones but each should have passing tests on its slice.

All branches for this effort share the prefix `gt-v0.2/`.

| Order | Branch / PR slug | Scope | Expected Checks |
| --- | --- | --- | --- |
| 1 | `gt-v0.2/docs-setup-adapter-vision` | Add this architecture note, cross-link from CLAUDE.md / CONTRIBUTING so humans & agents see it. | `bun run lint:md` |
| 2 | `gt-v0.2/feat-hooks-core-provider-interface` | Introduce adapter interfaces, Claude plugin, provider registry. No behaviour change yet; add unit tests around translation helpers. | `bun run type-check`, `bun test --filter hooks-core` |
| 3 | `gt-v0.2/refactor-runtime-use-adapter` | Route `runClaudeHook`/`executeHook`/builder through adapter while keeping legacy `HookResults`. Add regression tests validating Claude output JSON. | `bun run type-check`, `bun test` (affected packages) |
| 4 | `gt-v0.2/refactor-testing-adapter-mocks` | Update `@carabiner/hooks-testing` (new mock creators, assertions) + adjust Bun tests. Re-enable example package scripts that were disabled. | `bun run typecheck --filter hooks-testing`, `bun test --filter hooks-testing`, `bun run type-check` |
| 5 | `gt-v0.2/refactor-examples-adapter-runtime` | Migrate example scripts + READMEs to adapter runtime, ensure examples package typecheck/test scripts run green. | `bun run typecheck --filter=@carabiner/hooks-examples`, `bun test --filter=@carabiner/hooks-examples` |
| 6 | `gt-v0.2/docs-provider-howto` | Document provider authoring, note legacy API deprecations, update migration guide. | `bun run lint:md` |

Each PR is designed to keep CI green independently; local runs should use `bun run type-check` plus the scoped package/test commands above before submission.

Optional follow-ups: introduce other providers, remove legacy shims once consumers are migrated.
