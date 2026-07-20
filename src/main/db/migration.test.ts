import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';
import * as schema from './schema';
import { createTestDb } from './test-helpers';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

function journalEntries(): JournalEntry[] {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'));
  return journal.entries;
}

/**
 * Build a database that looks like an install sitting at migration 0000 — schema and
 * data in place, and a `__drizzle_migrations` row recording 0000 as applied so the real
 * migrator picks up from 0001. This is the upgrade path a shipped app takes.
 */
function dbAtInitialMigration() {
  const entries = journalEntries();
  const initial = entries[0];

  const sqlite = new Database(':memory:');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, `${initial.tag}.sql`), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) sqlite.exec(statement);
  }

  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric
  )`);
  sqlite
    .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run(initial.tag, initial.when);

  return { sqlite, entries };
}

function seedRealisticData(sqlite: Database.Database) {
  sqlite.exec(`
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-general', 'General', 1);
    INSERT INTO categories (id, name, sort_order) VALUES ('cat-chars', 'CHARACTERS', 2);
    INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('cat-gura', 'GURA', 3, 'cat-chars');
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

function count(sqlite: Database.Database, table: string): number {
  return (sqlite.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

describe('migrations', () => {
  it('upgrades an existing database without losing user data', () => {
    // Guards a real hazard: any migration that alters a table is emitted by drizzle-kit
    // as a rebuild (DROP TABLE + rename). With foreign keys enforced, that DROP cascades
    // through tags -> annotations / document_tags / section_tags and silently empties
    // them. The `PRAGMA foreign_keys=OFF` inside the migration file cannot prevent it —
    // the migrator wraps every statement in one BEGIN, and SQLite ignores that pragma
    // inside a transaction. connection.ts toggles it on the connection instead; this
    // test fails if that ever regresses.
    const { sqlite } = dbAtInitialMigration();
    seedRealisticData(sqlite);

    const before = {
      categories: count(sqlite, 'categories'),
      tags: count(sqlite, 'tags'),
      annotations: count(sqlite, 'annotations'),
      documentTags: count(sqlite, 'document_tags'),
      sectionTags: count(sqlite, 'section_tags'),
    };

    const db = drizzle(sqlite, { schema });
    sqlite.pragma('foreign_keys = OFF');
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    sqlite.pragma('foreign_keys = ON');

    expect({
      categories: count(sqlite, 'categories'),
      tags: count(sqlite, 'tags'),
      annotations: count(sqlite, 'annotations'),
      documentTags: count(sqlite, 'document_tags'),
      sectionTags: count(sqlite, 'section_tags'),
    }).toEqual(before);

    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('applies every migration in the journal', () => {
    const { sqlite, entries } = dbAtInitialMigration();
    const db = drizzle(sqlite, { schema });
    sqlite.pragma('foreign_keys = OFF');
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    sqlite.pragma('foreign_keys = ON');

    expect(count(sqlite, '__drizzle_migrations')).toBe(entries.length);
  });

  it('drops the global unique constraint on category names', () => {
    const { sqlite } = dbAtInitialMigration();
    seedRealisticData(sqlite);
    const db = drizzle(sqlite, { schema });
    sqlite.pragma('foreign_keys = OFF');
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    sqlite.pragma('foreign_keys = ON');

    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('cat-peko', 'PEKORA', 4, 'cat-chars')`);
    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h1', 'HISTORY', 5, 'cat-gura')`);
    // The same name under a different parent — rejected before this migration.
    sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h2', 'HISTORY', 6, 'cat-peko')`);

    expect(count(sqlite, 'categories')).toBe(6);
  });

  it('still rejects duplicate names under the same parent', () => {
    const { sqlite } = createTestDb();
    sqlite.exec(`
      INSERT INTO categories (id, name, sort_order) VALUES ('cat-chars', 'CHARACTERS', 1);
      INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h1', 'HISTORY', 2, 'cat-chars');
    `);
    expect(() =>
      sqlite.exec(`INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('h2', 'HISTORY', 3, 'cat-chars')`),
    ).toThrow(/UNIQUE/i);
  });

  it('rejects duplicate root category names', () => {
    // Root rows have parent_id NULL, and SQLite treats NULLs as distinct in a unique
    // index — so this relies on the separate partial index.
    const { sqlite } = createTestDb();
    sqlite.exec(`INSERT INTO categories (id, name, sort_order) VALUES ('c1', 'CHARACTERS', 1)`);
    expect(() =>
      sqlite.exec(`INSERT INTO categories (id, name, sort_order) VALUES ('c2', 'CHARACTERS', 2)`),
    ).toThrow(/UNIQUE/i);
  });

  it('unfiles annotations when their filing category is deleted, instead of blocking', () => {
    // Drizzle-kit emitted the 0002 ADD COLUMN without its ON DELETE SET NULL clause;
    // the .sql was corrected by hand before shipping. Without the clause, deleting a
    // category that has filed annotations fails the FK constraint outright.
    const { sqlite } = createTestDb();
    sqlite.exec(`
      INSERT INTO categories (id, name, sort_order) VALUES ('cat-chars', 'CHARACTERS', 1);
      INSERT INTO categories (id, name, sort_order, parent_id) VALUES ('cat-hist', 'HISTORY', 2, 'cat-chars');
      INSERT INTO documents (id, title) VALUES ('doc-1', 'Lore');
      INSERT INTO sections (id, document_id, title, abbreviation, sort_order)
        VALUES ('sec-1', 'doc-1', 'Intro', 'IN', 1);
      INSERT INTO tags (id, category_id, name) VALUES ('tag-1', 'cat-chars', 'Gura');
      INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos, category_id)
        VALUES ('ann-1', 'sec-1', 'tag-1', 1, 5, 'cat-hist');
    `);

    sqlite.exec(`DELETE FROM categories WHERE id = 'cat-hist'`);

    const row = sqlite.prepare(`SELECT category_id FROM annotations WHERE id = 'ann-1'`).get() as {
      category_id: string | null;
    };
    expect(row.category_id).toBeNull();
    expect(count(sqlite, 'annotations')).toBe(1);
  });

  it('leaves foreign keys enforced after the helper builds a database', () => {
    // connection.ts and test-helpers.ts must both restore the pragma after migrating.
    const { sqlite } = createTestDb();
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
