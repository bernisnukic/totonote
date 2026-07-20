import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useStore } from '../../stores';
import { flattenCategoryTree } from '../../lib/category-tree';
import { SidebarModeBar } from './SidebarModeBar';
import { CategoryTree } from './CategoryTree';
import { useClickOutside } from '../../hooks/useClickOutside';

export function LeftSidebar() {
  const searchQuery = useStore(s => s.searchQuery);
  const setSearch = useStore(s => s.setSearch);
  const leftSidebarMode = useStore(s => s.leftSidebarMode);
  const sortOrder = useStore(s => s.sortOrder);
  const setSortOrder = useStore(s => s.setSortOrder);
  const activeFilters = useStore(s => s.activeFilters);
  const toggleFilter = useStore(s => s.toggleFilter);
  const clearFilters = useStore(s => s.clearFilters);
  const categories = useStore(s => s.categories);
  const tags = useStore(s => s.tags);
  const highlightsVisible = useStore(s => s.highlightsVisible);
  const setHighlightsVisible = useStore(s => s.setHighlightsVisible);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const focusedTagId = useStore(s => s.focusedTagId);
  const deleteTag = useStore(s => s.deleteTag);
  const documentAnnotations = useStore(s => s.documentAnnotations);
  const sectionTags = useStore(s => s.sectionTags);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [exactMatch, setExactMatch] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tagId: string } | null>(null);
  const contextMenuRef = useClickOutside<HTMLDivElement>(() => setContextMenu(null));

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

  // Scoped usage: compute which tags are used in the current document
  const usedTagIds = useMemo(() => {
    return new Set([
      ...documentAnnotations.map(a => a.tagId),
      ...sectionTags.map(st => st.tagId),
    ]);
  }, [documentAnnotations, sectionTags]);

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
      const displayTags = (q && catNameMatch) ? catTags : matchingTags;

      return { category: cat, depth, tags: catTags, displayTags, visible, expanded, matchingTagIds: new Set(matchingTags.map(t => t.id)) };
    }).filter(item => item.visible);
  }, [flatCategoryList, tags, searchQuery, expandedCategories, exactMatch]);

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
      e.preventDefault();
      const idx = visibleTagIds.indexOf(focusedTagId);
      if (idx === -1) return;
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
              placeholder="Search categories & tags..."
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
          <div className="sidebar-results">
            {categoryTree.length > 0 ? (
              <div className="category-tree">
                {categoryTree.map(({ category, depth, displayTags, expanded, matchingTagIds }) => (
                  <div key={category.id} className="category-item">
                    <div
                      className="category-header"
                      onClick={() => toggleCategory(category.id)}
                      style={{ paddingLeft: `calc(var(--space-3) + ${depth * 16}px)` }}
                    >
                      <span className={`category-expand-icon${expanded ? ' expanded' : ''}`}>▶</span>
                      <span className="category-name">{category.name}</span>
                      <span className="category-count">{displayTags.length}</span>
                    </div>
                    {expanded && (
                      <div className="category-children" style={{ paddingLeft: `${depth * 16}px` }}>
                        {displayTags.map(t => (
                          <div
                            key={t.id}
                            className={`tag-tree-item${searchQuery.trim() && !matchingTagIds.has(t.id) ? ' dimmed' : ''}${focusedTagId === t.id ? ' active' : ''}`}
                            onClick={() => setFocusedTag(t.id)}
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

      {/* Sort mode */}
      {leftSidebarMode === 'sort' && (
        <div className="sidebar-panel">
          <div className="sidebar-sort-options">
            {([
              ['name-asc', 'Name A-Z'],
              ['name-desc', 'Name Z-A'],
              ['date-asc', 'Date (Oldest)'],
              ['date-desc', 'Date (Newest)'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={`sidebar-sort-btn${sortOrder === key ? ' active' : ''}`}
                onClick={() => setSortOrder(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sidebar-content">
            <CategoryTree />
          </div>
        </div>
      )}

      {/* Filter mode */}
      {leftSidebarMode === 'filter' && (
        <div className="sidebar-panel">
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
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.preventDefault(); setFocusedTag(t.id); }}
                      >{t.name}</span>
                      {renderUsageBadge(t.id)}
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
                      onClick={() => setFocusedTag(t.id)}
                      onContextMenu={(e) => handleContextMenu(e, t.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="sidebar-filter-color" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
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
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              setFocusedTag(contextMenu.tagId);
              setContextMenu(null);
            }}
          >
            View Details
          </div>
          <div className="context-menu-separator" />
          <div
            className="context-menu-item danger"
            onClick={() => {
              if (window.confirm('Delete this tag and all its annotations?')) {
                deleteTag(contextMenu.tagId);
              }
              setContextMenu(null);
            }}
          >
            Delete
          </div>
        </div>
      )}
    </>
  );
}

/** Fuzzy match: contains OR within edit distance threshold */
function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  if (text.includes(query)) return true;
  // Check each word in the text
  const words = text.split(/\s+/);
  const threshold = Math.max(1, Math.floor(query.length / 3));
  return words.some(word => levenshtein(query, word) <= threshold);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}
