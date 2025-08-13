/**
 * Template registry
 */

import { basicHookJavaScript, basicHookTypeScript } from './hook/basic.js';
import {
  securityHookJavaScript,
  securityHookTypeScript,
} from './hook/security.js';
import {
  validationHookJavaScript,
  validationHookTypeScript,
} from './hook/validation.js';
import {
  middlewareJavaScript,
  middlewareTypeScript,
} from './middleware/index.js';
import { testJavaScript, testTypeScript } from './test/index.js';
import { validatorJavaScript, validatorTypeScript } from './validator/index.js';

export type TemplateType = 'hook' | 'validator' | 'middleware' | 'test';
export type HookTemplateVariant = 'basic' | 'validation' | 'security';

export type TemplateFunction = (name: string) => string;

export interface TemplateRegistry {
  hook: {
    basic: {
      typescript: TemplateFunction;
      javascript: TemplateFunction;
    };
    validation: {
      typescript: TemplateFunction;
      javascript: TemplateFunction;
    };
    security: {
      typescript: TemplateFunction;
      javascript: TemplateFunction;
    };
  };
  validator: {
    typescript: TemplateFunction;
    javascript: TemplateFunction;
  };
  middleware: {
    typescript: TemplateFunction;
    javascript: TemplateFunction;
  };
  test: {
    typescript: TemplateFunction;
    javascript: TemplateFunction;
  };
}

/**
 * Template registry containing all available templates
 */
export const templates: TemplateRegistry = {
  hook: {
    basic: {
      typescript: basicHookTypeScript,
      javascript: basicHookJavaScript,
    },
    validation: {
      typescript: validationHookTypeScript,
      javascript: validationHookJavaScript,
    },
    security: {
      typescript: securityHookTypeScript,
      javascript: securityHookJavaScript,
    },
  },
  validator: {
    typescript: validatorTypeScript,
    javascript: validatorJavaScript,
  },
  middleware: {
    typescript: middlewareTypeScript,
    javascript: middlewareJavaScript,
  },
  test: {
    typescript: testTypeScript,
    javascript: testJavaScript,
  },
};

/**
 * Get template function by type and language
 */
export function getTemplate(
  type: TemplateType,
  language: 'typescript' | 'javascript',
  variant?: HookTemplateVariant
): TemplateFunction {
  if (type === 'hook') {
    if (!variant) {
      throw new Error(
        'Hook template requires a variant (basic, validation, security)'
      );
    }
    return templates.hook[variant][language];
  }

  return templates[type][language];
}

/**
 * Check if template exists
 */
export function hasTemplate(
  type: TemplateType,
  language: 'typescript' | 'javascript',
  variant?: HookTemplateVariant
): boolean {
  try {
    getTemplate(type, language, variant);
    return true;
  } catch {
    return false;
  }
}
