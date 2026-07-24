import React, { useEffect } from 'react';
import { useStore } from '../../stores';
import { InfoPanel } from './InfoPanel';

/**
 * The Info tab's tag/category page, popped out full-screen and navigable like a wiki.
 *
 * It renders the very same InfoPanel used in the sidebar, just at a comfortable reading
 * width — so navigation (clicking category headings), notes, and double-click-to-jump
 * all behave identically, without duplicating any of it. Closing it drops back to the
 * sidebar showing the same page.
 */
export function WikiView() {
  const wikiOpen = useStore(s => s.wikiOpen);
  const setWikiOpen = useStore(s => s.setWikiOpen);
  const focusedTagId = useStore(s => s.focusedTagId);
  const focusedCategoryId = useStore(s => s.focusedCategoryId);

  // Nothing to show a page for → don't stay open.
  const hasPage = Boolean(focusedTagId || focusedCategoryId);

  useEffect(() => {
    if (wikiOpen && !hasPage) setWikiOpen(false);
  }, [wikiOpen, hasPage, setWikiOpen]);

  useEffect(() => {
    if (!wikiOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWikiOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [wikiOpen, setWikiOpen]);

  if (!wikiOpen || !hasPage) return null;

  return (
    <div className="wiki-overlay">
      <div className="wiki-header">
        <span className="wiki-title">Page</span>
        <button className="help-close" onClick={() => setWikiOpen(false)} aria-label="Close page" data-tip="Close (Esc)">
          &times;
        </button>
      </div>
      <div className="wiki-body">
        <div className="wiki-content">
          <InfoPanel />
        </div>
      </div>
    </div>
  );
}
