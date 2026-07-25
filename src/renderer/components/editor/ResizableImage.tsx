import React, { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

/**
 * An embedded image with a drag handle to size it.
 *
 * The width is stored on the node, so a portrait stays small and a map stays wide across
 * reloads. Sizing is by width alone — the height follows the aspect ratio, which keeps a
 * dragged image from ever being squashed.
 */

/** Never let an image shrink past the point where you can still grab its handle. */
const MIN_WIDTH = 60;

export function ResizableImage({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) ?? '';
  const width = node.attrs.width as number | null;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!editor.isEditable) return;
      event.preventDefault();
      event.stopPropagation();

      const image = wrapperRef.current?.querySelector('img');
      if (!image) return;
      const startX = event.clientX;
      const startWidth = image.getBoundingClientRect().width;
      // The column the image sits in — an image wider than its column just overflows.
      const maxWidth = wrapperRef.current?.parentElement?.clientWidth ?? startWidth * 2;
      setDragging(true);

      const onMove = (move: PointerEvent) => {
        const next = Math.round(
          Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + (move.clientX - startX))),
        );
        // Live feedback without a transaction per frame — the node is updated on release.
        image.style.width = `${next}px`;
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDragging(false);
        const finalWidth = Math.round(image.getBoundingClientRect().width);
        image.style.width = '';
        updateAttributes({ width: finalWidth });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [editor.isEditable, updateAttributes],
  );

  return (
    <NodeViewWrapper
      className={`resizable-image${selected ? ' is-selected' : ''}${dragging ? ' is-resizing' : ''}`}
      ref={wrapperRef}
      data-drag-handle
    >
      <img src={src} alt={alt} width={width ?? undefined} draggable={false} />
      {editor.isEditable && (
        <span
          className="resizable-image__handle"
          onPointerDown={startResize}
          role="separator"
          aria-label="Resize image"
          title="Drag to resize"
        />
      )}
    </NodeViewWrapper>
  );
}
