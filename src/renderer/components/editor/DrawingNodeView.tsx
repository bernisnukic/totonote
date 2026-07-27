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
import { registerDrawing, unregisterDrawing } from '../../lib/drawing-registry';
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

/** Never let a drawing shrink past the point where the handle is still grabbable. */
const MIN_DRAWING_WIDTH = 120;

export function DrawingNodeView({ node, selected, editor, updateAttributes, getPos }: NodeViewProps) {
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
  const [resizing, setResizing] = useState(false);
  const storedWidth = node.attrs.width as number | null;

  // Drawings could not be sized at all, unlike pictures — a sketch was always as wide as
  // the column, whether it was a full map or a small arrow.
  const startResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!editor.isEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const host = hostRef.current;
    if (!host) return;
    const startX = event.clientX;
    const startWidth = host.getBoundingClientRect().width;
    const maxWidth = host.parentElement?.parentElement?.clientWidth ?? startWidth * 2;
    setResizing(true);

    const onMove = (move: PointerEvent) => {
      const next = Math.round(
        Math.min(maxWidth, Math.max(MIN_DRAWING_WIDTH, startWidth + (move.clientX - startX))),
      );
      host.style.width = `${next}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setResizing(false);
      const finalWidth = Math.round(host.getBoundingClientRect().width);
      host.style.width = '';
      updateAttributes({ width: finalWidth });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const hostRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clonedRef = useRef(false);

  // A pasted drawing arrives carrying the id of the one it was copied from, so both nodes
  // would be the same drawing and editing either would change both. Give the later one a
  // drawing of its own, starting from the same strokes.
  useEffect(() => {
    if (!drawingId || clonedRef.current) return;
    const positions: number[] = [];
    editor.state.doc.descendants((child, pos) => {
      if (child.type.name === 'drawing' && child.attrs.drawingId === drawingId) positions.push(pos);
      return true;
    });
    if (positions.length < 2) return;
    const mine = typeof getPos === 'function' ? (getPos() ?? -1) : -1;
    if (mine < 0 || mine === positions[0]) return; // the original keeps the id

    clonedRef.current = true;
    void (async () => {
      const source = await invoke('drawing:get', { id: drawingId });
      const copy = await invoke('drawing:create', { backgroundMediaId, aspectRatio });
      if (source?.strokes) {
        await invoke('drawing:save', { id: copy.id, strokes: source.strokes });
      }
      updateAttributes({ drawingId: copy.id });
    })();
  }, [drawingId, backgroundMediaId, aspectRatio, editor, getPos, updateAttributes]);
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
  // Let the History timeline read and restore these strokes: they live in their own table,
  // so a checkpoint of the section's text would otherwise miss them entirely.
  useEffect(() => {
    if (!drawingId) return;
    registerDrawing(drawingId, {
      read: () => serializeDrawing(drawingRef.current),
      restore: (strokes: string) => {
        const restored = parseDrawing(strokes);
        drawingRef.current = restored;
        setDrawing(restored);
        // Straight to disk: a restore is not an edit the user can undo inside the drawing.
        if (drawingId) {
          invoke('drawing:save', { id: drawingId, strokes }).catch(() => undefined);
        }
      },
    });
    return () => unregisterDrawing(drawingId);
  }, [drawingId]);

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
      className={`drawing-node${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}${resizing ? ' is-resizing' : ''}`}
      data-drawing-id={drawingId ?? undefined}
    >
      {/* Double-click to start drawing, the way double-click opens anything else. The
          Draw button stays for discoverability. */}
      <div
        className="drawing-node__surface"
        ref={hostRef}
        style={{ aspectRatio: String(aspectRatio), width: storedWidth ? `${storedWidth}px` : undefined }}
        onDoubleClick={() => setEditing(true)}
      >
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
        {editor.isEditable && !editing && (
          <span
            className="drawing-node__handle"
            onPointerDown={startResize}
            role="separator"
            aria-label="Resize drawing"
            title="Drag to resize"
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
