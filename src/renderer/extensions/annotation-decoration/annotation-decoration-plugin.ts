import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface AnnotationData {
  id: string;
  fromPos: number;
  toPos: number;
  color: string;
  tagId: string;
  sectionId: string;
  note: string;
}

export const annotationPluginKey = new PluginKey('annotationDecoration');

export function createAnnotationPlugin() {
  return new Plugin({
    key: annotationPluginKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, decorationSet) {
        const annotations: AnnotationData[] | undefined = tr.getMeta('annotations');

        if (annotations) {
          // Rebuild decorations from new annotations
          const decorations: Decoration[] = [];

          // inclusiveEnd is false so that text typed immediately after a highlight
          // starts a fresh, untagged run. With it on, carrying on writing at the end of
          // a tagged sentence silently swallowed the next sentence into the highlight —
          // and the debounced save then persisted the grown range. Use "Expand to
          // selection" from the right-click menu to grow a highlight deliberately.
          for (const ann of annotations) {
            if (ann.fromPos >= 0 && ann.toPos > ann.fromPos && ann.toPos <= tr.doc.content.size) {
              const alpha = 0.25;
              const r = parseInt(ann.color.slice(1, 3), 16);
              const g = parseInt(ann.color.slice(3, 5), 16);
              const b = parseInt(ann.color.slice(5, 7), 16);

              decorations.push(
                Decoration.inline(ann.fromPos, ann.toPos, {
                  class: 'annotation-highlight',
                  style: `background-color: rgba(${r}, ${g}, ${b}, ${alpha}); border-bottom: 2px solid ${ann.color};`,
                  'data-annotation-id': ann.id,
                  'data-tag-id': ann.tagId,
                }, { inclusiveEnd: false, annotationId: ann.id })
              );
            }
          }

          return DecorationSet.create(tr.doc, decorations);
        }

        // Map existing decorations through the transaction
        return decorationSet.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return annotationPluginKey.getState(state);
      },
    },
  });
}
