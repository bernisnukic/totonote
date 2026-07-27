import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Always keep somewhere to write above a section's first block.
 *
 * Starting a section with a picture or a drawing left nowhere to put a caption or an
 * opening line: there is no position before the first block, so the caret cannot go there
 * and typing does nothing. ProseMirror's gap cursor helps in some places but not at the
 * very start of a document.
 *
 * This keeps an empty paragraph as the first child whenever the section would otherwise
 * open with an atom. It is added only when needed, and only ever an empty one, so it does
 * not accumulate blank lines: once something is written in it, it is no longer first-and-
 * atom and the rule stops applying.
 */
export const LeadingParagraph = Extension.create({
  name: 'leadingParagraph',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('leadingParagraph'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const first = newState.doc.firstChild;
          if (!first || !first.isAtom) return null;
          const paragraph = newState.schema.nodes.paragraph;
          if (!paragraph) return null;
          return newState.tr.insert(0, paragraph.create());
        },
      }),
    ];
  },
});
