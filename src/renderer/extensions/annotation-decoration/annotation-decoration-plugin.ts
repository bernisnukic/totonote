import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

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

/**
 * What the plugin holds: the annotations themselves as well as the decorations built from
 * them.
 *
 * The annotations are kept because the two kinds of decoration survive a change
 * differently. An *inline* decoration over text is carried through by mapping the
 * decoration set, which is also what gives it its exact behaviour at the edges. A *node*
 * decoration is dropped as soon as its node is replaced — which is what setting an
 * attribute does, so resizing a tagged drawing made its highlight vanish. Those have to be
 * rebuilt, and rebuilding needs the annotations.
 */
export interface AnnotationPluginState {
  annotations: AnnotationData[];
  decorations: DecorationSet;
}

function rgbParts(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

const ALPHA = 0.25;

function isUsable(ann: AnnotationData, doc: ProseMirrorNode): boolean {
  return ann.fromPos >= 0 && ann.toPos > ann.fromPos && ann.toPos <= doc.content.size;
}

function inlineDecorationFor(ann: AnnotationData): Decoration {
  const [r, g, b] = rgbParts(ann.color);
  // inclusiveEnd is false so that text typed immediately after a highlight starts a fresh,
  // untagged run. With it on, carrying on writing at the end of a tagged sentence silently
  // swallowed the next sentence into the highlight — and the debounced save then persisted
  // the grown range. Use "Expand to selection" from the right-click menu to grow a
  // highlight deliberately.
  return Decoration.inline(
    ann.fromPos,
    ann.toPos,
    {
      class: 'annotation-highlight',
      style: `background-color: rgba(${r}, ${g}, ${b}, ${ALPHA}); border-bottom: 2px solid ${ann.color};`,
      'data-annotation-id': ann.id,
      'data-tag-id': ann.tagId,
    },
    { inclusiveEnd: false, annotationId: ann.id },
  );
}

/**
 * The highlight for any picture or drawing inside the range.
 *
 * An inline decoration draws nothing over one: they are atom nodes with no text inside to
 * wrap. Tagging one therefore looked like it had failed — no colour, nothing to
 * right-click, and no way to tell you had already done it, so people tagged the same image
 * again and again. A node decoration puts the class and the id on the element itself.
 *
 * The colour is passed down as custom properties rather than painted here, because the
 * element this lands on is TipTap's wrapper around the node view, which is as wide as the
 * column whatever size the drawing inside it is. Outlining *that* drew a full-width box
 * around a narrow drawing. The stylesheet takes these two values and outlines the drawing
 * itself, which needs no layout change and so cannot disturb resizing.
 */
function nodeDecorationsFor(ann: AnnotationData, doc: ProseMirrorNode): Decoration[] {
  const [r, g, b] = rgbParts(ann.color);
  const found: Decoration[] = [];
  doc.nodesBetween(ann.fromPos, ann.toPos, (node, pos) => {
    if (!node.isAtom || node.isText) return true;
    if (pos < ann.fromPos || pos + node.nodeSize > ann.toPos) return true;
    found.push(
      Decoration.node(
        pos,
        pos + node.nodeSize,
        {
          class: 'annotation-highlight annotation-highlight--node',
          style: `--annotation-color: ${ann.color}; --annotation-tint: rgba(${r}, ${g}, ${b}, ${ALPHA});`,
          'data-annotation-id': ann.id,
          'data-tag-id': ann.tagId,
        },
        // Marked so they can be picked back out of the set and replaced wholesale.
        { annotationId: ann.id, isNodeHighlight: true },
      ),
    );
    return false;
  });
  return found;
}

function buildAll(annotations: AnnotationData[], doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  for (const ann of annotations) {
    if (!isUsable(ann, doc)) continue;
    decorations.push(inlineDecorationFor(ann));
    decorations.push(...nodeDecorationsFor(ann, doc));
  }
  return DecorationSet.create(doc, decorations);
}

export function createAnnotationPlugin() {
  return new Plugin<AnnotationPluginState>({
    key: annotationPluginKey,
    state: {
      init() {
        return { annotations: [], decorations: DecorationSet.empty };
      },
      apply(tr, previous) {
        const fromMeta: AnnotationData[] | undefined = tr.getMeta('annotations');
        if (fromMeta) {
          return { annotations: fromMeta, decorations: buildAll(fromMeta, tr.doc) };
        }

        if (!tr.docChanged) return previous;

        // Mapping the set — rather than rebuilding it — is what keeps a highlight from
        // growing when you type at its end: the decoration's own inclusiveEnd governs,
        // whereas re-deriving from positions would need the bias hand-matched at every
        // call site. Positions in the stored list are mapped to agree with it.
        const annotations = previous.annotations.map(a => ({
          ...a,
          fromPos: tr.mapping.map(a.fromPos),
          // -1 keeps the end put when text is inserted there, matching inclusiveEnd: false.
          toPos: tr.mapping.map(a.toPos, -1),
        }));

        const mapped = tr.mapping.maps.length
          ? previous.decorations.map(tr.mapping, tr.doc)
          : previous.decorations;

        // Node decorations do not survive their node being replaced, which is exactly what
        // resizing a drawing does. Drop whatever is left of them and put back a fresh set.
        const staleNodeDecorations = mapped.find(
          undefined,
          undefined,
          spec => spec.isNodeHighlight === true,
        );
        const rebuilt = annotations
          .filter(ann => isUsable(ann, tr.doc))
          .flatMap(ann => nodeDecorationsFor(ann, tr.doc));

        const decorations = mapped.remove(staleNodeDecorations).add(tr.doc, rebuilt);
        return { annotations, decorations };
      },
    },
    props: {
      decorations(state) {
        return annotationPluginKey.getState(state)?.decorations;
      },
    },
  });
}
