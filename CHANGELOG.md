# What's New

## 1.23.1

**The splash fades in before the animation starts**, instead of appearing already halfway
through it, and **holds on the finished mark for a moment** before the app opens.

The animation also plays to its end now. It was being cut off five frames early: the splash
waited 3150ms for an animation that runs for 3300ms.

## 1.23.0

**Check for updates whenever you like.** **TotoNote → Check for Updates…**, or the
**Updates** section in Settings. It tells you what you have, what's out, and opens the
download page. It can't install the update for itself — TotoNote isn't signed with an Apple
developer certificate, which is also why macOS asks you to approve it the first time.

**The space beside a drawing belongs to the page again.** Narrow a drawing and the empty
space to its right was still part of it, so clicking there selected it and right-clicking
there opened its menu.

**The Tag toolbar opens above a drawing instead of on top of it**, the same as it does for
selected text.

**Reset a drawing or picture to its original size** — a new item in its right-click menu,
above Delete. Dragging a corner is easy to overshoot, and there was no way back.

**Delete is red before you touch it**, and hovering fills the row rather than tinting it.

## 1.22.0

**History reads as a log of what you did.** Every checkpoint used to be labelled with the
opening of the section — the same sixty characters every time — so the list said nothing
about which state you were choosing. Each row now names the change that produced it:

- `Added “hello”` · `Removed “hello”` · `Replaced “red” with “blue”`
- `Added 340 characters`, when it is too much to quote
- `Highlighted “the dragon”`
- `Added a drawing` · `Changed a drawing` · `Added a picture`

Undoing shows as whatever it put back — undoing a deletion of *hello* reads as
`Added “hello”` — because a checkpoint records the state of the section, not which button
you pressed. Hover a row to see how the section opened at that point.

## 1.21.3

**Resizing a drawing works again.** 1.21.2 broke it badly: a drawing could be made smaller
but never larger again, it dropped to its smallest size, and it became hard to click at
all. Making a tagged drawing's outline hug the drawing had shrunk the invisible box around
it down to the width of the Draw button — and that box was what limited how wide the
drawing could be dragged.

**Two tagged drawings no longer have overlapping outlines.**

The outline is now drawn on the drawing itself rather than on the box around it, so it
cannot affect the drawing's size or position again.

## 1.21.2

**Resizing a tagged drawing no longer makes its highlight disappear.** It came back only
after clicking around, which made resizing feel as though it had half-broken something.

**A small picture can be clicked again.** The resize handle sits on the bottom-right corner
and is invisible until you hover — but it was still catching clicks, and on anything
smaller than the handle it covered the picture completely. Clicking such a picture did
nothing at all: there was no way to select it, tag it, or resize it. The handle now moves
clear of the corner when the picture is small.

**Typing at the end of a highlight no longer extends it.** This briefly regressed while
fixing the resize above.

## 1.21.1

**Deleting a picture or drawing is an item in the right-click menu**, in red at the bottom,
rather than a dialog that replaced the menu. It works on tagged ones too — before, right-
clicking a tagged drawing only offered the tag options, with no way to delete it.

**Resizing a tagged drawing resizes its highlight with it.** The outline was following the
full column width and appeared to change height only.

**Escape in the guide's search box clears the search**, instead of closing the guide and
losing the page you were reading.

## 1.21.0

**Tag sets — apply a combination of tags in one go.** Where the same two or three tags keep
landing on the same passages, save the combination: **Edit** tab → **+ Create tag set**, name
it, tick the tags. It then appears in the tag box, and one click applies all of them.

A set is a **shortcut, not a tag**. Tagging with it puts its member tags on the text, so a
passage tagged with a four-tag set still counts towards every smaller combination inside it —
filter by two of those tags and it's there, with no set needed for that pair. Deleting a set
removes the shortcut only; the tags and everything tagged with them are untouched.

**Order the tag list.** Above the tag tree: A → Z, newest or oldest first, most or least
used, or as arranged.

**Shortcuts for tagging and filing.** **⌘T** tags what's selected. **⌘⇧F** files the
highlight you're on. Both open the same boxes as before.

