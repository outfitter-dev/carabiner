/**
 * Concrete hook context types
 * Replaces complex generics with simple, discoverable types
 */

import type { DirectoryPath, SessionId, TranscriptPath } from './brands';
import type {
  HookEvent,
  NotificationEvent,
  ToolHookEvent,
  ToolName,
} from './events';
import type { ToolInput, ToolInputMap } from './tools';

/**
 * Hook environment variables
 */
export type HookEnvironment = {
  readonly CLAUDE_PROJECT_DIR?: string;
};

/**
 * Base context shared by all hooks
 */
export type BaseHookContext = {
  readonly event: HookEvent;
  readonly sessionId: SessionId;
  readonly transcriptPath: TranscriptPath;
  readonly cwd: DirectoryPath;
  readonly matcher?: string;
  readonly environment: HookEnvironment;
};

/**
 * Tool hook context (PreToolUse, PostToolUse)
 */
export interface ToolHookContext extends BaseHookContext {
  readonly event: ToolHookEvent;
  readonly toolName: ToolName;
  readonly toolInput: ToolInput;
  readonly toolResponse?: Record<string, unknown>; // PostToolUse only
}

/**
 * Specific tool contexts for better type safety
 */
export interface BashHookContext extends BaseHookContext {
  readonly event: ToolHookEvent;
  readonly toolName: 'Bash';
  readonly toolInput: ToolInputMap['Bash'];
  readonly toolResponse?: Record<string, unknown>;
}

export interface FileHookContext extends BaseHookContext {
  readonly event: ToolHookEvent;
  readonly toolName: 'Write' | 'Edit' | 'Read';
  readonly toolInput:
    | ToolInputMap['Write']
    | ToolInputMap['Edit']
    | ToolInputMap['Read'];
  readonly toolResponse?: Record<string, unknown>;
}

export interface SearchHookContext extends BaseHookContext {
  readonly event: ToolHookEvent;
  readonly toolName: 'Glob' | 'Grep';
  readonly toolInput: ToolInputMap['Glob'] | ToolInputMap['Grep'];
  readonly toolResponse?: Record<string, unknown>;
}

/**
 * User prompt hook context
 */
export interface UserPromptHookContext extends BaseHookContext {
  readonly event: 'UserPromptSubmit';
  readonly userPrompt: string;
}

/**
 * Notification hook context
 */
export interface NotificationHookContext extends BaseHookContext {
  readonly event: NotificationEvent;
  readonly message?: string;
}

/**
 * Union of all possible hook contexts
 */
export type HookContext =
  | ToolHookContext
  | BashHookContext
  | FileHookContext
  | SearchHookContext
  | UserPromptHookContext
  | NotificationHookContext;

/**
 * Context discriminated by event type
 */
export type PreToolUseContext = ToolHookContext & {
  readonly event: 'PreToolUse';
};
export type PostToolUseContext = ToolHookContext & {
  readonly event: 'PostToolUse';
  readonly toolResponse: Record<string, unknown>;
};
export type SessionStartContext = NotificationHookContext & {
  readonly event: 'SessionStart';
};
export type StopContext = NotificationHookContext & { readonly event: 'Stop' };
export type SubagentStopContext = NotificationHookContext & {
  readonly event: 'SubagentStop';
};

/**
 * Hook handler function types
 */
export type HookHandler<TContext extends HookContext = HookContext> = (
  context: TContext
) => Promise<import('./events').HookResult> | import('./events').HookResult;

export type ToolHookHandler = HookHandler<ToolHookContext>;
export type BashHookHandler = HookHandler<BashHookContext>;
export type FileHookHandler = HookHandler<FileHookContext>;
export type UserPromptHandler = HookHandler<UserPromptHookContext>;
export type NotificationHandler = HookHandler<NotificationHookContext>;

/**
 * Specific event handlers
 */
export type PreToolUseHandler = HookHandler<PreToolUseContext>;
export type PostToolUseHandler = HookHandler<PostToolUseContext>;
export type SessionStartHandler = HookHandler<SessionStartContext>;
export type StopHandler = HookHandler<StopContext>;
export type SubagentStopHandler = HookHandler<SubagentStopContext>;

/**
 * Type guards for context discrimination
 */
export function isToolHookContext(
  context: HookContext
): context is ToolHookContext {
  return context.event === 'PreToolUse' || context.event === 'PostToolUse';
}

export function isBashHookContext(
  context: HookContext
): context is BashHookContext {
  return isToolHookContext(context) && context.toolName === 'Bash';
}

export function isFileHookContext(
  context: HookContext
): context is FileHookContext {
  return (
    isToolHookContext(context) &&
    ['Write', 'Edit', 'Read'].includes(context.toolName)
  );
}

export function isSearchHookContext(
  context: HookContext
): context is SearchHookContext {
  return (
    isToolHookContext(context) && ['Glob', 'Grep'].includes(context.toolName)
  );
}

export function isUserPromptContext(
  context: HookContext
): context is UserPromptHookContext {
  return context.event === 'UserPromptSubmit';
}

export function isNotificationContext(
  context: HookContext
): context is NotificationHookContext {
  return ['SessionStart', 'Stop', 'SubagentStop'].includes(context.event);
}

export function isPreToolUseContext(
  context: HookContext
): context is PreToolUseContext {
  return context.event === 'PreToolUse';
}

export function isPostToolUseContext(
  context: HookContext
): context is PostToolUseContext {
  return context.event === 'PostToolUse';
}

/**
 * Context creation helpers
 */
export type CreateContextOptions = {
  readonly sessionId: SessionId;
  readonly transcriptPath: TranscriptPath;
  readonly cwd: DirectoryPath;
  readonly matcher?: string;
  readonly environment?: HookEnvironment;
};

export function createToolHookContext(
  event: ToolHookEvent,
  toolName: ToolName,
  toolInput: ToolInput,
  options: CreateContextOptions,
  toolResponse?: Record<string, unknown>
): ToolHookContext {
  return {
    event,
    toolName,
    toolInput,
    toolResponse,
    ...options,
    environment: options.environment || {},
  };
}

export function createUserPromptContext(
  userPrompt: string,
  options: CreateContextOptions
): UserPromptHookContext {
  return {
    event: 'UserPromptSubmit',
    userPrompt,
    ...options,
    environment: options.environment || {},
  };
}

export function createNotificationContext(
  event: NotificationEvent,
  options: CreateContextOptions,
  message?: string
): NotificationHookContext {
  return {
    event,
    message,
    ...options,
    environment: options.environment || {},
  };
}
