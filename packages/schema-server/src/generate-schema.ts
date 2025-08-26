#!/usr/bin/env bun

/**
 * Generate JSON Schema from TypeScript types
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Config, createGenerator } from 'ts-json-schema-generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for the schema generator
const config: Config = {
  path: join(__dirname, '../../hooks-config/src/types.ts'),
  tsconfig: join(__dirname, '../../../tsconfig.json'),
  type: 'HookConfig', // Main type to generate schema for
  expose: 'export',
  topRef: true,
  jsDoc: 'extended',
  markdownDescription: true,
  additionalProperties: false,
  strictTuples: true,
  skipTypeCheck: false,
};

async function generateSchema() {
  try {
    console.log('Generating JSON Schema from TypeScript types...');

    const generator = createGenerator(config);
    const schema = generator.createSchema(config.type);

    // Add metadata
    schema.$id = 'https://carabiner.outfitter.dev/schema.json';
    schema.title = 'Carabiner Hook Configuration';
    schema.description = 'JSON Schema for Carabiner hook configuration files';

    // Ensure output directory exists
    const outputDir = join(__dirname, '../public');
    mkdirSync(outputDir, { recursive: true });

    // Write schema file
    const outputPath = join(outputDir, 'schema.json');
    writeFileSync(outputPath, JSON.stringify(schema, null, 2));

    console.log(`✅ Schema generated successfully at ${outputPath}`);

    // Also generate a TypeScript declaration file for the schema
    const dtsContent = `// Auto-generated schema type
export const schema = ${JSON.stringify(schema, null, 2)} as const;
`;
    writeFileSync(join(outputDir, 'schema.d.ts'), dtsContent);
  } catch (error) {
    console.error('Failed to generate schema:', error);
    process.exit(1);
  }
}

// Run the generator
generateSchema();
