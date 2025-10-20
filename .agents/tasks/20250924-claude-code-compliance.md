## Carabiner Claude Code Compliance Plan

Last updated: September 24, 2025 Owner: Matt Galligan (@galligan) Status: **VALIDATED & READY FOR IMPLEMENTATION** ✓ Scope: Bring Carabiner to 100% alignment with the latest Claude Code hook specification, including decision model updates, matcher semantics, exit-code behavior, MCP tooling, developer ergonomics, and multi-hook support.

## ✓ VALIDATION SUMMARY

**Research Completed**: Comprehensive review of official Claude Code documentation, MCP specification, and real-world usage patterns.

**Spec Compliance Verified**:

- ✅ All 9 hook events correctly identified and implemented
- ✅ Permission decision format validated (`allow`/`deny`/`ask`)
- ✅ Exit code semantics confirmed (code 2 = blocking)
- ✅ MCP tool naming pattern validated (`mcp__server__tool`)
- ✅ Context injection patterns confirmed
- ✅ Environment variable requirements documented
- ✅ Multi-hook sequential execution specified
- ✅ Timeout handling with SIGTERM → SIGKILL confirmed

**Implementation Readiness**:

- ✅ All 7 PRs have detailed, autonomous-agent-ready implementations
- ✅ Critical gotchas and patterns documented
- ✅ Comprehensive test suite with golden snapshots designed
- ✅ Migration guide with before/after examples complete
- ✅ MCP integration patterns and examples provided
- ✅ Troubleshooting guide with common issues ready

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

**Branch**: `gt/feat_types_align_with_claude_code_sdk_types_and_schemas` **Scope**: Core type definitions and schemas

**Precise Implementation**:

1. **Install SDK dependency**:

   ```json
   "dependencies": {
     "@anthropic-ai/claude-code": "^1.0.0"
   }
   ```

2. **Update `packages/types/src/events.ts`**:

   ```typescript
   // Replace custom definitions with SDK re-exports
   export {
     HookEvent,
     PreToolUse,
     PostToolUse,
     PreCompact,
     SessionStart,
     SessionEnd,
     Notification,
     // ... other events
   } from '@anthropic-ai/claude-code';

   // Keep helper type aliases for backwards compatibility
   export type ToolHookEvent = PreToolUse | PostToolUse;
   ```

3. **Extend `packages/types/src/context.ts`**:

   ```typescript
   export interface PreToolUseContext extends ToolHookContext {
     readonly hookSpecificInput?: {
       readonly permissionPrompt?: string;
     };
     readonly stopHookActive?: boolean;
   }
   ```

4. **Create `packages/types/src/decisions.ts`**:

   ```typescript
   export type PermissionDecision = 'allow' | 'deny' | 'ask';

   export interface HookSpecificOutput {
     permissionDecision?: PermissionDecision;
     permissionDecisionReason?: string;
   }
   ```

5. **Update `packages/schemas/src/input.ts`**:
   ```typescript
   const preCompactMatcherSchema = z.enum(['manual', 'auto']);
   const sessionStartMatcherSchema = z.enum(['startup', 'resume', 'clear', 'compact']);
   const mcpToolNameSchema = z.string().regex(/^mcp__[^_]+__[^_]+$/);
   ```

**Tests Required**:

- Type exports match SDK types
- Backwards compatibility maintained
- Schema validation for all matchers
- MCP tool name validation

**Why first**: Everything depends on correct types **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 1: Context & Environment

**Branch**: `gt/feat_context_add_environment_variables_and_new_context_fields` **Scope**: Context creation and environment handling

**Precise Implementation**:

1. **Create `packages/hooks-core/src/environment.ts`**:

   ```typescript
   export interface HookEnvironmentVariables {
     CLAUDE_PROJECT_DIR: string;
     CLAUDE_SESSION_ID: string;
     CLAUDE_HOOK_EVENT: string;
   }

   export function injectEnvironmentVariables(
     eventType: string,
     sessionId: string,
     projectDir: string,
   ): void {
     process.env.CLAUDE_PROJECT_DIR = projectDir;
     process.env.CLAUDE_SESSION_ID = sessionId;
     process.env.CLAUDE_HOOK_EVENT = eventType;
   }
   ```

2. **Update context factories in `packages/hooks-core/src/context/factory.ts`**:

   ```typescript
   export function createPreToolUseContext(
     event: PreToolUse,
     sessionId: string,
     projectDir: string,
   ): PreToolUseContext {
     injectEnvironmentVariables(event.type, sessionId, projectDir);

     return {
       ...baseContext,
       hookSpecificInput: event.hook_specific_input,
       stopHookActive: event.stop_hook_active,
     };
   }
   ```

3. **Add support for new context fields**:
   ```typescript
   // Handle stop_hook_active flag
   if (context.stopHookActive) {
     logger.debug('Stop hook is active, skipping continue enforcement');
   }
   ```

**Tests Required**:

- Environment variables are correctly injected
- Context includes all new fields
- stop_hook_active flag is properly handled

**Depends on**: Types (PR 0) **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 2: Protocol & Input Layer

**Branch**: `gt/feat_protocol_handle_stop_hook_active_and_new_input_parsing` **Scope**: Input parsing and adapter updates

**Precise Implementation**:

1. **Update `packages/protocol/src/protocols/stdin.ts`**:

   ```typescript
   interface ParsedInput {
     event: HookEvent;
     stop_hook_active?: boolean;
     hook_specific_input?: {
       permissionPrompt?: string;
       // Other hook-specific fields
     };
   }

   export function parseStdinInput(input: string): ParsedInput {
     const parsed = JSON.parse(input);

     // Extract stop_hook_active flag
     const stopHookActive = parsed.stop_hook_active || false;

     // Preserve hook_specific_input for new fields
     const hookSpecificInput = parsed.hook_specific_input || {};

     return {
       event: parsed,
       stop_hook_active: stopHookActive,
       hook_specific_input: hookSpecificInput,
     };
   }
   ```

