import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useStore } from '../../stores';
import { flattenCategoryTree } from '../../lib/category-tree';
import { fuzzyMatch } from '../../lib/fuzzy-match';
import { invoke } from '../../lib/ipc-client';
import { renderSnippet } from './search-snippet';
import type { SearchHit } from '../../../shared/domain-types';
import { SidebarModeBar } from './SidebarModeBar';
import { useClickOutside } from '../../hooks/useClickOutside';
import { confirmDialog } from '../common/ConfirmDialog';
import { clickable } from '../../lib/clickable';
import { useMenuPosition } from '../../hooks/useMenuPosition';
import { sortTags, TAG_SORTS } from '../../lib/tag-sort';

/** True for anywhere the user could be typing — the editor, an input or a textarea. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return Boolean(el.closest('input, textarea, [contenteditable="true"], .tiptap'));
}

export function LeftSidebar() {
  const searchQuery = useStore(s => s.searchQuery);
  const setSearch = useStore(s => s.setSearch);
  const leftSidebarMode = useStore(s => s.leftSidebarMode);
  const documentSort = useStore(s => s.documentSort);
  const setDocumentSort = useStore(s => s.setDocumentSort);
  const activeFilters = useStore(s => s.activeFilters);
  const toggleFilter = useStore(s => s.toggleFilter);
  const clearFilters = useStore(s => s.clearFilters);
  const categories = useStore(s => s.categories);
  const tags = useStore(s => s.tags);
  const highlightsVisible = useStore(s => s.highlightsVisible);
  const setHighlightsVisible = useStore(s => s.setHighlightsVisible);
  const hiddenTagIds = useStore(s => s.hiddenTagIds);
  const toggleTagHighlight = useStore(s => s.toggleTagHighlight);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);
  const focusedTagId = useStore(s => s.focusedTagId);
  const deleteTag = useStore(s => s.deleteTag);
  const documentAnnotations = useStore(s => s.documentAnnotations);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const tagSort = useStore(s => s.tagSort);
  const setTagSort = useStore(s => s.setTagSort);
  const [exactMatch, setExactMatch] = useState(false);

  // Matches from the writing itself, which live in the database rather than in the store —
  // the search runs in the main process against a full-text index.
  const [writingHits, setWritingHits] = useState<SearchHit[]>([]);
  const [writingSearching, setWritingSearching] = useState(false);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const openDocument = useStore(s => s.openDocument);
  const setActiveSection = useStore(s => s.setActiveSection);
  const activeDocumentId = useStore(s => s.activeDocumentId);

  useEffect(() => {
    const query = searchQuery.trim();
    if (leftSidebarMode !== 'search' || query.length < 2) {
      setWritingHits([]);
      return;
    }
    let cancelled = false;
    setWritingSearching(true);
    // Debounced so a fast typist doesn't queue a query per keystroke.
    const timer = setTimeout(() => {
      invoke('search:writing', { query, workspaceId: activeWorkspaceId ?? undefined })
        .then(hits => {
          if (!cancelled) setWritingHits(hits);
        })
        .finally(() => {
          if (!cancelled) setWritingSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, leftSidebarMode, activeWorkspaceId]);

  /** Open the passage a hit points at, in whichever document it lives. */
  const goToHit = useCallback(
    async (hit: SearchHit) => {
      if (hit.documentId !== activeDocumentId) await openDocument(hit.documentId);
      setActiveSection(hit.sectionId);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-section-id="${hit.sectionId}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
      );
    },
    [activeDocumentId, openDocument, setActiveSection],
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tagId: string } | null>(null);
  const contextMenuRef = useClickOutside<HTMLDivElement>(() => setContextMenu(null));
  const tagMenuPlacement = useMenuPosition(contextMenuRef, contextMenu?.x ?? 0, contextMenu?.y ?? 0);

  const handleContextMenu = useCallback((e: React.MouseEvent, tagId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tagId });
  }, []);

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  // Collapse-all / expand-all for the search tree.
  const allCategoryIds = useMemo(() => flattenCategoryTree(categories).map(({ category }) => category.id), [categories]);
  const allExpanded = allCategoryIds.length > 0 && allCategoryIds.every(id => expandedCategories.has(id));
  const toggleExpandAll = useCallback(() => {
    setExpandedCategories(allExpanded ? new Set<string>() : new Set(allCategoryIds));
  }, [allExpanded, allCategoryIds]);

  const tagUsageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of documentAnnotations) {
      counts.set(a.tagId, (counts.get(a.tagId) || 0) + 1);
    }
    return counts;
  }, [documentAnnotations]);

  // Flat category list with depth for indentation
  const flatCategoryList = useMemo(() => {
    return flattenCategoryTree(categories);
  }, [categories]);

  // Build category→tag tree filtered by search query
  const categoryTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const match = (text: string) =>
      exactMatch ? text.toLowerCase().includes(q) : fuzzyMatch(q, text.toLowerCase());

    return flatCategoryList.map(({ category: cat, depth }) => {
      const catTags = tags.filter(t => t.categoryId === cat.id);
      const catNameMatch = q ? match(cat.name) : false;
      const matchingTags = q
        ? catTags.filter(t => match(t.name) || match(t.description))
        : catTags;
      const visible = !q || catNameMatch || matchingTags.length > 0;
      const expanded = q ? (catNameMatch || matchingTags.length > 0) : expandedCategories.has(cat.id);
      // When category name matches, show all its tags
      const displayTags = sortTags((q && catNameMatch) ? catTags : matchingTags, tagSort, tagUsageCounts);

      return { category: cat, depth, tags: catTags, displayTags, visible, expanded, matchingTagIds: new Set(matchingTags.map(t => t.id)) };
    }).filter(item => item.visible);
  }, [flatCategoryList, tags, searchQuery, expandedCategories, exactMatch, tagSort, tagUsageCounts]);

  // Get active filter count
  const activeFilterCount = Object.values(activeFilters).flat().length;

  // Flat list of visible tag IDs for arrow key navigation
  const visibleTagIds = useMemo(() => {
    if (leftSidebarMode === 'search') {
      return categoryTree.flatMap(({ displayTags, expanded }) =>
        expanded ? displayTags.map(t => t.id) : []
      );
    }
    // filter + highlight modes show all tags grouped by category
    return flatCategoryList.flatMap(({ category: cat }) =>
      tags.filter(t => t.categoryId === cat.id).map(t => t.id)
    );
  }, [leftSidebarMode, categoryTree, flatCategoryList, tags]);

  // Arrow key navigation through tags
  useEffect(() => {
    if (!focusedTagId || visibleTagIds.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      // This listener is on `document`, so without this guard it swallows the arrow
      // keys everywhere — including the editor, where it stops the caret moving at all
      // for as long as a tag stays focused.
      if (isTypingTarget(e.target)) return;
      const idx = visibleTagIds.indexOf(focusedTagId);
      // preventDefault only once we know we are actually going to navigate.
      if (idx === -1) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown'
        ? visibleTagIds[(idx + 1) % visibleTagIds.length]
        : visibleTagIds[(idx - 1 + visibleTagIds.length) % visibleTagIds.length];
      setFocusedTag(next);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedTagId, visibleTagIds, setFocusedTag]);

  const renderUsageBadge = (tagId: string) => {
    const count = tagUsageCounts.get(tagId);
    if (!count) return null;
    return <span className="tag-usage-badge">{count}</span>;
  };

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Browse</span>
      </div>
      <SidebarModeBar />

      {/* Search mode */}
      {leftSidebarMode === 'search' && (
        <div className="sidebar-panel">
          <div className="sidebar-search">
            <input
              className="sidebar-search-input"
              value={searchQuery}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your writing, categories & tags…"
              autoFocus
            />
            <button
              className={`sidebar-exact-toggle${exactMatch ? ' active' : ''}`}
              onClick={() => setExactMatch(prev => !prev)}
              title={exactMatch ? 'Exact match (click for contains)' : 'Contains (click for exact match)'}
            >
              Exact
            </button>
          </div>
          {allCategoryIds.length > 0 && (
            <div className="sidebar-tree-actions">
              <button className="sidebar-tree-action" onClick={toggleExpandAll}>
                {allExpanded ? '▾ Collapse all' : '▸ Expand all'}
              </button>
              {/* Ordering the tags within each category. Alphabetical by default — the
                  only order you can predict without looking at the list first. */}
              <select
                className="sidebar-tree-sort"
                value={tagSort}
                onChange={e => setTagSort(e.target.value as typeof tagSort)}
                aria-label="Sort tags"
                title="How the tags in each category are ordered"
              >
                {TAG_SORTS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {searchQuery.trim().length >= 2 && (
            <div className="sidebar-writing-results">
              <div className="sidebar-filter-group-label">
                In your writing{writingHits.length > 0 ? ` (${writingHits.length})` : ''}
              </div>
              {writingHits.length === 0 ? (
                <div className="sidebar-empty" style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left' }}>
                  {writingSearching ? 'Searching…' : 'No matches in your writing'}
                </div>
              ) : (
                writingHits.map(hit => (
                  <button
                    key={hit.sectionId}
                    className="sidebar-writing-hit"
                    onClick={() => goToHit(hit)}
                    title="Open this passage"
                  >
                    <span className="sidebar-writing-hit__where">
                      {hit.documentTitle} › {hit.sectionTitle}
                    </span>
                    <span className="sidebar-writing-hit__snippet">{renderSnippet(hit.snippet)}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="sidebar-results">
            {categoryTree.length > 0 ? (
              <div className="category-tree">
                {categoryTree.map(({ category, depth, displayTags, expanded, matchingTagIds }) => (
                  <div key={category.id} className="category-item">
                    <div
                      className="category-header"
                      {...clickable(() => toggleCategory(category.id))}
                      style={{ paddingLeft: `calc(var(--space-3) + ${depth * 16}px)` }}
                    >
                      <span className={`category-expand-icon${expanded ? ' expanded' : ''}`}>▶</span>
                      <span
                        className="category-name category-name-link"
                        title="View this category's page"
                        {...clickable(e => {
                          // The row toggles expansion; the name opens the compiled page.
                          e.stopPropagation();
                          setFocusedCategory(category.id);
                        })}
                      >
                        {category.name}
                      </span>
                      <span className="category-count">{displayTags.length}</span>
                    </div>
                    {expanded && (
                      <div className="category-children" style={{ paddingLeft: `${depth * 16}px` }}>
                        {displayTags.map(t => (
                          <div
                            key={t.id}
                            className={`tag-tree-item${searchQuery.trim() && !matchingTagIds.has(t.id) ? ' dimmed' : ''}${focusedTagId === t.id ? ' active' : ''}`}
                            {...clickable(() => setFocusedTag(t.id))}
                            onContextMenu={(e) => handleContextMenu(e, t.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="tag-tree-color" style={{ backgroundColor: t.color }} />
                            <span className="tag-tree-name">{t.name}</span>
                            {renderUsageBadge(t.id)}
                          </div>
                        ))}
                        {displayTags.length === 0 && (
                          <div className="sidebar-empty" style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left' }}>No tags</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="sidebar-empty">
                {searchQuery.trim() ? 'No results found' : 'No categories yet'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort mode — the whole-document sorting counterpart to Filter: the main page
          shows every tagged excerpt, in the chosen order. */}
      {leftSidebarMode === 'sort' && (
        <div className="sidebar-panel">
          <p className="sidebar-mode-hint">
            The main page lists every tagged excerpt in the document, in this order.
          </p>
          <div className="sidebar-sort-options">
            {([
              ['document', 'Document order'],
              ['newest', 'Newest first'],
              ['oldest', 'Oldest first'],
              ['tag', 'Grouped by tag'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={`sidebar-sort-btn${documentSort === key ? ' active' : ''}`}
                onClick={() => setDocumentSort(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter mode */}
      {leftSidebarMode === 'filter' && (
        <div className="sidebar-panel">
          <p className="sidebar-mode-hint">
            {activeFilterCount > 0
              ? 'The main page shows only these tags\' excerpts. Untick to add more.'
              : 'Tick tags to show only their tagged text on the main page — several at once.'}
          </p>
          {activeFilterCount > 0 && (
            <button className="sidebar-clear-btn" onClick={clearFilters}>
              Clear filters ({activeFilterCount})
            </button>
          )}
          <div className="sidebar-filter-list">
            {flatCategoryList.map(({ category: cat, depth }) => {
              const catTags = tags.filter(t => t.categoryId === cat.id);
              if (catTags.length === 0) return null;
              const selected = activeFilters[cat.id] || [];
              return (
                <div key={cat.id} className="sidebar-filter-group" style={{ paddingLeft: depth * 16 }}>
                  <div className="sidebar-filter-group-label">{cat.name}</div>
                  {catTags.map(t => (
                    <label
                      key={t.id}
                      className={`sidebar-filter-item${focusedTagId === t.id ? ' active' : ''}`}
                      onContextMenu={(e) => handleContextMenu(e, t.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={() => toggleFilter(cat.id, t.id)}
                      />
                      <span className="sidebar-filter-color" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                      {renderUsageBadge(t.id)}
                      <button
                        className="tag-details-btn"
                        title="View details"
                        onClick={(e) => {
                          // Keep the label from also toggling the checkbox.
                          e.preventDefault();
                          e.stopPropagation();
                          setFocusedTag(t.id);
                        }}
                      >
                        &#8250;
                      </button>
                    </label>
                  ))}
                </div>
              );
            })}
            {tags.length === 0 && (
              <div className="sidebar-empty">No tags created yet</div>
            )}
          </div>
        </div>
      )}

      {/* Highlight mode */}
      {leftSidebarMode === 'highlight' && (
        <div className="sidebar-panel">
          <label className="sidebar-highlight-toggle">
            <input
              type="checkbox"
              checked={highlightsVisible}
              onChange={e => setHighlightsVisible(e.target.checked)}
            />
            <span>Show all highlights</span>
          </label>
          <div className="sidebar-highlight-list">
            {flatCategoryList.map(({ category: cat, depth }) => {
              const catTags = tags.filter(t => t.categoryId === cat.id);
              if (catTags.length === 0) return null;
              return (
                <div key={cat.id} className="sidebar-highlight-group" style={{ paddingLeft: depth * 16 }}>
                  <div className="sidebar-filter-group-label">{cat.name}</div>
                  {catTags.map(t => (
                    <div
                      key={t.id}
                      className={`sidebar-highlight-item${focusedTagId === t.id ? ' active' : ''}`}
                      onContextMenu={(e) => handleContextMenu(e, t.id)}
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenTagIds.includes(t.id)}
                        onChange={() => toggleTagHighlight(t.id)}
                        title="Show this tag's highlights"
                      />
                      <span className="sidebar-filter-color" style={{ backgroundColor: t.color }} />
                      <span style={{ cursor: 'pointer' }} {...clickable(() => setFocusedTag(t.id))}>{t.name}</span>
                      {renderUsageBadge(t.id)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tag context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={tagMenuPlacement}
        >
          <div
            className="context-menu-item"
            {...clickable(() => {
              setFocusedTag(contextMenu.tagId);
              setContextMenu(null);
            })}
          >
            View Details
          </div>
          <div className="context-menu-separator" />
          <div
            className="context-menu-item danger"
            {...clickable(() => {
              const tagId = contextMenu.tagId;
              setContextMenu(null);
              void confirmDialog({
                title: 'Delete tag?',
                message: 'Delete this tag and all of its highlights?',
                confirmLabel: 'Delete',
                destructive: true,
              }).then(ok => {
                if (ok) void deleteTag(tagId);
              });
            })}
          >
            Delete
          </div>
        </div>
      )}
    </>
  );
}

/** Fuzzy match: contains OR within edit distance threshold */
