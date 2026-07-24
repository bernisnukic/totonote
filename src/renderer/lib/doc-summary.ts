/**
 * A one-line summary of a TipTap/ProseMirror document, for the history timeline: how much
 * text it holds and a short preview of the start. Pure and JSON-only so it can run over a
 * stored snapshot string without an editor.
 */
export interface DocSummary {
  /** Total characters of text in the document. */
  chars: number;
  /** First ~60 characters of text, for the timeline label. */
  preview: string;
}

interface PMNode {
  type?: string;
  text?: string;
  content?: PMNode[];
}

function collectText(node: PMNode, out: string[], limit: number): void {
  if (out.join('').length >= limit && limit > 0) return;
  if (typeof node.text === 'string') out.push(node.text);
  // A block boundary reads as a space so words from adjacent paragraphs don't run together.
  else if (node.type && node.type !== 'text' && out.length && out[out.length - 1] !== ' ') out.push(' ');
  if (node.content) for (const child of node.content) collectText(child, out, limit);
}

export function summarizeDoc(contentJSON: string): DocSummary {
  let doc: PMNode;
  try {
    doc = JSON.parse(contentJSON);
  } catch {
    return { chars: 0, preview: '' };
  }
  const parts: string[] = [];
  collectText(doc, parts, 0); // full text for an accurate count
  const text = parts.join('').replace(/\s+/g, ' ').trim();
  return {
    chars: text.length,
    preview: text.length > 60 ? `${text.slice(0, 60)}…` : text,
  };
}
