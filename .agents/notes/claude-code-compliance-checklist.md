# Claude Code Compliance Checklist

This guide captures the concrete fixes we still need before the Claude Code compliance stack can merge. Use it as the source of truth while patching each branch in the stack.

## 1. Type Exports and Helpers ✅

Helpers implemented in `packages/types/src/decisions.ts` (`MCP_TOOL_NAME_PATTERN`, `isMCPToolName`, `validateMCPToolName`) and re-exported via `packages/types/src/index.ts`. Docs + examples updated to match the new signature and unit tests extended (`packages/types/src/__tests__/decisions.test.ts`).

## 2. Protocol Parsing ✅

`parseStdinInput` now returns the Claude payload with camelCase mirrors for `stop_hook_active`, `hook_specific_input`, notification/pre-compact helpers, and throws early on invalid JSON. `TestProtocol` can construct contexts for every Claude event. Added integration coverage (`tests/spec/protocol-stdin.test.ts`) and refreshed unit expectations in `packages/protocol/src/__tests__/stdin.test.ts`.

## 3. Execution Semantics ✅

Removed the stray `await`, introduced `HookProcessResult` so the CLI gets structured exit information instead of `process.exit`, and tightened permission-decision handling in `HookExecutor`. Tests updated (`packages/execution/src/__tests__/timeout.test.ts`, `packages/execution/src/__tests__/executor.test.ts`).

## 4. Configuration Compatibility ✅

`HookConfiguration` now accepts legacy maps or new multi-hook arrays. `toHookConfigItems` normalizes both, validation covers each shape, and downstream consumers handle the merged format. Default config + CLI generation stay backwards compatible.

## 5. Testing Strategy ✅

Removed committed `test-results/*` artifacts and added a dedicated protocol parsing spec (`tests/spec/protocol-stdin.test.ts`) that exercises existing fixtures. Full `bun test` passes.

## 6. Documentation Examples ✅

All MCP examples reference the real helpers and new tuple return shape (README, migration guide, troubleshooting, playground JSON). Compliance suite runs green (`bun test`).

**Next:** feature branches should rebase onto this stack and drop redundant local patches. Add commit hashes once merged to `main`.
