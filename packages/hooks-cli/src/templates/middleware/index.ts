/**
 * Middleware template
 */

import { camelCase, pascalCase } from "../../utils/case-conversion.js";

export const middlewareTypeScript = (name: string): string => `/**
 * Custom middleware: ${name}
 */

import type { HookMiddleware, HookContext, HookResult } from '@carabiner/hooks-core';

/**
 * ${pascalCase(name)} middleware
 */
export function ${camelCase(name)}Middleware<T extends HookContext>(): HookMiddleware<T> {
  return async (context: T, next: (context: T) => Promise<HookResult>): Promise<HookResult> => {
    const startTime = Date.now();
    
    try {
      // Pre-processing logic
      console.log(\`[${name}] Starting middleware for \${context.event}:\${context.toolName}\`);
      
      // Add your pre-processing logic here
      await preProcess(context);

      // Execute next middleware or handler
      const result = await next(context);

      // Post-processing logic
      await postProcess(context, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Error handling
      console.error(\`[\${name}] Middleware error:\`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Middleware error',
        metadata: {
          duration: Date.now() - startTime,
          middleware: '${name}'
        }
      };
    }
  };
}

/**
 * Pre-processing logic
 */
async function preProcess(context: HookContext): Promise<void> {
  // Add your pre-processing logic here
  // Examples:
  // - Rate limiting
  // - Authentication checks
  // - Context enrichment
  // - Logging preparation
}

/**
 * Post-processing logic
 */
async function postProcess(
  context: HookContext,
  result: HookResult,
  duration: number
): Promise<void> {
  // Add your post-processing logic here
  // Examples:
  // - Metrics collection
  // - Audit logging
  // - Result transformation
  // - Cleanup tasks
  
  console.log(\`[${name}] Completed in \${duration}ms - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
}

export default ${camelCase(name)}Middleware;
`;

export const middlewareJavaScript = (name: string): string => `/**
 * Custom middleware: ${name}
 */

/**
 * ${pascalCase(name)} middleware
 */
function ${camelCase(name)}Middleware() {
  return async (context, next) => {
    const startTime = Date.now();
    
    try {
      // Pre-processing logic
      console.log(\`[${name}] Starting middleware for \${context.event}:\${context.toolName}\`);
      
      // Add your pre-processing logic here
      await preProcess(context);

      // Execute next middleware or handler
      const result = await next(context);

      // Post-processing logic
      await postProcess(context, result, Date.now() - startTime);

      return result;
    } catch (error) {
      // Error handling
      console.error(\`[\${name}] Middleware error:\`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Middleware error',
        metadata: {
          duration: Date.now() - startTime,
          middleware: '${name}'
        }
      };
    }
  };
}

/**
 * Pre-processing logic
 */
async function preProcess(context) {
  // Add your pre-processing logic here
  // Examples:
  // - Rate limiting
  // - Authentication checks
  // - Context enrichment
  // - Logging preparation
}

/**
 * Post-processing logic
 */
async function postProcess(context, result, duration) {
  // Add your post-processing logic here
  // Examples:
  // - Metrics collection
  // - Audit logging
  // - Result transformation
  // - Cleanup tasks
  
  console.log(\`[${name}] Completed in \${duration}ms - \${result.success ? 'SUCCESS' : 'FAILED'}\`);
}

module.exports = { ${camelCase(name)}Middleware };
`;
