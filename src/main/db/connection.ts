import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  const dbPath = process.env.TOTONOTE_DB_PATH
    || path.join(app.getPath('userData'), 'totonote.db');

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(__dirname, '..', '..', 'src', 'main', 'db', 'migrations');
  // In production, migrations are bundled — try multiple paths
  const possiblePaths = [
    migrationsDir,
    path.join(__dirname, 'migrations'),
    path.join(process.resourcesPath || '', 'migrations'),
  ];

  let migrationFiles: string[] = [];
  let resolvedDir = '';

  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      migrationFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      resolvedDir = dir;
      break;
    }
  }

  if (migrationFiles.length === 0) {
    // If no migration files found on disk, run embedded initial migration
    runEmbeddedMigration(database);
    return;
  }

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all()
      .map((row: { name: string }) => row.name)
  );

  for (const file of migrationFiles) {
    if (!applied.has(file)) {
      const sql = fs.readFileSync(path.join(resolvedDir, file), 'utf-8');
      database.exec(sql);
      database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    }
  }
}

function runEmbeddedMigration(database: Database.Database): void {
  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all()
      .map((row: { name: string }) => row.name)
  );

  if (!applied.has('001-initial.sql')) {

  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      section_label TEXT DEFAULT 'Section',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sections (
      id          TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      sort_order  INTEGER NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sections_document ON sections(document_id, sort_order);

    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id          TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#48dbfb',
      description TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_category ON tags(name, category_id);

    CREATE TABLE IF NOT EXISTS annotations (
      id          TEXT PRIMARY KEY,
      section_id  TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      from_pos    INTEGER NOT NULL,
      to_pos      INTEGER NOT NULL,
      note        TEXT DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_section ON annotations(section_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_tag ON annotations(tag_id);

    CREATE TABLE IF NOT EXISTS document_tags (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      PRIMARY KEY (document_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS browse_categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      parent_id   TEXT REFERENCES browse_categories(id),
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
      ('cat-general', 'General', 1);
  `);

  database.prepare('INSERT INTO _migrations (name) VALUES (?)').run('001-initial.sql');
  }

  if (!applied.has('002-remove-seed-data.sql')) {
    database.exec(`
      DELETE FROM browse_categories;
      DELETE FROM categories WHERE id IN (
        'cat-member', 'cat-lore-type', 'cat-game', 'cat-location', 'cat-form'
      );
    `);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run('002-remove-seed-data.sql');
  }

  if (!applied.has('003-ensure-general-category.sql')) {
    database.exec(`
      INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
        ('cat-general', 'General', 1);
    `);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run('003-ensure-general-category.sql');
  }

  if (!applied.has('004-section-tags.sql')) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS section_tags (
        section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        tag_id     TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (section_id, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_section_tags_tag ON section_tags(tag_id);
    `);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run('004-section-tags.sql');
  }

  if (!applied.has('005-category-parent.sql')) {
    database.exec(`
      ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL;
    `);
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run('005-category-parent.sql');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
