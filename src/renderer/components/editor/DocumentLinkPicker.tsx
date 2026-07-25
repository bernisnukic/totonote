import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useStore } from '../../stores';
import { findLinkTrigger } from '../../lib/link-trigger';

/**
 * The list that appears when you type `[[`.
 *
 * Driven by the editor's own selection rather than by keystrokes, so it stays right through
 * undo, paste and clicking elsewhere in the text — anything that moves the caret is asked
 * again whether it is still inside an unclosed `[[`.
 */

const MAX_RESULTS = 8;

interface Props {
  editor: Editor | null;
}

export function DocumentLinkPicker({ editor }: Props) {
  const documents = useStore(s => s.documents);
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const [trigger, setTrigger] = useState<{ query: string; length: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  // The handler is rebound on every keystroke otherwise; a ref keeps Enter/Escape working
  // against the current list without re-registering the listener.
  const stateRef = useRef({ trigger, highlighted, matches: [] as typeof documents });

  useEffect(() => {
    if (!editor) return;
    const check = () => {
      const { from, empty } = editor.state.selection;
      if (!empty) {
        setTrigger(null);
        return;
      }
      const $from = editor.state.selection.$from;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '￼');
      const found = findLinkTrigger(textBefore);
      setTrigger(found);
      setHighlighted(0);
      if (found) {
        const coords = editor.view.coordsAtPos(from);
        setPos({ x: coords.left, y: coords.bottom + 4 });
      }
    };
    editor.on('selectionUpdate', check);
    editor.on('update', check);
    editor.on('blur', () => setTrigger(null));
    return () => {
      editor.off('selectionUpdate', check);
      editor.off('update', check);
    };
  }, [editor]);

  const matches = useMemo(() => {
    if (!trigger) return [];
    const query = trigger.query.trim().toLowerCase();
    // Linking a document to itself is never what someone means by `[[`.
    const candidates = documents.filter(d => d.id !== activeDocumentId);
    const scored = query
      ? candidates.filter(d => d.title.toLowerCase().includes(query))
      : candidates;
    // Titles that start with what was typed are what the person is reaching for.
    return [...scored]
      .sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.title.localeCompare(b.title);
      })
      .slice(0, MAX_RESULTS);
  }, [trigger, documents, activeDocumentId]);

  stateRef.current = { trigger, highlighted, matches };

  const choose = (index: number) => {
    const { trigger: t, matches: m } = stateRef.current;
    if (!editor || !t) return;
    const target = m[index];
    if (!target) return;

    const from = editor.state.selection.from - t.length;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to: editor.state.selection.from })
      .insertDocumentLink({ documentId: target.id, label: target.title })
      .run();
    setTrigger(null);
  };

  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const { trigger: t, matches: m, highlighted: h } = stateRef.current;
      if (!t || m.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted(prev => (prev + 1) % m.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(prev => (prev - 1 + m.length) % m.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        choose(h);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTrigger(null);
      }
    };
    // Capture, so Enter picks a document instead of the editor inserting a paragraph.
    const dom = editor.view.dom;
    dom.addEventListener('keydown', onKeyDown, true);
    return () => dom.removeEventListener('keydown', onKeyDown, true);
    // `choose` is deliberately not a dependency: it reads everything it needs from the ref,
    // so re-registering the listener on every keystroke would be pure churn.
  }, [editor]);

  if (!trigger || !pos || matches.length === 0) return null;

  return (
    <div className="doc-link-picker" style={{ left: pos.x, top: pos.y }} role="listbox">
      <div className="doc-link-picker__hint">Link to a document</div>
      {matches.map((doc, i) => (
        <button
          key={doc.id}
          type="button"
          role="option"
          aria-selected={i === highlighted}
          className={`doc-link-picker__item${i === highlighted ? ' is-highlighted' : ''}`}
          // mousedown, not click: click lands after the editor has already lost focus.
          onMouseDown={e => {
            e.preventDefault();
            choose(i);
          }}
          onMouseEnter={() => setHighlighted(i)}
        >
          {doc.title}
        </button>
      ))}
    </div>
  );
}
