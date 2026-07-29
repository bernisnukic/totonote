import { plainTextFromContent, excerptFromContent } from '../../shared/prosemirror-text';

/**
 * What changed between two checkpoints, in words.
 *
 * The History tab used to label every checkpoint with the opening of the section, which is
 * the same sixty characters every time — so the list read as the same line repeated and
 * told you nothing about which state you were about to roll back to. Reported as: "the
 * history previews are not helpful, you cannot tell what the history is; it would be
 * better if it worked like a log".
 *
 * So each checkpoint is labelled with the change that produced it — `Added “hello”`,
 * `Removed “hello”` — worked out by comparing it with the one before. Nothing about the
 * *cause* is recorded, only the effect, which is why undoing a deletion reads as adding the
 * text back rather than as an undo. That is the honest description of what the checkpoint
 * holds.
 *
 * Pure and JSON-only, so it runs over stored snapshots with no editor.
 */

export interface ChangePoint {
  /** TipTap JSON string. */
  content: string;
  annotations: { id: string; fromPos: number; toPos: number }[];
  drawings: { id: string; strokes: string }[];
}

/** Longest quoted run. Past this a snippet stops being readable at a glance. */
const MAX_QUOTE = 32;

/** Past this, say how much rather than quoting — a paragraph in a list row is noise. */
const TOO_LONG_TO_QUOTE = 80;

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function quote(text: string): string {
  const clean = tidy(text);
  if (clean.length <= MAX_QUOTE) return `“${clean}”`;
  return `“${clean.slice(0, MAX_QUOTE).trimEnd()}…”`;
}

function amount(text: string): string {
  const n = tidy(text).length;
  return `${n} character${n === 1 ? '' : 's'}`;
}

/**
 * The changed middle: what is left after the matching start and end are taken off.
 *
 * Typing inside a sentence changes one run in the middle, and this reports that run rather
 * than the whole paragraph.
 */
export function diffEnds(before: string, after: string): { removed: string; added: string } {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before[endBefore - 1] === after[endAfter - 1]
  ) {
    endBefore--;
    endAfter--;
  }
  return { removed: before.slice(start, endBefore), added: after.slice(start, endAfter) };
}

interface JsonNode {
  type?: string;
  content?: JsonNode[];
}

function countType(contentJson: string, type: string): number {
  let doc: JsonNode;
  try {
    doc = JSON.parse(contentJson) as JsonNode;
  } catch {
    return 0;
  }
  let found = 0;
  const walk = (node: JsonNode) => {
    if (node.type === type) found++;
    if (node.content) for (const child of node.content) walk(child);
  };
  walk(doc);
  return found;
}

function strokesChanged(
  before: ChangePoint['drawings'],
  after: ChangePoint['drawings'],
): boolean {
  const was = new Map(before.map(d => [d.id, d.strokes]));
  return after.some(d => was.has(d.id) && was.get(d.id) !== d.strokes);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** Text-only changes, or null when the words are identical. */
function describeText(before: string, after: string): string | null {
  if (before === after) return null;
  const { removed, added } = diffEnds(before, after);
  const removedClean = tidy(removed);
  const addedClean = tidy(added);

  if (removedClean && addedClean) {
    return `Replaced ${quote(removed)} with ${quote(added)}`;
  }
  if (addedClean) {
    return addedClean.length > TOO_LONG_TO_QUOTE ? `Added ${amount(added)}` : `Added ${quote(added)}`;
  }
  if (removedClean) {
    return removedClean.length > TOO_LONG_TO_QUOTE
      ? `Removed ${amount(removed)}`
      : `Removed ${quote(removed)}`;
  }

  // Nothing but whitespace moved: pressing Enter, or joining two paragraphs back up.
  if (added.includes('\n') && !removed.includes('\n')) return 'Split a paragraph';
  if (removed.includes('\n') && !added.includes('\n')) return 'Joined two paragraphs';
  return 'Changed spacing';
}

export function describeChange(previous: ChangePoint | null, next: ChangePoint): string {
  if (!previous) return 'Starting point';

  const words = describeText(
    plainTextFromContent(previous.content),
    plainTextFromContent(next.content),
  );
  if (words) return words;

  // The words are the same, so whatever changed is not text.
  const drawingDelta = next.drawings.length - previous.drawings.length;
  if (drawingDelta > 0) return `Added ${plural(drawingDelta, 'a drawing', 'drawings')}`;
  if (drawingDelta < 0) return `Removed ${plural(-drawingDelta, 'a drawing', 'drawings')}`;
  if (strokesChanged(previous.drawings, next.drawings)) return 'Changed a drawing';

  const imageDelta = countType(next.content, 'image') - countType(previous.content, 'image');
  if (imageDelta > 0) return `Added ${plural(imageDelta, 'a picture', 'pictures')}`;
  if (imageDelta < 0) return `Removed ${plural(-imageDelta, 'a picture', 'pictures')}`;

  const before = new Map(previous.annotations.map(a => [a.id, a]));
  const gained = next.annotations.filter(a => !before.has(a.id));
  if (gained.length === 1) {
    const text = excerptFromContent(next.content, gained[0].fromPos, gained[0].toPos);
    return tidy(text) ? `Highlighted ${quote(text)}` : 'Added a highlight';
  }
  if (gained.length > 1) return `Added ${gained.length} highlights`;

  const after = new Set(next.annotations.map(a => a.id));
  const lost = previous.annotations.filter(a => !after.has(a.id));
  if (lost.length > 0) return `Removed ${plural(lost.length, 'a highlight', 'highlights')}`;

  // Same ids, different places: the text around them was rewritten, or one was stretched.
  if (
    next.annotations.some(a => {
      const was = before.get(a.id);
      return was && (was.fromPos !== a.fromPos || was.toPos !== a.toPos);
    })
  ) {
    return 'Moved a highlight';
  }

  // Weakest signal, so it goes last. An empty paragraph on the end holds no text and the
  // trailing newline is trimmed away, so the words really are identical — only the count
  // of blocks gives it away.
  const paragraphDelta =
    countType(next.content, 'paragraph') - countType(previous.content, 'paragraph');
  if (paragraphDelta > 0) return `Added ${plural(paragraphDelta, 'a paragraph', 'paragraphs')}`;
  if (paragraphDelta < 0) return `Removed ${plural(-paragraphDelta, 'a paragraph', 'paragraphs')}`;

  return 'Changed formatting';
}
