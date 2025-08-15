/**
 * Tests for core error classes and functionality
 */

import { describe, test, expect } from 'bun:test';
import {
  GrappleError,
  ConfigurationError,
  RuntimeError,
  ValidationError,
  FileSystemError,
  NetworkError,
  SecurityError,
  UserInputError,
  ResourceError,
  AuthError,
  TimeoutError,
  ErrorFactory,
} from '../errors.js';
import { ErrorCode, ErrorCategory, ErrorSeverity } from '../types.js';

describe('GrappleError', () => {
  test('should create basic error with required properties', () => {
    const error = new GrappleError(
      'Test error message',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME
    );

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(ErrorCode.RUNTIME_EXCEPTION);
    expect(error.category).toBe(ErrorCategory.RUNTIME);
    expect(error.severity).toBe(ErrorSeverity.ERROR);
    expect(error.name).toBe('GrappleError');
    expect(error.context.correlationId).toBeDefined();
    expect(error.context.timestamp).toBeInstanceOf(Date);
  });

  test('should handle optional properties correctly', () => {
    const cause = new Error('Original error');
    const error = new GrappleError(
      'Test error',
      ErrorCode.CONFIG_INVALID,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.CRITICAL,
      {
        cause,
        operation: 'test-operation',
        userMessage: 'User-friendly message',
        technicalDetails: { key: 'value' },
        metadata: { test: true },
        isRecoverable: false,
      }
    );

    expect(error.cause).toBe(cause);
    expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    expect(error.context.operation).toBe('test-operation');
    expect(error.context.userMessage).toBe('User-friendly message');
    expect(error.context.technicalDetails).toEqual({ key: 'value' });
    expect(error.context.metadata).toEqual({ test: true });
    expect(error.isRecoverable).toBe(false);
  });

  test('should determine recoverability correctly', () => {
    // Non-recoverable security error
    const securityError = new GrappleError(
      'Security violation',
      ErrorCode.SECURITY_VIOLATION,
      ErrorCategory.SECURITY
    );
    expect(securityError.isRecoverable).toBe(false);

    // Recoverable network error
    const networkError = new GrappleError(
      'Connection timeout',
      ErrorCode.CONNECTION_TIMEOUT,
      ErrorCategory.NETWORK
    );
    expect(networkError.isRecoverable).toBe(true);

    // Non-recoverable validation error
    const validationError = new GrappleError(
      'Invalid input',
      ErrorCode.INVALID_INPUT,
      ErrorCategory.VALIDATION
    );
    expect(validationError.isRecoverable).toBe(false);
  });

  test('should generate user-friendly messages', () => {
    const configError = new GrappleError(
      'Config file not found',
      ErrorCode.CONFIG_NOT_FOUND,
      ErrorCategory.CONFIGURATION
    );
    expect(configError.toUserMessage()).toContain('Configuration error');

    const networkError = new GrappleError(
      'Connection failed',
      ErrorCode.CONNECTION_REFUSED,
      ErrorCategory.NETWORK
    );
    expect(networkError.toUserMessage()).toContain('Network error');

    const errorWithCustomMessage = new GrappleError(
      'Technical error',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME,
      ErrorSeverity.ERROR,
      { userMessage: 'Custom user message' }
    );
    expect(errorWithCustomMessage.toUserMessage()).toBe('Custom user message');
  });

  test('should generate detailed log messages', () => {
    const error = new GrappleError(
      'Test error',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME,
      ErrorSeverity.ERROR,
      {
        operation: 'test-operation',
        technicalDetails: { key: 'value' },
      }
    );

    const logMessage = error.toLogMessage();
    expect(logMessage).toContain('Error: GrappleError');
    expect(logMessage).toContain('Message: Test error');
    expect(logMessage).toContain('Code: 1103');
    expect(logMessage).toContain('Category: runtime');
    expect(logMessage).toContain('Severity: error');
    expect(logMessage).toContain('Operation: test-operation');
    expect(logMessage).toContain('Correlation ID:');
  });

  test('should create error reports', () => {
    const error = new GrappleError(
      'Test error',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME
    );

    const report = error.toReport();
    expect(report.error.name).toBe('GrappleError');
    expect(report.error.message).toBe('Test error');
    expect(report.error.code).toBe(ErrorCode.RUNTIME_EXCEPTION);
    expect(report.error.category).toBe(ErrorCategory.RUNTIME);
    expect(report.error.severity).toBe(ErrorSeverity.ERROR);
    expect(report.context).toBeDefined();
    expect(report.metadata.recoverable).toBeDefined();
    expect(report.reportedAt).toBeInstanceOf(Date);
  });

  test('should determine retryability correctly', () => {
    const retryableError = new GrappleError(
      'Timeout',
      ErrorCode.OPERATION_TIMEOUT,
      ErrorCategory.TIMEOUT
    );
    expect(retryableError.isRetryable()).toBe(true);

    const nonRetryableError = new GrappleError(
      'Security violation',
      ErrorCode.SECURITY_VIOLATION,
      ErrorCategory.SECURITY,
      ErrorSeverity.CRITICAL
    );
    expect(nonRetryableError.isRetryable()).toBe(false);
  });
});

