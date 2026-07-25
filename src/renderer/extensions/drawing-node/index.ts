import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { DrawingNodeView } from '../../components/editor/DrawingNodeView';

/**
 * A drawing embedded in a section — either a blank sketch or a pen layer over an image.
 *
 * Like `image`, this is an **atom block node occupying exactly one position**, which is
 * what shared/prosemirror-text.ts assumes when it walks stored content to compute excerpt
 * text. Anything that occupied a variable number of positions would shift every annotation
 * range stored after it in the same section.
 *
 * The node carries only ids and layout; the strokes live in the `drawings` table so the
 * document stays small enough to re-save on a debounce.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      /** Insert a drawing, optionally over an already-embedded image. */
      insertDrawing: (attrs: { drawingId: string; backgroundMediaId?: string | null; aspectRatio?: number }) => ReturnType;
    };
  }
}

export const DrawingNode = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      drawingId: { default: null as string | null },
      backgroundMediaId: { default: null as string | null },
      /** width / height of the surface, so it reserves the right space before loading. */
      aspectRatio: { default: 1.5 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    return [
      'div',
      mergeAttributes({
        'data-drawing-id': attrs.drawingId as string,
        'data-background-media-id': (attrs.backgroundMediaId as string) ?? undefined,
        'data-aspect-ratio': String(attrs.aspectRatio ?? 1.5),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },

  addCommands() {
    return {
      insertDrawing:
        attrs =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
