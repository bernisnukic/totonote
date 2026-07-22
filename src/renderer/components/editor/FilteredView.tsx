import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { getEditor } from '../../lib/editor-registry';

/**
 * Filter mode's reading view.
 *
 * When tags are ticked in the Filter sidebar, this shows only their excerpts on the main
 * page — the untagged text is removed, so what's left is just the passages carrying the
 * ticked tags, in document order, several tags at once. It overlays the editors (which
 * stay mounted underneath) so it can read their live text and nothing typed is lost.
 *
 * Read-only: click an excerpt to clear the filter and jump to that passage to edit it.
 */
export function FilteredView({ filterTagIds }: { filterTagIds: Set<string> }) {
  const sections = useStore(s => s.sections);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const tags = useStore(s => s.tags);
  const clearFilters = useStore(s => s.clearFilters);
  const setActiveSection = useStore(s => s.setActiveSection);

  // The underlying editors may still be settling their content on first paint; nudge one
  // re-read shortly after mount so freshly loaded text is picked up.
  const [, bump] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => bump(n => n + 1), 150);
    return () => clearTimeout(t);
  }, []);

  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

  const groups = useMemo(() => {
    return sections
      .map(section => {
        const editor = getEditor(section.id);
        const items = documentAnnotations
          .filter(a => a.sectionId === section.id && filterTagIds.has(a.tagId))
          .sort((a, b) => a.fromPos - b.fromPos)
          .map(a => {
            let text = '';
            try {
              text = editor ? editor.state.doc.textBetween(a.fromPos, a.toPos, ' ').trim() : '';
            } catch {
              text = '';
            }
            return { id: a.id, from: a.fromPos, text, tag: tagById.get(a.tagId) };
          })
          .filter(item => item.text && item.tag);
        return { section, items };
      })
      .filter(group => group.items.length > 0);
    // Depends on the timer bump too, so a re-read after mount takes effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, documentAnnotations, filterTagIds, tagById]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const jumpTo = (sectionId: string) => {
    clearFilters();
    setActiveSection(sectionId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-section-id="${sectionId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
  };

  return (
    <div className="filtered-view">
      <div className="filtered-view__bar">
        <span>
          {total > 0
            ? `Showing ${total} tagged excerpt${total === 1 ? '' : 's'} — untagged text hidden.`
            : 'Nothing matches the ticked tags here.'}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
          Clear filter
        </button>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            None of the ticked tags appear in this document. Untick some, or clear the filter to
            see everything.
          </p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.section.id} className="filtered-view__section">
            <div className="section-header">{group.section.title}</div>
            {group.items.map(item => (
              <div
                key={item.id}
                className="filtered-excerpt"
                style={{
                  backgroundColor: `${item.tag!.color}22`,
                  borderLeft: `3px solid ${item.tag!.color}`,
                }}
                onClick={() => jumpTo(group.section.id)}
                title="Click to edit this passage"
              >
                <span className="filtered-excerpt__tag" style={{ color: item.tag!.color }}>
                  {item.tag!.name}
                </span>
                <span className="filtered-excerpt__text">{item.text}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
