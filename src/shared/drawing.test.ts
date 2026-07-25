import { describe, it, expect } from 'vitest';
import {
  emptyDrawing,
  parseDrawing,
  serializeDrawing,
  isDrawingEmpty,
  widthAt,
  clamp01,
  simplifyPoints,
  strokeBounds,
  strokesAt,
  distanceToSegment,
  DEFAULT_PRESSURE,
  type Stroke,
  type StrokePoint,
} from './drawing';

const pt = (x: number, y: number, p = DEFAULT_PRESSURE): StrokePoint => ({ x, y, p });

const stroke = (over: Partial<Stroke> & { id: string }): Stroke => ({
  tool: 'pen',
  color: '#48dbfb',
  size: 0.01,
  points: [pt(0, 0), pt(1, 1)],
  ...over,
});

describe('serialisation', () => {
  it('round-trips a drawing', () => {
    const drawing = { version: 1 as const, strokes: [stroke({ id: 'a' })] };
    expect(parseDrawing(serializeDrawing(drawing))).toEqual(drawing);
  });

  it('returns an empty drawing for empty or broken input rather than throwing', () => {
    // A corrupt drawing should cost you that drawing, never the whole document.
    expect(parseDrawing('')).toEqual(emptyDrawing());
    expect(parseDrawing('not json')).toEqual(emptyDrawing());
    expect(parseDrawing('null')).toEqual(emptyDrawing());
    expect(parseDrawing('{"strokes":"nope"}')).toEqual(emptyDrawing());
  });

  it('drops malformed strokes but keeps the good ones', () => {
    const json = JSON.stringify({
      version: 1,
      strokes: [stroke({ id: 'good' }), { id: 'bad' }, { points: [] }, null],
    });
    const parsed = parseDrawing(json);
    expect(parsed.strokes.map(s => s.id)).toEqual(['good']);
  });

  it('knows an empty drawing when it sees one', () => {
    expect(isDrawingEmpty(emptyDrawing())).toBe(true);
    expect(isDrawingEmpty({ version: 1, strokes: [stroke({ id: 'a' })] })).toBe(false);
  });
});

describe('widthAt', () => {
  it('scales with pressure', () => {
    expect(widthAt(1, 1)).toBeGreaterThan(widthAt(1, 0.5));
    expect(widthAt(1, 0.5)).toBeGreaterThan(widthAt(1, 0));
  });

  it('never thins a stroke away to nothing', () => {
    // A zero-width stroke renders as gaps, which reads as a bug rather than a light touch.
    expect(widthAt(1, 0)).toBeGreaterThan(0.3);
  });

  it('never exceeds the nominal size', () => {
    expect(widthAt(1, 1)).toBeLessThanOrEqual(1);
  });

  it('treats a missing or absurd pressure as usable', () => {
    expect(widthAt(1, Number.NaN)).toBe(widthAt(1, DEFAULT_PRESSURE));
    expect(widthAt(1, 5)).toBe(widthAt(1, 1));
    expect(widthAt(1, -3)).toBe(widthAt(1, 0));
  });
});

describe('clamp01', () => {
  it('clamps into range and rejects nonsense', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe('simplifyPoints', () => {
  it('leaves very short strokes alone', () => {
    expect(simplifyPoints([pt(0, 0)])).toHaveLength(1);
    expect(simplifyPoints([pt(0, 0), pt(1, 1)])).toHaveLength(2);
  });

  it('drops points a tablet reported almost on top of each other', () => {
    const dense = Array.from({ length: 200 }, (_, i) => pt(i * 0.00005, 0));
    const simplified = simplifyPoints(dense);
    expect(simplified.length).toBeLessThan(dense.length / 4);
  });

  it('always keeps the first and last point', () => {
    const dense = Array.from({ length: 50 }, (_, i) => pt(i * 0.0001, 0));
    const simplified = simplifyPoints(dense);
    expect(simplified[0]).toEqual(dense[0]);
    expect(simplified[simplified.length - 1]).toEqual(dense[dense.length - 1]);
  });

  it('keeps a sharp corner even when the points are close together', () => {
    // A right angle drawn slowly would otherwise be rounded off into a curve.
    const corner = [pt(0, 0), pt(0.0005, 0), pt(0.001, 0), pt(0.001, 0.0005), pt(0.001, 0.001)];
    const simplified = simplifyPoints(corner);
    expect(simplified.some(p => p.x === 0.001 && p.y === 0)).toBe(true);
  });

  it('keeps everything on a stroke drawn with real spacing', () => {
    const spread = [pt(0, 0), pt(0.1, 0.1), pt(0.2, 0.2), pt(0.3, 0.3)];
    expect(simplifyPoints(spread)).toHaveLength(4);
  });
});

describe('strokeBounds', () => {
  it('covers every point', () => {
    const s = stroke({ id: 'a', points: [pt(0.2, 0.8), pt(0.6, 0.1), pt(0.4, 0.5)] });
    expect(strokeBounds(s)).toEqual({ minX: 0.2, minY: 0.1, maxX: 0.6, maxY: 0.8 });
  });

  it('handles a single-point dot', () => {
    const s = stroke({ id: 'a', points: [pt(0.5, 0.5)] });
    expect(strokeBounds(s)).toEqual({ minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5 });
  });
});

describe('distanceToSegment', () => {
  it('is zero on the segment', () => {
    expect(distanceToSegment({ x: 0.5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
  });

  it('measures perpendicular distance', () => {
    expect(distanceToSegment({ x: 0.5, y: 0.3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0.3);
  });

  it('clamps past the ends rather than measuring to the infinite line', () => {
    expect(distanceToSegment({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1);
  });

  it('handles a zero-length segment', () => {
    expect(distanceToSegment({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(1);
  });
});

describe('strokesAt (the eraser)', () => {
  const horizontal = stroke({ id: 'h', points: [pt(0, 0.5), pt(1, 0.5)], size: 0.01 });
  const vertical = stroke({ id: 'v', points: [pt(0.5, 0), pt(0.5, 1)], size: 0.01 });

  it('finds the stroke under the eraser', () => {
    expect(strokesAt([horizontal], { x: 0.3, y: 0.5 }, 0.02)).toEqual(['h']);
  });

  it('finds nothing when the eraser is clear of everything', () => {
    expect(strokesAt([horizontal], { x: 0.3, y: 0.9 }, 0.02)).toEqual([]);
  });

  it('finds every stroke under the eraser at a crossing', () => {
    expect(strokesAt([horizontal, vertical], { x: 0.5, y: 0.5 }, 0.02).sort()).toEqual(['h', 'v']);
  });

  it('accounts for the nib width, not just the centre line', () => {
    const fat = stroke({ id: 'fat', points: [pt(0, 0.5), pt(1, 0.5)], size: 0.2 });
    // 0.08 above the centre line: outside a hairline, inside a fat stroke.
    expect(strokesAt([fat], { x: 0.5, y: 0.58 }, 0.001)).toEqual(['fat']);
    expect(strokesAt([horizontal], { x: 0.5, y: 0.58 }, 0.001)).toEqual([]);
  });

  it('erases a single-point dot', () => {
    const dot = stroke({ id: 'dot', points: [pt(0.5, 0.5)], size: 0.01 });
    expect(strokesAt([dot], { x: 0.5, y: 0.5 }, 0.02)).toEqual(['dot']);
    expect(strokesAt([dot], { x: 0.9, y: 0.9 }, 0.02)).toEqual([]);
  });
});
