import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '../../lib/ipc-client';
import { mediaUrl } from '../../../shared/media-refs';
import { parseDrawing, type Drawing } from '../../../shared/drawing';
import { drawAll, sizeCanvas } from '../../lib/stroke-render';

/**
 * A filed drawing, shown on a compiled page.
 *
 * Renders the real strokes rather than a placeholder — the strokes are vectors in
 * normalised coordinates, so drawing them into a 64px box is the same operation as
 * drawing them full size. The background image, if there is one, sits underneath exactly
 * as it does in the document.
 */
const THUMB = 64;

export function DrawingThumb({ drawingId }: { drawingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke('drawing:get', { id: drawingId }).then(record => {
      if (cancelled || !record) return;
      setDrawing(parseDrawing(record.strokes));
      setBackgroundId(record.backgroundMediaId);
    });
    return () => {
      cancelled = true;
    };
  }, [drawingId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !drawing) return;
    const surface = { width: THUMB, height: THUMB };
    sizeCanvas(canvas, surface);
    const context = canvas.getContext('2d');
    if (context) drawAll(context, drawing.strokes, surface);
  }, [drawing]);

  return (
    <span className="placement-thumb placement-thumb--drawing" title="Drawing">
      {backgroundId && <img src={mediaUrl(backgroundId)} alt="" draggable={false} />}
      <canvas ref={canvasRef} />
    </span>
  );
}
