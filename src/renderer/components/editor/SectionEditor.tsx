import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// v3: StarterKit now bundles Underline (and Link); Placeholder moved to @tiptap/extensions.
import { Placeholder } from '@tiptap/extensions';
import { importImageFile, imageFilesFrom } from '../../lib/image-import';
import { SizedImage } from '../../extensions/sized-image';
import { DrawingNode } from '../../extensions/drawing-node';
import { AnnotationDecoration, annotationPluginKey } from '../../extensions/annotation-decoration';
import { DocumentLink } from '../../extensions/document-link';
import { DocumentLinkPicker } from './DocumentLinkPicker';
import { useStore } from '../../stores';
import { useDebounce } from '../../hooks/useDebounce';
import { registerEditor, unregisterEditor } from '../../lib/editor-registry';
import { registerFlusher, unregisterFlusher } from '../../lib/save-registry';
import { readDrawings } from '../../lib/drawing-registry';
import { drawingsInRange } from '../../../shared/prosemirror-text';
import type { Section, Annotation } from '../../../shared/domain-types';
import { invoke } from '../../lib/ipc-client';
import { alertDialog, confirmDialog } from '../common/ConfirmDialog';
import { undoDepth } from '@tiptap/pm/history';
import { noteDocumentSteps, clearEditHistory } from '../../lib/edit-history';
import { LeadingParagraph } from '../../extensions/leading-paragraph';
import { TextSelection } from '@tiptap/pm/state';
import { shiftEndRange } from '../../lib/line-selection';

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
  const deleteAnnotation = useStore(s => s.deleteAnnotation);
  const markSectionDirty = useStore(s => s.markSectionDirty);
  const pushSnapshot = useStore(s => s.pushSnapshot);
  const historyIntervalMs = useStore(s => s.historyIntervalMs);

  const annotationsRef = useRef<Annotation[]>([]);
  /** ProseMirror's undo depth as of the last transaction, for spotting new steps. */
  const undoDepthRef = useRef(0);
  const contentLoadedRef = useRef(false);
  /** The first annotation load is the starting state, not an edit worth checkpointing. */
  const annotationsSeededRef = useRef(false);
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
  }, [saveContent, batchUpdatePositions, deleteAnnotation]);

  /** Ask before an edit throws away highlights, and say how many. */
  const confirmHighlightLoss = (count: number) =>
    confirmDialog({
      title: count === 1 ? 'Delete this highlight too?' : `Delete ${count} highlights too?`,
      message:
        count === 1
          ? 'The text you are deleting is highlighted. The highlight goes with it.'
          : `The text you are deleting carries ${count} highlights. They go with it.`,
      detail: 'Undo brings the words back, but not the tagging.',
      confirmLabel: 'Delete',
      destructive: true,
    });

  const debouncedSave = useDebounce((sectionId: string, content: string) => {
    persistSection(sectionId, content);
  }, 1000);

  // Snapshot for the History timeline, independent of saving so it fills in whether
  // auto-save is on or off. The interval is a setting: a short one lands a checkpoint in
  // the gaps between keystrokes, so the timeline grows visibly as you write, at the cost of
  // filling the 60-checkpoint cap sooner. pushSnapshot dedupes, so a pause that changed
  // nothing costs nothing.
  const debouncedSnapshot = useDebounce((sectionId: string, content: string) => {
    pushSnapshot(sectionId, content, currentAnnotationPositions(), currentDrawingStates(content));
  }, historyIntervalMs);

  /** Strokes of the drawings in this section, so a rollback restores them along with the text. */
  function currentDrawingStates(content: string) {
    try {
      const parsed = JSON.parse(content);
      const ids = drawingsInRange(parsed, 0, Number.MAX_SAFE_INTEGER);
      return readDrawings(ids);
    } catch {
      return [];
    }
  }

  /**
   * Where each highlight sits right now, straight from the live decorations.
   *
   * Recorded with every checkpoint so a restore can put the highlights back where they
   * were — positions are relative to the document they were made in, so restoring text
   * alone leaves them pointing at whatever moved into those offsets.
   */
  function currentAnnotationPositions() {
    const ed = editorRef.current;
    if (!ed) return [];
    const decos = annotationPluginKey.getState(ed.state)?.find() ?? [];
    const positions: { id: string; fromPos: number; toPos: number }[] = [];
    for (const d of decos) {
      const id = d.spec?.annotationId;
      if (id) positions.push({ id, fromPos: d.from, toPos: d.to });
    }
    return positions;
  }

  /**
   * Store each file, then insert an image node pointing at it. Sequential rather than
   * parallel so a multi-image paste lands in the order it was picked up.
   */
  const insertImages = useCallback(async (files: File[], at?: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    let pos = at;
    for (const file of files) {
      try {
        const { meta, url } = await importImageFile(file);
        const node = { type: 'image', attrs: { src: url, alt: file.name, width: meta.width } };
        const chain = ed.chain().focus();
        pos === undefined ? chain.insertContent(node).run() : chain.insertContentAt(pos, node).run();
        // Step past what was just inserted so the next image follows it.
        if (pos !== undefined) pos += 1;
      } catch (err) {
        console.error('[image import]', err);
        void alertDialog(`Could not add "${file.name}".`, err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      SizedImage,
      DrawingNode,
      AnnotationDecoration,
      LeadingParagraph,
      DocumentLink.configure({
        // Read live rather than captured, so a rename shows up in existing links, and
        // opening a link goes through the same path as clicking a document card.
        resolveTitle: id => useStore.getState().documents.find(d => d.id === id)?.title ?? null,
        onOpen: id => void useStore.getState().openDocument(id),
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (!contentLoadedRef.current) return;

      // Keep the shared undo order in step with the editor's own history. Counting its
      // depth rather than transactions matters: it groups a run of typing into one step,
      // and the two must agree about how many steps there are.
      const depth = undoDepth(editor.state);
      noteDocumentSteps(section.id, depth - undoDepthRef.current);
      undoDepthRef.current = depth;


      const content = JSON.stringify(editor.getJSON());
      // Auto-save debounces to disk; manual-save mode just flags the section dirty and
      // waits for Cmd+S. Read the flag live so toggling the setting takes effect at once.
      if (useStore.getState().autoSaveEnabled) {
        debouncedSave(section.id, content);
      } else {
        markSectionDirty(section.id);
      }
      debouncedSnapshot(section.id, content);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSelection(from, to, section.id);
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
      handleKeyDown: (view, event) => {
        // Deleting a selection that carries highlights destroys them for good — the
        // decoration collapses, the row is cleaned up, and undo brings the words back but
        // not the tagging. Worth one question first.
        if ((event.key === 'Backspace' || event.key === 'Delete') && !view.state.selection.empty) {
          const { from, to } = view.state.selection;
          // Overlap comes from the annotations themselves, not the decoration plugin —
          // its set reads as empty at moments unrelated to what is on screen. Read the
          // store rather than this editor's copy: tagging updates the store first, and
          // the copy arrives an effect later, which was long enough on a loaded CI
          // machine to delete a freshly tagged line without asking.
          // Both store lists, plus this editor's own copy: they are populated by
          // different paths and can genuinely disagree for a moment after tagging, which
          // on a loaded machine was long enough to delete a fresh highlight without
          // asking. Any of them knowing about it is enough to stop and ask.
          const state = useStore.getState();
          const seen = new Map<string, { id: string; sectionId: string; fromPos: number; toPos: number }>();
          for (const a of [...state.annotations, ...state.documentAnnotations, ...annotationsRef.current]) {
            seen.set(a.id, a);
          }
          const ids = [...seen.values()]
            .filter(a => a.sectionId === section.id && a.fromPos < to && a.toPos > from)
            .map(a => a.id);
          if (ids.length > 0) {
            event.preventDefault();
            void confirmHighlightLoss(ids.length).then(async ok => {
              if (!ok) return;
              editor?.chain().focus().deleteSelection().run();
              // Delete exactly the ones that were in the selection. Inferring it later
              // from which decorations survived looked tidier and was wrong: the plugin
              // reports an empty set at moments that have nothing to do with deletion,
              // which cost every highlight in a section on the next rollback.
              annotationsRef.current = annotationsRef.current.filter(a => !ids.includes(a.id));
              for (const id of ids) await deleteAnnotation(id);
            });
            return true;
          }
        }
        // Shift+End ran past the end of the paragraph and into the block below, so a
        // picture underneath ended up inside the selection — "I select only the text and
        // the image keeps getting selected too". Selecting both together is still
        // possible by dragging; it just isn't what Shift+End does by accident.
        if (event.key === 'End' && event.shiftKey) {
          const { state } = view;
          const range = shiftEndRange(
            state.selection.anchor,
            state.selection.head,
            state.selection.$head.end(),
          );
          if (range) {
            view.dispatch(
              state.tr
                .setSelection(TextSelection.create(state.doc, range.from, range.to))
                .scrollIntoView(),
            );
            return true;
          }
        }
        if (event.key === 'Escape') {
          // Close whatever a click on a highlight opened, which is what Escape means
          // everywhere else in the app.
          setActiveAnnotation(null);
          setContextMenu(null);
          // Nudge the decorations so a stale hover state can't linger.
          setHighlightsVisible(false);
          setTimeout(() => setHighlightsVisible(true), 0);
          return true;
        }
        return false;
      },
      // Paste or drop an image file and it goes into the database, with only a
      // totonote://media/<id> reference landing in the document.
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = imageFilesFrom((event as DragEvent).dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        // Drop where the pointer is, not wherever the caret happened to be.
        const at = view.posAtCoords({
          left: (event as DragEvent).clientX,
          top: (event as DragEvent).clientY,
        });
        void insertImages(files, at?.pos);
        return true;
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
    return () => {
      unregisterEditor(section.id);
      clearEditHistory(section.id);
    };
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
    // Seed the History timeline with the loaded state (deduped, so re-mounting is free).
    pushSnapshot(section.id, JSON.stringify(editor.getJSON()));
  }, [editor, section.id, pushSnapshot]);

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

    // Adding or removing a highlight changes the section's state without changing a
    // character, so it gets its own checkpoint — otherwise the timeline has no record that
    // the highlight ever existed, and rolling back to "the same text" would destroy it.
    if (!contentLoadedRef.current) return;
    if (!annotationsSeededRef.current) {
      annotationsSeededRef.current = true; // the initial load is the starting state
      return;
    }
    const ed = editorRef.current;
    if (ed) {
      const json = JSON.stringify(ed.getJSON());
      pushSnapshot(section.id, json, currentAnnotationPositions(), currentDrawingStates(json));
    }
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

  // A section that is not the active one still has to draw its own highlights. The effect
  // that syncs from the store only runs for the active section, so tagging text in any
  // other one stored the annotation and drew nothing — which looked exactly like the tag
  // having failed, and is why "image tagging doesn't register" turned up in more than one
  // guise. Placed after syncDecorations so it can depend on it properly.
  const documentAnnotations = useStore(s => s.documentAnnotations);
  useEffect(() => {
    if (!editor || isActive) return;
    const mine = documentAnnotations.filter(a => a.sectionId === section.id);
    annotationsRef.current = mine;
    syncDecorations(mine);
  }, [editor, isActive, documentAnnotations, section.id, syncDecorations]);


  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // A picture or a drawing could only be removed with Backspace, which meant selecting
    // it first and knowing that was the way. Offer it where people look for it.
    const mediaEl = target.closest('.resizable-image, .drawing-node');
    if (mediaEl && !target.closest('[data-annotation-id]')) {
      e.preventDefault();
      const isDrawing = mediaEl.classList.contains('drawing-node');
      void confirmDialog({
        title: isDrawing ? 'Delete this drawing?' : 'Delete this picture?',
        message: isDrawing
          ? 'The drawing and its strokes are removed from this section.'
          : 'The picture is removed from this section.',
        detail: 'You can undo this straight afterwards.',
        confirmLabel: 'Delete',
        destructive: true,
      }).then(ok => {
        if (!ok || !editor) return;
        const pos = editor.view.posAtDOM(mediaEl, 0);
        if (pos < 0) return;
        editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
      });
      return;
    }

    const annotationEl = target.closest('[data-annotation-id]');
    if (annotationEl) {
      e.preventDefault();
      const annotationId = annotationEl.getAttribute('data-annotation-id');
      if (annotationId) {
        // Deliberately *not* setActiveAnnotation: that is the left-click popover, and
        // showing it alongside the menu meant a right-click produced two things at once,
        // the second of them somewhere unrelated. The menu carries the id it needs.
        setActiveAnnotation(null);
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
      <DocumentLinkPicker editor={editor} />
    </div>
  );
}
