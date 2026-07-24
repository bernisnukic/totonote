/**
 * The forgiving text match behind the Browse sidebar's search box — "iris" finds "IRyS".
 *
 * Extracted from LeftSidebar so the matching rules can be tested directly: search
 * behaviour is easy to change by accident and hard to notice in the UI.
 *
 * Callers lower-case both arguments; matching is otherwise case-sensitive.
 */

/** Edit distance between two strings (Levenshtein, single-row DP). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * True when `text` is a plausible match for `query`.
 *
 * A substring always matches. Otherwise each word of the text is compared by edit
 * distance, with the allowance growing as the query gets longer (a third of its length):
 * short queries stay strict, longer ones tolerate more typos.
 *
 * An empty query matches everything — the sidebar shows the whole tree when the box is
 * empty. Note the flip side: a single character with a threshold of 1 matches almost any
 * short word, which is why the guide tells users to type two or more.
 */
export function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  if (text.includes(query)) return true;
  const words = text.split(/\s+/);
  const threshold = Math.max(1, Math.floor(query.length / 3));
  return words.some(word => levenshtein(query, word) <= threshold);
}
