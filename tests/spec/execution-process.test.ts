/**
 * Integration tests covering process execution semantics.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { executeHookProcess, type Hook } from "@carabiner/execution";

function createShellHook(script: string): Hook {
  return {
    command: "sh",
    args: ["-c", script],
  };
}

describe("Hook process exit semantics", () => {
  let hook: Hook;

  beforeEach(() => {
    hook = createShellHook("exit 0");
  });

  test("exit code 0 continues execution", async () => {
    const result = await executeHookProcess(hook);

    expect(result.exitCode).toBe(0);
    expect(result.continue).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.stopReason).toBeUndefined();
  });

  test("exit code 1 surfaces warning without blocking", async () => {
    const warningHook = createShellHook(
      'echo "non-blocking warning" >&2; exit 1'
    );

    const result = await executeHookProcess(warningHook);

    expect(result.exitCode).toBe(1);
    expect(result.continue).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.stopReason).toBe("warning");
    expect(result.stderr).toContain("non-blocking warning");
  });

  test("exit code 2 blocks execution", async () => {
    const blockingHook = createShellHook('echo "critical" >&2; exit 2');

    const result = await executeHookProcess(blockingHook);

    expect(result.exitCode).toBe(2);
    expect(result.continue).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.stopReason).toBe("blocked");
    expect(result.stderr).toContain("critical");
  });
});
