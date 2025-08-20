/**
 * Basic hook template
 */

export const basicHookTypeScript = (name: string): string => `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@outfitter/hooks-core';

async function handler(ctx: HookContext) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    console.log('Executing custom hook logic...');
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

const { runClaudeHook, HookResults } = require('@outfitter/hooks-core');

async function handler(ctx) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);
  
  try {
    // Add your custom logic here
    console.log('Executing custom hook logic...');
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
