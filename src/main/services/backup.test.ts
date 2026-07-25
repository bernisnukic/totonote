import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { inspectBackup, replaceDatabase, suggestedBackupName, writeBackup } from './backup';

const MIGRATIONS = path.join(__dirname, '..', 'db', 'migrations');

let dir: string;

/** A database with the tables a real one has, and some content in it. */
function makeWorld(file: string, opts: { docTitle?: string; migrations?: number } = {}) {
  const db = new Database(file);
  db.exec(`
    CREATE TABLE documents (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE sections (id TEXT PRIMARY KEY, document_id TEXT, content TEXT);
    CREATE TABLE annotations (id TEXT PRIMARY KEY, section_id TEXT);
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE media (id TEXT PRIMARY KEY, data BLOB);
    CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at NUMERIC);
  `);
  db.prepare(`INSERT INTO documents VALUES ('d1', ?)`).run(opts.docTitle ?? 'Hololore');
  db.prepare(`INSERT INTO sections VALUES ('s1', 'd1', 'GURA IS A SHARK')`).run();
  db.prepare(`INSERT INTO annotations VALUES ('a1', 's1')`).run();
  db.prepare(`INSERT INTO media VALUES ('m1', ?)`).run(Buffer.from([1, 2, 3]));

  const appliedCount = opts.migrations ?? realMigrationCount();
  for (let i = 0; i < appliedCount; i++) {
    db.prepare(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`).run(`h${i}`, i);
  }
  return db;
}

function realMigrationCount(): number {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'));
  return journal.entries.length;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totonote-backup-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('taking a backup', () => {
  it('writes a file that holds the same world', async () => {
    const live = makeWorld(path.join(dir, 'live.db'));
    const dest = path.join(dir, 'out.totonote');

    const summary = await writeBackup(live, dest);

    expect(summary.documents).toBe(1);
    expect(summary.sections).toBe(1);
    expect(summary.annotations).toBe(1);
    expect(summary.images).toBe(1);
    expect(summary.bytes).toBeGreaterThan(0);

    const copy = new Database(dest, { readonly: true });
    expect(copy.prepare(`SELECT title FROM documents`).get()).toEqual({ title: 'Hololore' });
    copy.close();
    live.close();
  });

  it('includes writes still sitting in the write-ahead log', async () => {
    // The whole reason for the online backup. Measured: copying the file alone at this
    // point yields "no such table: documents" — with WAL, recent writes (here, all of
    // them) are still in the sidecar, so a plain copy can lose an entire session.
    const livePath = path.join(dir, 'live.db');
    const live = makeWorld(livePath);
    live.pragma('journal_mode = WAL');
    live.prepare(`INSERT INTO documents VALUES ('d2', 'Written just now')`).run();

    const dest = path.join(dir, 'out.totonote');
    await writeBackup(live, dest);
    live.close();

    const copy = new Database(dest, { readonly: true });
    const titles = (copy.prepare(`SELECT title FROM documents ORDER BY id`).all() as { title: string }[])
      .map(r => r.title);
    copy.close();
    expect(titles).toContain('Written just now');
  });

  it('leaves the live database usable afterwards', async () => {
    const live = makeWorld(path.join(dir, 'live.db'));
    await writeBackup(live, path.join(dir, 'out.totonote'));
    expect(() => live.prepare(`INSERT INTO documents VALUES ('d3', 'After')`).run()).not.toThrow();
    live.close();
  });
});

describe('checking a backup before trusting it', () => {
  it('accepts one of ours and reports what is inside', () => {
    const live = makeWorld(path.join(dir, 'live.db'));
    live.close();

    const check = inspectBackup(path.join(dir, 'live.db'), MIGRATIONS);
    expect(check.ok).toBe(true);
    expect(check.summary).toEqual({ documents: 1, sections: 1, annotations: 1, images: 1 });
  });

  it('rejects a file that is not a database at all', () => {
    const notADb = path.join(dir, 'holiday.jpg');
    fs.writeFileSync(notADb, 'this is a photo, not a world');

    const check = inspectBackup(notADb, MIGRATIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('not a TotoNote backup');
  });

  it('rejects a database that is missing our tables', () => {
    const stranger = new Database(path.join(dir, 'other.db'));
    stranger.exec(`CREATE TABLE recipes (id TEXT PRIMARY KEY)`);
    stranger.close();

    const check = inspectBackup(path.join(dir, 'other.db'), MIGRATIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('not a TotoNote backup');
  });

  it('refuses a backup from a newer version rather than silently dropping what it cannot read', () => {
    const future = makeWorld(path.join(dir, 'future.db'), { migrations: realMigrationCount() + 3 });
    future.close();

    const check = inspectBackup(path.join(dir, 'future.db'), MIGRATIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('newer version');
  });

  it('accepts a backup from an older version, which migrations can bring forward', () => {
    const old = makeWorld(path.join(dir, 'old.db'), { migrations: 1 });
    old.close();
    expect(inspectBackup(path.join(dir, 'old.db'), MIGRATIONS).ok).toBe(true);
  });

  it('says so rather than throwing when the file does not exist', () => {
    const check = inspectBackup(path.join(dir, 'nothing-here.totonote'), MIGRATIONS);
    expect(check.ok).toBe(false);
    expect(check.reason).toBeTruthy();
  });
});

describe('restoring', () => {
  it('puts the backed-up world in place of the current one', () => {
    const livePath = path.join(dir, 'live.db');
    const live = makeWorld(livePath, { docTitle: 'Current world' });
    live.close();

    const backupPath = path.join(dir, 'backup.totonote');
    const backup = makeWorld(backupPath, { docTitle: 'Backed-up world' });
    backup.close();

    replaceDatabase(livePath, backupPath);

    const restored = new Database(livePath, { readonly: true });
    expect(restored.prepare(`SELECT title FROM documents`).get()).toEqual({ title: 'Backed-up world' });
    restored.close();
  });

  it('keeps the replaced world aside, so the wrong backup is recoverable', () => {
    const livePath = path.join(dir, 'live.db');
    const live = makeWorld(livePath, { docTitle: 'Do not lose me' });
    live.close();

    const backupPath = path.join(dir, 'backup.totonote');
    makeWorld(backupPath, { docTitle: 'Other' }).close();

    const { keptAt } = replaceDatabase(livePath, backupPath);

    const kept = new Database(keptAt, { readonly: true });
    expect(kept.prepare(`SELECT title FROM documents`).get()).toEqual({ title: 'Do not lose me' });
    kept.close();
  });

  it('clears the old write-ahead files, which would otherwise replay over the restore', () => {
    const livePath = path.join(dir, 'live.db');
    fs.writeFileSync(`${livePath}-wal`, 'stale');
    fs.writeFileSync(`${livePath}-shm`, 'stale');
    makeWorld(livePath).close();
    const backupPath = path.join(dir, 'backup.totonote');
    makeWorld(backupPath, { docTitle: 'Restored' }).close();

    replaceDatabase(livePath, backupPath);

    expect(fs.existsSync(`${livePath}-wal`)).toBe(false);
    expect(fs.existsSync(`${livePath}-shm`)).toBe(false);
  });

  it('works when there is no current database yet', () => {
    const livePath = path.join(dir, 'fresh.db');
    const backupPath = path.join(dir, 'backup.totonote');
    makeWorld(backupPath, { docTitle: 'From backup' }).close();

    expect(() => replaceDatabase(livePath, backupPath)).not.toThrow();
    const restored = new Database(livePath, { readonly: true });
    expect(restored.prepare(`SELECT title FROM documents`).get()).toEqual({ title: 'From backup' });
    restored.close();
  });

  it('round-trips: back up, change everything, restore, and the original is back', async () => {
    const livePath = path.join(dir, 'live.db');
    const live = makeWorld(livePath, { docTitle: 'The world as it was' });

    const backupPath = path.join(dir, 'backup.totonote');
    await writeBackup(live, backupPath);

    live.prepare(`DELETE FROM documents`).run();
    live.prepare(`DELETE FROM annotations`).run();
    live.close();

    replaceDatabase(livePath, backupPath);

    const restored = new Database(livePath, { readonly: true });
    expect(restored.prepare(`SELECT title FROM documents`).get()).toEqual({ title: 'The world as it was' });
    expect(restored.prepare(`SELECT count(*) AS n FROM annotations`).get()).toEqual({ n: 1 });
    restored.close();
  });
});

describe('the suggested filename', () => {
  it('is dated, so a folder of backups sorts by when they were taken', () => {
    expect(suggestedBackupName(new Date('2026-07-25T13:45:00Z'))).toBe('TotoNote-backup-2026-07-25.totonote');
  });
});
