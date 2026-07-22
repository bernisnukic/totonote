# What's New

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
