/**
 * Test template
 */

import { pascalCase } from '../../utils/case-conversion.js';

export const testTypeScript = (name: string): string => `import { test, expect, describe, beforeEach } from 'bun:test';
import { 
  createMockContext,
  createMockContextFor,
  TestUtils,
  mockEnv
} from '@outfitter/hooks-testing';
import { handle${pascalCase(name)} } from '../${name}.ts';

describe('${name} hook tests', () => {
  beforeEach(() => {
    // Clean up mock environment before each test
    mockEnv.restore();
  });

  test('should handle valid input successfully', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'echo "test"');
    
    // Act
    const result = await handle${pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain('${name}');
  });

  test('should handle errors gracefully', async () => {
    // Arrange - Create a context that might cause an error
    mockEnv.setup({
      sessionId: '', // Invalid session ID
      toolName: 'Bash',
      command: 'echo test'
    });
    
    // Act
    const result = await handle${pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  test('should complete within reasonable time', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'ls');
    
    // Act & Assert
    await TestUtils.waitFor(async () => {
      const result = await handle${pascalCase(name)}();
      expect(result.success).toBe(true);
      return result;
    }, 5000); // 5 second timeout
  });

  test('should handle different tool types', async () => {
    // Test with Write tool
    const writeContext = createMockContextFor.write('PreToolUse', 'test.txt', 'content');
    mockEnv.setup({
      sessionId: 'test-session',
      toolName: 'Write',
      toolInput: { file_path: 'test.txt', content: 'content' }
    });

    const writeResult = await handle${pascalCase(name)}();
    expect(writeResult.success).toBe(true);

    // Test with Edit tool
    const editContext = createMockContextFor.edit('PreToolUse', 'test.txt', 'old', 'new');
    mockEnv.setup({
      sessionId: 'test-session',
      toolName: 'Edit',
      toolInput: { file_path: 'test.txt', old_string: 'old', new_string: 'new' }
    });

    const editResult = await handle${pascalCase(name)}();
    expect(editResult.success).toBe(true);
  });

  // Add more specific tests based on your hook's functionality
  // Examples:
  // - Security validation tests
  // - Edge case handling
  // - Performance tests
  // - Integration tests
});
`;

export const testJavaScript = (name: string): string => `const { test, expect, describe, beforeEach } = require('bun:test');
const { 
  createMockContext,
  createMockContextFor,
  TestUtils,
  mockEnv
} = require('@outfitter/hooks-testing');
const { handle${pascalCase(name)} } = require('../${name}.js');

describe('${name} hook tests', () => {
  beforeEach(() => {
    // Clean up mock environment before each test
    mockEnv.restore();
  });

  test('should handle valid input successfully', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'echo "test"');
    
    // Act
    const result = await handle${pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.message).toContain('${name}');
  });

  test('should handle errors gracefully', async () => {
    // Arrange - Create a context that might cause an error
    mockEnv.setup({
      sessionId: '', // Invalid session ID
      toolName: 'Bash',
      command: 'echo test'
    });
    
    // Act
    const result = await handle${pascalCase(name)}();
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  test('should complete within reasonable time', async () => {
    // Arrange
    const context = createMockContextFor.bash('PreToolUse', 'ls');
    
    // Act & Assert
    await TestUtils.waitFor(async () => {
      const result = await handle${pascalCase(name)}();
      expect(result.success).toBe(true);
      return result;
    }, 5000); // 5 second timeout
  });

  // Add more specific tests based on your hook's functionality
});
`;