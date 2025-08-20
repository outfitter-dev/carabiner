import { describe, expect, test } from 'bun:test';
import { getTemplate, hasTemplate, templates } from '../index.js';

describe('template registry', () => {
  test('getTemplate returns correct hook template function', () => {
    const basicTs = getTemplate('hook', 'typescript', 'basic');
    const basicJs = getTemplate('hook', 'javascript', 'basic');

    expect(typeof basicTs).toBe('function');
    expect(typeof basicJs).toBe('function');

    // Test template function execution
    const tsContent = basicTs('test-hook');
    const jsContent = basicJs('test-hook');

    expect(tsContent).toContain('import { runClaudeHook');
    expect(jsContent).toContain('const { runClaudeHook');
  });

  test('getTemplate returns validator template function', () => {
    const validatorTs = getTemplate('validator', 'typescript');
    const validatorJs = getTemplate('validator', 'javascript');

    expect(typeof validatorTs).toBe('function');
    expect(typeof validatorJs).toBe('function');

    const tsContent = validatorTs('test-validator');
    const jsContent = validatorJs('test-validator');

    expect(tsContent).toContain('TestValidatorValidator');
    expect(jsContent).toContain('TestValidatorValidator');
  });

  test('getTemplate returns middleware template function', () => {
    const middlewareTs = getTemplate('middleware', 'typescript');
    const middlewareJs = getTemplate('middleware', 'javascript');

    expect(typeof middlewareTs).toBe('function');
    expect(typeof middlewareJs).toBe('function');

    const tsContent = middlewareTs('test-middleware');
    const jsContent = middlewareJs('test-middleware');

    expect(tsContent).toContain('testMiddlewareMiddleware');
    expect(jsContent).toContain('testMiddlewareMiddleware');
  });

  test('getTemplate returns test template function', () => {
    const testTs = getTemplate('test', 'typescript');
    const testJs = getTemplate('test', 'javascript');

    expect(typeof testTs).toBe('function');
    expect(typeof testJs).toBe('function');

    const tsContent = testTs('test-component');
    const jsContent = testJs('test-component');

    expect(tsContent).toContain('handleTestComponent');
    expect(jsContent).toContain('handleTestComponent');
  });

  test('getTemplate throws error for hook without variant', () => {
    expect(() => getTemplate('hook', 'typescript')).toThrow(
      'Hook template requires a variant'
    );
  });

  test('hasTemplate returns true for valid templates', () => {
    expect(hasTemplate('hook', 'typescript', 'basic')).toBe(true);
    expect(hasTemplate('hook', 'javascript', 'validation')).toBe(true);
    expect(hasTemplate('validator', 'typescript')).toBe(true);
    expect(hasTemplate('middleware', 'javascript')).toBe(true);
    expect(hasTemplate('test', 'typescript')).toBe(true);
  });

  test('hasTemplate returns false for invalid templates', () => {
    expect(hasTemplate('hook', 'typescript')).toBe(false);
    expect(hasTemplate('unknown' as never, 'typescript')).toBe(false);
  });

  test('all template variants exist in registry', () => {
    // Test hook templates
    expect(templates.hook.basic.typescript).toBeDefined();
    expect(templates.hook.basic.javascript).toBeDefined();
    expect(templates.hook.validation.typescript).toBeDefined();
    expect(templates.hook.validation.javascript).toBeDefined();
    expect(templates.hook.security.typescript).toBeDefined();
    expect(templates.hook.security.javascript).toBeDefined();

    // Test other templates
    expect(templates.validator.typescript).toBeDefined();
    expect(templates.validator.javascript).toBeDefined();
    expect(templates.middleware.typescript).toBeDefined();
    expect(templates.middleware.javascript).toBeDefined();
    expect(templates.test.typescript).toBeDefined();
    expect(templates.test.javascript).toBeDefined();
  });
});
