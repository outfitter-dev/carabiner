/**
 * Examples of how to use the production logging system
 * 
 * These examples demonstrate enterprise-grade logging practices
 * for different components in the Grapple monorepo.
 */

import { 
  createLogger, 
  createHookLogger, 
  createCliLogger, 
  createProductionLogger,
  createDevelopmentLogger,
} from './factory';
import type { HookExecutionContext, PerformanceMetrics } from './types';

// =============================================================================
// BASIC LOGGING EXAMPLES
// =============================================================================

/**
 * Example 1: Basic service logger
 */
export function basicLoggingExample(): void {
  const logger = createLogger('my-service');
  
  // Simple info logging
  logger.info('Service started successfully');
  
  // Logging with context
  logger.info('Processing user request', {
    userId: 'user123', // Will be hashed for privacy
    requestId: 'req-abc-123',
    endpoint: '/api/data',
  });
  
  // Error logging
  try {
    throw new Error('Database connection failed');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error, 'Failed to connect to database', {
        database: 'production',
        retries: 3,
      });
    }
  }
  
  // Debug logging (only visible in development/debug mode)
  logger.debug('Cache hit for user data', {
    cacheKey: 'user:123:profile',
    ttl: 300,
  });
}

/**
 * Example 2: Environment-specific loggers
 */
export function environmentSpecificLogging(): void {
  // Production logger - optimized for performance
  const prodLogger = createProductionLogger('api-service');
  prodLogger.info('Production service started');
  
  // Development logger - verbose output with pretty printing
  const devLogger = createDevelopmentLogger('api-service');
  devLogger.debug('Development mode active', { features: ['hot-reload', 'debug-tools'] });
}

/**
 * Example 3: Child loggers with persistent context
 */
export function childLoggerExample(): void {
  const baseLogger = createLogger('user-service');
  
  // Create child logger with user context
  const userLogger = baseLogger.child({
    userId: 'user123', // Automatically hashed
    sessionId: 'session-abc-def',
    module: 'authentication',
  });
  
  userLogger.info('User login attempt');
  userLogger.warn('Invalid password attempt', { attempts: 3 });
  userLogger.info('User authenticated successfully');
  
  // Child of child - inheritance of context
  const auditLogger = userLogger.child({
    action: 'profile-update',
    timestamp: new Date().toISOString(),
  });
  
  auditLogger.info('Profile update initiated');
}

// =============================================================================
// HOOK EXECUTION LOGGING
// =============================================================================

/**
 * Example 4: Hook execution logging
 */
export function hookExecutionLogging(): void {
  const hookLogger = createHookLogger('PreToolUse', 'Bash');
  
  // Create execution context
  const executionContext: HookExecutionContext = {
    event: 'PreToolUse',
    toolName: 'Bash',
    executionId: `exec_${Date.now()}`,
    sessionId: 'claude-session-123',
    projectDir: '/workspace/my-project',
    userId: 'user123',
  };
  
  // Log execution start
  hookLogger.startExecution(executionContext);
  
  // Log user actions during execution
  hookLogger.logUserAction('validate-command', executionContext, {
    command: 'ls -la',
    validation: 'passed',
  });
  
  // Simulate execution completion
  const performanceMetrics: PerformanceMetrics = {
    duration: 150, // ms
    memoryBefore: 1024 * 1024, // 1MB
    memoryAfter: 1024 * 1024 * 1.2, // 1.2MB
    memoryDelta: 1024 * 200, // 200KB increase
    cpuUsage: 12.5, // 12.5%
  };
  
  hookLogger.completeExecution(executionContext, true, performanceMetrics, {
    success: true,
    message: 'Command executed successfully',
  });
}

/**
 * Example 5: Security event logging
 */
export function securityLogging(): void {
  const hookLogger = createHookLogger('PreToolUse', 'Bash');
  
  const executionContext: HookExecutionContext = {
    event: 'PreToolUse',
    toolName: 'Bash',
    executionId: 'exec_security_123',
    sessionId: 'claude-session-456',
  };
  
  // Log different severity security events
  hookLogger.logSecurityEvent(
    'suspicious_command_detected',
    'high',
    executionContext,
    {
      command: 'rm -rf /', // Will be sanitized/masked
      pattern: 'destructive_filesystem_operation',
      blocked: true,
    }
  );
  
  hookLogger.logSecurityEvent(
    'privilege_escalation_attempt',
    'critical',
    executionContext,
    {
      requestedUser: 'root',
      currentUser: 'claude',
      method: 'sudo',
    }
  );
  
  hookLogger.logSecurityEvent(
    'file_access_outside_workspace',
    'medium',
    executionContext,
    {
      requestedPath: '/etc/passwd',
      workspacePath: '/workspace',
      action: 'read',
    }
  );
}

/**
 * Example 6: Hook execution failure logging
 */
export function hookFailureLogging(): void {
  const hookLogger = createHookLogger('PostToolUse', 'Edit');
  
  const executionContext: HookExecutionContext = {
    event: 'PostToolUse',
    toolName: 'Edit',
    executionId: 'exec_fail_123',
    sessionId: 'claude-session-789',
  };
  
  hookLogger.startExecution(executionContext);
  
  try {
    // Simulate hook execution that fails
    throw new Error('File validation failed: syntax error on line 45');
  } catch (error) {
    const performanceMetrics: PerformanceMetrics = {
      duration: 75,
      memoryBefore: 1024 * 1024,
      memoryAfter: 1024 * 1024 * 1.1,
      memoryDelta: 1024 * 100,
    };
    
    if (error instanceof Error) {
      hookLogger.failExecution(executionContext, error, performanceMetrics);
    }
  }
}

