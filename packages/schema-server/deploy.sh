#!/usr/bin/env bash

# Deploy Carabiner schema to Cloudflare Workers

set -e

echo "🚀 Deploying Carabiner Schema Server..."

# Generate the schema from TypeScript types
echo "📝 Generating schema from TypeScript types..."
bun run generate-schema

# Deploy to Cloudflare Workers
echo "☁️ Deploying to Cloudflare Workers..."
wrangler deploy

echo "✅ Schema deployed to https://carabiner.outfitter.dev/schema.json"
echo ""
echo "Test with:"
echo "  curl https://carabiner.outfitter.dev/schema.json"