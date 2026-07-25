/**
 * Reading a date out of whatever someone typed.
 *
 * A world's calendar is not necessarily ours. "Year 300 of the Third Age", "1387 AR",
 * "-450 BE" and "12 March 1885" are all things people write in a lore document, and a date
 * picker would reject three of them. So the field is free text and this works out what it
 * sorts as — the label is always shown back exactly as written.
 *
 * Anything with no number in it sorts last, under "Undated", rather than being guessed at.
 */

export interface When {
  /** What to sort by; null when nothing numeric could be found. */
  sortKey: number | null;
  /** Exactly what was typed, trimmed. */
  label: string;
}

/** A real date, as `YYYY-MM-DD` or with the month written out. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The first signed number anywhere in the text.
 *
 * `-` only counts as a minus when it opens the text or follows a space, so "Year 300-400"
 * reads as 300 rather than as a negative.
 */
const NUMBER = /(?:^|\s)(-?\d+(?:\.\d+)?)/;

export function parseWhen(input: string | null | undefined): When {
  const label = (input ?? '').trim();
  if (!label) return { sortKey: null, label: '' };

  const iso = ISO_DATE.exec(label);
  if (iso) {
    // Encoded so a real date sorts against another real date correctly, and comfortably
    // clear of the small numbers a fantasy calendar uses.
    const [, y, m, d] = iso;
    return { sortKey: Number(y) * 10000 + Number(m) * 100 + Number(d), label };
  }

  const parsed = Date.parse(label);
  if (!Number.isNaN(parsed) && /\d{4}/.test(label)) {
    // Local fields, not UTC: Date.parse reads a date-only string like "12 March 1885" as
    // local midnight, so reading it back as UTC lands on the 11th west of Greenwich.
    const date = new Date(parsed);
    return {
      sortKey: date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate(),
      label,
    };
  }

  const number = NUMBER.exec(label);
  if (number) return { sortKey: Number(number[1]), label };

  return { sortKey: null, label };
}

export interface Dated<T> {
  when: When;
  item: T;
}

/**
 * Order events earliest first, with undated ones last.
 *
 * `tiebreak` decides between two things that happened at the same time — otherwise the
 * order would depend on whatever the database handed back.
 */
export function sortByWhen<T>(
  entries: Array<Dated<T>>,
  tiebreak: (a: T, b: T) => number = () => 0,
): Array<Dated<T>> {
  return [...entries].sort((a, b) => {
    if (a.when.sortKey === null && b.when.sortKey === null) return tiebreak(a.item, b.item);
    if (a.when.sortKey === null) return 1;
    if (b.when.sortKey === null) return -1;
    return a.when.sortKey - b.when.sortKey || tiebreak(a.item, b.item);
  });
}

/**
 * Group consecutive events that share a label, so a timeline reads as a list of moments
 * rather than a list of repetitions.
 */
export function groupByWhen<T>(entries: Array<Dated<T>>): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const entry of entries) {
    const label = entry.when.sortKey === null ? 'Undated' : entry.when.label;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry.item);
    else groups.push({ label, items: [entry.item] });
  }
  return groups;
}
