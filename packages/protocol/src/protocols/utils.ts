import type { HookResult } from "@carabiner/types";

/**
 * Ensure HookResult objects expose both legacy `success` and new `continue` flags.
 *
 * Claude SDK v2 prefers `continue`, but older integrations still set `success`.
 * When `continue` is missing we derive it from the boolean `success` value so
 * downstream consumers can rely on a consistent shape.
 */
export function normalizeHookResult(result: HookResult): HookResult {
  const hasContinue = typeof result.continue === "boolean";
  const hasSuccess =
    typeof (result as { success?: unknown }).success === "boolean";

  const normalizedContinue = hasContinue
    ? result.continue
    : hasSuccess
      ? (result as { success: boolean }).success
      : undefined;

  const normalizedSuccess = hasSuccess
    ? (result as { success: boolean }).success
    : hasContinue
      ? result.continue !== false
      : undefined;

  return {
    ...result,
    ...(normalizedContinue !== undefined
      ? { continue: normalizedContinue }
      : {}),
    ...(normalizedSuccess !== undefined ? { success: normalizedSuccess } : {}),
  };
}
