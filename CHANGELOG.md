# What's New

## 1.13.0

**Fixed: rolling back History could put wrong text on your wiki pages.** Restoring a
checkpoint put the words back but left every highlight pointing at the *positions* it had
in the newer text — so a compiled page could show a passage you never highlighted, with no
sign anything was wrong. Checkpoints now record where the highlights were and put them back
with the text. If a rollback would remove highlights added since, TotoNote says so first.

**The History interval is now a setting.** *Settings → History* — from a checkpoint at every
pause (a timeline that fills in as you write) up to every 10 seconds. One second by default.

**Filed drawings show up on wiki pages.** A drawing filed under a category used to render as
an empty row; it now shows its actual strokes, over its background image.

## 1.12.0

**Drawing.** The **✎** button adds a drawing surface to a section. Select an image first and
it draws *on top of that image* instead — for putting arrows on a map, circling a region, or
labelling a floorplan.

If you draw with a **graphics tablet the pen is pressure-sensitive**: press harder for a
thicker line. There's a highlighter for shading an area, and an eraser that removes a whole
stroke wherever you touch it rather than rubbing away pixels. Plus colours, four nib sizes,
and undo/redo for the drawing itself.

Strokes are saved as lines, not as a picture, so a drawing stays sharp at any size, costs
almost nothing in space, and stays lined up with whatever is underneath it.

**Also fixed:** the toolbar's buttons now update as you move around the document — Bold and
the rest showed a stale state until something else happened to refresh them.

## 1.11.0

**Pictures.** Paste or drag an image straight into a section — character references, maps,
concept art. PNG, JPEG, WebP, GIF and AVIF.

Images are kept **inside your world file**, so copying `totonote.db` still takes everything
with it, and anything over 2000px is scaled down once on the way in so a folder of concept
art doesn't turn your world into a multi-gigabyte file.

**Pictures go on wiki pages too.** Select an image, tag it, and file it under a category
just like a passage of text — the picture then shows up on that category's compiled page.
Which is how a character's portrait ends up on the character's page.

## 1.10.1

**Fixed: leaving a document could lose unsaved work.** With **Auto-save** turned off,
pressing **← Back**, opening another document or switching workspace threw away anything
you hadn't saved — without warning. Leaving a document now saves it first, whichever mode
you're in. (Auto-save decides whether TotoNote saves *while you type*; quitting still asks.)

If you use manual saving, please update.

Also: the History timeline no longer holds on to checkpoints for documents you've closed.

## 1.10.0

**A History timeline.** The new **History** tab keeps checkpoints of the section you're
writing — automatic snapshots taken whenever you pause. Click any one to roll the section
back to that state, and because the whole timeline stays put, you can jump forward again
too. It's more forgiving than plain undo, which throws the "future" away as soon as you make
a new edit. Each checkpoint shows when it was taken and a preview of the text; history lasts
for the session and clears when you close the app.

## 1.9.0

**Undo works in the editor again.** ⌘Z / Ctrl+Z was being swallowed by the menu's
system-level undo, which the editor never heard. It now goes straight to your writing.

**Auto-save is now optional.** It's still on by default — your writing saves itself as you
go — but you can turn it off in **Settings → Editing**. With it off, you save on demand with
**⌘S / Ctrl+S** (or the **Save** button in the status bar), the status bar shows **● Unsaved**
when you have pending changes, and TotoNote warns you before quitting with unsaved work.

**Expand or collapse every category at once.** The Search tab has an **Expand all /
Collapse all** button above the list.

## 1.8.0

**Familiar toolbar icons.** The formatting buttons are now the icons you know from any word
processor — bold, italic, underline, strikethrough, headings, and lists — instead of terse
letters. Hover any of them for its name.

**Drag to reorder sections.** In the Arrange tab you can now drag a section by its grip to
reorder it, as well as using the ▲ ▼ arrows.

**Deleting a section asks first.** The tab's ✕ now confirms before deleting — a section
holds a whole page of writing — and Undo still catches it if you change your mind.

**Fixes from your testing:**

- **Sort works with a filter on.** Opening the Sort tab now shows every excerpt even if you
  left filter tags ticked, instead of appearing to do nothing.
- **The pop-out wiki has one close button, not two.**
- **Deleting a tagged section updates the counts.** A tag's usage count no longer keeps
  counting a section you've deleted.
- **The Section Label field explains itself** — it's the word this document uses for its
  sections (Chapter, Act, Entry…), now spelled out right under the field.

## 1.7.0

**The Sort tab works now.** It turns the main page into a reading list of *every* tagged
excerpt in the document, in the order you choose — document order, newest, oldest, or
grouped by tag. It's the whole-document companion to Filter: Filter narrows to the tags you
tick, Sort shows them all, ordered. Like Filter it's a reading view — your writing is
untouched underneath, and double-clicking an excerpt jumps straight to it. (It used to
highlight a button and do nothing.)

