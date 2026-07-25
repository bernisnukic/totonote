import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { mediaUrl } from '../../../shared/media-refs';
import { invoke } from '../../lib/ipc-client';
import { pageToMarkdown, pageFilename } from '../../../shared/page-markdown';
import { DrawingThumb } from './DrawingThumb';
import type { AnnotationPlacement, Category } from '../../../shared/domain-types';
import { clickable } from '../../lib/clickable';
import { excerptTextFor } from '../../lib/excerpt-text';
import { ToolbarIcon } from '../toolbar/toolbar-icons';
import { flattenCategoryTree, optionIndent } from '../../lib/category-tree';

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

/**
 * Jump to a filed excerpt — opening its document first when it lives elsewhere.
 *
 * The panel you clicked from (a tag's page or a category's page) stays open, so you can
 * click straight through a list of excerpts. It used to clear the focus here, which
 * collapsed the whole panel back to the plain view on the first click.
 */
export function usePlacementNavigation() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const openDocument = useStore(s => s.openDocument);
  const setActiveSection = useStore(s => s.setActiveSection);
  const setWikiOpen = useStore(s => s.setWikiOpen);

  return useCallback(
    async (placement: AnnotationPlacement) => {
      // Jumping to the text means leaving the wiki overlay, if it was open.
      setWikiOpen(false);
      if (placement.documentId !== activeDocumentId) {
        await openDocument(placement.documentId);
      }
      setActiveSection(placement.sectionId);
      // Two frames: one for the view switch, one for the section editors to mount.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-section-id="${placement.sectionId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
      );
    },
    [activeDocumentId, openDocument, setActiveSection, setWikiOpen],
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
  const updateAnnotation = useStore(s => s.updateAnnotation);
  const categories = useStore(s => s.categories);
  const [refiling, setRefiling] = useState(false);
  const filedCategories = useMemo(() => flattenCategoryTree(categories), [categories]);
  const filedUnder = categories.find(c => c.id === placement.categoryId);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(placement.note);
  const [editingWhen, setEditingWhen] = useState(false);
  const [whenText, setWhenText] = useState(placement.whenText);

  let excerpt = excerptTextFor(placement);
  // A picture filed on its own has no text; the thumbnail below carries the meaning, so
  // name it rather than showing a bare ellipsis.
  const imageCount = placement.imageIds.length;
  const drawingCount = placement.drawingIds.length;
  if (!excerpt && imageCount + drawingCount > 0) {
    const parts: string[] = [];
    if (imageCount) parts.push(imageCount === 1 ? 'Image' : `${imageCount} images`);
    if (drawingCount) parts.push(drawingCount === 1 ? 'Drawing' : `${drawingCount} drawings`);
    excerpt = parts.join(' + ');
  }
  excerpt = excerpt || '…';
  const display = excerpt.length > 110 ? `${excerpt.slice(0, 110)}…` : excerpt;

  const saveNote = () => {
    setEditingNote(false);
    if (note !== placement.note) updateAnnotation(placement.id, { note });
  };

  const saveWhen = () => {
    setEditingWhen(false);
    const trimmed = whenText.trim();
    if (trimmed !== placement.whenText) updateAnnotation(placement.id, { whenText: trimmed });
  };

  return (
    <div className="placement-row">
      {/* Double-click opens the passage in the document; single-click stays put so you
          can read and annotate without being yanked away. */}
      <div
        className="placement-excerpt"
        onDoubleClick={() => onNavigate(placement)}
        title="Double-click to open in the document"
      >
        {showTag && <span className="label-color-dot" style={{ backgroundColor: placement.tagColor }} />}
        <span>{display}</span>
      </div>
      {/* An excerpt that is a picture has no text of its own — show it instead. */}
      {(placement.imageIds.length > 0 || placement.drawingIds.length > 0) && (
        <div className="placement-thumbs" onDoubleClick={() => onNavigate(placement)}>
          {placement.imageIds.map(id => (
            <img key={id} className="placement-thumb" src={mediaUrl(id)} alt="" draggable={false} />
          ))}
          {placement.drawingIds.map(id => (
            <DrawingThumb key={id} drawingId={id} />
          ))}
        </div>
      )}

      <div className="placement-source">
        {showTag && <span className="placement-tag-name">{placement.tagName} · </span>}
        {placement.documentTitle} › {placement.sectionTitle}
      </div>

      {editingNote ? (
        <textarea
          className="textarea placement-note-input"
          value={note}
          autoFocus
          rows={2}
          placeholder="A note about this excerpt (not shown in the document)…"
          onChange={e => setNote(e.target.value)}
          onBlur={saveNote}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setNote(placement.note);
              setEditingNote(false);
            }
          }}
        />
      ) : note ? (
        <div className="placement-note" {...clickable(() => setEditingNote(true))} title="Click to edit this note">
          {note}
        </div>
      ) : (
        <button className="placement-note-add" onClick={() => setEditingNote(true)}>
          + note
        </button>
      )}

      {/* Where this excerpt is filed. It used to be reachable only by right-clicking the
          highlight in the document, which meant you had to go and find it first. */}
      {refiling ? (
        <select
          className="input placement-file-input"
          value={placement.categoryId ?? ''}
          autoFocus
          onChange={e => {
            void updateAnnotation(placement.id, { categoryId: e.target.value || null });
            setRefiling(false);
          }}
          onBlur={() => setRefiling(false)}
        >
          <option value="">&mdash; not filed &mdash;</option>
          {filedCategories.map(({ category, depth }) => (
            <option key={category.id} value={category.id}>
              {optionIndent(depth)}
              {category.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          className="placement-note-add placement-file"
          onClick={() => setRefiling(true)}
          title="Choose which page this excerpt is filed on"
        >
          {filedUnder ? `filed in ${filedUnder.name}` : '+ file'}
        </button>
      )}

      {/* When this happened, in the world's own words — this is what the Timeline reads. */}
      {editingWhen ? (
        <input
          className="input placement-when-input"
          value={whenText}
          autoFocus
          placeholder="Year 300 of the Third Age"
          onChange={e => setWhenText(e.target.value)}
          onBlur={saveWhen}
          onKeyDown={e => {
            if (e.key === 'Enter') saveWhen();
            if (e.key === 'Escape') {
              setWhenText(placement.whenText);
              setEditingWhen(false);
            }
          }}
        />
      ) : whenText ? (
        <div
          className="placement-when"
          {...clickable(() => setEditingWhen(true))}
          title="Click to change when this happened"
        >
          {whenText}
        </div>
      ) : (
        <button className="placement-note-add" onClick={() => setEditingWhen(true)}>
          + when
        </button>
      )}
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
  const wikiOpen = useStore(s => s.wikiOpen);
  const setWikiOpen = useStore(s => s.setWikiOpen);
  const navigate = usePlacementNavigation();

  const [placements, setPlacements] = useState<AnnotationPlacement[]>([]);
  const [sort, setSort] = useState<PlacementSort>('custom');
  // Drag reordering, only meaningful in custom order.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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

  const persistOrder = async (group: AnnotationPlacement[], ids: string[]) => {
    const categoryId = group[0]?.categoryId;
    if (!categoryId) return;
    await reorderPlacements(categoryId, ids);
    refresh();
  };

  const move = async (group: AnnotationPlacement[], index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const ids = group.map(p => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await persistOrder(group, ids);
  };

  /** Drop `dragId` where `targetId` currently sits, keeping everything else in order. */
  const dropOnto = async (group: AnnotationPlacement[], targetId: string) => {
    const from = group.findIndex(p => p.id === dragId);
    const to = group.findIndex(p => p.id === targetId);
    setDragId(null);
    setDropTargetId(null);
    if (from === -1 || to === -1 || from === to) return;
    const ids = group.map(p => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    await persistOrder(group, ids);
  };

  const renderGroup = (owner: Category, rows: AnnotationPlacement[] | undefined, heading: boolean) => {
    const sorted = sortPlacements(rows ?? [], sort);
    if (heading && sorted.length === 0) return null;
    return (
      <div key={owner.id} className="info-section">
        {heading && (
          <div
            className="info-section-title placement-subheading"
            {...clickable(() => setFocusedCategory(owner.id))}
            title="Open this page"
          >
            {owner.name} <span className="placement-count">{sorted.length}</span>
          </div>
        )}
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`placement-row-wrap${dropTargetId === p.id ? ' drop-target' : ''}${
              dragId === p.id ? ' dragging' : ''
            }`}
            draggable={sort === 'custom' && sorted.length > 1}
            onDragStart={() => setDragId(p.id)}
            onDragEnd={() => {
              setDragId(null);
              setDropTargetId(null);
            }}
            onDragOver={e => {
              if (!dragId || dragId === p.id) return;
              e.preventDefault();
              setDropTargetId(p.id);
            }}
            onDragLeave={() => setDropTargetId(t => (t === p.id ? null : t))}
            onDrop={e => {
              e.preventDefault();
              dropOnto(sorted, p.id);
            }}
          >
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

  /** Write this page out as Markdown — the only way lore currently leaves the app. */
  const exportPage = async () => {
    if (!category) return;
    const markdown = pageToMarkdown({
      title: category.name,
      breadcrumb: breadcrumb.map(c => c.name),
      placements: sortPlacements(grouped.get(categoryId) ?? [], sort),
      children: children.map(child => ({
        category: child,
        placements: sortPlacements(grouped.get(child.id) ?? [], sort),
      })),
    });
    try {
      await invoke('export:save-text', { suggestedName: pageFilename(category.name), contents: markdown });
    } catch (err) {
      console.error('[export]', err);
    }
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
                <span className="placement-breadcrumb-link" {...clickable(() => setFocusedCategory(c.id))}>
                  {c.name}
                </span>
                {' › '}
              </span>
            ))}
          </div>
        )}
        <div className="info-section-title category-page-title">
          <span>{category.name}</span>
          <span style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {/* Export stays available in the pop-out — it is the reading view, which is
                exactly where someone decides to take the page elsewhere. Only the *close*
                is hidden there, because the overlay carries its own and two close buttons
                on one page look like a bug. */}
            <button
              className="btn btn-ghost btn-sm page-action"
              onClick={exportPage}
              data-tip="Export this page as Markdown"
              aria-label="Export this page as Markdown"
            >
              {ToolbarIcon.export}
              <span>Export</span>
            </button>
            {!wikiOpen && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setWikiOpen(true)} data-tip="Open as full page" aria-label="Open as full page">&#10530;</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setFocusedCategory(null)} aria-label="Close">
                  &times;
                </button>
              </>
            )}
          </span>
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
