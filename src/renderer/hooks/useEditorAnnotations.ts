import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { useStore } from '../stores';

export function useEditorAnnotations(editor: Editor | null) {
  const annotations = useStore(s => s.annotations);
  const highlightsVisible = useStore(s => s.highlightsVisible);
  const tags = useStore(s => s.tags);
  const prevAnnotationsRef = useRef(annotations);

  useEffect(() => {
    if (!editor) return;

    // Send annotations to the editor via transaction metadata
    const annotationsWithColors = highlightsVisible
      ? annotations.map(a => {
          const tag = tags.find(t => t.id === a.tagId);
          return { ...a, color: tag?.color || '#48dbfb' };
        })
      : [];

    editor.commands.command(({ tr }) => {
      tr.setMeta('annotations', annotationsWithColors);
      return true;
    });

    prevAnnotationsRef.current = annotations;
  }, [editor, annotations, highlightsVisible, tags]);
}