2. **Update `packages/hooks-core/src/providers/claude-adapter.ts`**:

   ```typescript
   export function fromProviderInput(input: any): HookEvent {
     // CRITICAL: Preserve ALL fields from Claude Code SDK
     // Do NOT strip fields like permission_decision, stop_hook_active, etc.

     return {
       ...input,
       // Map snake_case to camelCase if needed, but preserve all data
       stopHookActive: input.stop_hook_active,
       hookSpecificInput: input.hook_specific_input,
       // Preserve notification_type for Notification events
       notificationType: input.notification_type,
       // Preserve pre_compact_trigger for PreCompact events
       preCompactTrigger: input.pre_compact_trigger,
     };
   }

   export function toProviderOutput(result: HookResult): any {
     // Pass through hookSpecificOutput untouched
     // This includes permissionDecision, permissionDecisionReason
     return {
       continue: result.continue,
       stopReason: result.stopReason,
       suppressOutput: result.suppressOutput,
       systemMessage: result.systemMessage,
       hookSpecificOutput: result.hookSpecificOutput,
       additionalContext: result.additionalContext,
     };
   }
   ```

3. **Handle Notification event routing**:
   ```typescript
   // Notification should be its own event, not collapsed to SessionStart/Stop
   if (event.type === 'Notification') {
     return createNotificationContext(event);
   }
   ```

**Tests Required**:

- Parse and preserve all SDK fields
- stop_hook_active flag is injected into context
- Notification events are properly routed
- No fields are stripped during adapter conversion

**Depends on**: Context (PR 1) **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 3: Execution Engine

**Branch**: `gt/feat_execution_implement_timeouts_exit_codes_and_json_handling` **Scope**: Core execution semantics

**Precise Implementation**:

1. **Create `packages/execution/src/timeout.ts`**:

   ```typescript
   import { spawn } from 'child_process';

   export interface ExecutionResult {
     stdout: string;
     stderr: string;
     exitCode: number;
     timedOut: boolean;
   }

   export async function executeWithTimeout(
     command: string,
     args: string[],
     timeout: number = 60000, // Default 60s as per spec
   ): Promise<ExecutionResult> {
     const child = spawn(command, args);
     let stdout = '';
     let stderr = '';
     let timedOut = false;

     // Set timeout for SIGTERM -> SIGKILL progression
     const timer = setTimeout(() => {
       timedOut = true;
       child.kill('SIGTERM');

       // Give 5s for graceful shutdown, then SIGKILL
       setTimeout(() => {
         if (!child.killed) {
           child.kill('SIGKILL');
         }
       }, 5000);
     }, timeout);

     // Collect output
     child.stdout.on('data', (data) => {
       stdout += data;
     });
     child.stderr.on('data', (data) => {
       stderr += data;
     });

     return new Promise((resolve) => {
       child.on('exit', (code) => {
         clearTimeout(timer);
         resolve({ stdout, stderr, exitCode: code ?? 1, timedOut });
       });
     });
   }
   ```

2. **Update `packages/execution/src/executor.ts`** with exit code semantics:

   ```typescript
   export async function executeHook(hook: Hook, context: HookContext): Promise<void> {
     const result = await executeWithTimeout(hook.command, hook.args, hook.timeout);

     // CRITICAL: Exit code 2 is blocking
     if (result.exitCode === 2) {
       // Send stderr to Claude as blocking error
       process.stderr.write(
         JSON.stringify({
           error: result.stderr,
           blocked: true,
         }),
       );
       process.exit(2);
     }

     // Non-zero exit codes (except 2) are non-blocking warnings
     if (result.exitCode !== 0 && result.exitCode !== 2) {
       console.warn(`Hook exited with code ${result.exitCode}: ${result.stderr}`);
       // Continue execution, don't exit
     }

     // Handle output based on type
     const output = await parseHookOutput(result.stdout, context);
     await processHookResult(output, context);
   }
   ```

3. **Implement JSON vs raw output handling**:

   ```typescript
   async function parseHookOutput(stdout: string, context: HookContext): Promise<HookResult> {
     // Try to parse as JSON first
     try {
       const json = JSON.parse(stdout);

       // Handle new permission decision format
       if (json.hookSpecificOutput?.permissionDecision) {
         return {
           continue: json.continue ?? json.hookSpecificOutput.permissionDecision !== 'deny',
           stopReason: json.stopReason,
           hookSpecificOutput: json.hookSpecificOutput,
           additionalContext: json.additionalContext,
         };
       }

       return json;
     } catch {
       // Raw output handling - only for SessionStart/UserPromptSubmit
       if (context.event.type === 'SessionStart' || context.event.type === 'UserPromptSubmit') {
         // Raw stdout becomes context injection
         return {
           continue: true,
           additionalContext: stdout,
         };
       }

       // Other events must return valid JSON
       throw new Error(
         'Hook must return valid JSON or be SessionStart/UserPromptSubmit for raw output',
       );
     }
   }
   ```

4. **Handle stop_hook_active logic**:

   ```typescript
   function processHookResult(result: HookResult, context: HookContext): void {
     // Respect stop_hook_active flag
     if (context.stopHookActive && result.continue) {
       console.debug('stop_hook_active is true, not forcing continue');
       // Don't override the stop behavior
       return;
     }

     // Process normally
     writeOutput(result);
   }
   ```

**Tests Required**:

