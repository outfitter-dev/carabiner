/**
 * Cloudflare Worker to serve Carabiner hook configuration schema
 */

import schema from '../public/schema.json' with { type: 'json' };

export interface Env {
  SCHEMA_STORE?: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for cross-origin access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/' || url.pathname === '/schema.json') {
      // Serve the main schema
      return new Response(JSON.stringify(schema, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Versioned schemas (future support)
    const versionMatch = url.pathname.match(/^\/schema\/v(\d+)\.json$/);
    if (versionMatch && env.SCHEMA_STORE) {
      const version = versionMatch[1];
      const versionedSchema = await env.SCHEMA_STORE.get(`schema-v${version}`);

      if (versionedSchema) {
        return new Response(versionedSchema, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // API documentation endpoint
    if (url.pathname === '/docs') {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Carabiner Schema API</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem; }
            code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
            pre { background: #f4f4f4; padding: 1rem; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>Carabiner Hook Configuration Schema</h1>
          <p>This API serves the JSON Schema for Carabiner hook configurations.</p>
          
          <h2>Endpoints</h2>
          <ul>
            <li><code>GET /schema.json</code> - Latest schema version</li>
            <li><code>GET /</code> - Alias for /schema.json</li>
            <li><code>GET /schema/v{n}.json</code> - Specific schema version (when available)</li>
          </ul>
          
          <h2>Usage</h2>
          <pre><code>// In your hooks configuration
{
  "$schema": "https://carabiner.outfitter.dev/schema.json",
  "hooks": {
    // Your hook configuration
  }
}</code></pre>
          
          <h2>CORS</h2>
          <p>All endpoints support CORS for cross-origin requests.</p>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  },
};
