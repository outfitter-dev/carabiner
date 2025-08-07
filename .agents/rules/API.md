# API Development Rules

## API Architecture

### RESTful Design

```typescript
// Resource-based URLs
GET    /api/users          // List users
GET    /api/users/:id      // Get user
POST   /api/users          // Create user
PUT    /api/users/:id      // Update user
PATCH  /api/users/:id      // Partial update
DELETE /api/users/:id      // Delete user

// Nested resources
GET    /api/users/:userId/posts
POST   /api/users/:userId/posts
```

### API Versioning

```typescript
// URL versioning (preferred)
/api/v1/users
/api/v2/users

// Header versioning
headers: {
  'API-Version': '2.0'
}
```

## Request/Response Standards

### Request Validation

```typescript
import { z } from 'zod';

// Define schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

// Validate requests
export async function createUser(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const validated = createUserSchema.parse(body);

    // Process validated data
    const user = await userService.create(validated);

    return Response.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    throw error;
  }
}
```

### Response Format

```typescript
// Success response
interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Error response
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Pagination response
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## Bun.serve() API

### Basic Server Setup

```typescript
Bun.serve({
  port: process.env.PORT || 3000,
  hostname: '0.0.0.0',

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Routing
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok' });
    }

    // Handle routes
    return router.handle(req);
  },

  error(error: Error): Response {
    console.error('Server error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  },
});
```

### Router Pattern

```typescript
class Router {
  private routes = new Map<string, Map<string, Handler>>();

  get(path: string, handler: Handler) {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: Handler) {
    this.addRoute('POST', path, handler);
  }

  async handle(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const method = req.method;

    const handler = this.findHandler(method, pathname);
    if (!handler) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return handler(req);
  }
}
```

## Authentication

### JWT Implementation

```typescript
// Using jose for JWT
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    throw new AuthenticationError('Invalid token');
  }
}
```

### Auth Middleware

```typescript
export async function requireAuth(req: Request, next: () => Promise<Response>): Promise<Response> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const token = auth.slice(7);
    const payload = await verifyToken(token);

    // Add user to request context
    (req as any).user = payload;

    return next();
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

## Rate Limiting

### In-Memory Rate Limiter

```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private windowMs: number,
    private maxRequests: number,
  ) {}

  async limit(req: Request): Promise<Response | null> {
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();

    // Get existing requests
    const timestamps = this.requests.get(ip) || [];

    // Filter old requests
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return Response.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(this.windowMs / 1000),
          },
        },
      );
    }

    // Add current request
    recent.push(now);
    this.requests.set(ip, recent);

    return null;
  }
}
```

## CORS Configuration

### CORS Headers

```typescript
export function corsHeaders(origin?: string): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Dynamic origin handling
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

// Preflight handling
if (req.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('Origin')),
  });
}
```

## OpenAPI Documentation

### Schema Definition

```typescript
// OpenAPI schema
const openApiSchema = {
  openapi: '3.0.0',
  info: {
    title: 'API Documentation',
    version: '1.0.0',
  },
  paths: {
    '/api/users': {
      get: {
        summary: 'List users',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
        ],
        responses: {
          200: {
            description: 'User list',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserList',
                },
              },
            },
          },
        },
      },
    },
  },
};
```

## WebSocket Support

### Bun WebSocket

```typescript
Bun.serve({
  websocket: {
    message(ws, message) {
      // Handle incoming messages
      const data = JSON.parse(message.toString());

      // Broadcast to all clients
      ws.publish(
        'chat',
        JSON.stringify({
          type: 'message',
          data,
          timestamp: Date.now(),
        }),
      );
    },

    open(ws) {
      ws.subscribe('chat');
      ws.send(
        JSON.stringify({
          type: 'connected',
          id: ws.data.id,
        }),
      );
    },

    close(ws) {
      ws.unsubscribe('chat');
    },
  },

  fetch(req, server) {
    // Upgrade to WebSocket
    if (req.headers.get('upgrade') === 'websocket') {
      const success = server.upgrade(req, {
        data: { id: crypto.randomUUID() },
      });

      return success
        ? undefined
        : Response.json({ error: 'WebSocket upgrade failed' }, { status: 400 });
    }

    // Regular HTTP handling
    return handleHttp(req);
  },
});
```
