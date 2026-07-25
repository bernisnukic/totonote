import { isSharpTurn, widthAt, type Stroke, type StrokePoint } from '../../shared/drawing';

/**
 * Painting strokes onto a 2D canvas.
 *
 * Kept apart from the React component so the rendering rules are one plain function over
 * a context — easy to reason about, and callable from both the live canvas and any future
 * export. Everything takes normalised strokes and a pixel size, and converts on the way in.
 */

export interface Surface {
  /** CSS pixels. */
  width: number;
  height: number;
}

/** Nib sizes are a fraction of the shorter edge, so a stroke looks the same at any scale. */
export function nibScale(surface: Surface): number {
  return Math.min(surface.width, surface.height);
}

export function toPixels(point: StrokePoint, surface: Surface): { x: number; y: number } {
  return { x: point.x * surface.width, y: point.y * surface.height };
}

/**
 * Draw one stroke.
 *
 * Pressure varies the width along the stroke, so it can't be a single path with one
 * lineWidth — each segment is stroked at its own width. Segments are drawn through the
 * midpoints as quadratic curves, which is the standard trick for turning a jittery stream
 * of samples into a smooth line without fitting an actual spline.
 */
export function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, surface: Surface): void {
  const points = stroke.points;
  if (points.length === 0) return;

  const scale = nibScale(surface);
  context.save();
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  // A highlighter builds up where it overlaps itself but stays readable over text.
  context.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
  if (stroke.tool === 'highlighter') context.globalCompositeOperation = 'multiply';

  // A translucent stroke has to be one path in one pass. Drawing it segment by segment
  // composites each overlapping joint twice, which shows up as a row of darker bands
  // along the line. Highlighters give up pressure-varying width to stay even.
  if (stroke.tool === 'highlighter' && points.length > 1) {
    context.lineWidth = Math.max(1, stroke.size * scale);
    context.beginPath();
    const first = toPixels(points[0], surface);
    context.moveTo(first.x, first.y);
    for (let i = 1; i < points.length - 1; i++) {
      const current = toPixels(points[i], surface);
      const next = toPixels(points[i + 1], surface);
      context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    const last = toPixels(points[points.length - 1], surface);
    context.lineTo(last.x, last.y);
    context.stroke();
    context.restore();
    return;
  }

  // A tap with no movement is a dot, which a line-based path would draw as nothing.
  if (points.length === 1) {
    const p = toPixels(points[0], surface);
    context.beginPath();
    context.arc(p.x, p.y, (widthAt(stroke.size, points[0].p) * scale) / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  // Smoothing runs each segment between the midpoints of its neighbours, which turns a
  // stream of samples into a flowing line — but it also rounds off corners the user drew
  // on purpose. Points where the path turns sharply are marked and passed through exactly,
  // so an arrowhead stays an arrowhead.
  const corner = points.map((point, i) =>
    i === 0 || i === points.length - 1 ? true : isSharpTurn(points[i - 1], point, points[i + 1]),
  );

  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  for (let i = 1; i < points.length; i++) {
    const previous = toPixels(points[i - 1], surface);
    const current = toPixels(points[i], surface);
    // Average the two pressures so width changes gradually rather than stepping.
    context.lineWidth = Math.max(
      0.5,
      ((widthAt(stroke.size, points[i - 1].p) + widthAt(stroke.size, points[i].p)) / 2) * scale,
    );

    // Each segment runs from "just after" the previous point to "just before" this one —
    // the midpoints — unless either end is a corner, which is drawn to exactly.
    const start = corner[i - 1] ? previous : midpoint(toPixels(points[i - 2], surface), previous);
    const end = corner[i] ? current : midpoint(previous, current);

    context.beginPath();
    context.moveTo(start.x, start.y);
    // The shared point is the control, so the curve bends toward it without overshooting.
    // When both ends are corners this degenerates to the straight line it should be.
    context.quadraticCurveTo(previous.x, previous.y, end.x, end.y);
    context.stroke();
  }

  context.restore();
}

/** Repaint the whole surface. Cheap enough at these stroke counts to avoid dirty-rect bookkeeping. */
export function drawAll(context: CanvasRenderingContext2D, strokes: Stroke[], surface: Surface): void {
  context.clearRect(0, 0, surface.width, surface.height);
  for (const stroke of strokes) drawStroke(context, stroke, surface);
}

/**
 * Size a canvas for the display, accounting for screen density.
 *
 * Without the devicePixelRatio scaling, strokes look soft on any modern display — the
 * canvas would be drawn at CSS pixels and then stretched.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, surface: Surface, dpr = window.devicePixelRatio || 1): void {
  canvas.width = Math.max(1, Math.round(surface.width * dpr));
  canvas.height = Math.max(1, Math.round(surface.height * dpr));
  canvas.style.width = `${surface.width}px`;
  canvas.style.height = `${surface.height}px`;
  const context = canvas.getContext('2d');
  // Reset before scaling: setTransform is absolute, so repeated resizes can't compound.
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Where a pointer event falls on the surface, in normalised coordinates.
 *
 * Clamped, because a drag that leaves the canvas still reports positions and an unclamped
 * value would put strokes outside the picture.
 */
export function pointerToNormalised(
  event: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const x = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
  const y = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height;
  return { x: clamp(x), y: clamp(y) };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
