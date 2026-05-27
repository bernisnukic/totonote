import { Mark } from '@tiptap/core';

export const TagHighlightMark = Mark.create({
  name: 'tagHighlight',

  addAttributes() {
    return {
      tagId: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag-id'),
        renderHTML: attributes => {
          if (!attributes.tagId) return {};
          return { 'data-tag-id': attributes.tagId };
        },
      },
      color: {
        default: '#48dbfb',
        parseHTML: element => element.getAttribute('data-color'),
        renderHTML: attributes => {
          return {
            'data-color': attributes.color,
            style: `background-color: ${attributes.color}33; border-bottom: 2px solid ${attributes.color};`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'annotation-highlight' }, 0];
  },
});
