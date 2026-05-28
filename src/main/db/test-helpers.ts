import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from './schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export interface TestDbHandle {
  db: TestDb;
  sqlite: Database.Database;
}

// In-memory SQLite + Drizzle wrapper with the live migrations applied.
// Use sqlite.exec(...) for raw seed inserts; use db.* for typed queries.
export function createTestDb(): TestDbHandle {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  return { db, sqlite };
}
