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
      input: preInput.tool_input,
    };
  }

  if (isPostToolUseInput(input)) {
    const postInput = input as PostToolUseHookInput;
    return {
      name: postInput.tool_name,
      input: postInput.tool_input,
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

  return {
    event: input.hook_event_name,
    sessionId: input.session_id,
    cwd: input.cwd,
    transcriptPath,
    userPrompt: isUserPromptSubmitInput(input) ? input.prompt : undefined,
    environment: environment ?? { CLAUDE_PROJECT_DIR: undefined },
    tool: resolveToolContext(input),
    raw: input,
    metadata: {
      provider: CLAUDE_PROVIDER_METADATA,
      receivedAt: new Date().toISOString(),
    },
  };
}

function denormalizeHookResult(result: NormalizedHookResult): HookJSONOutput {
  const {
    providerState: _providerState,
    metadata: _metadata,
    ...json
  } = result;
  return { ...json } as HookJSONOutput;
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
