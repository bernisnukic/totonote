import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// v3: StarterKit now bundles Underline (and Link); Placeholder moved to @tiptap/extensions.
import { Placeholder } from '@tiptap/extensions';
import { AnnotationDecoration, annotationPluginKey } from '../../extensions/annotation-decoration';
import { useStore } from '../../stores';
import { useDebounce } from '../../hooks/useDebounce';
import { registerEditor, unregisterEditor } from '../../lib/editor-registry';
import { registerFlusher, unregisterFlusher } from '../../lib/save-registry';
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
  const hiddenTagIds = useStore(s => s.hiddenTagIds);
  const setSelection = useStore(s => s.setSelection);
  const clearSelection = useStore(s => s.clearSelection);
  const setSelectionToolbarPos = useStore(s => s.setSelectionToolbarPos);
  const setActiveAnnotation = useStore(s => s.setActiveAnnotation);
  const setHighlightsVisible = useStore(s => s.setHighlightsVisible);
  const setContextMenu = useStore(s => s.setContextMenu);
  const batchUpdatePositions = useStore(s => s.batchUpdatePositions);
  const markSectionDirty = useStore(s => s.markSectionDirty);

  const annotationsRef = useRef<Annotation[]>([]);
  const contentLoadedRef = useRef(false);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // Persist this section now: its content plus any annotation positions that moved with
  // edits. Used by both the auto-save debounce and manual save (Cmd+S / save-and-quit).
  const persistSection = useCallback((sectionId: string, content: string) => {
    const promise = saveContent(sectionId, content);
    const ed = editorRef.current;
    if (ed) {
      const decoSet = annotationPluginKey.getState(ed.state);
      const decos = decoSet?.find() ?? [];
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
    }
    return promise;
  }, [saveContent, batchUpdatePositions]);

  const debouncedSave = useDebounce((sectionId: string, content: string) => {
    persistSection(sectionId, content);
  }, 1000);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      AnnotationDecoration,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (!contentLoadedRef.current) return;
      const content = JSON.stringify(editor.getJSON());
      // Auto-save debounces to disk; manual-save mode just flags the section dirty and
      // waits for Cmd+S. Read the flag live so toggling the setting takes effect at once.
      if (useStore.getState().autoSaveEnabled) {
        debouncedSave(section.id, content);
      } else {
        markSectionDirty(section.id);
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

  // Register a manual-save flusher so Cmd+S / save-and-quit can persist this section on
  // demand (content + annotation positions) even with auto-save off.
  useEffect(() => {
    registerFlusher(section.id, () => {
      const ed = editorRef.current;
      if (ed && contentLoadedRef.current) return persistSection(section.id, JSON.stringify(ed.getJSON()));
    });
    return () => unregisterFlusher(section.id);
  }, [section.id, persistSection]);

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
    // v3 emits an update from setContent by default; suppress it so loading a section's
    // saved content never counts as an edit (which would trigger a spurious save).
    editor.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] }, {
      emitUpdate: false,
    });
    // Small delay to avoid triggering save from setContent
    requestAnimationFrame(() => {
      contentLoadedRef.current = true;
    });
  }, [editor, section.id]);

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
  }, [editor, section.id]);

  // Re-sync decorations when highlights toggle, per-tag visibility or tags change
  useEffect(() => {
    if (!editor) return;
    syncDecorations(annotationsRef.current);
  }, [editor, highlightsVisible, hiddenTagIds, tags]);

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
  }, [editor, isActive, globalAnnotations]);

  const syncDecorations = useCallback(
    (annotations: Annotation[]) => {
      if (!editor) return;
      // Drop annotations whose tag no longer exists. Deleting a tag cascades its
      // annotations away in the database, but this section may still be holding them
      // in memory — and without this they would keep rendering as highlights in the
      // fallback colour until the app restarted.
      const withColors = highlightsVisible
        ? annotations.flatMap(a => {
            if (hiddenTagIds.includes(a.tagId)) return [];
            const tag = tags.find(t => t.id === a.tagId);
            return tag ? [{ ...a, color: tag.color }] : [];
          })
        : [];
      editor.commands.command(({ tr }) => {
        tr.setMeta('annotations', withColors);
        return true;
      });
    },
    [editor, highlightsVisible, tags, hiddenTagIds]
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