// =============================================================================
// CLI LOGGING EXAMPLES
// =============================================================================

/**
 * Example 7: CLI command logging
 */
export function cliLogging(): void {
  const cliLogger = createCliLogger('generate');
  
  cliLogger.info('Starting code generation', {
    template: 'security-hook',
    outputDir: './hooks',
    options: { typescript: true, tests: true },
  });
  
  cliLogger.debug('Template loaded successfully', {
    templatePath: '/templates/security-hook.ts',
    variables: ['hookName', 'toolNames', 'validationRules'],
  });
  
  cliLogger.info('Files generated successfully', {
    filesCreated: [
      './hooks/security-hook.ts',
      './hooks/__tests__/security-hook.test.ts',
    ],
    linesOfCode: 156,
  });
  
  // CLI-specific success logging
  cliLogger.info('✅ Generation completed', {
    duration: '2.3s',
    nextSteps: ['Run tests', 'Update configuration'],
  });
}

// =============================================================================
// PERFORMANCE MONITORING EXAMPLES
// =============================================================================

/**
 * Example 8: Performance monitoring
 */
export function performanceLogging(): void {
  const logger = createLogger('performance-monitor');
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  // Simulate some work
  setTimeout(() => {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    logger.info('Operation completed', {
      performance: {
        duration: `${endTime - startTime}ms`,
        memoryDelta: `${(endMemory - startMemory) / 1024 / 1024}MB`,
        operationType: 'file-processing',
        filesProcessed: 25,
        averageFileSize: '1.2KB',
      },
    });
  }, 100);
}

// =============================================================================
// ERROR HANDLING AND RECOVERY
// =============================================================================

/**
 * Example 9: Comprehensive error handling
 */
export function errorHandlingExample(): void {
  const logger = createLogger('error-handler');
  
  // Different types of errors
  try {
    throw new TypeError('Invalid configuration object');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error, 'Configuration validation failed', {
        configFile: 'hooks.config.json',
        validationRules: ['required-fields', 'type-checking'],
        recovery: 'using-default-configuration',
      });
    }
  }
  
  // Network errors
  try {
    throw new Error('ECONNREFUSED: Connection refused');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error, 'External service unavailable', {
        service: 'claude-api',
        endpoint: 'https://api.anthropic.com',
        retryAttempt: 1,
        maxRetries: 3,
        backoffDelay: '5000ms',
      });
    }
  }
  
  // Validation errors
  try {
    throw new Error('Invalid hook configuration: missing required field "event"');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error, 'Hook validation failed', {
        hookFile: './hooks/my-hook.ts',
        field: 'event',
        allowedValues: ['PreToolUse', 'PostToolUse'],
        suggestion: 'add-event-field',
      });
    }
  }
}

// =============================================================================
// STRUCTURED DATA LOGGING
// =============================================================================

/**
 * Example 10: Rich structured data logging
 */
export function structuredDataLogging(): void {
  const logger = createLogger('data-processor');
  
  // Log with structured metrics
  logger.info('Batch processing completed', {
    batch: {
      id: 'batch-2024-001',
      size: 1000,
      processingTime: '45.2s',
      successRate: 98.5,
    },
    performance: {
      avgLatency: '12ms',
      p95Latency: '25ms',
      p99Latency: '45ms',
      throughput: '22.1 req/s',
    },
    errors: {
      count: 15,
      types: {
        'validation-error': 10,
        'timeout-error': 3,
        'network-error': 2,
      },
    },
    resources: {
      cpuUsage: '15.2%',
      memoryUsage: '234MB',
      diskIO: '1.2MB/s',
      networkIO: '500KB/s',
    },
  });
}

// =============================================================================
// INTEGRATION WITH EXTERNAL SYSTEMS
// =============================================================================

/**
 * Example 11: Logging for external system integration
 */
export function externalSystemLogging(): void {
  const logger = createLogger('integration');
  
  // API call logging
  logger.info('External API call initiated', {
    api: {
      provider: 'anthropic',
      endpoint: '/v1/messages',
      method: 'POST',
      timeout: 30000,
    },
    request: {
      id: 'req-123-abc',
      model: 'claude-3-sonnet',
      // Note: actual request content will be sanitized
    },
  });
  
  // Response logging
  logger.info('External API response received', {
    api: {
      provider: 'anthropic',
      endpoint: '/v1/messages',
    },
    response: {
      id: 'req-123-abc',
      status: 200,
      latency: '1.2s',
      tokens: {
        input: 1250,
        output: 890,
      },
      // Response content sanitized
    },
  });
}

// Export all examples for easy testing/demonstration
export const examples = {
  basicLoggingExample,
  environmentSpecificLogging,
  childLoggerExample,
  hookExecutionLogging,
  securityLogging,
  hookFailureLogging,
  cliLogging,
  performanceLogging,
  errorHandlingExample,
  structuredDataLogging,
  externalSystemLogging,
} as const;