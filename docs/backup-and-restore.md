# Backup and restore

Everything you write in TotoNote lives in a **single file** on your computer. That is what
makes it fast and private — and it is also why a backup matters. There is no cloud copy. If
that computer goes, so does the world.

## Making a backup

Two ways, both the same thing:

- **Settings → Backup → Back up everything…**
- **File → Back Up Everything…**

Choose where to save it. You get one file, `TotoNote-backup-2026-07-25.totonote`, holding:

- every document and section
- every highlight, tag and category
- every filing, note and date
- every picture you pasted and every drawing you made

Put it on a USB stick, in a synced folder, or send it to someone — it is one ordinary file.

> **Why not just copy the database file?** Because recent writing is often still in a
> companion `-wal` file that a plain copy misses. Backing up through the app writes a single
> complete file with everything folded in, and it is safe to do while you are working.

## Restoring

**Settings → Backup → Restore from a backup…**, or **File → Restore from Backup…**.

Pick the backup file. TotoNote checks it before touching anything, tells you what is inside
it, and asks once more. Then it replaces everything and restarts.

**Restoring replaces everything.** It is not a merge. Whatever is in TotoNote now is gone,
and the backup takes its place.

### If you restore the wrong one

The world you replaced is not deleted. It is kept next to the database as
`totonote.db.replaced`. Quit TotoNote, rename that file back to `totonote.db` — see
[the FAQ](faq.md) for where the database lives — and start the app again.

## What gets refused

TotoNote will not restore:

- a file that isn't a TotoNote backup — you'll be told so, and nothing is touched
- a backup made by a **newer version** of TotoNote than the one you're running, because it
  could contain things this version doesn't understand and would quietly drop. Update the
  app first, then restore.

Backups from **older** versions are fine — they are brought up to date on the way in.

## Moving to a new computer

1. On the old machine: **Back up everything…**
2. Copy the file across.
3. Install TotoNote on the new machine and open it.
4. **Restore from a backup…**, pick the file.

## How often?

There's no automatic schedule yet, so it's on you. A reasonable habit is a backup after any
session where you'd be upset to lose the work — and keeping the last few rather than
overwriting one, since the filenames are dated and sort in order.

---

See also: [FAQ](faq.md) for where the database file lives, and
[Workspaces](workspaces.md) — a backup covers *every* workspace, not just the open one.