**Escape leaves drawing mode.** If you haven't drawn anything it just leaves. If you have, it
asks whether to keep it — **Done** still keeps without asking, because that's what Done means.

## 1.20.1

**Highlights appear in every section, not just the one you're in.** Tagging text in a
section that wasn't the current one stored the highlight and drew nothing — so the tag
looked as though it had failed, and tagging again made a second one.

## 1.20.0

**A highlight goes on the section you selected the text in.** Tagging just after moving
between sections could attach it to the previous one instead, at positions that meant
nothing there — so no highlight appeared at all and the tag looked like it had failed.

**Drag section tabs to reorder them**, the way browser tabs work. The Arrange tab still
does it too.

**Selecting a line stops at the end of that line.** Holding Shift and pressing End ran past
the end of the paragraph and into whatever was below it — so a picture underneath ended up
selected along with the words. Selecting text and a picture together still works by
dragging.

**Export Page… is in the File menu**, next to the backup items — which is where people
looked for it. The button at the top of the page is unchanged.

## 1.19.0

**Tagging a picture or a drawing now shows.** It always created the highlight, but drew
nothing — so it looked like it hadn't worked, there was nothing to right-click, and you
could tag the same image over and over without noticing. The picture itself is outlined
now, and can be right-clicked like any other highlight. Tagging the same thing twice with
the same tag no longer makes a duplicate.

**Delete a picture or drawing by right-clicking it.** Backspace still works; this is for
when you're looking for a way to do it.

**A section can start with a picture.** There's always a line above it to write on — before,
a section beginning with an image or drawing left nowhere to put an opening line.

**Copying a drawing copies the drawing.** Pasting one used to produce a blank surface: the
drawing's identity didn't survive the clipboard, so the pasted copy pointed at nothing. It
now comes across with its strokes, as its own drawing — editing the copy doesn't change the
original.

**Drawings can be resized.** Drag the corner, the same as a picture. A quick arrow no longer
has to take the full width of the column.

**Double-click a drawing to start drawing on it.** The Draw button is still there.

## 1.18.0

**Undo treats tagging as its own step.** Typing something and then tagging it, one **⌘Z**
used to remove the tag *and* the writing together — undoing the typing took the words the
highlight sat on with it. Now each is its own step, in the order you did them:

> type → tag → **⌘Z** removes the tag → **⌘Z** removes the text → **⌘Y** puts the text back
> → **⌘Y** puts the tag back

**Right-clicking a highlight no longer opens two things.** It was showing the tag popover as
well as the menu, with the popover landing somewhere unrelated.

**Escape closes what a click on a highlight opened** — either the popover or the menu.

## 1.17.1

Fixes the warning before deleting highlighted text, which did not appear on Linux in 1.17.0.

## 1.17.0

**Deleting highlighted text asks first, and cleans up after itself.** A highlight whose words
you deleted used to stay in the database with nothing to point at, and turned up on every
compiled page as a bare “…”. Now you're told how many highlights an edit would destroy
before it happens, and empty leftovers are never drawn.

**Tag pages are reachable from where you are.** Double-click a tag in the **Info** tab to
open its page, or click the tag or category name on a highlight's popover. Previously you had
to leave for the Search sidebar and find the tag again.

**Filing offers the categories that make sense.** When you file an excerpt, the list starts
with the tag's own category and whatever sits under it, with **Show all categories** if you
need somewhere else. If narrowing would leave a single dead-end choice, you get the full list.

**Choose your tag, then where it's filed.** Picking a tag used to create the highlight
immediately, leaving no moment to also say where it belonged. There's now an **Add** button,
so you can do both in one go.

**Right-click menus stay on screen.** Near the bottom of the window they open upwards
instead of being cut off.

**Combining highlights is clearer.** Two neighbours with the same tag showed two identical
menu entries; they now say which side they're on and quote their own words. Combining across
two different tags warns you first, because the other tag is replaced and undo won't bring
it back.

