## Carabiner Claude Code Compliance Plan

Last updated: September 24, 2025 Owner: Matt Galligan (@galligan) Status: Draft (Enhanced) Scope: Bring Carabiner to 100% alignment with the latest Claude Code hook specification, including decision model updates, matcher semantics, exit-code behavior, MCP tooling, developer ergonomics, and multi-hook support.

---

> **Goal** Ship a compliance stack that guarantees all nine Claude Code hook events operate with the current SDK contract, deliver predictable exit/error semantics, and deliver a first-class DX for MCP-enabled tool chains.

---

> **Key Deliverables**

1. Authoritative spec reference + compliance matrix.
2. Updated type system & schemas mirroring the official SDK payloads.
3. Provider/runtime/protocol pipeline that preserves new fields and decision models.
4. Execution engine with correct exit code semantics, `stop_hook_active` handling, and timeout support (default 60s).
5. Matcher + configuration surface area for PreCompact/SessionStart scopes and MCP tool names.
6. Multi-hook support allowing multiple commands per event with sequential execution.
7. Automated acceptance suite covering all nine events, matchers, exit paths, and MCP flows.
8. Documentation & examples reflecting the new contract.
9. Environment variable injection (`CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_HOOK_EVENT`).

---

> **Execution Strategy**

- Work as a Graphite stack rooted at `feat/spec-alignment`. Slice by substrate (types → runtime → execution → config → tests → docs).
- Maintain an issue checklist linked from this document. Every PR must update the compliance matrix.
- Keep compatibility shims where existing API users require them; mark deprecations in a dedicated migration note.

---

> **Graphite Stack Strategy**

### Stack Structure (7 PRs, ~150-250 LOC each)

```
main
└── feat/compliance-0-types (~200 LOC)
    ├── Types, schemas, SDK alignment
    ├── Tests: Type validation tests
    └── Files: types/*, schemas/*

    └── feat/compliance-1-context (~150 LOC)
        ├── Context factories, environment vars
        ├── Tests: Context creation tests
        └── Files: hooks-core/context/*

        └── feat/compliance-2-protocol (~200 LOC)
            ├── Input parsing, stop_hook_active
            ├── Tests: Protocol parsing tests
            └── Files: protocol/*, adapters/*

            └── feat/compliance-3-execution (~250 LOC)
                ├── Exit codes, timeouts, JSON/raw handling
                ├── Tests: Execution behavior tests
                └── Files: execution/executor.ts, execution/timeout.ts

                └── feat/compliance-4-config (~200 LOC)
                    ├── Multi-hook, matchers, MCP validation
                    ├── Tests: Config validation tests
                    └── Files: hooks-config/*, builder/*

                    └── feat/compliance-5-integration (~150 LOC)
                        ├── E2E tests, MCP harness
                        ├── Tests: Full integration tests
                        └── Files: tests/spec/*, hooks-testing/*

                        └── feat/compliance-6-docs (~100 LOC)
                            ├── Examples, migration guide
                            └── Files: docs/*, examples/*
```

### PR Breakdown

#### PR 0: Type System Foundation
**Branch**: `feat/compliance-0-types`
**Scope**: Core type definitions and schemas
**Changes**:
- Update `packages/types/src/events.ts` with SDK re-exports
- Extend `packages/types/src/context.ts` with new fields
- Update `packages/schemas/src/input.ts` with matchers
- Add `packages/types/src/decisions.ts` for permission logic
- Tests in `packages/types/src/__tests__/`
**Why first**: Everything depends on correct types

#### PR 1: Context & Environment
**Branch**: `feat/compliance-1-context`
**Scope**: Context creation and environment handling
**Changes**:
- Update context factories for new fields
- Add environment variable injection
- Create `packages/hooks-core/src/environment.ts`
- Tests in same package
**Depends on**: Types (PR 0)

