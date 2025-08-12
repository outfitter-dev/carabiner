# Data Handling Rules

## Database Patterns

### Connection Management

```typescript
// Bun SQLite (built-in)
import { Database } from 'bun:sqlite';

class DatabaseService {
  private db: Database;

  constructor(path: string = ':memory:') {
    this.db = new Database(path);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  close() {
    this.db.close();
  }
}

// Connection pooling for external DBs
class ConnectionPool {
  private pool: Connection[] = [];
  private available: Connection[] = [];

  async acquire(): Promise<Connection> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    if (this.pool.length < this.maxConnections) {
      const conn = await this.createConnection();
      this.pool.push(conn);
      return conn;
    }

    // Wait for available connection
    return this.waitForConnection();
  }
}
```

### Query Patterns

```typescript
// Prepared statements (prevent SQL injection)
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(userId);

// Bulk operations
const insertMany = db.prepare('INSERT INTO logs (message, level) VALUES (?, ?)');
const insertLogs = db.transaction((logs) => {
  for (const log of logs) {
    insertMany.run(log.message, log.level);
  }
});

// Type-safe queries
interface User {
  id: number;
  email: string;
  created_at: string;
}

const getUser = db.prepare<User, [number]>('SELECT id, email, created_at FROM users WHERE id = ?');
```

## Data Validation

### Schema Validation

```typescript
import { z } from 'zod';

// Define schemas
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  roles: z.array(z.enum(['user', 'admin', 'moderator'])),
  metadata: z.record(z.unknown()).optional(),
});

// Validate with branded types
const emailSchema = z.string().email().brand('Email');
type Email = z.infer<typeof emailSchema>;

// Validate and transform
const dateSchema = z.string().transform((str) => new Date(str));
```

### Runtime Validation

```typescript
// Validate API inputs
export async function createUser(data: unknown): Promise<User> {
  const validated = userSchema.parse(data);

  // Additional business logic validation
  if (await userExists(validated.email)) {
    throw new ValidationError('Email already exists');
  }

  return await db.users.create(validated);
}

// Safe parsing with error handling
const result = userSchema.safeParse(data);
if (!result.success) {
  console.error('Validation errors:', result.error.format());
  return;
}
```

## Data Transformation

### DTOs and Mapping

```typescript
// Entity to DTO mapping
class UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

class UserDTO {
  id: string;
  email: string;
  createdAt: string;

  static fromEntity(entity: UserEntity): UserDTO {
    return {
      id: entity.id,
      email: entity.email,
      createdAt: entity.createdAt.toISOString(),
      // Exclude sensitive fields
    };
  }
}

// Batch transformation
const users = await db.users.findMany();
const dtos = users.map(UserDTO.fromEntity);
```

### Serialization

```typescript
// Custom JSON serialization
class DateSerializer {
  static toJSON(date: Date): string {
    return date.toISOString();
  }

  static fromJSON(value: unknown): Date {
    if (typeof value !== 'string') {
      throw new Error('Invalid date format');
    }
    return new Date(value);
  }
}

// BigInt serialization
JSON.stringify(data, (key, value) => (typeof value === 'bigint' ? value.toString() : value));
```

## Caching Strategies

### In-Memory Cache

```typescript
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();

  set(key: string, value: T, ttlMs: number) {
    const expires = Date.now() + ttlMs;
    this.cache.set(key, { value, expires });
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Auto-cleanup expired entries
  startCleanup(intervalMs = 60000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expires) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}
```

### Cache-Aside Pattern

```typescript
class UserRepository {
  constructor(
    private db: Database,
    private cache: MemoryCache<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    // Check cache first
    const cached = this.cache.get(`user:${id}`);
    if (cached) return cached;

    // Load from database
    const user = await this.db.users.findById(id);
    if (user) {
      // Cache for 5 minutes
      this.cache.set(`user:${id}`, user, 5 * 60 * 1000);
    }

    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.db.users.update(id, data);

    // Invalidate cache
    this.cache.delete(`user:${id}`);

    return user;
  }
}
```

## Data Migration

### Migration System

```typescript
interface Migration {
  id: number;
  name: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
}

class MigrationRunner {
  constructor(private db: Database) {
    this.createMigrationsTable();
  }

  private createMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async up(migrations: Migration[]) {
    const applied = new Set(
      this.db
        .prepare('SELECT id FROM migrations')
        .all()
        .map((r) => r.id),
    );

    for (const migration of migrations) {
      if (!applied.has(migration.id)) {
        console.log(`Running migration: ${migration.name}`);

        this.db.transaction(() => {
          migration.up(this.db);
          this.db
            .prepare('INSERT INTO migrations (id, name) VALUES (?, ?)')
            .run(migration.id, migration.name);
        })();
      }
    }
  }
}
```

### Data Seeding

```typescript
// Seed data for development
async function seedDatabase(db: Database) {
  const users = [
    { email: 'admin@example.com', role: 'admin' },
    { email: 'user@example.com', role: 'user' },
  ];

  const insertUser = db.prepare('INSERT OR IGNORE INTO users (email, role) VALUES (?, ?)');

  db.transaction(() => {
    for (const user of users) {
      insertUser.run(user.email, user.role);
    }
  })();
}

// Environment-specific seeding
if (process.env.NODE_ENV === 'development') {
  await seedDatabase(db);
}
```

## Data Privacy

### PII Handling

```typescript
// Encrypt sensitive fields
import { encrypt, decrypt } from './crypto';

class UserService {
  async create(data: CreateUserInput) {
    const user = {
      ...data,
      // Encrypt PII
      ssn: encrypt(data.ssn),
      // Hash passwords
      password: await Bun.password.hash(data.password),
    };

    return this.db.users.create(user);
  }

  async find(id: string) {
    const user = await this.db.users.findById(id);
    if (!user) return null;

    // Decrypt PII when needed
    return {
      ...user,
      ssn: decrypt(user.ssn),
    };
  }
}
```

### Data Retention

```typescript
// Automated data cleanup
class DataRetentionService {
  async cleanupOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Soft delete old records
    await this.db.logs.update({ createdAt: { lt: thirtyDaysAgo } }, { deletedAt: new Date() });

    // Hard delete after retention period
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 365);

    await this.db.logs.deleteMany({
      deletedAt: { lt: retentionDate },
    });
  }
}
```

## Event Sourcing

### Event Store

```typescript
interface Event {
  id: string;
  aggregateId: string;
  type: string;
  payload: unknown;
  timestamp: Date;
  version: number;
}

class EventStore {
  constructor(private db: Database) {}

  async append(event: Omit<Event, 'id' | 'timestamp'>) {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    this.db
      .prepare(
        `
      INSERT INTO events (id, aggregate_id, type, payload, timestamp, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        event.aggregateId,
        event.type,
        JSON.stringify(event.payload),
        timestamp.toISOString(),
        event.version,
      );

    return { id, timestamp, ...event };
  }

  async getEvents(aggregateId: string): Promise<Event[]> {
    return this.db
      .prepare(
        `
      SELECT * FROM events
      WHERE aggregate_id = ?
      ORDER BY version ASC
    `,
      )
      .all(aggregateId)
      .map((row) => ({
        ...row,
        payload: JSON.parse(row.payload),
        timestamp: new Date(row.timestamp),
      }));
  }
}
```
