import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { invoke } from '../../lib/ipc-client';
import { useStore } from '../../stores';
import { clickable } from '../../lib/clickable';

/** Search hit: a page plus a short snippet of the line the query matched. */
interface SearchHit {
  id: string;
  title: string;
  snippet: string;
}

/** Case-insensitive search across every guide page, one best snippet per page. */
function searchGuide(query: string, titleOf: (id: string) => string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const [id, text] of Object.entries(CONTENT)) {
    const lines = text.split('\n');
    const match = lines.find(line => line.toLowerCase().includes(q));
    // Also match on the page title so "shortcuts" finds the shortcuts page even if the
    // word isn't in its body.
    if (match || titleOf(id).toLowerCase().includes(q)) {
      const raw = (match ?? '').replace(/^#+\s*/, '').replace(/[*_`>|-]/g, '').trim();
      hits.push({ id, title: titleOf(id), snippet: raw.slice(0, 120) });
    }
  }
  return hits;
}

/**
 * The user guide, inside the app.
 *
 * Pages are the same markdown files that render on GitHub — bundled at build time, so
 * the guide works offline and always describes the version actually installed. Opened
 * from the Help menu.
 */

// Vite inlines these at build time; no filesystem access at runtime.
const PAGES = import.meta.glob('../../../../docs/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const CHANGELOG = import.meta.glob('../../../../CHANGELOG.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Screenshots referenced by the docs, so the images resolve in-app too.
const IMAGES = import.meta.glob('../../../../docs/screenshots/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** "…/docs/getting-started.md" → "getting-started" */
const pageId = (path: string) => path.split('/').pop()!.replace(/\.md$/, '');

const imageByName = new Map(Object.entries(IMAGES).map(([path, url]) => [path.split('/').pop()!, url]));

const CONTENT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PAGES).map(([path, text]) => [pageId(path), text])),
  ...Object.fromEntries(Object.entries(CHANGELOG).map(([, text]) => ['CHANGELOG', text])),
};

/** Reading order for the sidebar; anything unlisted is appended. */
const ORDER = [
  'README',
  'getting-started',
  'glossary',
  'workspaces',
  'documents-and-sections',
  'tags-and-annotations',
  'categories-and-rules',
  'filing-and-graph',
  'links-and-timeline',
  'search-and-filters',
  'backup-and-restore',
  'keyboard-shortcuts',
  'faq',
  'CHANGELOG',
];

const TITLES: Record<string, string> = {
  README: 'Overview',
  CHANGELOG: "What's New",
};