#### PR 2: Protocol & Input Layer
**Branch**: `feat/compliance-2-protocol`
**Scope**: Input parsing and adapter updates
**Changes**:
- Update `packages/protocol/src/protocols/stdin.ts`
- Update `packages/hooks-core/src/providers/claude-adapter.ts`
- Add `stop_hook_active` handling
- Tests for protocol parsing
**Depends on**: Context (PR 1)

#### PR 3: Execution Engine
**Branch**: `feat/compliance-3-execution`
**Scope**: Core execution semantics
**Changes**:
- Update `packages/execution/src/executor.ts`
- Add `packages/execution/src/timeout.ts`
- Implement exit code logic
- JSON vs raw output handling
- Tests for all execution paths
**Depends on**: Protocol (PR 2)

#### PR 4: Configuration & Matchers
**Branch**: `feat/compliance-4-config`
**Scope**: Config structure and validation
**Changes**:
- Update `packages/hooks-config/src/config.ts`
- Add multi-hook support
- MCP matcher resolver
- Config validation at startup
- Tests for config scenarios
**Depends on**: Execution (PR 3)

#### PR 5: Integration Testing
**Branch**: `feat/compliance-5-integration`
**Scope**: E2E tests and harnesses
**Changes**:
- Add `tests/spec/claude-compliance.test.ts`
- Create MCP dummy server
- Golden JSON snapshots
- Full integration tests
**Depends on**: Config (PR 4)

#### PR 6: Documentation
**Branch**: `feat/compliance-6-docs`
**Scope**: User-facing docs and examples
**Changes**:
- Update README.md
- Add examples/
- Migration guide
- Compliance matrix
**Depends on**: Integration (PR 5)

### Key Principles

1. **Atomic PRs**: Each PR is independently testable
2. **Co-located tests**: Tests live with the code they test
3. **No split changes**: Complete feature per PR
4. **Clear dependencies**: Linear stack, no cross-dependencies
5. **Size limits**: Target ~200 LOC per PR (excluding tests)

### Review Strategy

- PRs 0-2: Can be reviewed quickly (type/structure changes)
- PR 3: Needs careful review (execution logic)
- PR 4: Config changes need design review
- PR 5: Test-only, easier review
- PR 6: Documentation review

### Rollback Safety

Each PR can be reverted independently without breaking the base:
- Types (PR 0): Has compatibility shims
- Each subsequent PR: Feature-flagged or backwards compatible

### Work Item to PR Mapping

| Work Item | PR # | Branch |
|-----------|------|--------|
| Types & Schemas alignment | 0 | feat/compliance-0-types |
| Context factories, env vars | 1 | feat/compliance-1-context |
| Protocol parsing, adapters | 2 | feat/compliance-2-protocol |
| Execution engine, timeouts | 3 | feat/compliance-3-execution |
| Config, matchers, MCP | 4 | feat/compliance-4-config |
| Integration tests, harness | 5 | feat/compliance-5-integration |
| Documentation, examples | 6 | feat/compliance-6-docs |

---

> **Baseline Artifacts**

- `docs/compliance/claude-code-spec.md` _(new)_: canonical snapshot of the Claude Code hook spec with citations.
- `docs/compliance/compliance-matrix.md` _(new)_: table mapping spec line items to Carabiner modules/tests.
- Update `ADAPTER-MIGRATION-STATUS.md` once stack lands.

---

> **Work Breakdown**

> **Note**: Work items below are organized by PR in the stack. Each PR includes its tests to avoid split changes.

> ### 1. Spec Capture & Compliance Matrix (Pre-work)

- [ ] Create `docs/compliance/claude-code-spec.md` summarising: events, input payloads, hook-specific outputs, exit codes, matcher semantics, MCP naming rules, `stop_hook_active`, stdout context injection rules, timeout handling (default 60000ms), and multi-hook configuration.
- [ ] Document hook configuration structure supporting multiple hooks per event with sequential execution.
- [ ] Publish `docs/compliance/compliance-matrix.md` with columns: _Spec requirement_, _Implementation module_, _Test coverage_, _Status_. Seed with at least: decision fields, exit codes, notification handling, matchers, MCP support, context injection, stop-loop safety, timeout handling, environment variables.
- [ ] Add GitHub labels/issue template for "Claude compliance" items to keep tracking consistent.

