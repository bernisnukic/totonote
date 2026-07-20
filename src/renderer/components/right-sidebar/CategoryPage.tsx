import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { getEditor } from '../../lib/editor-registry';
import type { AnnotationPlacement, Category } from '../../../shared/domain-types';

export type PlacementSort = 'custom' | 'newest' | 'oldest' | 'document';

const SORT_OPTIONS: { key: PlacementSort; label: string }[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'document', label: 'Document order' },
];

export function sortPlacements(rows: AnnotationPlacement[], sort: PlacementSort): AnnotationPlacement[] {
  const sorted = [...rows];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'document':
      return sorted.sort(
        (a, b) =>
          a.documentTitle.localeCompare(b.documentTitle) ||
          a.sectionSortOrder - b.sectionSortOrder ||
          a.fromPos - b.fromPos,
      );
    default:
      // Rows arrive from the repo already in placement order.
      return sorted;
  }
}

/** Jump to a filed excerpt — opening its document first when it lives elsewhere. */
export function usePlacementNavigation() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const openDocument = useStore(s => s.openDocument);
  const setActiveSection = useStore(s => s.setActiveSection);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);

  return useCallback(
    async (placement: AnnotationPlacement) => {
      if (placement.documentId !== activeDocumentId) {
        await openDocument(placement.documentId);
      }
      setActiveSection(placement.sectionId);
      setFocusedTag(null);
      setFocusedCategory(null);
      // Two frames: one for the view switch, one for the section editors to mount.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-section-id="${placement.sectionId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
      );
    },
    [activeDocumentId, openDocument, setActiveSection, setFocusedTag, setFocusedCategory],
  );
}

export function PlacementRow({
  placement,
  onNavigate,
  showTag = true,
}: {
  placement: AnnotationPlacement;
  onNavigate: (p: AnnotationPlacement) => void;
  showTag?: boolean;
}) {
  // Server excerpts come from persisted content, which trails the debounced save by up
  // to a second — an excerpt filed moments ago would show as blank. If the section is
  // open in an editor, read the text live instead.
  let excerpt = placement.excerpt;
  if (!excerpt) {
    const editor = getEditor(placement.sectionId);
    if (editor) {
      try {
        excerpt = editor.state.doc.textBetween(placement.fromPos, placement.toPos, ' ').trim();
      } catch {
        excerpt = '';
      }
    }
  }
  excerpt = excerpt || '…';
  const display = excerpt.length > 110 ? `${excerpt.slice(0, 110)}…` : excerpt;
  return (
    <div className="placement-row" onClick={() => onNavigate(placement)} title={excerpt}>
      <div className="placement-excerpt">
        {showTag && <span className="label-color-dot" style={{ backgroundColor: placement.tagColor }} />}
        <span>{display}</span>
      </div>
      <div className="placement-source">
        {showTag && <span className="placement-tag-name">{placement.tagName} · </span>}
        {placement.documentTitle} › {placement.sectionTitle}
      </div>
    </div>
  );
}

interface CategoryPageProps {
  categoryId: string;
}

/**
 * The compiled "wiki page" for one category: every excerpt filed directly under it,
 * then one section per child category with the excerpts filed there. Clicking a child
 * heading drills into that child's own page.
 */
export function CategoryPage({ categoryId }: CategoryPageProps) {
  const categories = useStore(s => s.categories);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const loadPlacements = useStore(s => s.loadPlacements);
  const reorderPlacements = useStore(s => s.reorderPlacements);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);
  const navigate = usePlacementNavigation();

  const [placements, setPlacements] = useState<AnnotationPlacement[]>([]);
  const [sort, setSort] = useState<PlacementSort>('custom');

  const category = categories.find(c => c.id === categoryId);
  const children = useMemo(
    () => categories.filter(c => c.parentId === categoryId),
    [categories, categoryId],
  );

  const breadcrumb = useMemo(() => {
    const chain: Category[] = [];
    let current = category?.parentId ?? null;
    while (current) {
      const parent = categories.find(c => c.id === current);
      if (!parent) break;
      chain.unshift(parent);
      current = parent.parentId;
    }
    return chain;
  }, [category, categories]);

  const refresh = useCallback(() => {
    const ids = [categoryId, ...children.map(c => c.id)];
    loadPlacements({ categoryIds: ids }).then(setPlacements);
  }, [categoryId, children, loadPlacements]);

  // documentAnnotations changes whenever an annotation is created, refiled or deleted
  // in the open document — the interactive cases that should update an open page.
  useEffect(() => {
    refresh();
  }, [refresh, documentAnnotations]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, AnnotationPlacement[]>();
    for (const p of placements) {
      if (!p.categoryId) continue;
      const list = byCategory.get(p.categoryId) ?? [];
      list.push(p);
      byCategory.set(p.categoryId, list);
    }
    return byCategory;
  }, [placements]);

  const move = async (group: AnnotationPlacement[], index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const ids = group.map(p => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderPlacements(group[0].categoryId!, ids);
    refresh();
  };

  const renderGroup = (owner: Category, rows: AnnotationPlacement[] | undefined, heading: boolean) => {
    const sorted = sortPlacements(rows ?? [], sort);
    if (heading && sorted.length === 0) return null;
    return (
      <div key={owner.id} className="info-section">
        {heading && (
          <div
            className="info-section-title placement-subheading"
            onClick={() => setFocusedCategory(owner.id)}
            title="Open this page"
          >
            {owner.name} <span className="placement-count">{sorted.length}</span>
          </div>
        )}
        {sorted.map((p, i) => (
          <div key={p.id} className="placement-row-wrap">
            <PlacementRow placement={p} onNavigate={navigate} />
            {sort === 'custom' && sorted.length > 1 && (
              <div className="placement-reorder">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={i === 0}
                  onClick={() => move(sorted, i, -1)}
                  title="Move up"
                >
                  &#9650;
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(sorted, i, 1)}
                  title="Move down"
                >
                  &#9660;
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!category) return null;
  const directRows = grouped.get(categoryId) ?? [];
  const hasAnything = placements.length > 0;

  return (
    <div className="category-page">
      <div className="info-section">
        {breadcrumb.length > 0 && (
          <div className="placement-breadcrumb">
            {breadcrumb.map(c => (
              <span key={c.id}>
                <span className="placement-breadcrumb-link" onClick={() => setFocusedCategory(c.id)}>
                  {c.name}
                </span>
                {' › '}
              </span>
            ))}
          </div>
        )}
        <div className="info-section-title category-page-title">
          <span>{category.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFocusedCategory(null)}>
            &times;
          </button>
        </div>
      </div>

      {hasAnything && (
        <div className="placement-sort-bar">
          {SORT_OPTIONS.map(o => (
            <button
              key={o.key}
              className={`placement-sort-btn${sort === o.key ? ' active' : ''}`}
              onClick={() => setSort(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {directRows.length > 0 && renderGroup(category, directRows, false)}

      {children.map(child => renderGroup(child, grouped.get(child.id), true))}

      {!hasAnything && (
        <div className="empty-state">
          <p className="empty-state-text">
            Nothing filed here yet. Right-click a highlight and choose{' '}
            <strong>File under…</strong>, or pick a category while tagging a selection.
          </p>
        </div>
      )}
    </div>
  );
}