function titleOf(id: string): string {
  if (TITLES[id]) return TITLES[id];
  const text = CONTENT[id] ?? '';
  const heading = text.match(/^#\s+(.+)$/m);
  return heading ? heading[1] : id.replace(/-/g, ' ');
}

export function HelpViewer() {
  const page = useStore(s => s.helpPage);
  const openHelp = useStore(s => s.openHelp);
  const closeHelp = useStore(s => s.closeHelp);
  const [query, setQuery] = useState('');
  const [pendingFind, setPendingFind] = useState('');
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // The native Help menu (main process) asks to open a page.
  useEffect(() => {
    return window.api.onMenu('menu:open-help', payload => {
      const requested = typeof payload === 'string' ? payload : 'README';
      openHelp(CONTENT[requested] ? requested : 'README');
    });
  }, [openHelp]);

  const results = useMemo(() => searchGuide(query, titleOf), [query]);

  const goTo = (id: string) => {
    // Keep the term so the page can be scrolled to it — landing at the top of a long
    // page and hunting for the phrase again is barely better than not searching.
    setPendingFind(query.trim());
    setQuery('');
    openHelp(id);
  };

  // After the page renders, find the term and bring it into view.
  useEffect(() => {
    if (!page || !pendingFind) return;
    const root = scrollRef.current;
    if (!root) return;
    const needle = pendingFind.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? '';
      const at = text.toLowerCase().indexOf(needle);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      const mark = document.createElement('mark');
      mark.className = 'help-found';
      try {
        range.surroundContents(mark);
      } catch {
        // A match straddling elements can't be wrapped; scrolling to it is still useful.
      }
      (mark.isConnected ? mark : (node.parentElement as HTMLElement))?.scrollIntoView({
        block: 'center',
      });
      break;
    }
    setPendingFind('');
  }, [page, pendingFind]);

  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomed) {
          setZoomed(null);
          return;
        }
        // Escape in the search box means "never mind that search", not "close the guide" —
        // which threw people out of the page they were reading.
        if (document.activeElement === searchRef.current) {
          if (query) {
            setQuery('');
            return;
          }
          searchRef.current?.blur();
          return;
        }
        closeHelp();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, closeHelp, zoomed, query]);

  const pages = useMemo(() => {
    const ids = Object.keys(CONTENT);
    const ordered = ORDER.filter(id => ids.includes(id));
    return [...ordered, ...ids.filter(id => !ordered.includes(id))];
  }, []);

  if (!page) return null;

  return (
    <div className="help-overlay">
      <div className="help-header">
        <span className="help-title">Help</span>
        <input
          ref={searchRef}
          className="help-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the guide…"
          aria-label="Search the guide"
        />
        <button className="help-close" onClick={closeHelp} aria-label="Close help" data-tip="Close (Esc)">
          &times;
        </button>
      </div>
      <div className="help-body">
        <nav className="help-nav">
          {query.trim().length >= 2 ? (
            <div className="help-results">
              <div className="help-results-count">
                {results.length} result{results.length === 1 ? '' : 's'}
              </div>
              {results.map(hit => (
                <button key={hit.id} className="help-result" onClick={() => goTo(hit.id)}>
                  <span className="help-result-title">{hit.title}</span>
                  {hit.snippet && <span className="help-result-snippet">{hit.snippet}</span>}
                </button>
              ))}
              {results.length === 0 && <div className="help-results-empty">No matches</div>}
            </div>
          ) : (
            pages.map(id => (
              <button
                key={id}
                className={`help-nav-item${id === page ? ' active' : ''}`}
                onClick={() => openHelp(id)}
              >
                {titleOf(id)}
              </button>
            ))
          )}
        </nav>
        <div className="help-scroll" ref={scrollRef}>
        <article className="help-content" key={page}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Doc links are relative between markdown files — turn them into
              // in-app navigation rather than dead hrefs.
              a: ({ href, children }) => {
                const target = href ?? '';
                if (target.endsWith('.md') || target.startsWith('./')) {
                  const id = target.split('/').pop()!.replace(/\.md.*$/, '');
                  if (CONTENT[id]) {
                    return (
                      <a
                        href="#"
                        onClick={e => {
                          e.preventDefault();
                          openHelp(id);
                        }}
                      >
                        {children}
                      </a>
                    );
                  }
                }
                if (/^https?:/.test(target)) {
                  return (
                    <a
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        // Only GitHub links are allowed through by the main process.
                        invoke('app:open-external', { url: target }).catch(() => undefined);
                      }}
                    >
                      {children}
                    </a>
                  );
                }
                return <span>{children}</span>;
              },
              img: ({ src, alt }) => {
                const name = typeof src === 'string' ? src.split('/').pop() : undefined;
                const url = name ? imageByName.get(name) : undefined;
                if (!url) return null;
                // Screenshots are shrunk to the column width, which makes the small print
                // in them unreadable. Click to see one full size.
                return (
                  <img
                    src={url}
                    alt={alt ?? ''}
                    className="help-image"
                    {...clickable(() => setZoomed({ src: url, alt: alt ?? '' }), {
                      label: alt ? `Enlarge: ${alt}` : 'Enlarge this picture',
                    })}
                  />
                );
              },
            }}
          >
            {CONTENT[page]}
          </ReactMarkdown>
        </article>
        </div>
      </div>

      {zoomed && (
        <div
          className="help-zoom"
          {...clickable(() => setZoomed(null), { label: 'Close the enlarged picture' })}
        >
          <img src={zoomed.src} alt={zoomed.alt} />
        </div>
      )}
    </div>
  );
}