> ### 2. Types & Schemas Alignment

- [ ] Replace bespoke hook event definitions in `packages/types/src/events.ts` with direct re-exports from `@anthropic-ai/claude-code`. Keep helper aliases but ensure `HookEvent` includes `Notification`, `PreCompact`, `SessionEnd`.
- [ ] Extend context factories in `packages/types/src/context.ts` to surface new fields:
  ```ts
  export interface PreToolUseContext extends ToolHookContext {
    readonly hookSpecificInput?: {
      readonly permissionPrompt?: string;
    };
    readonly stopHookActive?: boolean;
  }
  ```
- [ ] Update Zod schemas in `packages/schemas/src/input.ts` to accept full event set and typed matchers:
  ```ts
  const preCompactMatcherSchema = z.enum(['manual', 'auto']);
  const sessionStartMatcherSchema = z.enum(['startup', 'resume', 'clear', 'compact']);
  ```
  _Include MCP-style tool names via refined regex (`/^([a-z0-9_]+\*?|mcp**[^_]+**[^_]+)$/i`).\_
- [ ] Adjust `HookResult` typings to support generic output fields (`continue`, `stopReason`, `suppressOutput`, `systemMessage`) and embed hook-specific envelopes via discriminated unions.
- [ ] Provide `mapLegacyDecision(result)` helper that converts legacy `success/block` to the new JSON while logging deprecation warnings.

> ### 3. Provider Adapter & Runtime

- [ ] Audit `packages/hooks-core/src/providers/claude-adapter.ts` to ensure `fromProviderInput` preserves spec-only fields (`permission_decision`, `stop_hook_active`, `pre_compact_trigger`, `notification_type`, etc.).
- [ ] Update `toProviderOutput` to pass through `hookSpecificOutput.permissionDecision` untouched. Remove legacy field stripping unless explicitly required.
- [ ] Enhance `packages/hooks-core/src/runtime.ts` utilities:
  ```ts
  const allow = ({ reason }: { reason: string }): HookResult => ({
    continue: true,
    hookSpecificOutput: { permissionDecision: 'allow', permissionDecisionReason: reason },
  });
  ```
- [ ] Ensure `safeHookExecution` returns metadata with preserved `hookSpecificOutput` and `additionalContext`.
- [ ] Propagate stdout context injection for `SessionStart`/`UserPromptSubmit` by piping handler `stdout` to the final JSON if present.

> ### 4. Protocol & Input Handling

- [ ] Extend `packages/protocol/src/protocols/stdin.ts` to parse new matchers and `hook_specific_input` payloads. Mirror logic in `protocols/http.ts` and test doubles.
- [ ] Inject `stop_hook_active` boolean into `HookContext` so downstream hooks can act on it without re-parsing raw input.
- [ ] Verify notification routing: treat `Notification` as its own event (current schema collapses to `SessionStart`/`Stop`). Update context creators accordingly.
- [ ] Ensure raw stdout is captured for `SessionStart` and `UserPromptSubmit` to satisfy spec’s transcript rules (may require teeing process stdout before `writeOutput`).

> ### 5. Execution Semantics

- [ ] Refactor `packages/execution/src/executor.ts` normalization path:
  - Interpret `hookSpecificOutput.permissionDecision === "deny"` or `stopReason === "blocked"` as a blocking outcome.
  - Map blocking outcomes → process exit code `2`; send serialized error to `stderr`.
  - Treat other non-zero exit codes as non-blocking warnings (per spec).
  - Implement hook command timeout handling (default 60000ms, configurable).
  - Support SIGTERM → SIGKILL progression for timeout enforcement.
