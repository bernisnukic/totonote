import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImage } from '../../components/editor/ResizableImage';

/**
 * The image node, plus a persisted display width.
 *
 * TipTap's Image carries only src/alt/title, so any width set on insert or by dragging a
 * corner would be dropped on the next save. Storing it as an attribute keeps a portrait
 * small and a map full-width across reloads.
 *
 * Left as a block node (`inline: false`): shared/prosemirror-text.ts counts `image` as a
 * one-position leaf, and inline images would change how surrounding text positions fall —
 * which is what every stored annotation range is measured in.
 */
export const SizedImage = Image.extend({
  // A node view, so the image can carry a drag handle. Without one there is no way to
  // size a picture at all: the width attribute was stored and honoured but nothing ever
  // set it, so a portrait and a map came out the same size.
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage);
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null as number | null,
        // Kept as a plain attribute rather than a style so it survives copy/paste as HTML.
        renderHTML: attributes => {
          const width = (attributes as { width?: number | null }).width;
          return width ? { width: String(width) } : {};
        },
        parseHTML: element => {
          const raw = (element as HTMLElement).getAttribute('width');
          const parsed = raw ? Number.parseInt(raw, 10) : NaN;
          return Number.isFinite(parsed) ? parsed : null;
        },
      },
    };
  },
}).configure({ inline: false, allowBase64: false });
