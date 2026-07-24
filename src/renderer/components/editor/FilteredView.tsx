import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { getEditor } from '../../lib/editor-registry';
import type { ExcerptSort } from '../../stores/filter-slice';
import { arrangeExcerpts } from '../../lib/excerpt-arrange';

/**
 * A reading view over the document's tagged excerpts — the whole-document counterpart to
 * the Info tab's per-tag pages. It overlays the editors (which stay mounted underneath)
 * so it can read their live text and nothing typed is lost.
 *
 * Two modes, chosen by the sidebar:
 *   - **Filter** (`filterTagIds` given): only those tags' excerpts, in document order,
 *     grouped by section. Untagged text is hidden.
 *   - **Sort** (`filterTagIds` omitted): *every* tagged excerpt, ordered by `sort` —
 *     document order and by-tag are grouped; the date orders are one flat list.
 *
 * Double-click an excerpt to clear and jump to that passage in the document.
 */
interface FilteredViewProps {
  /** Filter mode: only these tags. Omit for Sort mode (all tags). */
  filterTagIds?: Set<string>;
  /** Sort mode order. Filter mode is always document order. */
  sort?: ExcerptSort;
}

interface ExcerptItem {
  id: string;
  from: number;
  text: string;
  createdAt: string;
  tagName: string;
  tagColor: string;
  sectionId: string;
  sectionTitle: string;
  sectionSortOrder: number;
}

export function FilteredView({ filterTagIds, sort = 'document' }: FilteredViewProps) {
  const sections = useStore(s => s.sections);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const tags = useStore(s => s.tags);
  const clearFilters = useStore(s => s.clearFilters);
  const setLeftSidebarMode = useStore(s => s.setLeftSidebarMode);
  const setActiveSection = useStore(s => s.setActiveSection);

  // The underlying editors may still be settling their content on first paint; bump once
  // after mount (and depend on `tick`) so a re-read picks up their text.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setTick(n => n + 1), 150);
    return () => clearTimeout(t);
  }, []);

  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const sectionById = useMemo(() => new Map(sections.map(s => [s.id, s])), [sections]);

  const items = useMemo<ExcerptItem[]>(() => {
    const out: ExcerptItem[] = [];
    for (const a of documentAnnotations) {
      if (filterTagIds && !filterTagIds.has(a.tagId)) continue;
      const tag = tagById.get(a.tagId);
      const section = sectionById.get(a.sectionId);
      if (!tag || !section) continue;
      const editor = getEditor(a.sectionId);
      let text = '';
      try {
        text = editor ? editor.state.doc.textBetween(a.fromPos, a.toPos, ' ').trim() : '';
      } catch {
        text = '';
      }
      if (!text) continue;
      out.push({
        id: a.id,
        from: a.fromPos,
        text,
        createdAt: a.createdAt,
        tagName: tag.name,
        tagColor: tag.color,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionSortOrder: section.sortOrder,
      });
    }
    return out;
  }, [documentAnnotations, filterTagIds, tagById, sectionById, tick]);

  // Ordering/grouping is pure — see lib/excerpt-arrange (unit-tested there).
  const { flat, groups } = useMemo(() => arrangeExcerpts(items, sort), [items, sort]);

  const total = items.length;
  const isFilter = Boolean(filterTagIds);
  // The group heading already names the tag in by-tag mode; elsewhere show it per excerpt.
  const showTag = sort !== 'tag';
  // The section heading already names the source when grouped by section (document order);
  // in the flat date sorts and by-tag grouping, the excerpts are mixed, so label each.
  const showSource = sort !== 'document';

  const jumpTo = (sectionId: string) => {
    // Dismiss whichever overlay is up. Filter mode is driven by ticked tags (clear them);
    // Sort mode is driven by the sidebar mode itself, so leave it back to Search — clearing
    // filters alone wouldn't take the Sort overlay down.
    if (filterTagIds) clearFilters();
    else setLeftSidebarMode('search');
    setActiveSection(sectionId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-section-id="${sectionId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
  };

  const renderExcerpt = (item: ExcerptItem) => (
    <div
      key={item.id}
      className="filtered-excerpt"
      style={{ backgroundColor: `${item.tagColor}22`, borderLeft: `3px solid ${item.tagColor}` }}
      onDoubleClick={() => jumpTo(item.sectionId)}
      title="Double-click to open in the document"
    >
      {showTag && (
        <span className="filtered-excerpt__tag" style={{ color: item.tagColor }}>
          {item.tagName}
        </span>
      )}
      <span className="filtered-excerpt__text">{item.text}</span>
      {showSource && <span className="filtered-excerpt__source">{item.sectionTitle}</span>}
    </div>
  );

  return (
    <div className="filtered-view">
      <div className="filtered-view__bar">
        <span>
          {total === 0
            ? isFilter
              ? 'Nothing matches the ticked tags here.'
              : 'No tagged text in this document yet.'
            : isFilter
              ? `Showing ${total} tagged excerpt${total === 1 ? '' : 's'} — untagged text hidden.`
              : `All ${total} tagged excerpt${total === 1 ? '' : 's'}, ${sortLabel(sort)}.`}
        </span>
        {isFilter && (
          <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
            Clear filter
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            {isFilter
              ? 'None of the ticked tags appear in this document. Untick some, or clear the filter to see everything.'
              : 'Tag some text — select a passage and pick a tag — and it will show up here.'}
          </p>
        </div>
      ) : flat ? (
        <div className="filtered-view__section">{flat.map(renderExcerpt)}</div>
      ) : (
        groups!.map(group => (
          <div key={group.key} className="filtered-view__section">
            <div className="section-header">{group.label}</div>
            {group.items.map(renderExcerpt)}
          </div>
        ))
      )}
    </div>
  );
}

function sortLabel(sort: ExcerptSort): string {
  switch (sort) {
    case 'newest':
      return 'newest first';
    case 'oldest':
      return 'oldest first';
    case 'tag':
      return 'grouped by tag';
    default:
      return 'in document order';
  }
}
