import claudePackageJson from "@anthropic-ai/claude-code/package.json" with {
  type: "json",
};
import type { PackageJson } from "type-fest";
import type {
  HookEnvironment,
  HookInput,
  HookJSONOutput,
  PostToolUseHookInput,
  PreToolUseHookInput,
  ToolInput,
} from "../types";
import {
  isPostToolUseInput,
  isPreToolUseInput,
  isUserPromptSubmitInput,
} from "../types";
import type {
  HookProviderAdapter,
  HookProviderMetadata,
  NormalizedHookContext,
  NormalizedHookResult,
  NormalizedToolContext,
} from "./types";

const CLAUDE_PACKAGE = claudePackageJson as PackageJson;
const CLAUDE_SDK_VERSION =
  typeof CLAUDE_PACKAGE.version === "string"
    ? CLAUDE_PACKAGE.version
    : "unknown";

const CLAUDE_SUPPORTED_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
] as const;

const CLAUDE_SUPPORTED_TOOLS = [
  "Agent",
  "Bash",
  "BashOutput",
  "Edit",
  "MultiEdit",
  "Write",
  "Read",
  "Glob",
  "Grep",
  "KillShell",
  "NotebookEdit",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "ExitPlanMode",
  "ListMcpResources",
  "ReadMcpResource",
] as const;

export const CLAUDE_PROVIDER_METADATA: HookProviderMetadata = {
  id: "claude",
  name: "Claude Code",
  displayName: "Anthropic Claude Code",
  version: CLAUDE_SDK_VERSION,
  runtime: "claude-code",
  supports: {
    events: CLAUDE_SUPPORTED_EVENTS,
    tools: CLAUDE_SUPPORTED_TOOLS,
    capabilities: ["mcp", "tool-use"],
  },
  links: {
    homepage: "https://www.anthropic.com/claude",
    docs: "https://docs.anthropic.com/claude/reference/claude-code-hooks",
  },
};

function resolveToolContext(
  input: HookInput
): NormalizedToolContext | undefined {
  if (isPreToolUseInput(input)) {
    const preInput = input as PreToolUseHookInput;
    return {
      name: preInput.tool_name,
      input: preInput.tool_input as ToolInput | Record<string, unknown>,
    };
  }

  if (isPostToolUseInput(input)) {
    const postInput = input as PostToolUseHookInput;
    return {
      name: postInput.tool_name,
      input: postInput.tool_input as ToolInput | Record<string, unknown>,
      response: postInput.tool_response,
    };
  }

  return;
}

function buildNormalizedContext(
  input: HookInput,
  environment: HookEnvironment | undefined
): NormalizedHookContext<HookInput> {
  const transcriptPath =
    "transcript_path" in input ? input.transcript_path : undefined;

  // CRITICAL: Preserve ALL fields from Claude Code SDK
  // Do NOT strip fields like permission_decision, stop_hook_active, etc.
  const enhancedInput = {
    ...input,
  } as any;

  // Map snake_case to camelCase if needed, but preserve all data
  // Only add camelCase versions if the original field exists
  if ("stop_hook_active" in input) {
    enhancedInput.stopHookActive = input.stop_hook_active;
  }
  if ("hook_specific_input" in input) {
    enhancedInput.hookSpecificInput = input.hook_specific_input;
  }
  // Preserve notification_type for Notification events
  if ("notification_type" in input) {
    enhancedInput.notificationType = input.notification_type;
  }
  // Preserve pre_compact_trigger for PreCompact events
  if ("pre_compact_trigger" in input) {
    enhancedInput.preCompactTrigger = input.pre_compact_trigger;
  }

  return {
    event: input.hook_event_name,
    sessionId: input.session_id,
    cwd: input.cwd,
    transcriptPath,
    userPrompt: isUserPromptSubmitInput(input) ? input.prompt : undefined,
    environment: environment ?? { CLAUDE_PROJECT_DIR: undefined },
    tool: resolveToolContext(input),
    raw: enhancedInput as HookInput,
    metadata: {
      provider: CLAUDE_PROVIDER_METADATA,
      receivedAt: new Date().toISOString(),
    },
  };
}

function denormalizeHookResult(result: NormalizedHookResult): HookJSONOutput {
  // Pass through hookSpecificOutput untouched
  // This includes permissionDecision, permissionDecisionReason
  const {
    providerState: _providerState,
    metadata: _metadata,
    success: _legacySuccess,
    message: _legacyMessage,
    block: _legacyBlock,
    data: _legacyData,
    ...json
  } = result;

  // Build output object excluding undefined fields
  const output: any = {};

  if (result.continue !== undefined) {
    output.continue = result.continue;
  }
  if (result.stopReason !== undefined) {
    output.stopReason = result.stopReason;
  }
  if (result.suppressOutput !== undefined) {
    output.suppressOutput = result.suppressOutput;
  }
  if (result.systemMessage !== undefined) {
    output.systemMessage = result.systemMessage;
  }
  if (result.hookSpecificOutput !== undefined) {
    output.hookSpecificOutput = result.hookSpecificOutput;
  }
  if (result.additionalContext !== undefined) {
    output.additionalContext = result.additionalContext;
  }

  // Include any other fields from json that aren't already handled
  const jsonRecord = json as Record<string, unknown>;

  Object.entries(jsonRecord).forEach(([key, value]) => {
    if (value !== undefined && !(key in output)) {
      (output as Record<string, unknown>)[key] = value;
    }
  });

  return output as HookJSONOutput;
}

export const claudeProviderAdapter: HookProviderAdapter<
  HookInput,
  HookJSONOutput
> = {
  id: "claude",
  metadata: CLAUDE_PROVIDER_METADATA,
  fromProviderInput(
    input: HookInput,
    environment?: HookEnvironment
  ): NormalizedHookContext<HookInput> {
    return buildNormalizedContext(input, environment);
  },
  toProviderOutput(
    result: NormalizedHookResult,
    _context: NormalizedHookContext<HookInput>
  ): HookJSONOutput {
    return denormalizeHookResult(result);
  },
};
