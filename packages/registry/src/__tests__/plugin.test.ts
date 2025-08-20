/**
 * @file plugin.test.ts
 * @description Tests for plugin interfaces and utilities
 */

import { describe, expect, test } from 'bun:test';
import type { HookPlugin, PluginResult } from '../plugin';
import {
  createPluginResult,
  isHookPlugin,
  isPluginResult,
  PluginConfigurationError,
  PluginExecutionError,
  PluginValidationError,
} from '../plugin';

describe('Plugin Utilities', () => {
  describe('isHookPlugin', () => {
    test('should return true for valid plugin', () => {
      const plugin: HookPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        events: ['PreToolUse'],
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      expect(isHookPlugin(plugin)).toBe(true);
    });

    test('should return false for invalid plugin - missing name', () => {
      const invalid = {
        version: '1.0.0',
        events: ['PreToolUse'],
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      expect(isHookPlugin(invalid)).toBe(false);
    });

    test('should return false for invalid plugin - missing version', () => {
      const invalid = {
        name: 'test-plugin',
        events: ['PreToolUse'],
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      expect(isHookPlugin(invalid)).toBe(false);
    });

    test('should return false for invalid plugin - invalid events', () => {
      const invalid = {
        name: 'test-plugin',
        version: '1.0.0',
        events: 'PreToolUse', // Should be array
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      expect(isHookPlugin(invalid)).toBe(false);
    });

    test('should return false for invalid plugin - missing apply function', () => {
      const invalid = {
        name: 'test-plugin',
        version: '1.0.0',
        events: ['PreToolUse'],
      };

      expect(isHookPlugin(invalid)).toBe(false);
    });

    test('should return false for non-object', () => {
      expect(isHookPlugin(null)).toBe(false);
      expect(isHookPlugin(undefined)).toBe(false);
      expect(isHookPlugin('string')).toBe(false);
      expect(isHookPlugin(123)).toBe(false);
    });
  });

  describe('isPluginResult', () => {
    test('should return true for valid plugin result', () => {
      const result: PluginResult = {
        success: true,
        pluginName: 'test-plugin',
        pluginVersion: '1.0.0',
      };

      expect(isPluginResult(result)).toBe(true);
    });

    test('should return true for plugin result with additional fields', () => {
      const result: PluginResult = {
        success: false,
        block: true,
        message: 'Test failed',
        pluginName: 'test-plugin',
        pluginVersion: '1.0.0',
        executionTime: 100,
        metadata: { test: true },
      };

      expect(isPluginResult(result)).toBe(true);
    });

    test('should return false for invalid plugin result - missing success', () => {
      const invalid = {
        pluginName: 'test-plugin',
        pluginVersion: '1.0.0',
      };

      expect(isPluginResult(invalid)).toBe(false);
    });

    test('should return false for invalid plugin result - missing pluginName', () => {
      const invalid = {
        success: true,
        pluginVersion: '1.0.0',
      };

      expect(isPluginResult(invalid)).toBe(false);
    });

    test('should return false for non-object', () => {
      expect(isPluginResult(null)).toBe(false);
      expect(isPluginResult('string')).toBe(false);
      expect(isPluginResult(123)).toBe(false);
    });
  });

  describe('createPluginResult', () => {
    test('should create plugin result from hook result', () => {
      const plugin: HookPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        events: ['PreToolUse'],
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      const hookResult = {
        success: true,
        message: 'Test passed',
      };

      const pluginResult = createPluginResult(plugin, hookResult, 150, {
        heapUsed: 1024,
        heapTotal: 2048,
      });

      expect(pluginResult).toEqual({
        success: true,
        message: 'Test passed',
        pluginName: 'test-plugin',
        pluginVersion: '1.0.0',
        executionTime: 150,
        memoryUsage: {
          heapUsed: 1024,
          heapTotal: 2048,
        },
      });
    });

    test('should create plugin result without optional fields', () => {
      const plugin: HookPlugin = {
        name: 'test-plugin',
        version: '2.0.0',
        events: ['PostToolUse'],
        apply: async () => ({
          success: true,
          pluginName: 'test',
          pluginVersion: '1.0.0',
        }),
      };

      const hookResult = {
        success: false,
        block: true,
      };

      const pluginResult = createPluginResult(plugin, hookResult);

      expect(pluginResult).toEqual({
        success: false,
        block: true,
        pluginName: 'test-plugin',
        pluginVersion: '2.0.0',
      });
    });
  });
});

describe('Plugin Error Classes', () => {
  describe('PluginValidationError', () => {
    test('should create error with correct message and properties', () => {
      const error = new PluginValidationError(
        'test-plugin',
        'name',
        'Invalid name format'
      );

      expect(error.name).toBe('PluginValidationError');
      expect(error.message).toBe(
        'Plugin test-plugin: name - Invalid name format'
      );
      expect(error.pluginName).toBe('test-plugin');
      expect(error.field).toBe('name');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('PluginExecutionError', () => {
    test('should create error with correct message and properties', () => {
      const originalError = new Error('Original error');
      const error = new PluginExecutionError(
        'test-plugin',
        'Execution failed',
        originalError
      );

      expect(error.name).toBe('PluginExecutionError');
      expect(error.message).toBe('Plugin test-plugin: Execution failed');
      expect(error.pluginName).toBe('test-plugin');
      expect(error.originalError).toBe(originalError);
      expect(error.stack).toBe(originalError.stack);
    });

    test('should create error without original error', () => {
      const error = new PluginExecutionError('test-plugin', 'Execution failed');

      expect(error.name).toBe('PluginExecutionError');
      expect(error.message).toBe('Plugin test-plugin: Execution failed');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('PluginConfigurationError', () => {
    test('should create error with config field', () => {
      const error = new PluginConfigurationError(
        'test-plugin',
        'Invalid timeout value',
        'timeout'
      );

      expect(error.name).toBe('PluginConfigurationError');
      expect(error.message).toBe(
        'Plugin test-plugin configuration error: Invalid timeout value'
      );
      expect(error.pluginName).toBe('test-plugin');
      expect(error.configField).toBe('timeout');
    });

    test('should create error without config field', () => {
      const error = new PluginConfigurationError(
        'test-plugin',
        'Invalid configuration'
      );

      expect(error.name).toBe('PluginConfigurationError');
      expect(error.message).toBe(
        'Plugin test-plugin configuration error: Invalid configuration'
      );
      expect(error.pluginName).toBe('test-plugin');
      expect(error.configField).toBeUndefined();
    });
  });
});