describe('Specific Error Classes', () => {
  test('ConfigurationError should have correct defaults', () => {
    const error = new ConfigurationError('Config error');
    expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
    expect(error.category).toBe(ErrorCategory.CONFIGURATION);
    expect(error.severity).toBe(ErrorSeverity.ERROR);
  });

  test('ValidationError should not be recoverable', () => {
    const error = new ValidationError('Validation failed');
    expect(error.isRecoverable).toBe(false);
    expect(error.category).toBe(ErrorCategory.VALIDATION);
  });

  test('NetworkError should be recoverable', () => {
    const error = new NetworkError('Connection failed');
    expect(error.isRecoverable).toBe(true);
    expect(error.category).toBe(ErrorCategory.NETWORK);
  });

  test('SecurityError should not be recoverable and have critical severity', () => {
    const error = new SecurityError('Security violation');
    expect(error.isRecoverable).toBe(false);
    expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    expect(error.toUserMessage()).toBe('Security violation detected. Operation denied.');
  });

  test('AuthError should have user-friendly message', () => {
    const error = new AuthError('Auth failed');
    expect(error.isRecoverable).toBe(false);
    expect(error.toUserMessage()).toBe('Authentication required. Please verify your credentials.');
  });

  test('TimeoutError should be recoverable', () => {
    const error = new TimeoutError('Operation timed out');
    expect(error.isRecoverable).toBe(true);
    expect(error.category).toBe(ErrorCategory.TIMEOUT);
  });
});

describe('ErrorFactory', () => {
  test('should create appropriate errors from system errors', () => {
    const enoentError = new Error('File not found') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    
    const grappleError = ErrorFactory.fromSystemError(enoentError, 'file-operation');
    expect(grappleError).toBeInstanceOf(FileSystemError);
    expect(grappleError.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(grappleError.context.operation).toBe('file-operation');
  });

  test('should create network errors from connection errors', () => {
    const connError = new Error('Connection refused') as NodeJS.ErrnoException;
    connError.code = 'ECONNREFUSED';
    
    const grappleError = ErrorFactory.fromSystemError(connError);
    expect(grappleError).toBeInstanceOf(NetworkError);
    expect(grappleError.code).toBe(ErrorCode.CONNECTION_REFUSED);
  });

  test('should create appropriate errors from generic errors', () => {
    const genericError = new Error('Something went wrong');
    const grappleError = ErrorFactory.fromError(genericError, 'test-operation');
    
    expect(grappleError).toBeInstanceOf(RuntimeError);
    expect(grappleError.cause).toBe(genericError);
    expect(grappleError.context.operation).toBe('test-operation');
  });

  test('should return existing GrappleError unchanged', () => {
    const originalError = new GrappleError(
      'Original error',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME
    );
    
    const result = ErrorFactory.fromError(originalError);
    expect(result).toBe(originalError);
  });

  test('should create errors based on message patterns', () => {
    const timeoutMessage = ErrorFactory.fromMessage('Operation timed out', 'test');
    expect(timeoutMessage).toBeInstanceOf(TimeoutError);

    const permissionMessage = ErrorFactory.fromMessage('Permission denied', 'test');
    expect(permissionMessage).toBeInstanceOf(FileSystemError);
    expect(permissionMessage.code).toBe(ErrorCode.PERMISSION_DENIED);

    const validationMessage = ErrorFactory.fromMessage('Validation failed', 'test');
    expect(validationMessage).toBeInstanceOf(ValidationError);

    const configMessage = ErrorFactory.fromMessage('Config error', 'test');
    expect(configMessage).toBeInstanceOf(ConfigurationError);

    const securityMessage = ErrorFactory.fromMessage('Unauthorized access', 'test');
    expect(securityMessage).toBeInstanceOf(SecurityError);
  });
});

describe('Error Inheritance and Polymorphism', () => {
  test('should maintain proper inheritance chain', () => {
    const configError = new ConfigurationError('Config error');
    
    expect(configError instanceof GrappleError).toBe(true);
    expect(configError instanceof Error).toBe(true);
    expect(configError instanceof ConfigurationError).toBe(true);
  });

  test('should have consistent prototype chain', () => {
    const errors = [
      new ConfigurationError('Config error'),
      new RuntimeError('Runtime error'),
      new ValidationError('Validation error'),
      new NetworkError('Network error'),
      new SecurityError('Security error'),
    ];

    for (const error of errors) {
      expect(error.constructor.name).toBe(error.name);
      expect(Object.getPrototypeOf(error).constructor).toBe(error.constructor);
    }
  });

  test('should capture stack traces correctly', () => {
    const error = new GrappleError(
      'Test error',
      ErrorCode.RUNTIME_EXCEPTION,
      ErrorCategory.RUNTIME
    );

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('GrappleError');
    expect(error.context.stackTrace).toBeDefined();
  });
});