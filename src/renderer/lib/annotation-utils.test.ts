import { describe, it, expect } from 'vitest';
import { detectOverlaps, findAdjacentAnnotations, isPositionInAnnotation, hexToRgba } from './annotation-utils';
import type { Annotation } from '../../shared/domain-types';

function makeAnnotation(id: string, from: number, to: number): Annotation {
  return {
    id,
    sectionId: 'sec-1',
    tagId: 'tag-1',
    fromPos: from,
    toPos: to,
    note: '',
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
