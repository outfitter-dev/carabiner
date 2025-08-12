# @outfitter/hooks-validators

Security validators and environment-specific validation rules for Claude Code hooks.

## Installation

```bash
bun add @outfitter/hooks-validators
```

## Usage

### Quick Security Validation

```typescript
#!/usr/bin/env bun
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { SecurityValidators } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  try {
    // Environment-specific validation
    switch (Bun.env.NODE_ENV) {
      case 'production':
        await SecurityValidators.production(context); // Strict rules
        break;
      case 'development':
        await SecurityValidators.development(context); // Lenient rules
        break;
      default:
        await SecurityValidators.strict(context); // Maximum security
    }

    return HookResults.success('Security validation passed');
  } catch (error) {
    return HookResults.block(error.message);
  }
});
```

### Tool Input Validation

```typescript
import { validateToolInput, ToolSchemas } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  // Validate tool input structure
  const result = await validateToolInput(context.toolName, context.toolInput, context);

  if (!result.valid) {
    const errors = result.errors.map((e) => e.message).join(', ');
    return HookResults.block(`Validation failed: ${errors}`);
  }

  if (result.warnings.length > 0) {
    console.warn(
      'Warnings:',
      result.warnings.map((w) => w.message),
    );
  }

  return HookResults.success('Input validation passed');
});
```

### Custom Validation Rules

```typescript
import { ValidationRules, validateSchema } from '@outfitter/hooks-validators';

const customSchema = {
  file_path: [
    ValidationRules.required('file_path'),
    ValidationRules.validFilePath(true),
    ValidationRules.fileExtension(['.ts', '.js', '.json']),
  ],
  content: [
    ValidationRules.required('content'),
    ValidationRules.maxLength(100000),
    ValidationRules.custom(
      (content) => !content.includes('console.log'),
      'Code should not contain console.log statements',
    ),
  ],
};

runClaudeHook(async (context) => {
  const result = await validateSchema(context.toolInput, customSchema, context);

  if (!result.valid) {
    return HookResults.block('Custom validation failed');
  }

  return HookResults.success('Custom validation passed');
});
```

## API Reference

### Security Validators

#### `SecurityValidators.strict(context: HookContext): Promise<void>`

Apply maximum security validation rules. Blocks dangerous operations and enforces strict file access controls.

**Throws:** `SecurityError` if validation fails

#### `SecurityValidators.production(context: HookContext): Promise<void>`

Apply production-appropriate security rules. Balanced security with usability.

#### `SecurityValidators.development(context: HookContext): Promise<void>`

Apply lenient security rules suitable for development environments.

#### `SecurityValidators.custom(rules: SecurityRuleSet, context: HookContext): Promise<void>`

Apply custom security rule set.

**Parameters:**

- `rules` - Custom security rule configuration
- `context` - Hook context to validate

### Input Validation

#### `validateToolInput(toolName: ToolName, input: ToolInput, context?: HookContext): Promise<ValidationResult>`

Validate tool input against tool-specific schema.

**Parameters:**

- `toolName` - Name of the Claude Code tool
- `input` - Tool input parameters
- `context` - Optional hook context for path resolution

**Returns:** Validation result with errors and warnings

#### `validateSchema(data: Record<string, any>, schema: ValidationSchema, context?: HookContext): Promise<ValidationResult>`

Validate data against a custom schema.

#### `validateHookContext(context: HookContext): Promise<ValidationResult>`

Validate hook context comprehensively.

### Validation Rules

#### `ValidationRules.required<T>(fieldName: string): ValidationRule<T>`

Ensure field is present and not empty.

#### `ValidationRules.minLength(min: number): ValidationRule<string>`

Ensure string meets minimum length.

#### `ValidationRules.maxLength(max: number): ValidationRule<string>`

Ensure string doesn't exceed maximum length.

#### `ValidationRules.pattern(regex: RegExp, message?: string): ValidationRule<string>`

Validate string against regular expression pattern.

#### `ValidationRules.validFilePath(allowNonExistent?: boolean): ValidationRule<string>`

Validate file path exists and is accessible.

#### `ValidationRules.fileExtension(extensions: string[]): ValidationRule<string>`

Validate file has one of the allowed extensions.

#### `ValidationRules.number(min?: number, max?: number): ValidationRule<any>`

Validate numeric values with optional range constraints.

#### `ValidationRules.boolean(): ValidationRule<any>`

Validate boolean values.

#### `ValidationRules.array(minItems?: number, maxItems?: number): ValidationRule<any>`

Validate arrays with optional size constraints.

#### `ValidationRules.custom<T>(validate: Function, message: string | Function): ValidationRule<T>`

Create custom validation rule.