- [ ] Honor `stop_hook_active`: skip forcing `continue` when true; expose override flag in executor options to prevent infinite stop hook loops.
- [ ] Implement JSON vs raw output handling:
  - If hook outputs valid JSON → parse as structured response.
  - If raw text → treat as context injection (SessionStart/UserPromptSubmit only).
- [ ] Inject environment variables: `CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_HOOK_EVENT`.
- [ ] Emit structured metrics (`permissionDecision`, `permissionDecisionReason`, `matcher`) in `packages/execution/src/metrics.ts`.
- [ ] Add explicit tests for exit-code behavior in `packages/execution/src/__tests__/executor.test.ts`.

> ### 6. Matchers, MCP, Configuration & Builder UX

- [ ] Expand configuration typing in `packages/hooks-config/src/config.ts` to allow:
  - Wildcard (`"*"`) and regex matchers.
  - Enum matchers for PreCompact/SessionStart triggers (`manual` vs `auto`, etc.).
  - MCP tool names (`mcp__server__tool`) - no wildcards supported for MCP.
  - Multiple hook commands per event with sequential execution.
- [ ] Implement configuration structure:
  ```json
  {
    "hooks": {
      "EventName": [{
        "matcher": "optional-pattern",
        "hooks": [{
          "type": "command",
          "command": "executable-command",
          "timeout": 60000
        }]
      }]
    }
  }
  ```
- [ ] Enhance `ConfigManager.setHookConfig` so writing to `"*"` updates a wildcard bucket and new `matcher` property is persisted.
- [ ] Update `HookBuilder.withMatcher` to accept `{ type: "regex" | "literal" | "wildcard"; value: string }`, falling back to string for backwards compatibility.
- [ ] Add configuration validation at startup: check scripts exist and are executable.
- [ ] Close the open MCP custom tools issue by implementing an MCP-aware matcher resolver (split on `__`, normalise case) and adding fixtures.

> ### 7. Acceptance & Regression Tests

- [ ] Add `tests/spec/claude-compliance.test.ts` covering all nine events with golden JSON snapshots.
- [ ] Create MCP dummy server harness inside `packages/hooks-testing` to exercise `mcp__filesystem__read_file` etc.
- [ ] Extend existing error-path tests to cover:
  - Permission deny (`permissionDecision: "deny"`).
  - `hookSpecificOutput.permissionDecision === "ask"` flows.
  - `stop_hook_active` skip logic to prevent infinite loops.
  - Notification hooks returning advisory context.
  - Timeout handling with SIGTERM → SIGKILL progression.
  - Multi-hook sequential execution within a single event.
- [ ] Include tests asserting stdout context injection for SessionStart/UserPromptSubmit.
- [ ] Test JSON vs raw output handling:
  - Valid JSON parsed as structured response.
  - Raw text treated as context injection (specific events only).
- [ ] Verify environment variables are correctly injected.

> ### 8. Documentation & Examples

- [ ] Revise `README.md`/`GETTING-STARTED.md` to surface new output patterns:
  ```ts
  return {
    continue: false,
    stopReason: 'blocked',
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: 'Command writes to /etc',
    },
  };
  ```
- [ ] Add Notification hook example (idle timeout handler) in `packages/examples`.
- [ ] Update CLI docs to explain new matcher syntax and MCP tooling (`packages/hooks-cli` commands).
- [ ] Document migration guidance (legacy `success/block` conversions, new exit codes) in `RELEASE-PREFLIGHT.md`.
- [ ] Record the work in `CHANGELOG.md` under the upcoming release.

> ### 9. Tooling & Release Tasks

- [ ] Add CI job `claude-compliance` running the new spec suite + lint/type checks.
- [ ] Ensure `ultracite format` / biome configs know about any new files.
- [ ] Prepare release notes summarizing breaking changes (exit code behavior, matcher syntax).
- [ ] Tag release once the stack is merged; update `claude-hooks-*` binaries if necessary.

