/**
 * Spotting `[[` as it is typed.
 *
 * Kept apart from the editor so the rule is a pure string function that can be tested on its
 * own — the awkward cases here are all about *not* firing (a closed link, a bracket left
 * over from something else, a query long enough that it clearly isn't one).
 */

export interface LinkTrigger {
  /** What has been typed after the brackets, for matching document titles against. */
  query: string;
  /** How many characters back from the caret the `[[` starts, brackets included. */
  length: number;
}

/** Longest title anyone would type before giving up on the picker. */
const MAX_QUERY = 120;

/**
 * Is the caret sitting just after an unclosed `[[…`?
 *
 * `textBefore` is the plain text of the current block up to the caret.
 */
export function findLinkTrigger(textBefore: string): LinkTrigger | null {
  const open = textBefore.lastIndexOf('[[');
  if (open === -1) return null;

  const query = textBefore.slice(open + 2);
  if (query.length > MAX_QUERY) return null;
  // A `]` means this link was already finished, or the brackets were never a link at all.
  // A newline means the caret has moved on to another line entirely.
  if (query.includes(']') || query.includes('\n')) return null;

  return { query, length: query.length + 2 };
}
