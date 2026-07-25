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

import { DOCUMENT_LINK_NODE } from './doc-links';
import { mediaIdFromUrl } from './media-refs';

export interface PMJsonNode {
  type: string;
  text?: string;
  content?: PMJsonNode[];
}

/**
 * Nodes that occupy a single position and can never have children.
 *
 * Every inline atom belongs here. Miss one and every highlight after it in the section is
 * read back one position short, so wiki excerpts quietly show the wrong words.
 */
const LEAF_NODES = new Set([
  'hardBreak',
  'horizontalRule',
  'image',
  'drawing',
  DOCUMENT_LINK_NODE,
]);

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

/**
 * The media ids of any images inside a document range.
 *
 * A filed excerpt that is an image has no text at all, so a compiled page would show
 * nothing for it — a character's portrait would render as an empty row. Walking for image
 * nodes with the same position arithmetic lets the page show a thumbnail instead.
 */
export function imagesInRange(doc: PMJsonNode, from: number, to: number): string[] {
  const ids: string[] = [];

  const walk = (node: PMJsonNode, pos: number): void => {
    if (node.text != null) return;

    if (LEAF_NODES.has(node.type)) {
      // A leaf occupies exactly one position; include it when that position is covered.
      if (node.type === 'image' && pos >= from && pos < to) {
        const src = (node as { attrs?: { src?: string } }).attrs?.src;
        const id = src ? mediaIdFromUrl(src) : null;
        if (id && !ids.includes(id)) ids.push(id);
      }
      return;
    }

    // Children of a container start one position inside it (the doc itself starts at 0).
    let childPos = node === doc ? 0 : pos + 1;
    for (const child of node.content ?? []) {
      walk(child, childPos);
      childPos += nodeSize(child);
    }
  };

  walk(doc, 0);
  return ids;
}

/**
 * The drawing ids inside a document range.
 *
 * Same reasoning as images: a filed drawing has no text of its own, so a compiled page
 * would show an empty row for it. Drawing nodes carry a bare `drawingId` attribute rather
 * than a url, so they need their own pass.
 */
export function drawingsInRange(doc: PMJsonNode, from: number, to: number): string[] {
  const ids: string[] = [];

  const walk = (node: PMJsonNode, pos: number): void => {
    if (node.text != null) return;

    if (LEAF_NODES.has(node.type)) {
      if (node.type === 'drawing' && pos >= from && pos < to) {
        const id = (node as { attrs?: { drawingId?: string } }).attrs?.drawingId;
        if (id && !ids.includes(id)) ids.push(id);
      }
      return;
    }

    let childPos = node === doc ? 0 : pos + 1;
    for (const child of node.content ?? []) {
      walk(child, childPos);
      childPos += nodeSize(child);
    }
  };

  walk(doc, 0);
  return ids;
}

/** `drawingsInRange` against stored JSON, tolerating unparsable content. */
export function drawingsFromContent(contentJson: string, from: number, to: number): string[] {
  if (!contentJson) return [];
  try {
    return drawingsInRange(JSON.parse(contentJson), from, to);
  } catch {
    return [];
  }
}

/** `imagesInRange` against stored JSON, tolerating unparsable content. */
export function imagesFromContent(contentJson: string, from: number, to: number): string[] {
  if (!contentJson) return [];
  try {
    return imagesInRange(JSON.parse(contentJson), from, to);
  } catch {
    return [];
  }
}

/**
 * All the text in a stored document, for the search index.
 *
 * Unlike `extractTextBetween` this ignores positions entirely — it just wants the words,
 * with block boundaries separated so a search for "dragon lair" can't match across an
 * unrelated paragraph break.
 */
export function plainTextFromContent(contentJson: string): string {
  if (!contentJson) return '';
  let doc: PMJsonNode;
  try {
    doc = JSON.parse(contentJson);
  } catch {
    return '';
  }
  const parts: string[] = [];
  const walk = (node: PMJsonNode): void => {
    if (node.text != null) {
      parts.push(node.text);
      return;
    }
    if (LEAF_NODES.has(node.type)) return;
    for (const child of node.content ?? []) walk(child);
    parts.push('\n');
  };
  walk(doc);
  return parts.join(' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