---

> **Dependencies & Open Questions**

- Confirm latest Claude Code SDK version (recommend `@anthropic-ai/claude-code@^1.0.0` based on current patterns).
- Validate whether SDK surfaces structured `notification` payload beyond message text; adjust schemas accordingly.
- Decide on long-term deprecation timeline for legacy `HookResults.success/block` helpers (proposal: deprecate now, remove v0.x+2).
- Determine reasonable context concatenation limits to prevent truncation issues.
- Define retry logic strategy for transient hook failures.

---

> **Next Actions**

1. Create compliance spec + matrix docs (pre-work before stack).
2. Start stack with `gt create -m "feat(types): align with Claude Code SDK types"` for PR 0.
3. Build stack incrementally, testing each PR before moving to next.

### Graphite Commands for Stack Creation

```bash
# Start from main
gt checkout main
gt sync

# PR 0: Types
# Make type changes...
gt create -m "feat(types): align with Claude Code SDK types and schemas"

# PR 1: Context
# Make context changes...
gt create -m "feat(context): add environment variables and new context fields"

# PR 2: Protocol
# Make protocol changes...
gt create -m "feat(protocol): handle stop_hook_active and new input parsing"

# PR 3: Execution
# Make execution changes...
gt create -m "feat(execution): implement timeouts, exit codes, and JSON handling"

# PR 4: Config
# Make config changes...
gt create -m "feat(config): add multi-hook support and MCP validation"

# PR 5: Integration
# Add integration tests...
gt create -m "test(integration): add Claude Code compliance test suite"

# PR 6: Docs
# Update documentation...
gt create -m "docs: add migration guide and compliance examples"

# Submit the stack
gt submit --stack --no-interactive
```

---

> **Glossary**

- _Hook-specific output_: JSON placed under `hookSpecificOutput` (e.g., `permissionDecision`).
- _Blocking outcome_: Any response that stops the tool (permission deny, `stopReason === "blocked"`, exit code `2`).
- _MCP tool names_: Names reported as `mcp__<server>__<tool>`; must be supported in matchers/config (no wildcards).
- _stop_hook_active_: Flag sent by Claude when a Stop/SubagentStop hook is currently forcing a halt.
- _Permission Decision Priority_: `allow` bypasses normal flow, `deny` blocks execution, `ask` forces user confirmation.
- _Context Injection_: Raw stdout from hooks appended to session context (SessionStart/UserPromptSubmit only).
- _Sequential Execution_: Multiple hook commands for same event execute in order, not parallel.

---

> **Implementation Gotchas & Best Practices**

1. **Debug Output Format**: Implement consistent debug logging following Claude Code patterns:
   ```
   [DEBUG] Executing hooks for PostToolUse:Write
   [DEBUG] Getting matching hook commands for PostToolUse with query: Write
   [DEBUG] Found 1 hook matchers in settings
   [DEBUG] Matched 1 hooks for query "Write"
   [DEBUG] Found 1 hook commands to execute
   [DEBUG] Executing hook command: <command> with timeout 60000ms
   [DEBUG] Hook command completed with status 0: <stdout>
   ```

2. **Error Recovery**: Hook failures should be logged but not crash Claude Code. Implement graceful degradation.

3. **Context Limits**: Implement reasonable limits for context concatenation to prevent memory issues.

4. **MCP Validation**: Validate MCP server names against loaded configurations at runtime.

5. **Hook Order**: Within a configuration, hooks execute sequentially. This is critical for dependent operations.

---

> **References**

- Claude Code Hook Reference (Anthropic docs)
- Carabiner provider adapter: `packages/hooks-core/src/providers/claude-adapter.ts`
- Execution engine: `packages/execution/src/executor.ts`
- Config manager: `packages/hooks-config/src/config.ts`
- Claude Code SDK: `@anthropic-ai/claude-code`
