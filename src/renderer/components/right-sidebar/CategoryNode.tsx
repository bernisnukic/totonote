import React from 'react';
import type { Category, Tag } from '../../../shared/domain-types';

/**
 * One category row in the Edit tab, with its tags and — recursively — its sub-categories.
 *
 * Split out of EditPanel, which was carrying this alongside five modals and nineteen
 * pieces of state. The node owns no state of its own: the panel still decides what is
 * selected, being renamed or being edited, and passes it down.
 */
export interface CategoryNodeProps {
  category: Category;
  categories: Category[];
  tags: Tag[];
  /** How many sub-categories this category's rule would create (0 for no rule). */
  ruleSize: (categoryId: string) => number;

  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;

  renamingCategoryId: string | null;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onStartRename: (id: string, name: string) => void;

  onOpenRule: (categoryId: string) => void;
  onAddSubCategory: (parentId: string) => void;
  onDelete: (id: string, name: string) => void;
  onContextMenu: (e: React.MouseEvent, categoryId: string) => void;
}

export function CategoryNode(props: CategoryNodeProps) {
  const {
    category: cat,
    categories,
    tags,
    ruleSize,
    selectMode,
    selectedIds,
    onToggleSelected,
    renamingCategoryId,
    renameValue,
    renameInputRef,
    onRenameChange,
    onRenameCommit,
    onRenameCancel,
    onStartRename,
    onOpenRule,
    onAddSubCategory,
    onDelete,
    onContextMenu,
  } = props;

  const catTags = tags.filter(t => t.categoryId === cat.id);
  const children = categories.filter(c => c.parentId === cat.id);
  const size = ruleSize(cat.id);

  return (
    <div className="info-section category-node">
      <div className="category-row" onContextMenu={e => onContextMenu(e, cat.id)}>
        {selectMode && (
          <input
            type="checkbox"
            className="category-select-box"
            checked={selectedIds.has(cat.id)}
            onChange={() => onToggleSelected(cat.id)}
            aria-label={`Select ${cat.name}`}
          />
        )}

        {renamingCategoryId === cat.id ? (
          <input
            ref={renameInputRef}
            className="input category-rename-input"
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameCommit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onBlur={onRenameCommit}
          />
        ) : (
          <div
            className="info-section-title category-node-name"
            onClick={() => (selectMode ? onToggleSelected(cat.id) : onStartRename(cat.id, cat.name))}
            title={selectMode ? 'Click to select' : 'Click to rename — right-click for more'}
          >
            {cat.name}
          </div>
        )}

        {size > 0 && (
          <button
            className="rule-chip"
            onClick={() => onOpenRule(cat.id)}
            title={`Rule: creates ${size} sub-categor${size === 1 ? 'y' : 'ies'} in each new sub-category`}
          >
            rule {size}
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm category-row-btn"
          onClick={() => onAddSubCategory(cat.id)}
          title="Add sub-category"
        >
          +
        </button>
        <button
          className="btn btn-ghost btn-sm category-row-btn"
          onClick={() => onDelete(cat.id, cat.name)}
          title="Delete category"
        >
          ×
        </button>
      </div>

      {catTags.length > 0 && (
        <div className="label-list">
          {catTags.map(tag => (
            <span
              key={tag.id}
              className="badge"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                borderLeft: `3px solid ${tag.color}`,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {catTags.length === 0 && children.length === 0 && <div className="category-node-empty">No tags</div>}

      {children.length > 0 && (
        <div className="category-node-children">
          {children.map(child => (
            <CategoryNode key={child.id} {...props} category={child} />
          ))}
        </div>
      )}
    </div>
  );
}
