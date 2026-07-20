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

Quit TotoNote, then copy `totonote.db` (and the `-wal` / `-shm` files if they're there)
somewhere safe. To restore, quit and copy them back.

Worth doing before you install a new version.

## Can I export my notes?

Not yet. There's no export or import in the app — the database file is the only copy.

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

## Can I rename a document or a section?

Not at the moment. Titles are fixed once created. Categories and tags *can* be renamed.

## I deleted something by accident. Can I undo it?

No. Deleting a document, section, category or tag is immediate and permanent. `⌘Z` undoes
typing inside a section, but not deletions.

This is the main reason to keep a backup.

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