**Line spacing.** **Settings → Editing** — Tight, Normal, Relaxed or Loose.

**The user guide works properly.**

- The area to the right of the text scrolls now, instead of ignoring the wheel.
- A search result takes you to the words, not just the top of the page.
- **⌘F** / **Ctrl+F** focuses the search box — in the guide, or the sidebar elsewhere.
- Click a screenshot to see it full size.
- A few lines that read like ad copy have been rewritten.

**Smaller things**

- Section tabs keep their titles until there are more than five, like browser tabs. Every
  other tab used to shrink to a three-letter code, which put the × somewhere easy to misclick.
- **Escape** in a note or date editor closes just that editor, rather than the whole page.
- The drawing tools (pen, highlighter, eraser, undo/redo) are bigger.
- New FAQ entry for exported `.md` files opening in the wrong application.

## 1.16.4

**Rolling back History always asks first.** It only warned when highlights were about to be
lost; otherwise one click on the wrong row silently replaced everything written since. The
warning now names the section, says how far back it goes, and how much writing and how many
highlights will go with it. Dismissing it means *no*.

**File an excerpt from where you're reading it.** Every excerpt row — on a category page, on
a tag's page, in the Info tab — now shows where it's filed and lets you change it. Before,
the only way was to find the highlight in the document and right-click it.

**The tag picker fits more tags.** "Add tag to selection" showed about five at a time in a
narrow box, which stops working once a world has a lot of tags. The list is now up to three
times taller and the box is wider.

**Icons that match.** The graph, timeline, sidebar and settings buttons were text characters
and rendered noticeably smaller than the drawn icons beside them — they're now drawn to
match. The **⌘ ⇧ ⌥** symbols in the keyboard-shortcut list were 10px; they're readable now.
The export button on a compiled page is an icon *and* the word **Export**, so it's findable.

**Fixes**

- Fourteen style rules referenced custom properties that don't exist (`--font-xs` where the
  token is `--font-size-xs`, `--border-color` where it's `--border-default`), so text in the
  timeline, the link picker, the backup panel and the confirm dialogs rendered at a browser
  default size instead of the intended one. A test now fails the build on any unresolvable
  property.

## 1.16.3

**History uses far less memory when a section has a drawing in it.** Each checkpoint kept
its own complete copy of every drawing in the section — so typing next to a detailed drawing
filled memory with sixty identical copies of it. Measured: a section with a 120-stroke
drawing held **10.2 MB** of checkpoints, now **0.4 MB**. Unchanged drawings are stored once
and shared. Nothing about what History does has changed.

**Clearer wording for the checkpoint setting.** "Checkpoint every / Every pause (50ms)" did
not say what a *pause* was. It now reads **"Checkpoint after you stop typing for"**, with
options phrased as the wait itself.

## 1.16.2

**A real splash screen.** Opening TotoNote now shows a small splash window — the mark, the
name, the version — on its own while the app loads, then hands over to a fully drawn app.
Before, it was drawn *on top of* the main window, so you saw the app sitting behind it,
which isn't what a splash screen is.

**And it appears every time.** It used to play once per world, ever — after that the
**Play the opening animation** setting did nothing at all, whichever way you set it, and
there was no way to see the splash again. Now the setting means what it says: on shows it
every launch, off never shows it. Click it or press any key to skip.

**A button for inserting pictures.** There wasn't one — pasting or dragging a file in was
the only way, so if you went looking for a button you'd reasonably conclude the app couldn't
do it. The toolbar now has one, next to the pencil that adds a drawing.

**Fixes**

- The Timeline's heading sat underneath the macOS window buttons unless the app was
  fullscreen. Every full-screen view is now checked for this, not just the two that had
  been reported.
- The picture and drawing buttons were plain text characters among the drawn icons; they're
  now drawn to match.

## 1.16.1

**The built-in guide caught up with 1.16.0.** Nothing in the app itself changed. The pages on
backup, links and the timeline now have pictures of what they describe, the glossary defines
the new words (*link*, *linked from*, *when*, *timeline*, *backup*), and the shortcut list
covers the keys the `[[` picker responds to and the fact that Tab now reaches every control.

