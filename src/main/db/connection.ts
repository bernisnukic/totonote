import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { adoptLegacyDatabase } from './legacy-baseline';

export type Db = BetterSQLite3Database<typeof schema>;

let db: Db | null = null;
let sqlite: Database.Database | null = null;

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Db {
  const dbPath = process.env.TOTONOTE_DB_PATH
    || path.join(app.getPath('userData'), 'totonote.db');

  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  db = drizzle(sqlite, { schema });

  // Foreign keys MUST be off across migrate(). Migrations that alter a table are
  // emitted by drizzle-kit as a rebuild (create __new_x, copy, DROP TABLE x, rename),
  // and with enforcement on, that DROP cascades — deleting every tag, annotation and
  // document_tag hanging off the table. The `PRAGMA foreign_keys=OFF` drizzle-kit puts
  // inside the migration file cannot help: the migrator wraps all statements in a
  // single BEGIN, and SQLite ignores this pragma inside a transaction. So it has to be
  // toggled out here, on the connection, around the call.
  sqlite.pragma('foreign_keys = OFF');
  const migrationsFolder = findMigrationsFolder();
  adoptLegacyDatabase(sqlite, migrationsFolder);
  migrate(db, { migrationsFolder });
  sqlite.pragma('foreign_keys = ON');

  // Default seed: one workspace, and a General category inside it. Drizzle migrations
  // only handle schema; this is idempotent data that must survive every launch.
  sqlite
    .prepare(`INSERT OR IGNORE INTO workspaces (id, name, sort_order) VALUES (?, ?, ?)`)
    .run('ws-default', 'My World', 1);
  sqlite
    .prepare(`INSERT OR IGNORE INTO categories (id, workspace_id, name, sort_order) VALUES (?, ?, ?, ?)`)
    .run('cat-general', 'ws-default', 'General', 1);

  return db;
}

// In dev, migrations are under src/. In a packaged build, Forge's
// extraResource hook copies them to Contents/Resources/migrations/.
function findMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'src', 'main', 'db', 'migrations'),
    path.join(__dirname, 'migrations'),
    process.resourcesPath ? path.join(process.resourcesPath, 'migrations') : '',
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'meta', '_journal.json'))) return dir;
  }
  throw new Error(
    `Drizzle migrations folder not found. Tried: ${candidates.join(', ')}`,
  );
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}
