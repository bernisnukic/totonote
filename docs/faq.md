# FAQ

## Where are my notes kept?

In a single SQLite file on your own machine. Nothing is uploaded anywhere, and there is no
account.

| System | Location |
|--------|----------|
| macOS | `~/Library/Application Support/TotoNote/totonote.db` |
| Windows | `%APPDATA%\TotoNote\totonote.db` |
| Linux | `~/.config/TotoNote/totonote.db` |

You may also see `totonote.db-wal` and `totonote.db-shm` next to it. Those belong to the
database too.

## How do I back up?

**Settings → Backup → Back up everything…**, or **File → Back Up Everything…**. You get one
file holding your whole world, which you can keep anywhere. **Restore from a backup…** puts
one back.

Worth doing before you install a new version. Full details in
[Backup and restore](backup-and-restore.md).

> Copying `totonote.db` by hand also works if you quit the app first — but take the `-wal`
> and `-shm` files with it, or you may miss your most recent writing. Backing up through the
> app avoids that entirely.

## Can I export my notes?

A backup is a complete export: one file with everything in it, readable by any SQLite tool
if TotoNote ever stops existing. Individual category pages can also be exported to Markdown
from the page itself.

## Why does my computer warn me when I open it?

The builds aren't code-signed, so macOS and Windows treat them as coming from an unknown
developer.

- **macOS** — right-click the app → **Open**, then confirm. Only needed the first time.
- **Windows** — on the SmartScreen prompt: **More info → Run anyway**.

## Which Macs are supported?

The macOS build is for **Apple Silicon** (M1 and later). It will not run on an Intel Mac.

## How do updates work?

TotoNote checks GitHub once when it starts. If there's a newer version, a small panel
appears in the bottom-right corner saying **New version available** with a **Download**
button.

Download opens the release page in your browser — it doesn't install anything for you.
Grab the file, then install it the same way you did the first time. Your notes stay where
they are.

The **×** dismisses that particular version for good; a later version will still tell you.
There's no "check for updates" button, and if the check fails it stays quiet.

## Why do my categories show up in every document?

Because they're shared across the whole **workspace** — that's what makes a category page
able to collect excerpts from all your documents at once. If you want a clean slate for a
different project, make a new workspace. See [Workspaces](workspaces.md).

## I deleted something by accident — can I get it back?

Deleting a tag, category or section shows an **Undo** button for a few seconds in the
bottom of the window. That puts back everything the delete took with it, including
highlights in other documents.

Once the toast disappears, it's gone. Deleting a **document** or a **workspace** asks you
to confirm instead, and cannot be undone.

## Where's the user guide?

**Help** in the menu bar, at the top of the screen. It has this whole guide and a
**What's New** page, and works offline.

## Can I rename a document or a section?

Not at the moment. Titles are fixed once created. Categories and tags *can* be renamed.

## Why did my last sentence not save?

Saving happens about a second after you stop typing. If you press **← Back** or quit
straight after a keystroke, that last edit can be lost. Wait for the status bar to say
**Saved**.

## Where's the Settings button?

In the toolbar, but only once a document is open. The Documents screen has no toolbar.

## I'm upgrading from an old version and it won't start

Versions before 1.1.0 had a bug where a database from **v1.0.4 or earlier** stopped the app
from opening at all. Updating to 1.1.0 or later fixes it — your notes are intact, the app
just couldn't read them.

## Something's broken / I have an idea

Open an issue at
[github.com/bernisnukic/totonote/issues](https://github.com/bernisnukic/totonote/issues).
