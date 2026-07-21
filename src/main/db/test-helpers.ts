import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from './schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** The workspace every fixture belongs to unless it says otherwise. */
export const DEFAULT_TEST_WORKSPACE_ID = 'ws-default';

export interface TestDbHandle {
  db: TestDb;
  sqlite: Database.Database;
}

// In-memory SQLite + Drizzle wrapper with the live migrations applied.
// Use sqlite.exec(...) for raw seed inserts; use db.* for typed queries.
export function createTestDb(): TestDbHandle {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  // Off across migrate(), on afterwards — see the comment in connection.ts.
  sqlite.pragma('foreign_keys = OFF');
  migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  sqlite.pragma('foreign_keys = ON');
  // Mirror connection.ts's post-migrate seed so fixtures can reference a workspace.
  // Migration 0003 already inserts 'ws-default'; this keeps it true if that changes.
  sqlite
    .prepare(`INSERT OR IGNORE INTO workspaces (id, name, sort_order) VALUES (?, ?, ?)`)
    .run(DEFAULT_TEST_WORKSPACE_ID, 'My World', 1);
  return { db, sqlite };
}