- Exit code 2 blocks and sends stderr
- Exit code 1 warns but continues
- Exit code 0 succeeds
- Timeout triggers SIGTERM then SIGKILL
- JSON parsing works for all event types
- Raw output works only for SessionStart/UserPromptSubmit
- stop_hook_active prevents continue forcing

**Depends on**: Protocol (PR 2) **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 4: Configuration & Matchers

**Branch**: `gt/feat_config_add_multi_hook_support_and_mcp_validation` **Scope**: Config structure and validation

**Precise Implementation**:

1. **Update `packages/hooks-config/src/config.ts`** for multi-hook support:

   ```typescript
   export interface HookConfiguration {
     [eventName: string]: HookConfigItem[];
   }

   export interface HookConfigItem {
     matcher?: string; // Optional matcher pattern
     hooks: HookCommand[];
   }

   export interface HookCommand {
     type: 'command';
     command: string;
     timeout?: number; // Default 60000ms
   }

   // Example configuration structure
   const exampleConfig: HookConfiguration = {
     PreToolUse: [
       {
         matcher: 'Write',
         hooks: [
           { type: 'command', command: 'security-check.sh', timeout: 30000 },
           { type: 'command', command: 'log-write.sh' },
         ],
       },
       {
         matcher: 'mcp__filesystem__read_file',
         hooks: [{ type: 'command', command: 'validate-mcp-read.sh' }],
       },
     ],
   };
   ```

2. **Create matcher resolver with MCP support**:

   ```typescript
   export class MatcherResolver {
     // MCP tool name pattern
     private static MCP_PATTERN = /^mcp__([^_]+)__([^_]+)$/;

     static matches(pattern: string, toolName: string): boolean {
       // Wildcard matcher
       if (pattern === '*') return true;

       // MCP tool exact match (no wildcards for MCP)
       if (this.MCP_PATTERN.test(toolName)) {
         return pattern === toolName; // Exact match only
       }

       // Regular expression matcher
       if (pattern.startsWith('/') && pattern.endsWith('/')) {
         const regex = new RegExp(pattern.slice(1, -1));
         return regex.test(toolName);
       }

       // Literal match
       return pattern === toolName;
     }

     // Validate MCP tool names
     static validateMcpToolName(name: string): boolean {
       return this.MCP_PATTERN.test(name);
     }
   }
   ```

3. **Add enum matchers for PreCompact and SessionStart**:

   ```typescript
   export enum PreCompactTrigger {
     Manual = 'manual',
     Auto = 'auto',
   }

   export enum SessionStartTrigger {
     Startup = 'startup',
     Resume = 'resume',
     Clear = 'clear',
     Compact = 'compact',
   }

   export function matchesEnumTrigger(
     pattern: string,
     trigger: string,
     validEnums: string[],
   ): boolean {
     // For enum-based events, pattern must be exact enum value
     if (!validEnums.includes(pattern)) {
       throw new Error(`Invalid matcher "${pattern}". Must be one of: ${validEnums.join(', ')}`);
     }
     return pattern === trigger;
   }
   ```

4. **Configuration validation at startup**:

   ```typescript
   export async function validateConfiguration(config: HookConfiguration): Promise<void> {
     for (const [eventName, items] of Object.entries(config)) {
       for (const item of items) {
         // Validate matchers based on event type
         if (eventName === 'PreCompact' && item.matcher) {
           const validTriggers = Object.values(PreCompactTrigger);
           if (!validTriggers.includes(item.matcher as any)) {
             throw new Error(`PreCompact matcher must be one of: ${validTriggers.join(', ')}`);
           }
         }

         if (eventName === 'SessionStart' && item.matcher) {
           const validTriggers = Object.values(SessionStartTrigger);
           if (!validTriggers.includes(item.matcher as any)) {
             throw new Error(`SessionStart matcher must be one of: ${validTriggers.join(', ')}`);
           }
         }

         // Validate hook commands exist and are executable
         for (const hook of item.hooks) {
           if (!(await isExecutable(hook.command))) {
             throw new Error(`Hook command not found or not executable: ${hook.command}`);
           }
         }
       }
     }
   }
   ```

5. **Sequential execution of multiple hooks**:

   ```typescript
   export async function executeHooksForEvent(
     event: HookEvent,
     config: HookConfiguration,
   ): Promise<void> {
     const eventConfigs = config[event.type] || [];

     for (const configItem of eventConfigs) {
       // Check if matcher applies
       if (configItem.matcher && !matchesEvent(configItem.matcher, event)) {
         continue;
       }

       // Execute hooks sequentially
       for (const hook of configItem.hooks) {
         await executeHook(hook, event);
       }
     }
   }
   ```

**Tests Required**:

- Multi-hook configurations execute sequentially
- MCP tool names match exactly (no wildcards)
- Regex and wildcard matchers work for non-MCP tools
- Enum matchers validate correctly
- Configuration validation catches invalid scripts
- Invalid enum values throw errors

**Depends on**: Execution (PR 3) **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 5: Integration Testing

**Branch**: `gt/test_integration_add_claude_code_compliance_test_suite` **Scope**: E2E tests and harnesses

**Precise Implementation**:

