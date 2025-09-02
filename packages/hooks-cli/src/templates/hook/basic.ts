/**
 * Basic hook template
 */

export const basicHookTypeScript = (name: string): string => `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext, stdout } from '@carabiner/hooks-core';

async function handler(ctx: HookContext) {
  stdout.line(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    stdout.line('Executing custom hook logic...');
    return HookResults.success('${name} hook completed successfully');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;

export const basicHookJavaScript = (name: string): string => `#!/usr/bin/env bun

const { runClaudeHook, HookResults, stdout } = require('@carabiner/hooks-core');

async function handler(ctx) {
  stdout.line(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    stdout.line('Executing custom hook logic...');
    return HookResults.success('${name} hook completed successfully');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
