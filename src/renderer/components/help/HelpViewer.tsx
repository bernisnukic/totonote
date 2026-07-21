import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { invoke } from '../../lib/ipc-client';

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
  'documents-and-sections',
  'tags-and-annotations',
  'categories-and-rules',
  'filing-and-graph',
  'search-and-filters',
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
  const [page, setPage] = useState<string | null>(null);

  useEffect(() => {
    return window.api.onMenu('menu:open-help', payload => {
      const requested = typeof payload === 'string' ? payload : 'README';
      setPage(CONTENT[requested] ? requested : 'README');
    });
  }, []);

  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPage(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page]);

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
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(null)} aria-label="Close help">
          &times;
        </button>
      </div>
      <div className="help-body">
        <nav className="help-nav">
          {pages.map(id => (
            <button
              key={id}
              className={`help-nav-item${id === page ? ' active' : ''}`}
              onClick={() => setPage(id)}
            >
              {titleOf(id)}
            </button>
          ))}
        </nav>
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
                          setPage(id);
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
                return url ? <img src={url} alt={alt ?? ''} /> : null;
              },
            }}
          >
            {CONTENT[page]}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
