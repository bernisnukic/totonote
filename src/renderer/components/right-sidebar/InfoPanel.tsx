import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../../stores';
import { LabelItem } from './LabelItem';
import { LabelOptionsPanel } from './LabelOptionsPanel';
import { getEditor } from '../../lib/editor-registry';
import type { Tag } from '../../../shared/domain-types';

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
  const setActiveSection = useStore(s => s.setActiveSection);

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Clear focused tag when active section changes
  const prevSectionId = useRef(activeSectionId);
  useEffect(() => {
    if (prevSectionId.current !== activeSectionId && focusedTagId) {
      setFocusedTag(null);
    }
    prevSectionId.current = activeSectionId;
  }, [activeSectionId, focusedTagId, setFocusedTag]);

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

  // Stats for focused tag
  const focusedTagStats = useMemo(() => {
    if (!focusedTag) return null;
    const matching = documentAnnotations.filter(a => a.tagId === focusedTag.id);
    const sectionIds = new Set(matching.map(a => a.sectionId));
    return { count: matching.length, sectionCount: sectionIds.size };
  }, [focusedTag, documentAnnotations]);

  // Annotation list grouped by section for focused tag
  const annotationsBySection = useMemo(() => {
    if (!focusedTag) return [];
    const matching = documentAnnotations.filter(a => a.tagId === focusedTag.id);
    const groups = new Map<string, typeof matching>();
    for (const ann of matching) {
      const list = groups.get(ann.sectionId) || [];
      list.push(ann);
      groups.set(ann.sectionId, list);
    }
    return Array.from(groups.entries()).map(([sectionId, annotations]) => {
      const section = sections.find(s => s.id === sectionId);
      return { sectionId, sectionTitle: section?.title || 'Untitled', annotations };
    });
  }, [focusedTag, documentAnnotations, sections]);

  // Navigate to annotation's section
  const navigateToAnnotation = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    setFocusedTag(null);
    // Small delay to allow React to re-render before scrolling
    requestAnimationFrame(() => {
      document.querySelector(`[data-section-id="${sectionId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [setActiveSection, setFocusedTag]);

  // Escape key to close focused tag
  useEffect(() => {
    if (!focusedTagId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocusedTag(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTagId, setFocusedTag]);

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
            <button className="btn btn-ghost btn-sm" onClick={() => setFocusedTag(null)}>&times;</button>
          </div>
        </div>

        <div className="info-section">
          <div className="info-section-title">Usage</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', margin: 0, padding: '0 var(--space-2)' }}>
            Used {focusedTagStats.count} time{focusedTagStats.count !== 1 ? 's' : ''} across {focusedTagStats.sectionCount} section{focusedTagStats.sectionCount !== 1 ? 's' : ''}
          </p>
        </div>

        {annotationsBySection.length > 0 && (
          <div className="info-section">
            <div className="info-section-title">Annotations</div>
            {annotationsBySection.map(({ sectionId, sectionTitle, annotations }) => (
              <div key={sectionId} style={{ marginBottom: 'var(--space-2)' }}>
                <div className="annotation-list-section-title">{sectionTitle}</div>
                {annotations.map(ann => {
                  const editor = getEditor(ann.sectionId);
                  let snippet = '...';
                  try {
                    if (editor) {
                      const text = editor.state.doc.textBetween(ann.fromPos, ann.toPos, ' ');
                      snippet = text.length > 50 ? text.slice(0, 50) + '…' : text;
                    }
                  } catch {
                    snippet = '...';
                  }
                  return (
                    <div
                      key={ann.id}
                      className="annotation-list-item"
                      onClick={() => navigateToAnnotation(sectionId)}
                    >
                      {snippet}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

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
