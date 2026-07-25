import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { invoke } from '../../lib/ipc-client';
import { mediaUrl } from '../../../shared/media-refs';
import {
  emptyDrawing,
  isDrawingEmpty,
  parseDrawing,
  serializeDrawing,
  strokesAt,
  type Drawing,
  type DrawingTool,
  type Stroke,
} from '../../../shared/drawing';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingToolbar, PEN_COLORS, PEN_SIZES } from './DrawingToolbar';

/**
 * A drawing inside the document.
 *
 * Starts read-only: a drawing is usually something you made earlier and are now reading
 * past, and a live canvas over an image would swallow every click meant for the text.
 * Pressing Edit hands the surface over to the pen and shows the tools.
 */

/** How long after the last stroke the drawing is written to the database. */
const SAVE_DEBOUNCE_MS = 600;

/** How far the eraser reaches, in surface fractions. */
const ERASER_RADIUS = 0.02;

export function DrawingNodeView({ node, selected, editor }: NodeViewProps) {
  const drawingId = node.attrs.drawingId as string | null;
  const backgroundMediaId = node.attrs.backgroundMediaId as string | null;
  const aspectRatio = (node.attrs.aspectRatio as number) || 1.5;

  const [drawing, setDrawing] = useState<Drawing>(emptyDrawing());
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tool, setTool] = useState<DrawingTool | 'eraser'>('pen');
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [width, setWidth] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Undo within the drawing, kept separate from the editor's own document history. */
  const undoStack = useRef<Drawing[]>([]);
  const redoStack = useRef<Drawing[]>([]);

  // Measure the available width and follow it, so the canvas matches the column and the
  // strokes (stored 0..1) land in the same place at any size.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!drawingId) {
      setLoaded(true);
      return;
    }
    invoke('drawing:get', { id: drawingId }).then(record => {
      if (cancelled) return;
      const loadedDrawing = record ? parseDrawing(record.strokes) : emptyDrawing();
      drawingRef.current = loadedDrawing;
      setDrawing(loadedDrawing);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [drawingId]);

  // The authoritative current strokes. Kept in a ref, not read from state, so a burst of
  // strokes in one tick accumulates instead of each overwriting the last.
  const drawingRef = useRef<Drawing>(drawing);

  const persist = useCallback(
    (next: Drawing) => {
      if (!drawingId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        invoke('drawing:save', { id: drawingId, strokes: serializeDrawing(next) }).catch(err =>
          console.error('[drawing save]', err),
        );
      }, SAVE_DEBOUNCE_MS);
    },
    [drawingId],
  );

  // A pending save must not be lost when the section unmounts.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (drawingId) {
          invoke('drawing:save', { id: drawingId, strokes: serializeDrawing(drawingRef.current) }).catch(
            () => undefined,
          );
        }
      }
    };
  }, [drawingId]);

  /**
   * Commit a change. The ref is updated *before* the state, so two strokes finishing in
   * the same tick both land — React wouldn't have re-rendered between them.
   */
  const applyChange = useCallback(
    (next: Drawing) => {
      undoStack.current.push(drawingRef.current);
      redoStack.current = [];
      drawingRef.current = next;
      setDrawing(next);
      persist(next);
    },
    [persist],
  );

  const addStroke = useCallback(
    (stroke: Stroke) => {
      const current = drawingRef.current;
      applyChange({ ...current, strokes: [...current.strokes, stroke] });
    },
    [applyChange],
  );

  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const current = drawingRef.current;
      const hits = strokesAt(current.strokes, point, ERASER_RADIUS);
      if (hits.length === 0) return;
      applyChange({ ...current, strokes: current.strokes.filter(s => !hits.includes(s.id)) });
    },
    [applyChange],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(drawingRef.current);
    drawingRef.current = previous;
    setDrawing(previous);
    persist(previous);
  }, [persist]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(drawingRef.current);
    drawingRef.current = next;
    setDrawing(next);
    persist(next);
  }, [persist]);

  const clear = useCallback(() => {
    if (isDrawingEmpty(drawingRef.current)) return;
    applyChange(emptyDrawing());
  }, [applyChange]);

  const height = width > 0 ? Math.round(width / aspectRatio) : 0;

  return (
    <NodeViewWrapper
      className={`drawing-node${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`}
      data-drawing-id={drawingId ?? undefined}
    >
      <div className="drawing-node__surface" ref={hostRef} style={{ aspectRatio: String(aspectRatio) }}>
        {backgroundMediaId && (
          <img className="drawing-node__background" src={mediaUrl(backgroundMediaId)} alt="" draggable={false} />
        )}
        {loaded && width > 0 && height > 0 && (
          <DrawingCanvas
            drawing={drawing}
            onStroke={addStroke}
            onErase={eraseAt}
            width={width}
            height={height}
            tool={tool}
            color={color}
            size={size}
            readOnly={!editing}
          />
        )}
      </div>

      {editor.isEditable && (
        <div className="drawing-node__bar">
          {editing ? (
            <DrawingToolbar
              tool={tool}
              color={color}
              size={size}
              onTool={setTool}
              onColor={setColor}
              onSize={setSize}
              onUndo={undo}
              onRedo={redo}
              onClear={clear}
              onDone={() => setEditing(false)}
            />
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              &#9998; Draw
            </button>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
