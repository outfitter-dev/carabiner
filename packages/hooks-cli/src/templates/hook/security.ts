/**
 * Security hook template
 */

export const securityHookTypeScript = (
  name: string
): string => `#!/usr/bin/env bun

import { runClaudeHook, HookResults, type HookContext } from '@outfitter/hooks-core';
import { SecurityValidators } from '@outfitter/hooks-validators';

async function handler(ctx: HookContext) {
  console.log(\`🔒 ${name} security hook triggered for: \${ctx.toolName}\`);

  try {
    // Apply security validation based on environment
    const environment = Bun.env.NODE_ENV as 'development' | 'production' | 'test' || 'development';
    
    switch (environment) {
      case 'production':
        SecurityValidators.production(ctx);
        break;
      case 'development':
        SecurityValidators.development(ctx);
        break;
      default:
        SecurityValidators.strict(ctx);
    }

    // Additional custom security checks
    await performSecurityChecks(ctx);

    return HookResults.success(\`Security validation passed for \${ctx.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Security validation failed'
    );
  }
}

/**
 * Perform additional security checks
 */
async function performSecurityChecks(context: HookContext): Promise<void> {
  // Add your custom security logic here
  
  // Example: Check for suspicious patterns in bash commands
  if (context.toolName === 'Bash' && 'command' in context.toolInput) {
    const command = context.toolInput.command as string;
    const suspiciousPatterns = [
      /curl.*|.*sh/i,     // Piped curl to shell
      /base64.*-d/i,       // Base64 decoding
      /eval.*\\$\\(/i,        // Shell evaluation
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(command)) {
        throw new Error(\`Suspicious pattern detected in command\`);
      }
    }
  }

  // Example: Rate limiting check
  const rateLimitKey = \`\${context.sessionId}:\${context.toolName}\`;
  // Implement rate limiting logic here
}

if (import.meta.main) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

export { handler };
`;

export const securityHookJavaScript = (
  name: string
): string => `#!/usr/bin/env bun

const { runClaudeHook, HookResults } = require('@outfitter/hooks-core');
const { SecurityValidators } = require('@outfitter/hooks-validators');

async function handler(ctx) {
  console.log(\`🔒 ${name} security hook triggered for: \${ctx.toolName}\`);

  try {
    // Apply security validation based on environment
    const environment = process.env.NODE_ENV || 'development';
    
    switch (environment) {
      case 'production':
        SecurityValidators.production(ctx);
        break;
      case 'development':
        SecurityValidators.development(ctx);
        break;
      default:
        SecurityValidators.strict(ctx);
    }

    // Additional custom security checks
    await performSecurityChecks(ctx);

    return HookResults.success(\`Security validation passed for \${ctx.toolName}\`);
  } catch (error) {
    return HookResults.block(
      error instanceof Error ? error.message : 'Security validation failed'
    );
  }
}

/**
 * Perform additional security checks
 */
async function performSecurityChecks(context) {
  // Add your custom security logic here
  
  // Example: Check for suspicious patterns in bash commands
  if (context.toolName === 'Bash' && context.toolInput?.command) {
    const suspiciousPatterns = [
      /curl.*|.*sh/i,     // Piped curl to shell
      /base64.*-d/i,       // Base64 decoding
      /eval.*\\$\\(/i,        // Shell evaluation
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(context.toolInput.command)) {
        throw new Error(\`Suspicious pattern detected in command\`);
      }
    }
  }

  // Example: Rate limiting check
  const rateLimitKey = \`\${context.sessionId}:\${context.toolName}\`;
  // Implement rate limiting logic here
}

if (require.main === module) {
  await runClaudeHook(handler, { timeout: 10_000 });
}

module.exports = { handler };
`;
