# What's New

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
