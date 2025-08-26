# @carabiner/schema-server

Cloudflare Worker that serves the JSON Schema for Carabiner hook configurations.

## Overview

This package provides:

- JSON Schema for validating Carabiner hook configurations
- Cloudflare Worker for serving the schema at `https://carabiner.outfitter.dev/schema.json`
- Versioning support for schema evolution
- CORS-enabled API for cross-origin access

## Setup

### Prerequisites

1. Cloudflare account with Workers enabled
2. Domain configured in Cloudflare (outfitter.dev)
3. Wrangler CLI installed

### Deployment

```bash
# Install dependencies
bun install

# Generate schema from TypeScript types
bun run generate-schema

# Deploy to Cloudflare Workers
bun run deploy
```

### Local Development

```bash
# Run locally with Wrangler
bun run dev

# Test locally
curl http://localhost:8787/schema.json
```

## Configuration

### DNS Setup

Add a CNAME record in Cloudflare:

```
carabiner.outfitter.dev -> carabiner-schema.workers.dev
```

Or use a custom route in `wrangler.toml`:

```toml
route = { pattern = "carabiner.outfitter.dev/*", zone_name = "outfitter.dev" }
```

### KV Namespace (Optional)

For versioned schemas, create a KV namespace:

```bash
wrangler kv:namespace create SCHEMA_STORE
```

## API Endpoints

- `GET /` - Returns the latest schema
- `GET /schema.json` - Returns the latest schema
- `GET /schema/v{n}.json` - Returns a specific schema version (when available)
- `GET /docs` - HTML documentation page

## Usage

In your Carabiner hook configuration:

```json
{
  "$schema": "https://carabiner.outfitter.dev/schema.json",
  "hooks": {
    "PreToolUse": {
      "Bash": {
        "command": "bun run hooks/bash-security.ts"
      }
    }
  }
}
```

## Schema Generation

The schema is generated from TypeScript types in `@carabiner/hooks-config`:

```bash
bun run generate-schema
```

This reads the TypeScript types and generates a JSON Schema that:

- Validates hook configurations
- Provides IDE autocomplete
- Documents available options
- Enforces type safety

## Versioning Strategy

1. **Latest**: Always available at `/schema.json`
2. **Versioned**: Available at `/schema/v{major}.json`
3. **Breaking changes**: Increment major version
4. **Non-breaking additions**: Update latest, keep old versions

## License

MIT
