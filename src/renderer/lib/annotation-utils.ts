import type { Annotation } from '../../shared/domain-types';

export function detectOverlaps(annotations: Annotation[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();

  for (let i = 0; i < annotations.length; i++) {
    for (let j = i + 1; j < annotations.length; j++) {
      const a = annotations[i];
      const b = annotations[j];

      if (a.fromPos < b.toPos && b.fromPos < a.toPos) {
        if (!overlaps.has(a.id)) overlaps.set(a.id, []);
        if (!overlaps.has(b.id)) overlaps.set(b.id, []);
        overlaps.get(a.id)!.push(b.id);
        overlaps.get(b.id)!.push(a.id);
      }
    }
  }

  return overlaps;
}

export function findAdjacentAnnotations(
  annotations: Annotation[],
  targetId: string,
  threshold = 1
): Annotation[] {
  const target = annotations.find(a => a.id === targetId);
  if (!target) return [];

  return annotations.filter(a => {
    if (a.id === targetId) return false;
    return (
      Math.abs(a.toPos - target.fromPos) <= threshold ||
      Math.abs(target.toPos - a.fromPos) <= threshold
    );
  });
}

export function isPositionInAnnotation(pos: number, annotation: Annotation): boolean {
  return pos >= annotation.fromPos && pos <= annotation.toPos;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Minimal shape of a ProseMirror doc — enough to walk it, without importing the editor. */
interface WalkableDoc {
  nodesBetween(
    from: number,
    to: number,
    f: (node: { isText: boolean; nodeSize: number }, pos: number) => void,
  ): void;
}

/**
 * Shrink a selection range to the text it actually covers.
 *
 * Select-all produces a ProseMirror `AllSelection` running from 0 to the document size,
 * which includes the paragraph's own open/close positions. An annotation stored with
 * those bounds ends *after* the last character, so text typed at the end of the
 * paragraph is inserted before the annotation's end and shifts it — the highlight grows
 * to swallow whatever is typed next, and `inclusiveEnd` never gets a say because the
 * insertion is not at the boundary.
 *
 * Returns null when the range covers no text at all.
 */
export function clampRangeToText(
  doc: WalkableDoc,
  from: number,
  to: number,
): { from: number; to: number } | null {
  let start: number | null = null;
  let end: number | null = null;

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const s = Math.max(from, pos);
    const e = Math.min(to, pos + node.nodeSize);
    if (e <= s) return;
    if (start === null) start = s;
    end = e;
  });

  return start === null || end === null ? null : { from: start, to: end };
}