### Tool Schemas

Pre-built validation schemas for all Claude Code tools:

#### `ToolSchemas.Bash`

```typescript
{
  command: [
    ValidationRules.required('command'),
    ValidationRules.minLength(1),
    ValidationRules.maxLength(10000)
  ],
  timeout: ValidationRules.number(100, 300000),
  description: ValidationRules.maxLength(500)
}
```

#### `ToolSchemas.Write`

```typescript
{
  file_path: [
    ValidationRules.required('file_path'),
    ValidationRules.validFilePath(true)
  ],
  content: [
    ValidationRules.required('content'),
    ValidationRules.maxLength(1000000) // 1MB limit
  ]
}
```

#### `ToolSchemas.Edit`

```typescript
{
  file_path: [
    ValidationRules.required('file_path'),
    ValidationRules.validFilePath()
  ],
  old_string: [
    ValidationRules.required('old_string'),
    ValidationRules.minLength(1)
  ],
  new_string: ValidationRules.required('new_string'),
  replace_all: ValidationRules.boolean()
}
```

## Security Rules

### Built-in Security Rule Sets

#### Strict Security Rules

```typescript
const strictRules = {
  dangerousCommands: {
    enabled: true,
    severity: 'critical',
    patterns: [
      /rm\s+-rf\s+\//,
      /sudo.*rm/,
      /curl.*\|\s*sh/,
      /wget.*\|\s*sh/,
      />\s*\/dev\/sda/,
      /dd\s+if=.*of=\/dev/,
    ],
  },
  fileAccess: {
    enabled: true,
    severity: 'high',
    allowedPaths: ['./'],
    deniedPaths: ['/etc', '/usr', '/bin', '/sbin'],
    allowSymlinks: false,
  },
  networkAccess: {
    enabled: true,
    severity: 'medium',
    allowedDomains: [],
    deniedPorts: [22, 23, 135, 445],
  },
};
```

#### Production Security Rules

```typescript
const productionRules = {
  dangerousCommands: {
    enabled: true,
    severity: 'high',
    patterns: [/rm\s+-rf/, /sudo\s+rm/, /curl.*\|\s*sh/],
  },
  fileAccess: {
    enabled: true,
    severity: 'medium',
    allowedPaths: ['./', '/tmp'],
    deniedPaths: ['/etc'],
    allowSymlinks: true,
  },
  networkAccess: {
    enabled: false,
  },
};
```

#### Development Security Rules

```typescript
const developmentRules = {
  dangerousCommands: {
    enabled: true,
    severity: 'warning',
    patterns: [/rm\s+-rf\s+\/(?!tmp|var\/tmp)/],
  },
  fileAccess: {
    enabled: false,
  },
  networkAccess: {
    enabled: false,
  },
};
```

### Security Rule Configuration

```typescript
interface SecurityRuleSet {
  dangerousCommands?: {
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
    patterns: RegExp[];
    exceptions?: string[];
  };

  fileAccess?: {
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
    allowedPaths: string[];
    deniedPaths: string[];
    allowSymlinks: boolean;
    maxFileSize?: number;
  };

  networkAccess?: {
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
    allowedDomains: string[];
    deniedPorts: number[];
    allowLocalhost?: boolean;
  };

  contentFiltering?: {
    enabled: boolean;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'warning';
    patterns: RegExp[];
    maxContentSize: number;
  };
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  ValidationResult,
  ValidationRule,
  ValidationSchema,
  SecurityRuleSet,
  SecurityError,
  ToolSchemaType,
} from '@outfitter/hooks-validators';

// Type-safe validation
const schema: ValidationSchema = {
  file_path: ValidationRules.validFilePath(),
  content: ValidationRules.maxLength(1000),
};

// Custom rule with proper typing
const customRule: ValidationRule<string> = {
  name: 'customValidation',
  description: 'Custom validation rule',
  validate: (value: string) => value.includes('required-text'),
  message: 'Value must contain required text',
  severity: 'error',
};
```

## Validation Results

### `ValidationResult`

```typescript
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field?: string;
    message: string;
    code?: string;
    severity?: 'error' | 'warning' | 'info';
  }>;
  warnings: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}
```

### Example Usage

```typescript
const result = await validateToolInput('Write', {
  file_path: '/etc/passwd',
  content: 'malicious content',
});

if (!result.valid) {
  console.error('Validation errors:');
  result.errors.forEach((error) => {
    console.error(`${error.field}: ${error.message}`);
  });
}

if (result.warnings.length > 0) {
  console.warn('Validation warnings:');
  result.warnings.forEach((warning) => {
    console.warn(`${warning.field}: ${warning.message}`);
  });
}
```