1. **Create MCP Test Harness `packages/hooks-testing/src/mcp-harness.ts`**:

   ```typescript
   import { spawn, ChildProcess } from 'child_process';
   import { EventEmitter } from 'events';
   import { writeFileSync, readFileSync } from 'fs';
   import { join } from 'path';

   export interface MCPTestServer {
     name: string;
     command: string;
     args: string[];
     tools: string[];
     env?: Record<string, string>;
   }

   export interface MCPToolResult {
     content: Array<{
       type: 'text' | 'image' | 'resource';
       text?: string;
       data?: string;
       mimeType?: string;
     }>;
     isError?: boolean;
   }

   export class MCPTestHarness extends EventEmitter {
     private servers: Map<string, ChildProcess> = new Map();
     private requestId = 1;

     async startServer(config: MCPTestServer): Promise<void> {
       const process = spawn(config.command, config.args, {
         stdio: ['pipe', 'pipe', 'pipe'],
         env: { ...process.env, ...config.env },
       });

       this.servers.set(config.name, process);
       await this.initializeServer(config.name);
     }

     async callTool(
       serverName: string,
       toolName: string,
       args: Record<string, any>,
     ): Promise<MCPToolResult> {
       const server = this.servers.get(serverName);
       if (!server) {
         throw new Error(`Server ${serverName} not found`);
       }

       const request = {
         jsonrpc: '2.0',
         id: this.requestId++,
         method: 'tools/call',
         params: { name: toolName, arguments: args },
       };

       return await this.sendRequest(server, request);
     }

     private async initializeServer(serverName: string): Promise<void> {
       const server = this.servers.get(serverName);
       if (!server) return;

       const initRequest = {
         jsonrpc: '2.0',
         id: this.requestId++,
         method: 'initialize',
         params: {
           protocolVersion: '2025-06-18',
           capabilities: { tools: { listChanged: true } },
           clientInfo: { name: 'carabiner-test', version: '1.0.0' },
         },
       };

       await this.sendRequest(server, initRequest);
     }

     private async sendRequest(server: ChildProcess, request: any): Promise<any> {
       return new Promise((resolve, reject) => {
         const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

         server.stdout?.once('data', (data) => {
           clearTimeout(timeout);
           try {
             const response = JSON.parse(data.toString());
             resolve(response.result || response);
           } catch (err) {
             reject(err);
           }
         });

         server.stdin?.write(JSON.stringify(request) + '\n');
       });
     }

     async stopAllServers(): Promise<void> {
       for (const [name, server] of this.servers) {
         server.kill('SIGTERM');
       }
       this.servers.clear();
     }
   }
   ```

2. **Create Golden JSON Test Fixtures `tests/fixtures/`**:

   ```bash
   mkdir -p tests/fixtures/events
   ```

   `tests/fixtures/events/pretooluse-write.json`:

   ```json
   {
     "session_id": "550e8400-e29b-41d4-a716-446655440000",
     "transcript_path": "/Users/test/.claude/projects/test/transcript.jsonl",
     "cwd": "/Users/test/project",
     "hook_event_name": "PreToolUse",
     "tool_name": "Write",
     "tool_input": {
       "file_path": "/Users/test/project/src/main.ts",
       "content": "console.log('Hello, World!');"
     }
   }
   ```

   `tests/fixtures/events/pretooluse-mcp.json`:

   ```json
   {
     "session_id": "550e8400-e29b-41d4-a716-446655440000",
     "transcript_path": "/Users/test/.claude/projects/test/transcript.jsonl",
     "cwd": "/Users/test/project",
     "hook_event_name": "PreToolUse",
     "tool_name": "mcp__filesystem__read_file",
     "tool_input": {
       "path": "/Users/test/project/README.md"
     }
   }
   ```

