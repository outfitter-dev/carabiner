# Hook Provider Adapter Architecture (v0.2)

_Updated: September 20, 2025_

The v0.2 stack introduces a provider adapter layer so Carabiner can normalize Claude Code input/output today while keeping the door open for additional hook providers in the future. This document captures the scope and sequencing for the migration.

## Objectives

- Establish a provider-neutral `HookContext` surface that all runtime utilities, builders, and plugins consume.
- Ship a Claude adapter that converts between Claude Code payloads and the normalized context without breaking existing hooks.
- Update documentation, testing helpers, and examples to reference the adapter-aware APIs.

## Work Breakdown

1. **Architecture & Documentation (this branch)**
   - Capture the overall plan (this document) and update contributor guidance (`AGENTS.md`).

2. **Provider Interface & Registry**
   - Define `HookProviderAdapter` contracts and default registration inside `@carabiner/hooks-core`.
   - Implement the Claude adapter and normalize runtime execution paths.

3. **Runtime + Testing Helpers**
   - Route `runClaudeHook`, `executeHook`, and builder middleware through adapters.
   - Update `@carabiner/hooks-testing` mocks/results to operate on the normalized context.

4. **Examples & CLI**
   - Migrate examples and CLI templates to the adapter-aware helpers.

5. **Follow-up Docs**
   - Author provider how-to guides explaining how third parties can register additional adapters.

## Success Criteria

- TypeScript compilation succeeds across the monorepo with the adapter layer enabled.
- Legacy hooks using `HookResults.success` continue to work without modification.
- Documentation, testing utilities, and starter templates all reference the normalized helpers.
- Future providers can register themselves without touching core runtime code.

Track remaining tasks in [.agents/handoff.md](../.agents/handoff.md) as branches land.
