import React from 'react';
import type { DrawingTool } from '../../../shared/drawing';

/**
 * The tools for a drawing that's being edited.
 *
 * Deliberately small: this is for marking up a map or sketching a rough layout, not for
 * making art — a real drawing app will always do that better. Everything here earns its
 * place for annotation work.
 */

/** Nib sizes as a fraction of the surface's shorter edge. */
export const PEN_SIZES = [0.004, 0.008, 0.018, 0.035];

/** Marker colours that stay legible on both a dark page and a photograph. */
export const PEN_COLORS = ['#ff9f43', '#48dbfb', '#ff6b6b', '#1dd1a1', '#feca57', '#ffffff', '#1a1a1a'];

export interface DrawingToolbarProps {
  tool: DrawingTool | 'eraser';
  color: string;
  size: number;
  onTool: (tool: DrawingTool | 'eraser') => void;
  onColor: (color: string) => void;
  onSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDone: () => void;
}

export function DrawingToolbar({
  tool,
  color,
  size,
  onTool,
  onColor,
  onSize,
  onUndo,
  onRedo,
  onClear,
  onDone,
}: DrawingToolbarProps) {
  return (
    <div className="drawing-toolbar" role="toolbar" aria-label="Drawing tools">
      <div className="drawing-toolbar__group">
        <button
          className={`drawing-tool${tool === 'pen' ? ' active' : ''}`}
          onClick={() => onTool('pen')}
          aria-label="Pen"
          data-tip="Pen"
        >
          &#9998;
        </button>
        <button
          className={`drawing-tool${tool === 'highlighter' ? ' active' : ''}`}
          onClick={() => onTool('highlighter')}
          aria-label="Highlighter"
          data-tip="Highlighter"
        >
          &#9646;
        </button>
        <button
          className={`drawing-tool${tool === 'eraser' ? ' active' : ''}`}
          onClick={() => onTool('eraser')}
          aria-label="Eraser"
          data-tip="Eraser — removes a whole stroke"
        >
          &#9003;
        </button>
      </div>

      <div className="drawing-toolbar__group">
        {PEN_COLORS.map(c => (
          <button
            key={c}
            className={`drawing-swatch${color === c ? ' active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => onColor(c)}
            aria-label={`Colour ${c}`}
            data-tip={c}
          />
        ))}
      </div>

      <div className="drawing-toolbar__group">
        {PEN_SIZES.map((s, i) => (
          <button
            key={s}
            className={`drawing-size${size === s ? ' active' : ''}`}
            onClick={() => onSize(s)}
            aria-label={`Size ${i + 1}`}
            data-tip={`Size ${i + 1}`}
          >
            {/* The dot previews the nib, so the sizes are comparable at a glance. */}
            <span style={{ width: 4 + i * 4, height: 4 + i * 4, backgroundColor: 'currentColor' }} />
          </button>
        ))}
      </div>

      <div className="drawing-toolbar__group">
        <button className="drawing-tool" onClick={onUndo} aria-label="Undo stroke" data-tip="Undo stroke">
          &#8630;
        </button>
        <button className="drawing-tool" onClick={onRedo} aria-label="Redo stroke" data-tip="Redo stroke">
          &#8631;
        </button>
        <button className="drawing-tool" onClick={onClear} aria-label="Clear drawing" data-tip="Clear the whole drawing">
          &#128465;
        </button>
      </div>

      <button className="btn btn-primary btn-sm drawing-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