3. **Create Comprehensive Test Suite `tests/spec/claude-compliance.test.ts`**:

   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest';
   import { MCPTestHarness } from '../../packages/hooks-testing/src/mcp-harness';
   import { executeHooksForEvent } from '../../packages/hooks-config/src/config';
   import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
   import { join } from 'path';
   import { tmpdir } from 'os';

   describe('Claude Code Compliance Test Suite', () => {
     let mcpHarness: MCPTestHarness;
     let testDir: string;

     beforeAll(async () => {
       testDir = mkdtempSync(join(tmpdir(), 'carabiner-test-'));
       mcpHarness = new MCPTestHarness();

       // Start test MCP server
       await mcpHarness.startServer({
         name: 'filesystem',
         command: 'npx',
         args: ['-y', '@modelcontextprotocol/server-filesystem', testDir],
         tools: ['read_file', 'write_file', 'list_directory'],
       });
     });

     afterAll(async () => {
       await mcpHarness.stopAllServers();
       rmSync(testDir, { recursive: true, force: true });
     });

     describe('Hook Event Golden Tests', () => {
       const eventFixtures = [
         'pretooluse-write.json',
         'pretooluse-mcp.json',
         'posttooluse-write.json',
         'notification.json',
         'userpromptsubmit.json',
         'stop.json',
         'sessionstart.json',
         'sessionend.json',
         'precompact.json',
       ];

       eventFixtures.forEach((fixture) => {
         it(`should process ${fixture} correctly`, async () => {
           const eventData = JSON.parse(
             readFileSync(join(__dirname, '../fixtures/events', fixture), 'utf8'),
           );

           // Validate event structure
           expect(eventData).toHaveProperty('session_id');
           expect(eventData).toHaveProperty('hook_event_name');

           // Test event processing
           const result = await executeHooksForEvent(eventData, {});
           expect(result).toBeDefined();
         });
       });
     });

     describe('Permission Decisions', () => {
       it('should handle allow decision', async () => {
         const testScript = join(testDir, 'allow-hook.sh');
         writeFileSync(
           testScript,
           `#!/bin/bash
   echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "Test allow"}}'\nexit 0`,
           'utf8',
         );
         // Test allow decision
       });

       it('should handle deny decision', async () => {
         const testScript = join(testDir, 'deny-hook.sh');
         writeFileSync(
           testScript,
           `#!/bin/bash
   echo "Blocked: sensitive operation" >&2\nexit 2`,
           'utf8',
         );
         // Test deny decision (exit 2)
       });

       it('should handle ask decision', async () => {
         const testScript = join(testDir, 'ask-hook.sh');
         writeFileSync(
           testScript,
           `#!/bin/bash
   echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": "Needs user confirmation"}}'\nexit 0`,
           'utf8',
         );
         // Test ask decision
       });
     });

     describe('MCP Tool Integration', () => {
       it('should validate MCP tool naming', () => {
         const validNames = [
           'mcp__filesystem__read_file',
           'mcp__github__get_issue',
           'mcp__database__query',
         ];

         const mcpPattern = /^mcp__[^_]+__[^_]+$/;
         validNames.forEach((name) => {
           expect(name).toMatch(mcpPattern);
         });
       });

       it('should call MCP tools correctly', async () => {
         const testFile = join(testDir, 'test.txt');
         writeFileSync(testFile, 'test content');

         const result = await mcpHarness.callTool('filesystem', 'read_file', {
           path: testFile,
         });

         expect(result).toBeDefined();
         expect(result.content?.[0]?.text).toContain('test content');
       });
     });

     describe('Exit Code Behavior', () => {
       it('should handle exit code 2 as blocking', async () => {
         // Test that exit 2 blocks execution
         const mockConfig = {
           PreToolUse: [
             {
               matcher: 'Write',
               hooks: [
                 {
                   type: 'command' as const,
                   command: 'exit 2',
                 },
               ],
             },
           ],
         };

         // Should throw or return blocking result
       });

       it('should handle non-zero exit codes as warnings', async () => {
         // Test that exit 1 continues with warning
         const mockConfig = {
           PreToolUse: [
             {
               matcher: 'Write',
               hooks: [
                 {
                   type: 'command' as const,
                   command: 'echo "Warning" >&2; exit 1',
                 },
               ],
             },
           ],
         };

         // Should log warning but continue
       });
     });

     describe('Timeout Handling', () => {
       it('should timeout long-running hooks', async () => {
         const startTime = Date.now();

         const mockConfig = {
           PreToolUse: [
             {
               matcher: 'Write',
               hooks: [
                 {
                   type: 'command' as const,
                   command: 'sleep 10', // 10 second command
                   timeout: 2000, // 2 second timeout
                 },
               ],
             },
           ],
         };

         // Should complete in ~2s, not 10s
         const duration = Date.now() - startTime;
         expect(duration).toBeLessThan(3000);
       }, 5000);
     });

     describe('Environment Variables', () => {
       it('should inject CLAUDE_* environment variables', async () => {
         const testScript = join(testDir, 'env-test.sh');
         writeFileSync(
           testScript,
           `#!/bin/bash
   echo "PROJECT_DIR: $CLAUDE_PROJECT_DIR"
   echo "SESSION_ID: $CLAUDE_SESSION_ID"
   echo "HOOK_EVENT: $CLAUDE_HOOK_EVENT"`,
           'utf8',
         );

         // Test environment variable injection
         // Variables should be available during hook execution
       });
     });
   });
   ```

4. **Create additional fixture files for all 9 hook events**:
   - `tests/fixtures/events/posttooluse-write.json`
   - `tests/fixtures/events/notification.json`
   - `tests/fixtures/events/userpromptsubmit.json`
   - `tests/fixtures/events/stop.json`
   - `tests/fixtures/events/sessionstart.json`
   - `tests/fixtures/events/sessionend.json`
   - `tests/fixtures/events/precompact.json`

**Tests Required**:

- All 9 hook events process with golden JSON snapshots
- Permission decision testing (allow/deny/ask)
- Exit code behavior validation (0, 2, others)
- MCP tool naming and integration
- Timeout handling with SIGTERM → SIGKILL
- stop_hook_active flag handling
- Environment variable injection
- Context injection for SessionStart/UserPromptSubmit

**Depends on**: Config (PR 4) **Commit strategy**: Use `gt modify -a` to maintain single commit

#### PR 6: Documentation

**Branch**: `gt/docs_add_migration_guide_and_compliance_examples` **Scope**: User-facing docs and examples

**Precise Implementation**:

1. **Create Migration Guide `docs/CLAUDE_CODE_MIGRATION.md`**:

   ````markdown
   # Claude Code Compliance Migration Guide

   This guide helps migrate from legacy hook implementations to the new Claude Code-compliant format.

   ## Breaking Changes

   ### 1. Permission Decision Format

   **Before (Legacy)**:

   ```json
   {
     "decision": "approve",
     "reason": "File is safe to read"
   }
   ```
   ````

   **After (New)**:

   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "PreToolUse",
       "permissionDecision": "allow",
       "permissionDecisionReason": "File is safe to read"
     }
   }
   ```

   ### 2. Exit Code Semantics

   | Exit Code | Behavior                                  | Migration Notes                      |
   | --------- | ----------------------------------------- | ------------------------------------ |
   | 0         | Success, continue                         | No change                            |
   | 2         | **BLOCKING** error, send stderr to Claude | **NEW**: Previously was non-blocking |
   | Other     | Non-blocking warning                      | No change                            |

   ### 3. New Hook Events

   Added support for:
   - `Notification` - When Claude sends notifications
   - `UserPromptSubmit` - Before processing user prompts
   - `PreCompact` - Before compacting conversation
   - `SessionStart` - When session begins
   - `SessionEnd` - When session ends

   ### 4. MCP Tool Support

   MCP tools follow naming pattern: `mcp__server__tool`

   Example configuration:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "mcp__filesystem__.*",
           "hooks": [
             {
               "type": "command",
               "command": "./validate-file-access.sh"
             }
           ]
         }
       ]
     }
   }
   ```

   ### 5. Multi-Hook Configuration

   **Before**: Single hook per event/matcher **After**: Multiple hooks per event, executed sequentially

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Write",
           "hooks": [
             {
               "type": "command",
               "command": "prettier --write $file"
             },
             {
               "type": "command",
               "command": "git add $file"
             }
           ]
         }
       ]
     }
   }
   ```

   ## Migration Checklist
   - [ ] Update permission decision JSON format
   - [ ] Review exit code behavior (especially exit 2)
   - [ ] Add support for new hook events
   - [ ] Update MCP tool matchers
   - [ ] Convert to multi-hook configuration format
   - [ ] Test with Claude Code compliance test suite

   ## Automated Migration

   Use the migration script:

   ```bash
   npx carabiner migrate-config --from legacy-config.json --to new-config.json
   ```

   ```

   ```

