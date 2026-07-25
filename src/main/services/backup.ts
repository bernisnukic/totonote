import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * Whole-world backup and restore.
 *
 * Everything the app holds — documents, sections, highlights, categories, drawings and the
 * bytes of every pasted image — lives in one SQLite file. So a backup is that file, and a
 * restore is putting it back. No format of our own to keep in step with the schema, and a
 * backup opens in any SQLite tool if this app ever stops existing.
 *
 * Two things stop the naive version from working:
 *
 * - **WAL.** Recent writes sit in `totonote.db-wal`, not the main file, so copying the file
 *   alone can lose the last few minutes. `better-sqlite3`'s online backup writes a single
 *   consistent file with the WAL folded in, while the app keeps running.
 * - **Restoring into a running app.** Every open handle points at the old file. The restore
 *   validates first, keeps the current database aside, swaps the file in, and the caller
 *   relaunches — nothing tries to reuse a connection to a file that has been replaced.
 */

/** Tables that must be present for a file to be one of our backups. */
const REQUIRED_TABLES = ['documents', 'sections', 'annotations', 'categories', 'tags'];

export interface BackupSummary {
  path: string;
  bytes: number;
  documents: number;
  sections: number;
  annotations: number;
  images: number;
}

export interface RestoreCheck {
  ok: boolean;
  /** Why it can't be restored, phrased for the person reading it. */
  reason?: string;
  summary?: Omit<BackupSummary, 'path' | 'bytes'>;
}

/** Count of migrations this build knows how to apply. */
function knownMigrationCount(migrationsFolder: string): number {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] };
  return journal.entries.length;
}

function countRows(db: Database.Database, table: string): number {
  try {
    return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  } catch {
    return 0;
  }
}

/**
 * Is this file a TotoNote backup this build can open?
 *
 * Checked before anything is overwritten — a wrong file, a corrupt one, or one written by a
 * newer version must fail here rather than half-way through a restore.
 */
export function inspectBackup(filePath: string, migrationsFolder: string): RestoreCheck {
  let db: Database.Database | null = null;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });

    const tables = new Set(
      (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[])
        .map(r => r.name),
    );
    const missing = REQUIRED_TABLES.filter(t => !tables.has(t));
    if (missing.length > 0) {
      return { ok: false, reason: 'That file is not a TotoNote backup.' };
    }

    // A backup taken by a newer version can carry tables and columns this build has never
    // heard of. Opening it would appear to work and then lose whatever it can't represent,
    // so refuse and say which way round the problem is.
    const applied = countRows(db, '__drizzle_migrations');
    const known = knownMigrationCount(migrationsFolder);
    if (applied > known) {
      return {
        ok: false,
        reason: 'That backup was made by a newer version of TotoNote. Update the app first, then restore it.',
      };
    }

    return {
      ok: true,
      summary: {
        documents: countRows(db, 'documents'),
        sections: countRows(db, 'sections'),
        annotations: countRows(db, 'annotations'),
        images: countRows(db, 'media'),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: message.includes('not a database')
        ? 'That file is not a TotoNote backup.'
        : `That backup could not be read: ${message}`,
    };
  } finally {
    db?.close();
  }
}

/**
 * Write a consistent copy of the live database to `destination`.
 *
 * `live` stays open and usable throughout.
 */
export async function writeBackup(
  live: Database.Database,
  destination: string,
): Promise<BackupSummary> {
  await live.backup(destination);
  return {
    path: destination,
    bytes: fs.statSync(destination).size,
    documents: countRows(live, 'documents'),
    sections: countRows(live, 'sections'),
    annotations: countRows(live, 'annotations'),
    images: countRows(live, 'media'),
  };
}

/**
 * Put `backupPath` in place of the database at `dbPath`.
 *
 * The caller must have closed every connection to `dbPath` first, and must relaunch after.
 * The database being replaced is kept alongside as `<name>.replaced` — if the backup turns
 * out to be the wrong one, the previous world is still there to rename back.
 */
export function replaceDatabase(dbPath: string, backupPath: string): { keptAt: string } {
  const keptAt = `${dbPath}.replaced`;

  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, keptAt);
  }

  // Copy through a temporary file in the same directory, so a failure part-way leaves the
  // current database untouched rather than truncated.
  const staging = `${dbPath}.incoming`;
  fs.copyFileSync(backupPath, staging);
  fs.renameSync(staging, dbPath);

  // The old WAL and shared-memory files describe the database that was just replaced.
  // Leaving them behind would have SQLite replay them over the restored content.
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar);
  }

  return { keptAt };
}

/** `TotoNote-backup-2026-07-25.totonote` — sorts chronologically in a folder of them. */
export function suggestedBackupName(now: Date): string {
  const stamp = now.toISOString().slice(0, 10);
  return `TotoNote-backup-${stamp}.totonote`;
}
