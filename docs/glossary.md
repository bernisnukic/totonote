# Glossary

Every word TotoNote uses for one of its own things, in one place. If a button or a guide
page uses a term you're not sure about, it's defined here — and the deeper page for it is
linked.

The terms build on each other, so they're grouped rather than alphabetised.

## Where things live

**Workspace** — a self-contained world. Its documents, categories and tags are its own;
switching workspace swaps all of them at once. Use one per setting you're building.
→ [Workspaces](workspaces.md)

**Document** — one writing project inside a workspace: a character, a place, an event.
Opens into the editor.

**Section** — a labelled part of a document. All of a document's sections sit on one
scrollable page, with a tab bar across the top to jump between them.
→ [Documents and sections](documents-and-sections.md)

**Checkpoint** — an automatic snapshot of a section, taken as you write. The **History**
tab lists them as a timeline; click one to roll the section back to that state. Checkpoints
last for the session and clear when you close the app.
→ [Documents and sections](documents-and-sections.md#history)

## Marking up your writing

**Tag** — a named, coloured label: `Gura`, `Ancient Temple`, `Betrayal`. A tag says *what
a piece of writing is about*. Tags live inside categories.
→ [Tags and highlights](tags-and-annotations.md)

**Highlight** — a tag attached to *a specific piece of text*, which colours that text in.
The highlight is the coloured passage you see in the editor. (Under the hood these were
once called "annotations" — you may still see that word in older notes; in the app it's a
**highlight**.)

**Excerpt** — the actual run of text a highlight covers. When you file a highlight onto a
page, the excerpt is what gets listed there. "Highlight" is the coloured mark in your
writing; "excerpt" is the words it holds.

**Section tag** — a tag attached to *a whole section* rather than a piece of text. It shows
up as a small badge above the section instead of colouring anything.

**Drawing** — a freehand layer you can add to a section, either blank or on top of an
embedded image. Strokes are stored as lines rather than as a picture, so they stay sharp,
take almost no space, and stay lined up with the image beneath them. Pressure-sensitive if
you draw with a graphics tablet.
→ [Drawing](documents-and-sections.md#drawing)

**Note** — an optional line of your own you can attach to a single filed excerpt (click
**+ note** under it on a page). It's a reminder to yourself — *"this is the first time she
mentions the sword"* — and never appears in the document itself.

## Organising tags

**Category** — a folder that holds tags, and can hold other categories. `Characters`,
`Locations`, `Events`. Categories nest as deep as you like, which is what gives you a tree
down the side.
→ [Categories and rules](categories-and-rules.md)

**Rule** — a sub-category skeleton attached to a category. Give `Characters` a rule of
`History / Abilities / Appearance`, and every new character category you create under it is
born with those three sub-categories already inside. The little `⚙ 3` marker on a category
means it carries a rule that would create 3 sub-categories.
→ [Categories and rules](categories-and-rules.md)

## Building wiki pages

**Filing** (also **File under…**) — placing an excerpt onto a category's page. Filing is
separate from tagging: the tag says what the text *is*, filing says which *page* it should
appear on. A highlight can be filed or left unfiled; filing never changes the colour in
your writing.
→ [Filing and the graph](filing-and-graph.md)

**Page** — the compiled view of one tag or one category: every excerpt filed under it,
gathered together and ordered, like a wiki entry assembled from your writing. Open a page
from the **Info** tab, or pop it out full-screen with the ⤒ button.

**The graph** (the **connections map**) — a single picture of everything and how it links:
categories, the tags inside them, and every filing drawn as a line between a tag and the
page it's filed on. Good for spotting what connects to what.
→ [Filing and the graph](filing-and-graph.md)

## Connecting documents, and time

**Link** (also **`[[wiki link]]`**) — a clickable jump from one document to another, made by
typing `[[` and picking from the list. A link points at the *document*, not at its name, so
renaming the target updates every link to it.
→ [Links and the timeline](links-and-timeline.md)

**Linked from** (also **backlinks**) — the list, in a document's **Info** tab, of every other
document that links *to* it. The direction you didn't write.
→ [Links and the timeline](links-and-timeline.md)

**When** — an optional date on a filed excerpt, written however your world writes dates:
`Year 300 of the Third Age` and `1885-03-12` both work. TotoNote sorts by the first number
it finds and shows back exactly what you typed.
→ [Links and the timeline](links-and-timeline.md)

**Timeline** — the ⌚ view: every excerpt that has a *when*, earliest first, gathered from
every document. Things dated in words with no number in them collect under **Undated**.
→ [Links and the timeline](links-and-timeline.md)

## Keeping it safe

**Backup** — one file holding your entire world: every document, highlight, category,
drawing and picture. **Restore** puts one back, replacing everything currently in the app.
→ [Backup and restore](backup-and-restore.md)

**Workspace** — see *Where things live*, above. A backup covers *every* workspace, not just
the one you have open.

## Reading everything back

These are the four modes down the left of the browse sidebar. All four work on your tagged
writing — they differ in what they do with it.

**Search** — find a category or tag by name.

**Sort** — turn the main page into a list of *every* tagged excerpt in the document, in an
order you pick (document order, newest, oldest, or grouped by tag). A reading view — the
editor is underneath, untouched.

**Filter** — tick one or more tags and the main page collapses to *only* those tags'
excerpts, hiding everything untagged. Sort shows all of it ordered; Filter narrows it to
what you ticked.

**Highlights** — show or hide the highlight colours, all at once or tag by tag, without
removing anything. For when the colours get busy and you just want to read.
→ [Search and filters](search-and-filters.md)

---

Still stuck on a word? [Open an issue](https://github.com/bernisnukic/totonote/issues) and
we'll add it here.