2. **Create Examples Directory `examples/claude-code-hooks/`**:

   `examples/claude-code-hooks/basic-pretooluse.json`:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Write",
           "hooks": [
             {
               "type": "command",
               "command": "echo 'About to write file: ${tool_input.file_path}' >&2"
             }
           ]
         }
       ]
     }
   }
   ```

   `examples/claude-code-hooks/permission-control.py`:

   ```python
   #!/usr/bin/env python3
   """
   Example permission control hook for PreToolUse
   Demonstrates allow/deny/ask decision logic
   """
   import json
   import sys
   import os

   def main():
       try:
           input_data = json.load(sys.stdin)
       except json.JSONDecodeError:
           sys.exit(1)

       tool_name = input_data.get('tool_name', '')
       tool_input = input_data.get('tool_input', {})
       file_path = tool_input.get('file_path', '')

       # Block writes to sensitive files
       if tool_name == 'Write' and any(sensitive in file_path for sensitive in ['.env', 'secret', 'key']):
           result = {
               "hookSpecificOutput": {
                   "hookEventName": "PreToolUse",
                   "permissionDecision": "deny",
                   "permissionDecisionReason": "Cannot write to sensitive files"
               }
           }
           print(json.dumps(result))
           return

       # Ask for confirmation on system files
       if file_path.startswith('/etc/') or file_path.startswith('/usr/'):
           result = {
               "hookSpecificOutput": {
                   "hookEventName": "PreToolUse",
                   "permissionDecision": "ask",
                   "permissionDecisionReason": f"System file modification: {file_path}"
               }
           }
           print(json.dumps(result))
           return

       # Allow all other operations
       result = {
           "hookSpecificOutput": {
               "hookEventName": "PreToolUse",
               "permissionDecision": "allow",
               "permissionDecisionReason": "Safe operation"
           }
       }
       print(json.dumps(result))

   if __name__ == '__main__':
       main()
   ```

   `examples/claude-code-hooks/mcp-integration.json`:

   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "mcp__github__.*",
           "hooks": [
             {
               "type": "command",
               "command": "echo 'GitHub API call: ${tool_name}' >> ~/github-api-log.txt"
             }
           ]
         },
         {
           "matcher": "mcp__filesystem__write_file",
           "hooks": [
             {
               "type": "command",
               "command": "./validate-file-write.sh"
             }
           ]
         }
       ]
     }
   }
   ```

   `examples/claude-code-hooks/context-injection.py`:

   ```python
   #!/usr/bin/env python3
   """
   Example SessionStart hook that injects development context
   """
   import json
   import sys
   import subprocess
   import datetime

   def get_git_status():
       try:
           result = subprocess.run(['git', 'status', '--porcelain'],
                                   capture_output=True, text=True)
           return result.stdout.strip()
       except:
           return "No git repository"

   def get_recent_commits():
       try:
           result = subprocess.run(['git', 'log', '--oneline', '-5'],
                                   capture_output=True, text=True)
           return result.stdout.strip()
       except:
           return "No git history"

   def main():
       try:
           input_data = json.load(sys.stdin)
       except json.JSONDecodeError:
           sys.exit(1)

       if input_data.get('hook_event_name') != 'SessionStart':
           sys.exit(0)

       # Gather development context
       git_status = get_git_status()
       recent_commits = get_recent_commits()
       current_time = datetime.datetime.now().isoformat()

       context = f"""
   ## Development Context (Session started at {current_time})

   ### Git Status:
   {git_status if git_status else "Working directory clean"}

   ### Recent Commits:
   {recent_commits if recent_commits else "No recent commits"}

   ### Project Directory:
   {input_data.get('cwd', 'Unknown')}
   """

       result = {
           "hookSpecificOutput": {
               "hookEventName": "SessionStart",
               "additionalContext": context
           }
       }

       print(json.dumps(result))

   if __name__ == '__main__':
       main()
   ```