## Advanced Examples

### Environment-Specific Hook

```typescript
#!/usr/bin/env bun
import { runClaudeHook, HookResults } from '@outfitter/hooks-core';
import { SecurityValidators, validateToolInput } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  // Always validate input structure
  const inputValidation = await validateToolInput(context.toolName, context.toolInput, context);

  if (!inputValidation.valid) {
    const errors = inputValidation.errors.map((e) => e.message).join(', ');
    return HookResults.block(`Input validation failed: ${errors}`);
  }

  // Apply environment-specific security
  try {
    const environment = Bun.env.NODE_ENV || 'development';

    switch (environment) {
      case 'production':
        await SecurityValidators.production(context);
        break;
      case 'staging':
        await SecurityValidators.production(context); // Use production rules for staging
        break;
      case 'development':
        await SecurityValidators.development(context);
        break;
      case 'test':
        // Skip security validation in tests
        break;
      default:
        await SecurityValidators.strict(context); // Default to strict
    }

    return HookResults.success(`Validation passed for ${environment} environment`);
  } catch (error) {
    return HookResults.block(`Security validation failed: ${error.message}`);
  }
});
```

### Custom Security Rules

```typescript
import { SecurityValidators, ValidationRules } from '@outfitter/hooks-validators';

const customSecurityRules = {
  dangerousCommands: {
    enabled: true,
    severity: 'critical',
    patterns: [
      // Custom dangerous patterns
      /curl.*githubusercontent.*\|.*sh/,
      /wget.*raw\.github.*\|.*sh/,
      /docker\s+run.*--privileged/,
      /systemctl\s+stop/,
    ],
  },
  fileAccess: {
    enabled: true,
    severity: 'high',
    allowedPaths: ['./src', './docs', './tests'],
    deniedPaths: ['/etc', '/var', '/usr/bin'],
    allowSymlinks: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  contentFiltering: {
    enabled: true,
    severity: 'medium',
    patterns: [
      /password\s*=\s*["'].*["']/i,
      /api_?key\s*=\s*["'].*["']/i,
      /secret\s*=\s*["'].*["']/i,
    ],
    maxContentSize: 1024 * 1024, // 1MB
  },
};

runClaudeHook(async (context) => {
  try {
    await SecurityValidators.custom(customSecurityRules, context);
    return HookResults.success('Custom security validation passed');
  } catch (error) {
    return HookResults.block(error.message);
  }
});
```

### Tool-Specific Validation

```typescript
import { isBashToolInput, isWriteToolInput } from '@outfitter/hooks-core';
import { ValidationRules, validateSchema } from '@outfitter/hooks-validators';

runClaudeHook(async (context) => {
  if (isBashToolInput(context.toolInput)) {
    // Custom Bash validation
    const bashSchema = {
      command: [
        ValidationRules.required('command'),
        ValidationRules.custom(
          (cmd: string) => !cmd.includes('sudo'),
          'sudo commands are not allowed',
        ),
        ValidationRules.custom(
          (cmd: string) => cmd.length <= 1000,
          'Commands must be under 1000 characters',
        ),
      ],
    };

    const result = await validateSchema(context.toolInput, bashSchema);
    if (!result.valid) {
      return HookResults.block('Bash validation failed');
    }
  }

  if (isWriteToolInput(context.toolInput)) {
    // Custom Write validation
    const writeSchema = {
      file_path: [
        ValidationRules.validFilePath(true),
        ValidationRules.custom(
          (path: string) => !path.startsWith('/etc/'),
          'Cannot write to system directories',
        ),
      ],
      content: [
        ValidationRules.maxLength(100000),
        ValidationRules.custom(
          (content: string) => !content.includes('#!/bin/sh'),
          'Shell scripts are not allowed',
        ),
      ],
    };

    const result = await validateSchema(context.toolInput, writeSchema);
    if (!result.valid) {
      return HookResults.block('Write validation failed');
    }
  }

  return HookResults.success('Tool-specific validation passed');
});
```

## Error Handling

### `SecurityError`

Thrown when security validation fails:

```typescript
try {
  await SecurityValidators.strict(context);
} catch (error) {
  if (error instanceof SecurityError) {
    console.error(`Security violation: ${error.message}`);
    console.error(`Rule: ${error.rule}`);
    console.error(`Severity: ${error.severity}`);
    console.error(`Context:`, error.context);
  }
}
```

### `ValidationError`

Thrown when input validation fails:

```typescript
try {
  const result = await validateToolInput(toolName, input, context);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation error: ${error.message}`);
    console.error(`Field: ${error.field}`);
    console.error(`Code: ${error.code}`);
  }
}
```

## License

MIT
