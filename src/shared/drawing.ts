/**
 * The stroke model behind the drawing layer.
 *
 * Strokes are **vectors, not pixels**: a list of sampled points with pressure, plus a
 * colour and a nib size. That keeps a drawing a few kilobytes instead of a few hundred,
 * lets it be erased and undone stroke by stroke, and means it stays sharp at any size.
 *
 * Coordinates are **normalised to 0..1** across the drawing surface. A drawing over a map
 * has to stay lined up with it when the image is displayed at 400px on one screen and
 * 900px on another, or resized later — pixel coordinates would drift on every one of those.
 *
 * Nothing here touches the DOM, so all of it is directly testable.
 */

export interface StrokePoint {
  /** 0..1 across the surface. */
  x: number;
  /** 0..1 down the surface. */
  y: number;
  /** Pen pressure 0..1; 0.5 for devices that don't report any. */
  p: number;
}

export type DrawingTool = 'pen' | 'highlighter';

export interface Stroke {
  id: string;
  tool: DrawingTool;
  /** CSS colour. */
  color: string;
  /** Nib width as a fraction of the surface's smaller edge, so it scales with the image. */
  size: number;
  points: StrokePoint[];
}

export interface Drawing {
  /** Bumped when the on-disk shape changes, so old drawings can be migrated. */
  version: 1;
  strokes: Stroke[];
}

export const DRAWING_VERSION = 1;

/** Pressure reported when the device has none (mouse, trackpad, some pens on first contact). */
export const DEFAULT_PRESSURE = 0.5;

export function emptyDrawing(): Drawing {
  return { version: DRAWING_VERSION, strokes: [] };
}

/** Parse stored JSON, falling back to an empty drawing rather than throwing at the user. */
export function parseDrawing(json: string): Drawing {
  if (!json) return emptyDrawing();
  try {
    const parsed = JSON.parse(json) as Partial<Drawing>;
    if (!parsed || !Array.isArray(parsed.strokes)) return emptyDrawing();
    return {
      version: DRAWING_VERSION,
      strokes: parsed.strokes.filter(isStroke),
    };
  } catch {
    return emptyDrawing();
  }
}

function isStroke(value: unknown): value is Stroke {
  const s = value as Stroke;
  return Boolean(
    s &&
      typeof s.id === 'string' &&
      typeof s.color === 'string' &&
      typeof s.size === 'number' &&
      Array.isArray(s.points) &&
      s.points.length > 0,
  );
}

export function serializeDrawing(drawing: Drawing): string {
  return JSON.stringify({ version: DRAWING_VERSION, strokes: drawing.strokes });
}

/** True when there is nothing to draw — used to drop empty drawings rather than store them. */
export function isDrawingEmpty(drawing: Drawing): boolean {
  return drawing.strokes.length === 0;
}

/**
 * Nib width for a point, in surface fractions.
 *
 * A light touch is thinner than a heavy one, but never vanishes: below about a third of
 * the nominal width a stroke starts to look broken rather than delicate.
 */
export function widthAt(size: number, pressure: number): number {
  const p = clamp01(Number.isFinite(pressure) ? pressure : DEFAULT_PRESSURE);
  return size * (0.35 + 0.65 * p);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Drop points that add nothing to the shape.
 *
 * A tablet reports hundreds of points a second, most of them a fraction of a pixel apart.
 * Keeping every one would make a page of annotations bigger than the image underneath, so
 * points closer than `minDistance` to the previous kept point are discarded — except a
 * sharp direction change, which is exactly where detail matters.
 */
export function simplifyPoints(points: StrokePoint[], minDistance = 0.002): StrokePoint[] {
  if (points.length <= 2) return [...points];
  const kept: StrokePoint[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const previous = kept[kept.length - 1];
    const current = points[i];
    if (distance(previous, current) >= minDistance || isSharpTurn(previous, current, points[i + 1])) {
      kept.push(current);
    }
  }

  kept.push(points[points.length - 1]);
  return kept;
}

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * True when the path bends sharply at `b`.
 *
 * Used twice: simplification keeps these points because they carry the shape, and
 * rendering stops smoothing through them so a deliberate corner — the head of an arrow,
 * the angle of a boundary — stays sharp instead of being rounded into a curve.
 */
export function isSharpTurn(a: StrokePoint, b: StrokePoint, c: StrokePoint, cosineLimit = 0.86): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const magnitude = Math.hypot(abx, aby) * Math.hypot(bcx, bcy);
  if (magnitude === 0) return false;
  const cosine = (abx * bcx + aby * bcy) / magnitude;
  return cosine < cosineLimit;
}

/** The axis-aligned box a stroke covers, ignoring nib width. */
export function strokeBounds(stroke: Stroke): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Ids of strokes the eraser touches at `point`.
 *
 * Whole-stroke erasing rather than pixel erasing: it matches how the strokes are stored,
 * it's instant, and for marking up a map "remove that arrow" is what you actually want.
 */
export function strokesAt(strokes: Stroke[], point: { x: number; y: number }, radius: number): string[] {
  const hits: string[] = [];
  for (const stroke of strokes) {
    // The nib itself makes the stroke wider than its centre line.
    const reach = radius + stroke.size / 2;
    const box = strokeBounds(stroke);
    if (
      point.x < box.minX - reach ||
      point.x > box.maxX + reach ||
      point.y < box.minY - reach ||
      point.y > box.maxY + reach
    ) {
      continue; // cheap rejection before the segment maths
    }
    if (touchesStroke(stroke, point, reach)) hits.push(stroke.id);
  }
  return hits;
}

function touchesStroke(stroke: Stroke, point: { x: number; y: number }, reach: number): boolean {
  const { points } = stroke;
  if (points.length === 1) {
    return Math.hypot(points[0].x - point.x, points[0].y - point.y) <= reach;
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(point, points[i], points[i + 1]) <= reach) return true;
  }
  return false;
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  // How far along the segment the nearest point sits, clamped to its ends.
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
