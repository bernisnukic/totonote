# Search and filters

The left sidebar is called **Browse**. It has four modes:

![The Browse mode bar with Search, Sort, Filter and HL](screenshots/19-browse-modes.png)

## Search

Type in the box and it looks through your **category names**, **tag names** and **tag
descriptions**. Matching categories open up on their own; anything with no match is hidden.

If a *category* name matches, all of its tags are shown, with the ones that didn't match
themselves dimmed.

### The "Exact" button

Off by default. It changes how forgiving the matching is:

- **Off** — typos are tolerated. `iris` will find `IRyS`. The longer your search, the more
  slack you get.
- **On** — the text must actually contain what you typed, letter for letter (capitals
  still don't matter).

> Despite the name, "Exact" doesn't mean the whole name has to match — it means "contains
> exactly this", as opposed to "something roughly like this".

> Searching a **single letter** with Exact off matches nearly every tag. Type two or more
> and it behaves properly.

## Filter

![Filter mode, with a checkbox beside each tag](screenshots/20-filter-mode.png)

Tick tags here to **hide sections that don't use them**. A section survives if it carries
one of the ticked tags as a section tag, or contains a highlight using one.

Ticking several tags widens the net rather than narrowing it — you get every section
matching *any* of them, not only sections matching all.

If nothing matches you'll see *"No sections match the active filters."* in the middle of
the window. **Clear filters (N)** at the top puts everything back.

> **Clear filters also empties the Search box.** If your search text vanishes, that's why.

> Clicking a tag's **name** here opens its details instead of ticking it. Click the
> checkbox or the colour dot to tick it.

## HL — highlights

![Highlight mode, with the Show all highlights tickbox](screenshots/21-highlight-mode.png)

One tickbox: **Show all highlights**. Unticking it turns off the colouring on every
highlight at once, everywhere, so you can read your writing plain. Nothing is deleted —
tick it again and the colours come back.

The tag list below it is just for browsing; there's no per-tag highlight switch.

## Sort

Four buttons — Name A-Z, Name Z-A, Date (Oldest), Date (Newest).

> **These don't do anything yet.** The button highlights when clicked but nothing is
> actually re-sorted. It's unfinished, not broken on your machine.

## Clicking tags

Clicking any tag anywhere in the Browse sidebar opens its details in the right-hand
**Info** panel — usage counts, every phrase it's attached to, and a form to edit it.

Once you've clicked one, **↑** and **↓** move through the list. **Escape** clears the
selection.

Right-clicking a tag gives you **View Details** and **Delete**.