**Tag and category pages pop out full-screen.** The ⤒ button on any page opens it as a
full-width wiki page — the same page, just roomier to read. Escape drops back to the
sidebar.

**Notes on individual excerpts.** Under any filed excerpt there's a **+ note** — jot a
reminder to yourself ("first mention of the sword") that lives with the excerpt and never
shows up in the document.

**Double-click to jump.** Double-clicking an excerpt on a page opens it in the document,
while a single click leaves the page open so you can read down the list.

**Clearer labels and a glossary.** Every button tooltip now says what it does (Bold,
Heading 1, Bullet list…). The cramped **HL** tab is now **Highlights**. And the in-app
guide has a new **Glossary** page defining every term TotoNote uses — tag, highlight,
excerpt, filing, page — so nothing is left to guess.

**Guide search, and small comforts.** The in-app guide has a search box, its close button is
easier to hit, and **View → Reset Sidebar Widths** puts the panels back if you drag them
somewhere awkward.

## 1.6.0

**Editor updated to TipTap 3.** The rich-text editor moved to the current major version
for better performance and ongoing support. Everything works as before — the change is
under the hood.

## 1.5.0

**Filter now collapses the page to just the tagged text.** Ticking tags in Filter mode
turns the main page into a reading view showing only those tags' passages — the untagged
text is hidden, several tags at once. Click any passage to jump back and edit it. (This
replaces the earlier version that only dimmed highlights.)

**The changelog shows itself after an update, reliably.** What's New now opens on the
first launch of a new version, and the intro plays only once — both remembered in your
database, so they work even when you download a fresh copy each time.

## 1.4.0

**Filter now hides highlights, not just sections.** Ticking tags in Filter mode shows
only those highlights and dims the rest — so it does something visible even in a
single-section document. It still hides sections that have none of the ticked tags.

**The tag and category panels stay open when you click an excerpt.** Clicking a phrase
in a tag's or category's page jumps to that text in the editor and keeps the panel open,
so you can click straight down the list. It used to collapse on the first click.

**The graph tells same-named categories apart.** When several categories share a name —
every character has a HISTORY — the graph shows the parent for context ("GURA › HISTORY").
Hover any node for its full path.

**What's New shows itself.** After you update, the app opens this page on first launch so
you can see what changed.

## 1.3.1

- The **Help** window's title sat underneath the macOS window buttons unless the app was
  fullscreen. The graph view had the same problem.
- Help pages are listed in reading order, with their proper titles.

## 1.3.0

**Workspaces.** Documents and their categories now live inside a **workspace** — a
world. Create one per project and their categories stay separate: `Game 1` can have its
own `CHARACTERS` tree without seeing `Game 2`'s. Switch between them from the bar above
your documents. Everything you already had moved into a workspace called *My World*.

**Undo for deletions.** Deleting a tag, category or section now offers **Undo** for a few
seconds — it puts back everything that went with it, including highlights in other
documents. Deleting a document still asks first, since that one is bigger.

**Help, in the app.** The menu bar has a real **Help** menu with the full user guide and
this changelog, readable offline. Previously that menu was empty.

**Drag to reorder filed excerpts.** Category pages let you drag excerpts into the order
you want, as well as the arrow buttons.

**Fixes**

- "Add tag to selection" from the right-click menu opened nothing until you right-clicked
  a second time. Fixed.
- Tooltips appear promptly instead of after a long pause, and no longer need a perfectly
  still cursor.
- The intro animation plays once, on first launch, and no longer loops before fading.
- The app identified itself as "Electron" in the macOS menu bar.
- Deleting a document asks for confirmation.
- Sidebar widths reset to default when you double-click the divider.
- The macOS Edit menu is back, so ⌘C / ⌘V / ⌘Z work as expected everywhere.

## 1.2.0

**Filing.** Tags say what a piece of text is about; **filing** says which page it belongs
on. File an excerpt under `GURA > HISTORY` and that category becomes a compiled page,
collecting everything filed there from every document. Order excerpts by hand, by age, or
by document position.

**The graph.** A new toolbar button draws your whole structure as one map — the category
tree, each tag's home, and the filing links that cut across it.

**Fixes**

- Deleting a tag left its highlights coloured in until the app restarted.
- The category dropdown when tagging a selection didn't indent sub-categories.
- Selecting a sentence pre-filled it into the tag search box, hiding your tag list.
- Arrow keys stopped moving the text cursor once a tag had been clicked.
- Typing right after a highlight got swallowed into it.
- Deleting a tag from the Info panel had no confirmation.

## 1.1.0

**Category rules.** Give a category a rule — a list of sub-categories — and every new
sub-category you add under it is created with that skeleton inside. Rules are indented
text so they can nest, are editable, and can be applied retroactively to sub-categories
you already made. A Select mode adds one sub-category to several categories at once.

**Fixes**

- Databases from v1.0.4 and earlier stopped the app from opening at all.

## 1.0.6

Earlier releases: see the
[GitHub releases page](https://github.com/bernisnukic/totonote/releases).
