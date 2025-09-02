/**
 * Validation hook template
 */

export const validationHookTypeScript = (
	name: string,
): string => `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@carabiner/hooks-core';
import { validateHookContext } from '@carabiner/hooks-validators';

async function handler(ctx: HookContext) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);

  try {
    // Validate hook context
    const validationResult = await validateHookContext(ctx);
    if (!validationResult.valid) {
      return HookResults.failure(
        \`Validation failed: \${validationResult.errors.map(e => e.message).join(', ')}\`
      );
    }

    // Custom validation logic
    const customValidation = await performCustomValidation(ctx);
    if (!customValidation.valid) {
      return HookResults.failure(customValidation.message);
    }

    return HookResults.success('${name} hook validation passed');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Validation error occurred'
    );
  }
}

/**
 * Perform custom validation logic
 */
async function performCustomValidation(context: HookContext): Promise<{ valid: boolean; message?: string }> {
  // Add your custom validation logic here
  
  // Example: Check tool name
  if (!context.toolName) {
    return { valid: false, message: 'Tool name is required' };
  }

  // Example: Validate environment
  if (!context.environment?.CLAUDE_PROJECT_DIR) {
    return { valid: false, message: 'Invalid project environment' };
  }

  return { valid: true };
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;

export const validationHookJavaScript = (
	name: string,
): string => `#!/usr/bin/env bun

const { runClaudeHook, HookResults } = require('@carabiner/hooks-core');
const { validateHookContext } = require('@carabiner/hooks-validators');

async function handler(ctx) {
  console.log(\`${name} hook triggered for: \${ctx.toolName}\`);

  try {
    // Validate hook context
    const validationResult = await validateHookContext(ctx);
    if (!validationResult.valid) {
      return HookResults.failure(
        \`Validation failed: \${validationResult.errors.map(e => e.message).join(', ')}\`
      );
    }

    // Custom validation logic
    const customValidation = await performCustomValidation(ctx);
    if (!customValidation.valid) {
      return HookResults.failure(customValidation.message);
    }

    return HookResults.success('${name} hook validation passed');
  } catch (error) {
    return HookResults.failure(
      error instanceof Error ? error.message : 'Validation error occurred'
    );
  }
}

/**
 * Perform custom validation logic
 */
async function performCustomValidation(context) {
  // Add your custom validation logic here
  
  // Example: Check tool name
  if (!context.toolName) {
    return { valid: false, message: 'Tool name is required' };
  }

  // Example: Validate environment
  if (!context.environment?.CLAUDE_PROJECT_DIR) {
    return { valid: false, message: 'Invalid project environment' };
  }

  return { valid: true };
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
