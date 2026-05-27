import { Node } from '@tiptap/core';

export const SectionNode = Node.create({
  name: 'section',

  group: 'block',

  content: 'block+',

  addAttributes() {
    return {
      sectionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-section-id'),
        renderHTML: attributes => {
          if (!attributes.sectionId) return {};
          return { 'data-section-id': attributes.sectionId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-section-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, class: 'editor-section' }, 0];
  },
});
