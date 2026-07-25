/**
 * Links from one document to another.
 *
 * A link is an inline atom node in the section's TipTap JSON:
 *
 *     { type: 'documentLink', attrs: { documentId: 'uuid', label: 'GURA' } }
 *
 * The id is what the link means; the label is only what it looked like when it was written,
 * so that a link to a since-deleted document still reads as something rather than a blank.
 * Renaming a document does not have to touch a single stored link — the current title is
 * looked up when the link is drawn.
 *
 * Both processes need to find these: the renderer to render them, main to answer "what links
 * here?". Hence shared.
 */

export const DOCUMENT_LINK_NODE = 'documentLink';

/** Every document this content links to, in the order they appear, with duplicates kept. */
export function documentLinkIdsInContent(contentJson: string | null | undefined): string[] {
  if (!contentJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(contentJson);
  } catch {
    return [];
  }

  const found: string[] = [];
  walk(parsed, node => {
    if (node.type !== DOCUMENT_LINK_NODE) return;
    const id = (node.attrs as { documentId?: unknown } | undefined)?.documentId;
    if (typeof id === 'string' && id) found.push(id);
  });
  return found;
}

interface JsonNode {
  type?: string;
  attrs?: unknown;
  content?: unknown;
}

function walk(value: unknown, visit: (node: JsonNode & { type: string }) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const node = value as JsonNode;
  if (typeof node.type === 'string') visit(node as JsonNode & { type: string });
  if (node.content) walk(node.content, visit);
}
