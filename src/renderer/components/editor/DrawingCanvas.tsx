import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PRESSURE,
  clamp01,
  simplifyPoints,
  type Drawing,
  type DrawingTool,
  type Stroke,
  type StrokePoint,
} from '../../../shared/drawing';
import { drawAll, drawStroke, pointerToNormalised, sizeCanvas } from '../../lib/stroke-render';

/**
 * The drawing surface.
 *
 * Two canvases stacked: everything committed on the lower one, and the stroke currently
 * under the pen on the upper one. That way an in-progress stroke costs one small repaint
 * per frame instead of redrawing the whole picture on every sample.
 *
 * Pen tablets are handled through Pointer Events — `pressure` for nib width, and
 * `getCoalescedEvents()` to pick up the samples the tablet reported between animation
 * frames, which is the difference between a smooth line and a visibly faceted one.
 */

export interface DrawingCanvasProps {
  drawing: Drawing;
  /**
   * A finished stroke. The canvas reports *what happened* rather than handing back a whole
   * new drawing: building `[...drawing.strokes, stroke]` from a prop drops strokes when two
   * finish in the same tick, because React hasn't re-rendered with the first one yet.
   */
  onStroke: (stroke: Stroke) => void;
  /** The eraser passed over this point; the owner decides what it hits. */
  onErase: (point: { x: number; y: number }) => void;
  /** Display size in CSS pixels. */
  width: number;
  height: number;
  tool: DrawingTool | 'eraser';
  color: string;
  /** Nib size as a fraction of the shorter edge. */
  size: number;
  /** Read-only rendering — no pointer handling at all. */
  readOnly?: boolean;
}

export function DrawingCanvas({
  drawing,
  onStroke,
  onErase,
  width,
  height,
  tool,
  color,
  size,
  readOnly = false,
}: DrawingCanvasProps) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<StrokePoint[]>([]);
  const drawingIdRef = useRef<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const surface = { width, height };

  // Repaint the committed strokes whenever they or the size change.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas) return;
    sizeCanvas(canvas, surface);
    const context = canvas.getContext('2d');
    if (context) drawAll(context, drawing.strokes, surface);
  }, [drawing, width, height]);

  useEffect(() => {
    const canvas = liveRef.current;
    if (canvas) sizeCanvas(canvas, surface);
  }, [width, height]);

  /** Read every sample this event carries, not just its final position. */
  const samplesFrom = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint[] => {
      const canvas = liveRef.current;
      if (!canvas) return [];
      const rect = canvas.getBoundingClientRect();
      const native = event.nativeEvent;
      const events =
        typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length > 0
          ? native.getCoalescedEvents()
          : [native];
      return events.map(e => {
        const { x, y } = pointerToNormalised(e, rect);
        // A pen that reports 0 while touching means "no pressure data", not "no contact".
        const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : DEFAULT_PRESSURE;
        return { x, y, p: clamp01(pressure) };
      });
    },
    [],
  );

  const repaintLive = useCallback(() => {
    const canvas = liveRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (pointsRef.current.length > 0) {
      drawStroke(context, { id: 'live', tool: tool === 'eraser' ? 'pen' : tool, color, size, points: pointsRef.current }, surface);
    }
  }, [color, size, tool, width, height]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    // Ignore a palm resting on the tablet, and anything but the primary contact.
    if (!event.isPrimary) return;
    event.preventDefault();
    // Capture so a stroke that leaves the canvas still finishes cleanly.
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingIdRef.current = event.pointerId;
    setIsDrawing(true);

    const samples = samplesFrom(event);
    if (tool === 'eraser') {
      if (samples[0]) onErase(samples[0]);
      return;
    }
    pointsRef.current = samples;
    repaintLive();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || drawingIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const samples = samplesFrom(event);
    if (tool === 'eraser') {
      for (const sample of samples) onErase(sample);
      return;
    }
    pointsRef.current = [...pointsRef.current, ...samples];
    repaintLive();
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingIdRef.current !== event.pointerId) return;
    drawingIdRef.current = null;
    setIsDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // The lift carries a final position, and it is often past the last move — dropping it
    // ends every stroke slightly short of where the pen actually left the surface.
    if (tool !== 'eraser' && pointsRef.current.length > 0) {
      const [end] = samplesFrom(event);
      const last = pointsRef.current[pointsRef.current.length - 1];
      if (end && (end.x !== last.x || end.y !== last.y)) {
        // Carry the last real pressure over: a lift reports 0, which would taper to nothing.
        pointsRef.current = [...pointsRef.current, { ...end, p: last.p }];
      }
    }

    const points = simplifyPoints(pointsRef.current);
    pointsRef.current = [];
    const context = liveRef.current?.getContext('2d');
    context?.clearRect(0, 0, width, height);

    if (tool === 'eraser' || points.length === 0) return;
    onStroke({ id: crypto.randomUUID(), tool, color, size, points });
  };

  return (
    <div
      className={`drawing-canvas${readOnly ? ' is-readonly' : ''}${isDrawing ? ' is-drawing' : ''}`}
      style={{ width, height }}
    >
      <canvas ref={baseRef} className="drawing-canvas__base" />
      <canvas
        ref={liveRef}
        className="drawing-canvas__live"
        style={{
          cursor: readOnly ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
          // Without this the browser scrolls or zooms instead of letting the pen draw.
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </div>
  );
}
