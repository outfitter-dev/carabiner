import { describe, expect, test } from 'bun:test';
import {
  camelCase,
  kebabCase,
  pascalCase,
  snakeCase,
} from '../case-conversion.js';

describe('case conversion utilities', () => {
  describe('pascalCase', () => {
    test('converts kebab-case to PascalCase', () => {
      expect(pascalCase('my-hook-name')).toBe('MyHookName');
    });

    test('converts snake_case to PascalCase', () => {
      expect(pascalCase('my_hook_name')).toBe('MyHookName');
    });

    test('converts space separated to PascalCase', () => {
      expect(pascalCase('my hook name')).toBe('MyHookName');
    });

    test('handles single word', () => {
      expect(pascalCase('hook')).toBe('Hook');
    });

    test('handles mixed separators', () => {
      expect(pascalCase('my-hook_name test')).toBe('MyHookNameTest');
    });
  });

  describe('camelCase', () => {
    test('converts to camelCase', () => {
      expect(camelCase('my-hook-name')).toBe('myHookName');
    });

    test('handles single word', () => {
      expect(camelCase('hook')).toBe('hook');
    });
  });

  describe('kebabCase', () => {
    test('converts to kebab-case', () => {
      expect(kebabCase('MyHookName')).toBe('myhookname');
    });

    test('converts snake_case to kebab-case', () => {
      expect(kebabCase('my_hook_name')).toBe('my-hook-name');
    });
  });

  describe('snakeCase', () => {
    test('converts to snake_case', () => {
      expect(snakeCase('my-hook-name')).toBe('my_hook_name');
    });

    test('converts spaces to snake_case', () => {
      expect(snakeCase('my hook name')).toBe('my_hook_name');
    });
  });
});
