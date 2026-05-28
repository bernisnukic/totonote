import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

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
  sqlite.pragma('foreign_keys = ON');

  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: findMigrationsFolder() });

  // Default seed: ensure the General category always exists.
  // Drizzle migrations only handle schema; this is idempotent data.
  sqlite
    .prepare(`INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)`)
    .run('cat-general', 'General', 1);

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
