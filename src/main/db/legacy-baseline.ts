import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

/**
 * Bring a database created by the pre-Drizzle migration runner up to the state the
 * Drizzle migrator expects, so it can carry on from migration 0001.
 *
 * Before v1.0.5, migrations were applied by a hand-rolled runner that recorded them in
 * a `_migrations` table. The Drizzle migrator looks for `__drizzle_migrations` instead,
 * finds it missing, and tries to apply `0000_initial.sql` from scratch — which fails on
 * `table 'annotations' already exists` and takes the whole app down at startup.
 *
 * Two things have to happen for such a database to move forward:
 *
 *  1. `categories` has to be rebuilt. The old schema declared `name TEXT NOT NULL
 *     UNIQUE` inline, which SQLite backs with an *implicit* autoindex. Implicit indexes
 *     cannot be dropped, so migration 0001's `DROP INDEX categories_name_unique` has
 *     nothing to drop and the global uniqueness that blocks per-parent category names
 *     would survive. Recreating the table is the only way to shed it.
 *  2. `0000_initial` has to be recorded as applied, so the migrator skips it.
 *
 * The result is a database indistinguishable from one that started life under Drizzle,
 * which then takes the same 0001+ path as everyone else.
 *
 * Callers must have foreign key enforcement OFF: the rebuild drops `categories`, and
 * with enforcement on that cascades into tags, annotations and document_tags.
 */
export function adoptLegacyDatabase(sqlite: Database.Database, migrationsFolder: string): boolean {
  if (tableExists(sqlite, '__drizzle_migrations')) return false;
  // A database with no categories table is simply new — let the migrator build it.
  if (!tableExists(sqlite, 'categories')) return false;

  rebuildCategoriesTable(sqlite);
  recordInitialMigrationAsApplied(sqlite, migrationsFolder);
  return true;
}

function tableExists(sqlite: Database.Database, name: string): boolean {
  const row = sqlite
    .prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name) as { c: number };
  return row.c > 0;
}

function columnNames(sqlite: Database.Database, table: string): Set<string> {
  const rows = sqlite.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[];
  return new Set(rows.map(r => r.name));
}

/**
 * Recreate `categories` in the exact shape `0000_initial.sql` produces, carrying the
 * rows across. `parent_id` is selected defensively: a database that never got the old
 * `005-category-parent.sql` migration will not have the column.
 */
function rebuildCategoriesTable(sqlite: Database.Database): void {
  const hasParentId = columnNames(sqlite, 'categories').has('parent_id');
  const parentIdSelect = hasParentId ? 'parent_id' : 'NULL';

  sqlite.exec(`
    CREATE TABLE __new_categories (
      \`id\` text PRIMARY KEY NOT NULL,
      \`name\` text NOT NULL,
      \`sort_order\` integer DEFAULT 0 NOT NULL,
      \`parent_id\` text,
      FOREIGN KEY (\`parent_id\`) REFERENCES \`__new_categories\`(\`id\`) ON UPDATE no action ON DELETE set null
    );
    INSERT INTO __new_categories (id, name, sort_order, parent_id)
      SELECT id, name, sort_order, ${parentIdSelect} FROM categories;
    DROP TABLE categories;
    ALTER TABLE __new_categories RENAME TO categories;
    CREATE UNIQUE INDEX \`categories_name_unique\` ON \`categories\` (\`name\`);
  `);
}

/**
 * Write the `__drizzle_migrations` row for 0000. The migrator only compares
 * `created_at` against each entry's `when` from the journal, but the hash is computed
 * the same way `readMigrationFiles` does it so the table is honest about what it says.
 */
function recordInitialMigrationAsApplied(sqlite: Database.Database, migrationsFolder: string): void {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: { idx: number; when: number; tag: string }[];
  };
  const initial = journal.entries.find(e => e.idx === 0);
  if (!initial) throw new Error('Cannot baseline legacy database: no initial migration in the journal');

  const sql = fs.readFileSync(path.join(migrationsFolder, `${initial.tag}.sql`), 'utf8');
  const hash = crypto.createHash('sha256').update(sql).digest('hex');

  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  )`);
  sqlite
    .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
    .run(hash, initial.when);
}
