import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOCUMENT_LINK_NODE } from '../../../shared/doc-links';

/**
 * `[[Another document]]` — a link from one document to another.
 *
 * An inline atom rather than a mark: a link is one indivisible thing you click, not a range
 * of styled characters that editing can split down the middle. It costs exactly one
 * position, which matters because highlight positions are arithmetic over the same document
 * (see shared/prosemirror-text.ts).
 *
 * The title is stored as `label` but only used as a fallback — `openTarget` resolves the
 * live title, so renaming a document updates every link to it.
 */

export interface DocumentLinkOptions {
  /** Current title for a document id, or null if it no longer exists. */
  resolveTitle: (documentId: string) => string | null;
  /** Called when a link is clicked. */
  onOpen: (documentId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    documentLink: {
      insertDocumentLink: (attrs: { documentId: string; label: string }) => ReturnType;
    };
  }
}

export const DocumentLink = Node.create<DocumentLinkOptions>({
  name: DOCUMENT_LINK_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      resolveTitle: () => null,
      onOpen: () => undefined,
    };
  },

  addAttributes() {
    return {
      documentId: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-document-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const documentId = String(HTMLAttributes.documentId ?? '');
    const label = String(HTMLAttributes.label ?? '');
    const current = this.options.resolveTitle(documentId);
    const missing = current === null;
    return [
      'a',
      mergeAttributes({
        'data-document-id': documentId,
        'data-label': label,
        class: `doc-link${missing ? ' doc-link--missing' : ''}`,
        title: missing ? 'That document no longer exists' : `Open “${current}”`,
      }),
      current ?? label,
    ];
  },

  addProseMirrorPlugins() {
    const { onOpen } = this.options;
    return [
      new Plugin({
        key: new PluginKey('documentLinkClick'),
        props: {
          handleClickOn(_view, _pos, node) {
            if (node.type.name !== DOCUMENT_LINK_NODE) return false;
            const id = node.attrs.documentId as string;
            if (!id) return false;
            onOpen(id);
            return true;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertDocumentLink:
        attrs =>
        ({ commands }) =>
          // A trailing space so the caret lands outside the link and typing continues as
          // ordinary text rather than appearing to extend it.
          commands.insertContent([
            { type: DOCUMENT_LINK_NODE, attrs },
            { type: 'text', text: ' ' },
          ]),
    };
  },
});