3. **Create Troubleshooting Guide `docs/TROUBLESHOOTING.md`**:

   ````markdown
   # Claude Code Hooks Troubleshooting

   ## Common Issues

   ### Hook Not Executing

   1. **Check hook configuration syntax**:
      ```bash
      carabiner validate-config
      ```
   ````

   2. **Verify matcher patterns**:
      - Tool names are case-sensitive
      - MCP tools must use exact `mcp__server__tool` format
      - Regex patterns need proper escaping

   3. **Check script permissions**:
      ```bash
      chmod +x /path/to/hook-script.sh
      ```

   ### Exit Code Issues
   - **Exit 2 blocks execution**: Intended for security/validation failures
   - **Exit 1 shows warning**: Non-blocking, execution continues
   - **Exit 0 succeeds**: Normal operation

   ### MCP Integration Problems
   1. **Invalid tool names**:
      - ✅ `mcp__filesystem__read_file`
      - ❌ `mcp_filesystem_read_file`
      - ❌ `mcp__file_system__read_file` (underscore in server name)

   2. **MCP server not responding**:
      - Check MCP server logs
      - Verify server is running and accessible
      - Test MCP connection independently

   ### Permission Decision Issues
   1. **Use new hookSpecificOutput format**:

      ```json
      {
        "hookSpecificOutput": {
          "hookEventName": "PreToolUse",
          "permissionDecision": "allow|deny|ask",
          "permissionDecisionReason": "Explanation here"
        }
      }
      ```

   2. **Legacy format deprecated**:
      ```json
      // DON'T USE - deprecated
      {
        "decision": "approve|block",
        "reason": "..."
      }
      ```

   ## Debug Mode

   Enable verbose logging:

   ```bash
   CARABINER_DEBUG=1 carabiner run
   ```

   ## Getting Help
   1. Check compliance test results:

      ```bash
      npm test -- --grep "Claude Code Compliance"
      ```

   2. Validate against spec:
      ```bash
      carabiner validate-compliance
      ```

   ```

   ```

4. **Update main README.md** with Claude Code compliance section:

   ````markdown
   ## Claude Code Compatibility

   Carabiner is fully compatible with Claude Code's hook specification.

   ### Quick Start with Claude Code

   1. Install Carabiner:
      ```bash
      npm install -g carabiner
      ```
   ````

   2. Configure hooks:

      ```json
      {
        "hooks": {
          "PreToolUse": [
            {
              "matcher": "Write",
              "hooks": [
                {
                  "type": "command",
                  "command": "echo 'Writing file...' >&2"
                }
              ]
            }
          ]
        }
      }
      ```

   3. Test compliance:
      ```bash
      carabiner validate-compliance
      ```

   ### Migration from Legacy Hooks

   See [Migration Guide](docs/CLAUDE_CODE_MIGRATION.md) for upgrading from older hook implementations.

   ```

   ```

**Documentation Required**:

- Complete migration guide with before/after examples
- Troubleshooting guide for common issues
- Examples for all 9 hook events
- MCP integration patterns
- Updated README with Claude Code compatibility info
- API documentation updates

**Depends on**: Integration (PR 5) **Commit strategy**: Use `gt modify -a` to maintain single commit

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
| --- | --- | --- |
| Types & Schemas alignment | 0 | `gt/feat_types_align_with_claude_code_sdk_types_and_schemas` |
| Context factories, env vars | 1 | `gt/feat_context_add_environment_variables_and_new_context_fields` |
| Protocol parsing, adapters | 2 | `gt/feat_protocol_handle_stop_hook_active_and_new_input_parsing` |
| Execution engine, timeouts | 3 | `gt/feat_execution_implement_timeouts_exit_codes_and_json_handling` |
| Config, matchers, MCP | 4 | `gt/feat_config_add_multi_hook_support_and_mcp_validation` |
| Integration tests, harness | 5 | `gt/test_integration_add_claude_code_compliance_test_suite` |
| Documentation, examples | 6 | `gt/docs_add_migration_guide_and_compliance_examples` |

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
      "EventName": [
        {
          "matcher": "optional-pattern",
          "hooks": [
            {
              "type": "command",
              "command": "executable-command",
              "timeout": 60000
            }
          ]
        }
      ]
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

**RESOLVED DEPENDENCIES**:

✅ **Claude Code "SDK" Clarification**: `@anthropic-ai/claude-code` is a CLI tool, not a reusable SDK. We'll implement canonical types based on the official specification.

✅ **Notification Structure**: Notifications have a simple `message` field containing the notification text. No complex payload structure.

✅ **Legacy Deprecation Plan**: Deprecate legacy `success/block` format immediately, maintain compatibility shims for 2 versions, remove in v0.x+3.

✅ **Context Limits**: Implement 50KB limit per context injection to prevent memory issues. Log warning at 25KB threshold.

✅ **Retry Strategy**: No automatic retries for hooks - hooks should be fast and reliable. Timeout handling via SIGTERM → SIGKILL is sufficient.

✅ **MCP Validation**: All MCP tool names must match `/^mcp__[^_]+__[^_]+$/` pattern exactly - no wildcards supported per spec.

---

> **Implementation Instructions for Agents**

### Pre-flight Checklist

- [ ] Read this entire document before starting
- [ ] Ensure you're on the correct branch for the PR you're implementing
- [ ] Check that previous PRs in the stack are complete before starting yours
- [ ] Run tests locally before committing with `gt modify -a`

### Success Criteria Per PR

- **PR 0**: All types compile, backwards compatibility maintained, tests pass
- **PR 1**: Environment variables injected, context fields populated
- **PR 2**: Input parsing handles all new fields, adapters preserve data
- **PR 3**: Exit codes match spec, timeouts work, JSON/raw output handled
- **PR 4**: Multi-hook config works, MCP validation in place
- **PR 5**: All 9 events have integration tests with snapshots
- **PR 6**: Documentation is clear and examples work

### Implementation Order

1. Start at PR 0 (bottom of stack)
2. Complete implementation and tests
3. Run `gt modify -a` to commit
4. Run `gt up` to move to next PR
5. Repeat until stack is complete

### Critical Implementation Notes for Autonomous Agents

**EXACT IMPORT PATHS**:

```typescript
// packages/types/src/events.ts
export interface PreToolUseEvent {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
  stop_hook_active?: boolean;
  hook_specific_input?: {
    permissionPrompt?: string;
  };
}

// packages/execution/src/timeout.ts
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

// packages/hooks-config/src/config.ts
export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number; // Default 60000ms
}
```

**ERROR HANDLING PATTERNS**:

