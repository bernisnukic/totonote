import React from 'react';

/**
 * Render an FTS5 snippet, highlighting the matched words.
 *
 * SQLite marks matches with the delimiters we asked for — `[` and `]` — rather than any
 * markup, so the string is split on them instead of being injected as HTML. That keeps the
 * user's own square brackets from ever being treated as formatting, and means nothing from
 * the database is interpreted as markup.
 */
export function renderSnippet(snippet: string): React.ReactNode {
  if (!snippet) return null;
  const parts: React.ReactNode[] = [];
  let rest = snippet;
  let key = 0;

  while (rest.length > 0) {
    const open = rest.indexOf('[');
    const close = open === -1 ? -1 : rest.indexOf(']', open + 1);
    if (open === -1 || close === -1) {
      parts.push(rest);
      break;
    }
    if (open > 0) parts.push(rest.slice(0, open));
    parts.push(
      <mark key={key++} className="search-match">
        {rest.slice(open + 1, close)}
      </mark>,
    );
    rest = rest.slice(close + 1);
  }

  return parts;
}
