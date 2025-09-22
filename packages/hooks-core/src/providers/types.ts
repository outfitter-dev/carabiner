import type { LiteralUnion } from "type-fest";
import type {
  HookEnvironment,
  HookEvent,
  HookJSONOutput,
  HookResult,
  ToolInput,
  ToolName,
} from "../types";

export type HookProviderId = LiteralUnion<"claude", string>;

export type HookProviderMetadata = {
  /** Unique identifier for the provider (human readable slug). */
  readonly id: HookProviderId;
  /** Human facing provider name. */
  readonly name: string;
  /** Optional marketing/display name. */
  readonly displayName?: string;
  /** Version of the underlying SDK/runtime. */
  readonly version: string;
  /** Runtime identifier (e.g. "claude-code", "openai-code"). */
  readonly runtime: string;
  readonly supports: {
    /** Hook events supported by this provider. */
    readonly events: readonly HookEvent[];
    /** Tool names supported by this provider (subset is fine). */
    readonly tools?: readonly ToolName[];
    /** Optional feature flags/capabilities. */
    readonly capabilities?: readonly string[];
  };
  readonly links?: {
    readonly homepage?: string;
    readonly docs?: string;
  };
};

export type NormalizedToolContext = {
  readonly name?: ToolName;
  readonly input?: ToolInput | Record<string, unknown>;
  readonly response?: unknown;
};

export type NormalizedHookContext<TProviderInput = unknown> = {
  readonly event: HookEvent;
  readonly sessionId: string;
  readonly cwd: string;
  readonly transcriptPath?: string;
  readonly userPrompt?: string;
  readonly environment: HookEnvironment;
  readonly tool?: NormalizedToolContext;
  readonly raw: TProviderInput;
  readonly metadata: {
    readonly provider: HookProviderMetadata;
    readonly receivedAt: string;
  };
};

export type NormalizedHookResult = HookResult;

export type HookProviderAdapter<
  TProviderInput = unknown,
  TProviderOutput = HookJSONOutput,
> = {
  readonly id: HookProviderId;
  readonly metadata: HookProviderMetadata;
  /**
   * Normalize raw provider input into Carabiner's provider-neutral context shape.
   */
  fromProviderInput(
    input: TProviderInput,
    environment?: HookEnvironment
  ): NormalizedHookContext<TProviderInput>;
  /**
   * Convert the normalized hook result back into a provider specific payload.
   */
  toProviderOutput(
    result: NormalizedHookResult,
    context: NormalizedHookContext<TProviderInput>
  ): TProviderOutput;
};
