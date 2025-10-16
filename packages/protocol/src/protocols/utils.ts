import type { HookResult } from "@carabiner/types";

/**
 * Ensure HookResult objects expose both legacy `success` and new `continue` flags.
 *
 * Claude SDK v2 prefers `continue`, but older integrations still set `success`.
 * When `continue` is missing we derive it from the boolean `success` value so
 * downstream consumers can rely on a consistent shape.
 */
export function normalizeHookResult(result: HookResult): HookResult {
  if (
    result.continue === undefined &&
    typeof (result as { success?: unknown }).success === "boolean"
  ) {
    const { success } = result as { success: boolean };
    return {
      ...result,
      continue: success,
    };
  }

  return result;
}
