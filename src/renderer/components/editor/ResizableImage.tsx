import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Below this, the handle moves out of the picture's corner and sits just beyond it.
 *
 * The handle straddles the bottom-right corner, overlapping the picture by about nine
 * pixels. That is invisible on a photograph and fatal on an icon: paste something smaller
 * than the handle and it covers the picture completely, so clicking to select it lands on
 * the handle instead and nothing happens. `MIN_WIDTH` only governs dragging, so an image
 * that arrives small was never covered by it.
 */
const SMALL_WIDTH = 40;

export function ResizableImage({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) ?? '';
  const width = node.attrs.width as number | null;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [small, setSmall] = useState(false);

  // Measured rather than taken from the width attribute, because an image that has never
  // been resized has no width at all and renders at whatever size it happens to be.
  const measure = useCallback(() => {
    const image = wrapperRef.current?.querySelector('img');
    if (image) setSmall(image.getBoundingClientRect().width < SMALL_WIDTH);
  }, []);

  useEffect(() => {
    measure();
  }, [measure, width]);

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
      className={`resizable-image${selected ? ' is-selected' : ''}${dragging ? ' is-resizing' : ''}${
        width ? ' is-sized' : ''
      }${small ? ' is-small' : ''}`}
      ref={wrapperRef}
      data-drag-handle
    >
      {/* Natural size is only known once it has loaded, so measure again then. */}
      <img src={src} alt={alt} width={width ?? undefined} draggable={false} onLoad={measure} />
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
