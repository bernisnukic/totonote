import { describe, it, expect } from 'vitest';
import { detectOverlaps, findAdjacentAnnotations, isPositionInAnnotation, hexToRgba , clampRangeToText} from './annotation-utils';
import type { Annotation } from '../../shared/domain-types';

function makeAnnotation(id: string, from: number, to: number): Annotation {
  return {
    id,
    sectionId: 'sec-1',
    tagId: 'tag-1',
    fromPos: from,
    toPos: to,
    note: '',
    categoryId: null,
    placementOrder: 0,
    createdAt: '2024-01-01',
  };
}

describe('detectOverlaps', () => {
  it('detects no overlaps for non-overlapping annotations', () => {
    const annotations = [
      makeAnnotation('a', 0, 5),
      makeAnnotation('b', 10, 15),
    ];
    const overlaps = detectOverlaps(annotations);
    expect(overlaps.size).toBe(0);
  });

  it('detects overlaps for overlapping annotations', () => {
    const annotations = [
      makeAnnotation('a', 0, 10),
      makeAnnotation('b', 5, 15),
    ];
    const overlaps = detectOverlaps(annotations);
    expect(overlaps.has('a')).toBe(true);
    expect(overlaps.has('b')).toBe(true);
    expect(overlaps.get('a')).toContain('b');
    expect(overlaps.get('b')).toContain('a');
  });

  it('detects no overlap for adjacent (touching) annotations', () => {
    const annotations = [
      makeAnnotation('a', 0, 5),
      makeAnnotation('b', 5, 10),
    ];
    const overlaps = detectOverlaps(annotations);
    expect(overlaps.size).toBe(0);
  });

  it('handles fully contained annotations', () => {
    const annotations = [
      makeAnnotation('a', 0, 20),
      makeAnnotation('b', 5, 10),
    ];
    const overlaps = detectOverlaps(annotations);
    expect(overlaps.get('a')).toContain('b');
  });
});

describe('findAdjacentAnnotations', () => {
  it('finds adjacent annotations within threshold', () => {
    const annotations = [
      makeAnnotation('a', 0, 5),
      makeAnnotation('b', 5, 10),
      makeAnnotation('c', 20, 25),
    ];
    const adj = findAdjacentAnnotations(annotations, 'a', 1);
    expect(adj.length).toBe(1);
    expect(adj[0].id).toBe('b');
  });

  it('returns empty for no adjacent', () => {
    const annotations = [
      makeAnnotation('a', 0, 5),
      makeAnnotation('b', 20, 25),
    ];
    const adj = findAdjacentAnnotations(annotations, 'a', 1);
    expect(adj.length).toBe(0);
  });

  it('returns empty for unknown id', () => {
    const annotations = [makeAnnotation('a', 0, 5)];
    expect(findAdjacentAnnotations(annotations, 'nonexistent')).toEqual([]);
  });
});

describe('isPositionInAnnotation', () => {
  const ann = makeAnnotation('a', 5, 10);

  it('returns true for position inside', () => {
    expect(isPositionInAnnotation(7, ann)).toBe(true);
  });

  it('returns true for position at boundaries', () => {
    expect(isPositionInAnnotation(5, ann)).toBe(true);
    expect(isPositionInAnnotation(10, ann)).toBe(true);
  });

  it('returns false for position outside', () => {
    expect(isPositionInAnnotation(4, ann)).toBe(false);
    expect(isPositionInAnnotation(11, ann)).toBe(false);
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba', () => {
    expect(hexToRgba('#48dbfb', 0.25)).toBe('rgba(72, 219, 251, 0.25)');
  });
});

describe('clampRangeToText', () => {
  /**
   * Stands in for a ProseMirror doc. `nodes` are [pos, size, isText] — a paragraph
   * holding 26 characters looks like a text node at position 1 of size 26, with the
   * paragraph's own open/close positions at 0 and 27.
   */
  function docOf(nodes: [number, number, boolean][]) {
    return {
      nodesBetween(from: number, to: number, f: (n: { isText: boolean; nodeSize: number }, pos: number) => void) {
        for (const [pos, nodeSize, isText] of nodes) {
          if (pos < to && pos + nodeSize > from) f({ isText, nodeSize }, pos);
        }
      },
    };
  }

  const oneParagraph = docOf([[0, 28, false], [1, 26, true]]);

  it('trims a select-all range back to the text', () => {
    // AllSelection runs 0..doc.content.size and includes the paragraph boundaries.
    expect(clampRangeToText(oneParagraph, 0, 28)).toEqual({ from: 1, to: 27 });
  });

  it('leaves an ordinary text selection alone', () => {
    expect(clampRangeToText(oneParagraph, 1, 27)).toEqual({ from: 1, to: 27 });
    expect(clampRangeToText(oneParagraph, 5, 11)).toEqual({ from: 5, to: 11 });
  });

  it('spans from the first text to the last across several blocks', () => {
    const twoParagraphs = docOf([
      [0, 12, false], [1, 10, true],
      [12, 12, false], [13, 10, true],
    ]);
    expect(clampRangeToText(twoParagraphs, 0, 24)).toEqual({ from: 1, to: 23 });
  });

  it('returns null when the range covers no text', () => {
    expect(clampRangeToText(docOf([[0, 2, false]]), 0, 2)).toBeNull();
  });
});
