import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { invoke } from '../../lib/ipc-client';
import { parseWhen, sortByWhen, groupByWhen } from '../../../shared/when';
import { clickable } from '../../lib/clickable';
import { excerptTextFor } from '../../lib/excerpt-text';
import type { AnnotationPlacement } from '../../../shared/domain-types';

/**
 * Everything that has a "when" on it, in order.
 *
 * A world's history is written down in fragments, scattered across whichever document
 * happened to be open — this is the one place they line up. Only excerpts that have been
 * given a date appear; anything given one that has no number in it ("long ago") collects at
 * the end rather than being silently dropped.
 */
export function TimelineView() {
  const setTimelineOpen = useStore(s => s.setTimelineOpen);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const openDocument = useStore(s => s.openDocument);
  const setActiveSection = useStore(s => s.setActiveSection);
  const [events, setEvents] = useState<AnnotationPlacement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    invoke('annotation:timeline', { workspaceId: activeWorkspaceId ?? undefined })
      .then(rows => {
        if (current) setEvents(rows);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTimelineOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setTimelineOpen]);

  const groups = useMemo(() => {
    const dated = events.map(item => ({ when: parseWhen(item.whenText), item }));
    // Two things at the same moment keep a stable, meaningful order: by document, then by
    // where they sit in it.
    return groupByWhen(
      sortByWhen(
        dated,
        (a, b) =>
          a.documentTitle.localeCompare(b.documentTitle) ||
          a.sectionSortOrder - b.sectionSortOrder ||
          a.fromPos - b.fromPos,
      ),
    );
  }, [events]);

  const goTo = async (event: AnnotationPlacement) => {
    setTimelineOpen(false);
    await openDocument(event.documentId);
    setActiveSection(event.sectionId);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-section-id="${event.sectionId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
  };

  return (
    <div className="timeline-overlay">
      <div className="timeline-header">
        <h2 className="timeline-title">Timeline</h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setTimelineOpen(false)}
          aria-label="Close"
          title="Close"
        >
          &times;
        </button>
      </div>

      {loading ? (
        <p className="timeline-empty">Reading the history…</p>
      ) : groups.length === 0 ? (
        <div className="timeline-empty">
          <p>Nothing is dated yet.</p>
          <p className="input-hint">
            Give a highlight a “When” in the right sidebar — “Year 300 of the Third Age” works
            as well as “1885-03-12” — and it will show up here.
          </p>
        </div>
      ) : (
        <ol className="timeline-list">
          {groups.map(group => (
            <li key={group.label} className="timeline-moment">
              <div className="timeline-moment__when">{group.label}</div>
              <div className="timeline-moment__events">
                {group.items.map(event => (
                  <div
                    key={event.id}
                    className="timeline-event"
                    style={{ borderLeftColor: event.tagColor }}
                    {...clickable(() => void goTo(event), {
                      label: `Go to this passage in ${event.documentTitle}`,
                    })}
                  >
                    <div className="timeline-event__text">{excerptTextFor(event) || '(no text)'}</div>
                    <div className="timeline-event__meta">
                      <span className="timeline-event__tag" style={{ color: event.tagColor }}>
                        {event.tagName}
                      </span>
                      <span>
                        {event.documentTitle} · {event.sectionTitle}
                      </span>
                    </div>
                    {event.note && <div className="timeline-event__note">{event.note}</div>}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
