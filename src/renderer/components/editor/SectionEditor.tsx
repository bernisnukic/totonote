import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { AnnotationDecoration, annotationPluginKey } from '../../extensions/annotation-decoration';
import { useStore } from '../../stores';
import { useDebounce } from '../../hooks/useDebounce';
import { registerEditor, unregisterEditor } from '../../lib/editor-registry';
import type { Section, Annotation } from '../../../shared/domain-types';
import { invoke } from '../../lib/ipc-client';

interface SectionEditorProps {
  section: Section;
  isActive: boolean;
  onFocus: (sectionId: string) => void;
}

export function SectionEditor({ section, isActive, onFocus }: SectionEditorProps) {
  const saveContent = useStore(s => s.saveContent);
  const tags = useStore(s => s.tags);
  const highlightsVisible = useStore(s => s.highlightsVisible);
  const setSelection = useStore(s => s.setSelection);
  const clearSelection = useStore(s => s.clearSelection);
  const setSelectionToolbarPos = useStore(s => s.setSelectionToolbarPos);
  const setActiveAnnotation = useStore(s => s.setActiveAnnotation);
  const setHighlightsVisible = useStore(s => s.setHighlightsVisible);
  const setContextMenu = useStore(s => s.setContextMenu);
  const batchUpdatePositions = useStore(s => s.batchUpdatePositions);

  const annotationsRef = useRef<Annotation[]>([]);
  const contentLoadedRef = useRef(false);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const debouncedSave = useDebounce((sectionId: string, content: string) => {
    saveContent(sectionId, content);
    // Persist mapped annotation positions alongside content
    const ed = editorRef.current;
    if (!ed) return;
    const decoSet = annotationPluginKey.getState(ed.state);
    if (!decoSet) return;
    const decos = decoSet.find();
    const updates: Array<{ id: string; fromPos: number; toPos: number }> = [];
    for (const d of decos) {
      const annId = d.spec?.annotationId;
      if (!annId) continue;
      const orig = annotationsRef.current.find(a => a.id === annId);
      if (orig && (orig.fromPos !== d.from || orig.toPos !== d.to)) {
        updates.push({ id: annId, fromPos: d.from, toPos: d.to });
      }
    }
    if (updates.length > 0) {
      batchUpdatePositions(updates);
      annotationsRef.current = annotationsRef.current.map(a => {
        const u = updates.find(up => up.id === a.id);
        return u ? { ...a, fromPos: u.fromPos, toPos: u.toPos } : a;
      });
    }
  }, 1000);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      AnnotationDecoration,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (contentLoadedRef.current) {
        debouncedSave(section.id, JSON.stringify(editor.getJSON()));
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSelection(from, to);
        const coords = editor.view.coordsAtPos(from);
        setSelectionToolbarPos({ x: coords.left, y: coords.top - 40 });
      } else {
        clearSelection();
      }
    },
    onFocus: () => {
      onFocus(section.id);
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          setHighlightsVisible(false);
          setTimeout(() => setHighlightsVisible(true), 0);
          return true;
        }
        return false;
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const annotationEl = target.closest('[data-annotation-id]');
        if (annotationEl) {
          const annotationId = annotationEl.getAttribute('data-annotation-id');
          if (annotationId) {
            setActiveAnnotation(annotationId);
          }
        }
        return false;
      },
    },
  });

  // Keep editorRef current for debounced save
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Register editor in registry
  useEffect(() => {
    if (!editor) return;
    registerEditor(section.id, editor);
    return () => unregisterEditor(section.id);
  }, [editor, section.id]);

  // Load content
  useEffect(() => {
    if (!editor) return;
    let content;
    try {
      content = section.content ? JSON.parse(section.content) : undefined;
    } catch {
      content = undefined;
    }
    contentLoadedRef.current = false;
    editor.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] });
    // Small delay to avoid triggering save from setContent
    requestAnimationFrame(() => {
      contentLoadedRef.current = true;
    });
  }, [editor, section.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load and sync annotations
  useEffect(() => {
    if (!editor) return;
    invoke('annotation:list', { sectionId: section.id }).then(annotations => {
      annotationsRef.current = annotations;
      // Also update global store if this is the active section
      if (isActive) {
        useStore.setState({ annotations });
      }
      syncDecorations(annotations);
    });
  }, [editor, section.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-sync decorations when highlights toggle or tags change
  useEffect(() => {
    if (!editor) return;
    syncDecorations(annotationsRef.current);
  }, [editor, highlightsVisible, tags]); // eslint-disable-line react-hooks/exhaustive-deps

  // When this section becomes active, push its annotations to global store
  useEffect(() => {
    if (isActive && editor) {
      useStore.setState({ annotations: annotationsRef.current });
    }
  }, [isActive, editor]);

  // Re-sync when global annotations change (e.g. from SelectionToolbar or TagContextMenu)
  const globalAnnotations = useStore(s => s.annotations);
  useEffect(() => {
    if (!editor || !isActive) return;
    annotationsRef.current = globalAnnotations;
    syncDecorations(globalAnnotations);
  }, [editor, isActive, globalAnnotations]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncDecorations = useCallback(
    (annotations: Annotation[]) => {
      if (!editor) return;
      // Drop annotations whose tag no longer exists. Deleting a tag cascades its
      // annotations away in the database, but this section may still be holding them
      // in memory — and without this they would keep rendering as highlights in the
      // fallback colour until the app restarted.
      const withColors = highlightsVisible
        ? annotations.flatMap(a => {
            const tag = tags.find(t => t.id === a.tagId);
            return tag ? [{ ...a, color: tag.color }] : [];
          })
        : [];
      editor.commands.command(({ tr }) => {
        tr.setMeta('annotations', withColors);
        return true;
      });
    },
    [editor, highlightsVisible, tags]
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const annotationEl = target.closest('[data-annotation-id]');
    if (annotationEl) {
      e.preventDefault();
      const annotationId = annotationEl.getAttribute('data-annotation-id');
      if (annotationId) {
        setActiveAnnotation(annotationId);
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'annotation', annotationId });
      }
    } else if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'text-selection' });
      }
    }
  };

  return (
    <div
      className={`section-block${isActive ? ' section-block--active' : ''}`}
      onContextMenu={handleContextMenu}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
