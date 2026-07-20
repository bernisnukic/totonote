import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from './schema';
import { adoptLegacyDatabase } from './legacy-baseline';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * The schema the pre-Drizzle migration runner left behind, copied from a real
 * v1.0.4 database. Note `name TEXT NOT NULL UNIQUE` declared inline — SQLite backs
 * that with an implicit autoindex, which is precisely what cannot be dropped.
 */
function createLegacyDatabase({ withParentId = true } = {}) {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
      section_label TEXT DEFAULT 'Section',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE sections (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL, abbreviation TEXT NOT NULL, sort_order INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
      ${withParentId ? ', parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL' : ''}
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#48dbfb', description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX idx_tags_name_category ON tags(name, category_id);
    CREATE TABLE annotations (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      from_pos INTEGER NOT NULL, to_pos INTEGER NOT NULL, note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE document_tags (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id),
      PRIMARY KEY (document_id, tag_id)
    );
    CREATE TABLE section_tags (
      section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (section_id, tag_id)
    );
    CREATE TABLE browse_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      parent_id TEXT REFERENCES browse_categories(id), sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    INSERT INTO _migrations (name) VALUES ('001-initial.sql'), ('002-remove-seed-data.sql'),
      ('003-ensure-general-category.sql'), ('004-section-tags.sql'), ('005-category-parent.sql');
  `);
  return sqlite;
}

function seed(sqlite: Database.Database, { withParentId = true } = {}) {
  sqlite.exec(`
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-general', 'General', 1);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-chars', 'CHARACTERS', 2);
    ${withParentId
      ? `INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('cat-gura', 'GURA', 3, 'cat-chars');`
      : `INSERT INTO categories (id, name, sort_order) VALUES ('cat-gura', 'GURA', 3);`}
    INSERT INTO documents (id, title) VALUES ('doc-1', 'Lore');
    INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
      VALUES ('sec-1', 'doc-1', 'Intro', 'IN', 1);
    INSERT INTO tags (id, category_id, name) VALUES ('tag-1', 'cat-general', 'Hero');
    INSERT INTO tags (id, category_id, name) VALUES ('tag-2', 'cat-gura', 'Shark');
    INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos)
      VALUES ('ann-1', 'sec-1', 'tag-1', 0, 5);
    INSERT INTO document_tags (document_id, tag_id, category_id) VALUES ('doc-1', 'tag-1', 'cat-general');
    INSERT INTO section_tags (section_id, tag_id) VALUES ('sec-1', 'tag-2');
  `);
}

const count = (sqlite: Database.Database, table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

/** The startup sequence from connection.ts, minus Electron. */
function runStartupMigration(sqlite: Database.Database) {
  const db = drizzle(sqlite, { schema });
  sqlite.pragma('foreign_keys = OFF');
  const adopted = adoptLegacyDatabase(sqlite, MIGRATIONS_DIR);
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  sqlite.pragma('foreign_keys = ON');
  return adopted;
}

describe('adoptLegacyDatabase', () => {
  it('lets a pre-Drizzle database start up instead of crashing', () => {
    // Without adoption the migrator re-runs 0000_initial and dies on
    // "table `annotations` already exists", taking the app down at launch.
    const sqlite = createLegacyDatabase();
    seed(sqlite);

    expect(() => runStartupMigration(sqlite)).not.toThrow();
  });

  it('keeps every row through the upgrade', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);
    const before = ['documents', 'sections', 'categories', 'tags', 'annotations', 'document_tags', 'section_tags']
      .map(t => [t, count(sqlite, t)] as const);

    runStartupMigration(sqlite);

    for (const [table, n] of before) {
      expect(`${table}=${count(sqlite, table)}`).toBe(`${table}=${n}`);
    }
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
  });

  it('preserves category values and parent links', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);
    runStartupMigration(sqlite);

    const gura = sqlite.prepare(`SELECT * FROM categories WHERE id = 'cat-gura'`).get();
    expect(gura).toEqual({ id: 'cat-gura', name: 'GURA', sort_order: 3, parent_id: 'cat-chars' });
  });

  it('sheds the un-droppable inline UNIQUE so per-parent names become possible', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);
    runStartupMigration(sqlite);

    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('cat-peko', 'PEKORA', 4, 'cat-chars')`);
    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h1', 'HISTORY', 5, 'cat-gura')`);
    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h2', 'HISTORY', 6, 'cat-peko')`);

    expect(count(sqlite, 'categories')).toBe(6);
  });

  it('still rejects duplicate names under one parent after adoption', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);
    runStartupMigration(sqlite);

    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h1', 'HISTORY', 5, 'cat-gura')`);
    expect(() =>
      sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h2', 'HISTORY', 6, 'cat-gura')`),
    ).toThrow(/UNIQUE/i);
  });

  it('applies the new migrations and creates the rules table', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);
    runStartupMigration(sqlite);

    sqlite.exec(`INSERT INTO category_rules (category_id, template) VALUES ('cat-chars', 'HISTORY')`);
    expect(count(sqlite, 'category_rules')).toBe(1);
  });

  it('handles a database old enough to predate the parent_id column', () => {
    const sqlite = createLegacyDatabase({ withParentId: false });
    seed(sqlite, { withParentId: false });

    expect(() => runStartupMigration(sqlite)).not.toThrow();
    expect(count(sqlite, 'categories')).toBe(3);
    expect(
      sqlite.prepare(`SELECT parent_id FROM categories WHERE id = 'cat-gura'`).get(),
    ).toEqual({ parent_id: null });
  });

  it('is idempotent — a second startup changes nothing', () => {
    const sqlite = createLegacyDatabase();
    seed(sqlite);

    expect(runStartupMigration(sqlite)).toBe(true);
    expect(runStartupMigration(sqlite)).toBe(false);
    expect(count(sqlite, 'categories')).toBe(3);
    expect(count(sqlite, 'tags')).toBe(2);
  });

  it('leaves a database that already uses Drizzle alone', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.pragma('foreign_keys = OFF');
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    sqlite.pragma('foreign_keys = ON');

    expect(adoptLegacyDatabase(sqlite, MIGRATIONS_DIR)).toBe(false);
  });

  it('leaves a brand-new empty database to the migrator', () => {
    const sqlite = new Database(':memory:');
    expect(adoptLegacyDatabase(sqlite, MIGRATIONS_DIR)).toBe(false);
  });
});