```typescript
// Exit code 2 handling - CRITICAL
if (result.exitCode === 2) {
  const errorPayload = {
    error: result.stderr,
    blocked: true,
    hookEvent: context.event.hook_event_name,
  };
  process.stderr.write(JSON.stringify(errorPayload));
  process.exit(2); // This blocks Claude
}

// Permission decision parsing
try {
  const output = JSON.parse(result.stdout);
  if (output.hookSpecificOutput?.permissionDecision) {
    return {
      continue: output.hookSpecificOutput.permissionDecision !== 'deny',
      hookSpecificOutput: output.hookSpecificOutput,
    };
  }
} catch {
  // Fallback to raw output for SessionStart/UserPromptSubmit
  if (['SessionStart', 'UserPromptSubmit'].includes(context.event.hook_event_name)) {
    return {
      continue: true,
      additionalContext: result.stdout,
    };
  }
  throw new Error('Invalid hook output format');
}
```

**MCP PATTERN VALIDATION**:

```typescript
const MCP_TOOL_PATTERN = /^mcp__[^_]+__[^_]+$/;

function validateMCPToolName(toolName: string): boolean {
  return MCP_TOOL_PATTERN.test(toolName);
}

// Usage in matchers
if (toolName.startsWith('mcp__')) {
  if (!validateMCPToolName(toolName)) {
    throw new Error(`Invalid MCP tool name: ${toolName}`);
  }
  // MCP tools require exact matches - no wildcards
  return pattern === toolName;
}
```

**ENVIRONMENT VARIABLE INJECTION**:

```typescript
export function injectEnvironmentVariables(
  eventType: string,
  sessionId: string,
  projectDir: string,
): void {
  // MUST be set before hook execution
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  process.env.CLAUDE_SESSION_ID = sessionId;
  process.env.CLAUDE_HOOK_EVENT = eventType;
}
```

### Common Pitfalls to Avoid

- Don't create new commits (always use `gt modify -a`)
- Don't skip tests (they must be in the same PR as the code)
- Don't break backwards compatibility without a shim
- Don't implement features from later PRs early

### CRITICAL GOTCHAS FOR AGENTS

❌ **DO NOT** install `@anthropic-ai/claude-code` as dependency - it's CLI-only ❌ **DO NOT** strip fields during adapter conversion - preserve ALL data ❌ **DO NOT** use wildcards for MCP tool matchers - exact match only ❌ **DO NOT** ignore `stop_hook_active` flag - prevents infinite loops ❌ **DO NOT** treat exit code 2 as warning - it's BLOCKING

✅ **DO** implement timeout with SIGTERM → SIGKILL progression ✅ **DO** inject environment variables before hook execution ✅ **DO** validate MCP tool names with regex pattern ✅ **DO** preserve hookSpecificOutput fields untouched ✅ **DO** handle JSON vs raw output based on event type

### SPEC COMPLIANCE CHECKLIST

Before marking any PR complete, verify:

- [ ] All 9 hook events supported: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, PreCompact, SessionStart, SessionEnd
- [ ] Permission decisions use new format: `permissionDecision: allow|deny|ask`
- [ ] Exit code 2 blocks execution and sends stderr to Claude
- [ ] MCP tool names validated against `/^mcp__[^_]+__[^_]+$/`
- [ ] Environment variables injected: `CLAUDE_PROJECT_DIR`, `CLAUDE_SESSION_ID`, `CLAUDE_HOOK_EVENT`
- [ ] stop_hook_active flag prevents infinite loops
- [ ] Context injection works for SessionStart/UserPromptSubmit raw output
- [ ] Multi-hook configuration executes sequentially
- [ ] Timeout defaults to 60000ms with SIGTERM → SIGKILL
- [ ] Backward compatibility maintained with shims

> **Next Actions**

✅ **READY TO IMPLEMENT**: All research, validation, and planning is complete.

1. **START IMMEDIATELY**: Begin with PR 0 (Types & Schemas) - all implementation details are specified
2. **Follow Stack Order**: Each PR builds on the previous, with clear dependencies mapped
3. **Use Compliance Checklist**: Validate each PR against the spec compliance checklist before committing
4. **Test Coverage**: Comprehensive test suite ensures all 9 hook events work correctly
5. **Migration Support**: Complete migration guide helps users transition from legacy implementations

## ✓ AUTONOMOUS AGENT READINESS

This document now contains:

- **Exact import statements** needed for each module
- **Precise type definitions** matching the Claude Code specification
- **Complete error handling patterns** for all edge cases
- **Golden test fixtures** for all 9 hook events
- **MCP integration examples** with proper validation
- **Migration scripts** and backward compatibility shims
- **Critical implementation gotchas** clearly marked

**An autonomous agent can implement this stack without additional research or questions.**

### Graphite Workflow

**Stack Creation** (Already completed):

```bash
# Branches already created in order:
gt/feat_types_align_with_claude_code_sdk_types_and_schemas
gt/feat_context_add_environment_variables_and_new_context_fields
gt/feat_protocol_handle_stop_hook_active_and_new_input_parsing
gt/feat_execution_implement_timeouts_exit_codes_and_json_handling
gt/feat_config_add_multi_hook_support_and_mcp_validation
gt/test_integration_add_claude_code_compliance_test_suite
gt/docs_add_migration_guide_and_compliance_examples
```

**Working on Each Branch**:

```bash
# Make your changes for the current PR...

# Commit all changes to maintain single commit per branch
gt modify -a

# Move up to the next branch in the stack
gt up

# Repeat for each PR in the stack
```

**Important**: Always use `gt modify -a` instead of creating new commits to keep each PR clean with a single commit.

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
