import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { LabelItem } from './LabelItem';
import { LabelOptionsPanel } from './LabelOptionsPanel';
import { CategoryPage, PlacementRow, usePlacementNavigation } from './CategoryPage';
import type { AnnotationPlacement, Tag } from '../../../shared/domain-types';

export function InfoPanel() {
  const activeSectionId = useStore(s => s.activeSectionId);
  const sections = useStore(s => s.sections);
  const selectedRange = useStore(s => s.selectedRange);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const categories = useStore(s => s.categories);
  const tags = useStore(s => s.tags);
  const loadCategories = useStore(s => s.loadCategories);
  const loadTags = useStore(s => s.loadTags);
  const focusedTagId = useStore(s => s.focusedTagId);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const focusedCategoryId = useStore(s => s.focusedCategoryId);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);
  const openDocument = useStore(s => s.openDocument);
  const wikiOpen = useStore(s => s.wikiOpen);
  const setWikiOpen = useStore(s => s.setWikiOpen);
  const loadPlacements = useStore(s => s.loadPlacements);
  const navigateToPlacement = usePlacementNavigation();

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagPlacements, setTagPlacements] = useState<AnnotationPlacement[]>([]);

  // The focused tag/category panel deliberately survives section changes now. It used
  // to clear whenever the active section changed, which fought with clicking an excerpt
  // to jump to its text — the jump changed the section and collapsed the panel on the
  // first click. Close it with the × or Escape instead.

  useEffect(() => {
    loadCategories();
    loadTags();
  }, [loadCategories, loadTags]);

  const activeSection = sections.find(s => s.id === activeSectionId);

  // Resolve focused tag from store
  const focusedTag = useMemo(
    () => (focusedTagId ? tags.find(t => t.id === focusedTagId) ?? null : null),
    [focusedTagId, tags]
  );

  // The focused tag's excerpts, across every document, grouped by where each is filed
  // — this is the tag's "mini wiki page".
  useEffect(() => {
    if (!focusedTagId) {
      setTagPlacements([]);
      return;
    }
    loadPlacements({ tagId: focusedTagId }).then(setTagPlacements);
  }, [focusedTagId, loadPlacements, documentAnnotations]);

  /** Documents this tag appears in, most-used first. */
  const mentionedIn = useMemo(() => {
    const byDocument = new Map<string, { documentId: string; documentTitle: string; count: number }>();
    for (const p of tagPlacements) {
      const entry = byDocument.get(p.documentId) ?? {
        documentId: p.documentId,
        documentTitle: p.documentTitle,
        count: 0,
      };
      entry.count += 1;
      byDocument.set(p.documentId, entry);
    }
    return [...byDocument.values()].sort((a, b) => b.count - a.count || a.documentTitle.localeCompare(b.documentTitle));
  }, [tagPlacements]);

  const focusedTagStats = useMemo(() => {
    if (!focusedTag) return null;
    const docs = new Set(tagPlacements.map(p => p.documentId));
    return { count: tagPlacements.length, documentCount: docs.size };
  }, [focusedTag, tagPlacements]);

  const placementsByCategory = useMemo(() => {
    const groups = new Map<string | null, AnnotationPlacement[]>();
    for (const p of tagPlacements) {
      const list = groups.get(p.categoryId) ?? [];
      list.push(p);
      groups.set(p.categoryId, list);
    }
    // Filed groups first (in category tree order), unfiled last.
    const ordered: { key: string; name: string; categoryId: string | null; rows: AnnotationPlacement[] }[] = [];
    for (const cat of categories) {
      const rows = groups.get(cat.id);
      if (rows) ordered.push({ key: cat.id, name: cat.name, categoryId: cat.id, rows });
    }
    const unfiled = groups.get(null);
    if (unfiled) ordered.push({ key: 'unfiled', name: 'Not filed', categoryId: null, rows: unfiled });
    return ordered;
  }, [tagPlacements, categories]);

  // Escape closes whichever page is focused
  useEffect(() => {
    if (!focusedTagId && !focusedCategoryId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocusedTag(null);
        setFocusedCategory(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTagId, focusedCategoryId, setFocusedTag, setFocusedCategory]);

  // --- Category wiki page ---
  if (focusedCategoryId) {
    return <CategoryPage categoryId={focusedCategoryId} />;
  }

  // --- Focused tag detail view ---
  if (focusedTag && focusedTagStats) {
    return (
      <div>
        <div className="info-section">
          <div className="info-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: focusedTag.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {focusedTag.name}
            </span>
            <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {/* In the pop-out the overlay has its own close button, so hide this one —
                  two close buttons on one page read as a bug. */}
              {!wikiOpen && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWikiOpen(true)} data-tip="Open as full page" aria-label="Open as full page">&#10530;</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFocusedTag(null)} aria-label="Close">&times;</button>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="info-section">
          <div className="info-section-title">Usage</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', margin: 0, padding: '0 var(--space-2)' }}>
            Used {focusedTagStats.count} time{focusedTagStats.count !== 1 ? 's' : ''} across {focusedTagStats.documentCount} document{focusedTagStats.documentCount !== 1 ? 's' : ''}
          </p>
        </div>

        {mentionedIn.length > 0 && (
          <div className="info-section">
            <div className="info-section-title">Mentioned in</div>
            {/* The graph shows these connections as lines; this is the same thing as a list
                you can actually click, which is what you want when chasing a name. */}
            {mentionedIn.map(doc => (
              <button
                key={doc.documentId}
                className="backlink-row"
                onClick={() => openDocument(doc.documentId)}
                title="Open this document"
              >
                <span className="backlink-row__title">{doc.documentTitle}</span>
                <span className="backlink-row__count">{doc.count}</span>
              </button>
            ))}
          </div>
        )}

        {placementsByCategory.map(group => (
          <div key={group.key} className="info-section">
            <div
              className={`info-section-title${group.categoryId ? ' placement-subheading' : ''}`}
              onClick={group.categoryId ? () => setFocusedCategory(group.categoryId) : undefined}
              title={group.categoryId ? 'Open this page' : undefined}
            >
              {group.name} <span className="placement-count">{group.rows.length}</span>
            </div>
            {group.rows.map(p => (
              <PlacementRow key={p.id} placement={p} onNavigate={navigateToPlacement} showTag={false} />
            ))}
          </div>
        ))}

        <LabelOptionsPanel key={focusedTag.id} tag={focusedTag} onClose={() => setFocusedTag(null)} hideHeader />
      </div>
    );
  }

  // --- Default annotation-based view ---

  // Get annotations for the active section
  const sectionAnnotations = documentAnnotations.filter(a => a.sectionId === activeSectionId);

  // Filter to selection range or show all section annotations
  const relevantAnnotations = selectedRange
    ? sectionAnnotations.filter(a => a.fromPos < selectedRange.to && a.toPos > selectedRange.from)
    : sectionAnnotations;

  // Dedupe by tagId and group by category
  const uniqueTagIds = new Set(relevantAnnotations.map(a => a.tagId));
  const matchingTags = tags.filter(t => uniqueTagIds.has(t.id));
  const tagsByCategory = categories
    .map(cat => ({
      category: cat,
      tags: matchingTags.filter(t => t.categoryId === cat.id),
    }))
    .filter(group => group.tags.length > 0);

  const header = selectedRange ? 'Selection' : (activeSection?.title || 'Section');

  return (
    <div>
      <div className="info-section">
        <div className="info-section-title">{header}</div>
      </div>

      {tagsByCategory.map(group => (
        <div key={group.category.id} className="info-section">
          <div className="info-section-title">{group.category.name}</div>
          <div className="label-list">
            {group.tags.map(tag => (
              <LabelItem
                key={tag.id}
                name={tag.name}
                color={tag.color}
                onClick={() => setSelectedTag(tag)}
                isActive={selectedTag?.id === tag.id}
              />
            ))}
          </div>
        </div>
      ))}

      {tagsByCategory.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-text">
            {selectedRange
              ? 'No annotations in this selection.'
              : activeSectionId
                ? 'No annotations in this section.'
                : 'Select a section to view annotations.'}
          </p>
        </div>
      )}

      {selectedTag && (
        <LabelOptionsPanel key={selectedTag.id} tag={selectedTag} onClose={() => setSelectedTag(null)} />
      )}
    </div>
  );
}
