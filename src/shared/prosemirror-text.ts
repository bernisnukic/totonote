/**
 * Extract plain text from stored TipTap/ProseMirror JSON by document position.
 *
 * Annotations are stored as ProseMirror positions, and the compiled "wiki page" views
 * need the text those positions cover for documents that are not open in an editor —
 * including other documents entirely. The main process only has the persisted JSON, so
 * this walks it with the same position arithmetic ProseMirror uses:
 *
 *   - the doc's content starts at position 0
 *   - every other container node costs 1 to enter and 1 to leave
 *   - a text node occupies one position per character
 *   - a childless leaf (hard break, horizontal rule) occupies exactly 1
 *
 * The result deliberately mirrors `doc.textBetween(from, to, ' ')`: block boundaries
 * inside the range collapse to a single separator, and leaves contribute nothing.
 */

export interface PMJsonNode {
  type: string;
  text?: string;
  content?: PMJsonNode[];
}

/** Nodes that occupy a single position and can never have children. */
const LEAF_NODES = new Set(['hardBreak', 'horizontalRule', 'image']);

/** Size of a node in ProseMirror positions. An empty paragraph is 2, not 1. */
export function nodeSize(node: PMJsonNode): number {
  if (node.text != null) return node.text.length;
  if (LEAF_NODES.has(node.type)) return 1;
  return 2 + (node.content ?? []).reduce((sum, child) => sum + nodeSize(child), 0);
}

export function extractTextBetween(
  doc: PMJsonNode,
  from: number,
  to: number,
  blockSeparator = ' ',
): string {
  let text = '';
  // Starts true so the range's first block never emits a leading separator.
  let separated = true;

  const walk = (node: PMJsonNode, pos: number): void => {
    if (node.text != null) {
      const start = Math.max(from, pos);
      const end = Math.min(to, pos + node.text.length);
      if (end > start) {
        text += node.text.slice(start - pos, end - pos);
        separated = false;
      }
      return;
    }
    if (LEAF_NODES.has(node.type)) return;

    if (node !== doc && !separated) {
      text += blockSeparator;
      separated = true;
    }

    // The doc's children start at its own position; any other container's start one
    // position further in, past its opening token.
    let childPos = node === doc ? pos : pos + 1;
    for (const child of node.content ?? []) {
      const size = nodeSize(child);
      if (childPos < to && childPos + size > from) walk(child, childPos);
      childPos += size;
    }
  };

  walk(doc, 0);
  return text;
}

/**
 * Parse stored section content and extract the text an annotation covers. Returns ''
 * for content that fails to parse or a range that covers nothing.
 */
export function excerptFromContent(contentJson: string, from: number, to: number): string {
  if (!contentJson) return '';
  let doc: PMJsonNode;
  try {
    doc = JSON.parse(contentJson);
  } catch {
    return '';
  }
  return extractTextBetween(doc, from, to).trim();
}