The 1.16.0 notes below also gained the **System** theme, which shipped in that release but
went unmentioned.

## 1.16.0

**Back up everything, and put it back.** Everything you have written lives in a single file
on one computer, and until now there was no copy of it anywhere. **Settings → Backup**, or
**File → Back Up Everything**, writes the whole world — documents, highlights, categories,
drawings, pictures — to one file you can put on a drive or send to someone. **Restore from a
backup** puts one back; it checks the file first, keeps the world it replaces alongside in
case you picked the wrong one, and restarts.

**Link documents to each other.** Type `[[` anywhere in your writing and a list of your
documents appears — pick one and it becomes a link you can click to jump there. Rename that
document later and every link to it follows, because a link points at the document, not at
its name. The document you land on shows a **Linked from** list of everywhere that mentions
it.

**A timeline.** Give any highlight a *when* — "Year 300 of the Third Age" works as well as
"1885-03-12" — and the new **⌚ Timeline** button lays out everything dated, earliest first,
across every document. Click an entry to jump to the passage it came from. Things dated in
words with no number ("long ago") gather at the end rather than disappearing.

**Prompts look like the rest of the app.** The "are you sure?" boxes were the operating
system's own, in the wrong colours and naming the wrong thing. They are now part of TotoNote,
and dismissing one always means *no*.

**A theme that follows your system.** A fifth option in **Settings → Appearance**: pick
**System** and TotoNote is light when your computer is light and dark when it's dark,
switching as your computer does — no need to come back and change it.

**The keyboard reaches everything.** Rows, tabs, menu items and cards that could only be
clicked can now be reached with Tab and activated with Enter or Space, with a visible ring
around whatever is focused.

**Fixes**

- Renaming a document no longer leaves search looking for its old name.
- Rolling back to a checkpoint now restores drawings alongside the text, instead of leaving
  them at their latest state.

## 1.15.1

**Better reading of text in pictures.** Two fixes to what shipped in 1.15.0:

- **Crooked pictures are straightened first.** A scan or photo that sits a few degrees off
  level used to come out as nonsense — "Frozen Harbour" read as "grozel Haroou!". The copy
  used for reading is now levelled first. Your picture itself is untouched.
- **Guesses are thrown away instead of being indexed.** Where it couldn't really read
  something, it was putting its best guess into the search index, where it could never
  match anything and only got in the way. Now only words it's actually confident about are
  kept — and a picture where it reads the big labels but not the small print still
  contributes the labels.

## 1.15.0

**Search everything you've written.** The search box now looks through your actual writing,
not just category and tag names. Matches appear at the top with the words picked out and
the document they came from — click to jump straight there, even into a document you don't
have open.

**Words inside pictures are searchable too.** Shortly after you add an image, TotoNote reads
any text in it — a label on a map, a name on a character sheet — so you can find the picture
by what it says. It runs in the background and needs no internet.

**Resize pictures.** Drag the corner handle: small for a portrait, wide for a map. The size
sticks.

**Rename documents and sections.** In the **Arrange** tab, click the title. Titles stopped
being permanent.

**Export a page.** The **Export** button at the top of a category page saves it as Markdown — every filed
excerpt with its note and source — so lore can go into a wiki or a design doc.

**Mentioned in.** A tag's page now lists which documents mention it, most-used first.

**A smaller opening animation**, and a setting to skip it entirely (*Settings → Startup*).

**Reclaim space.** *Settings → Storage* shows what embedded pictures cost and clears out
ones nothing points at any more.

## 1.14.0

**A real app icon.** TotoNote now has its own icon — the TOTO NOTE mark from the opening
animation — instead of the generic Electron one, in the Dock, the app switcher and your
Applications folder.

**Settings in the menu bar.** On macOS: **TotoNote → Settings…**, or **⌘,**. It works from
the Documents screen too, where there's no toolbar gear to click.

> If the menu bar says "Electron" rather than "TotoNote", you're running a development
> build — installed builds show the right name.

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
