import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../stores';
import { flattenCategoryTree, optionIndent } from '../../lib/category-tree';
import { Modal } from '../common/Modal';
import { ColorPicker } from '../common/ColorPicker';
import { CategoryRuleModal } from './CategoryRuleModal';
import { BulkAddSubcategoryModal } from './BulkAddSubcategoryModal';
import { CategoryNode } from './CategoryNode';
import { useClickOutside } from '../../hooks/useClickOutside';
import { parseRuleTemplate, countRuleNodes } from '../../../shared/category-rule';
import { categoryImpact, describeCategoryDeletion } from '../../lib/category-impact';
import { confirmDialog } from '../common/ConfirmDialog';
import { clickable } from '../../lib/clickable';

export function EditPanel() {
  const categories = useStore(s => s.categories);
  const categoryRules = useStore(s => s.categoryRules);
  const tags = useStore(s => s.tags);
  const createTag = useStore(s => s.createTag);
  const loadTags = useStore(s => s.loadTags);
  const loadCategories = useStore(s => s.loadCategories);
  const loadCategoryRules = useStore(s => s.loadCategoryRules);
  const createCategory = useStore(s => s.createCategory);
  const updateCategory = useStore(s => s.updateCategory);
  const deleteCategory = useStore(s => s.deleteCategory);
  const applyRuleToExisting = useStore(s => s.applyRuleToExisting);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newColor, setNewColor] = useState('#48dbfb');
  const [error, setError] = useState('');

  // Category inline creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<string | undefined>(undefined);
  const [newCatApplyRule, setNewCatApplyRule] = useState(true);
  const [newCatError, setNewCatError] = useState('');
  const newCatInputRef = useRef<HTMLInputElement>(null);

  // Category inline rename
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameCatName, setRenameCatName] = useState('');
  const renameCatInputRef = useRef<HTMLInputElement>(null);

  // Rules, multi-select and the row context menu
  const [ruleCategoryId, setRuleCategoryId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [status, setStatus] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; categoryId: string } | null>(null);
  const contextMenuRef = useClickOutside<HTMLDivElement>(() => setContextMenu(null));

  const flatCategories = useMemo(() => flattenCategoryTree(categories), [categories]);

  /** Number of categories a rule would create, for the chips and checkbox labels. */
  const ruleSize = useCallback(
    (categoryId: string) => {
      const template = categoryRules[categoryId];
      return template ? countRuleNodes(parseRuleTemplate(template)) : 0;
    },
    [categoryRules],
  );

  useEffect(() => {
    if (categories.length === 0) loadCategories();
    loadCategoryRules();
  }, [categories.length, loadCategories, loadCategoryRules]);

  useEffect(() => {
    if (categories.length > 0 && !newCategoryId) {
      setNewCategoryId(categories[0].id);
    }
  }, [categories, newCategoryId]);

  useEffect(() => {
    if (showNewCategory && newCatInputRef.current) {
      newCatInputRef.current.focus();
    }
  }, [showNewCategory]);

  useEffect(() => {
    if (renamingCategoryId && renameCatInputRef.current) {
      renameCatInputRef.current.focus();
      renameCatInputRef.current.select();
    }
  }, [renamingCategoryId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  const openCreateModal = () => {
    setNewName('');
    setNewCategoryId(categories.length > 0 ? categories[0].id : '');
    setNewColor('#48dbfb');
    setError('');
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Tag name is required');
      return;
    }
    const categoryId = newCategoryId || (categories.length > 0 ? categories[0].id : '');
    if (!categoryId) {
      setError('No categories available');
      return;
    }
    setError('');
    try {
      await createTag(categoryId, newName.trim(), newColor);
      setShowCreate(false);
      setNewName('');
      setNewColor('#48dbfb');
      loadTags();
    } catch (err) {
      setError(`Failed to create tag: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const closeNewCategory = () => {
    setShowNewCategory(false);
    setNewCatName('');
    setNewCatParentId(undefined);
    setNewCatError('');
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      setNewCatError('Category name is required');
      return;
    }
    try {
      const parentRuleSize = newCatParentId ? ruleSize(newCatParentId) : 0;
      await createCategory(newCatName.trim(), newCatParentId, newCatApplyRule && parentRuleSize > 0);
      if (newCatApplyRule && parentRuleSize > 0) {
        setStatus(`Created "${newCatName.trim()}" with ${parentRuleSize} sub-categories from the rule.`);
      }
      closeNewCategory();
    } catch (err) {
      setNewCatError(err instanceof Error ? err.message : String(err));
    }
  };

  const startCreateSubCategory = (parentId: string) => {
    setNewCatParentId(parentId);
    setNewCatName('');
    setNewCatError('');
    setNewCatApplyRule(true);
    setShowNewCategory(true);
  };

  const startRenameCategory = (id: string, name: string) => {
    setRenamingCategoryId(id);
    setRenameCatName(name);
  };

  const handleRenameCategory = async () => {
    if (!renamingCategoryId || !renameCatName.trim()) {
      setRenamingCategoryId(null);
      return;
    }
    try {
      await updateCategory(renamingCategoryId, { name: renameCatName.trim() });
    } catch (err) {
      setStatus(`Failed to rename: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRenamingCategoryId(null);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    // Everything nested underneath goes too, so the prompt counts the whole subtree —
    // see lib/category-impact, where that arithmetic is unit-tested.
    const impact = categoryImpact(id, categories, tags);
    const confirmed = await confirmDialog({
      title: 'Delete category?',
      message: describeCategoryDeletion(name, impact),
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    const { descendantIds } = impact;

    try {
      await deleteCategory(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        for (const d of descendantIds) next.delete(d);
        return next;
      });
    } catch (err) {
      setStatus(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleApplyRuleToExisting = async (categoryId: string) => {
    try {
      const { created, childrenAffected } = await applyRuleToExisting(categoryId);
      setStatus(
        created.length === 0
          ? 'Every existing sub-category already matches the rule.'
          : `Added ${created.length} sub-categor${created.length === 1 ? 'y' : 'ies'} across ${childrenAffected} existing sub-categor${childrenAffected === 1 ? 'y' : 'ies'}.`,
      );
    } catch (err) {
      setStatus(`Failed to apply rule: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  /** Everything CategoryNode needs; the panel keeps owning the state. */
  const categoryNodeProps = {
    categories,
    tags,
    ruleSize,
    selectMode,
    selectedIds,
    onToggleSelected: toggleSelected,
    renamingCategoryId,
    renameValue: renameCatName,
    renameInputRef: renameCatInputRef,
    onRenameChange: setRenameCatName,
    onRenameCommit: handleRenameCategory,
    onRenameCancel: () => setRenamingCategoryId(null),
    onStartRename: startRenameCategory,
    onOpenRule: setRuleCategoryId,
    onAddSubCategory: startCreateSubCategory,
    onDelete: handleDeleteCategory,
    onContextMenu: (e: React.MouseEvent, categoryId: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, categoryId });
    },
  };

  const rootCategories = categories.filter(c => !c.parentId);
  const newCatParentRuleSize = newCatParentId ? ruleSize(newCatParentId) : 0;
  const newCatParentName = categories.find(c => c.id === newCatParentId)?.name;
  const contextCategory = contextMenu ? categories.find(c => c.id === contextMenu.categoryId) : undefined;

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
          + New Tag
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setNewCatParentId(undefined);
            setNewCatError('');
            setShowNewCategory(true);
          }}
        >
          + New Category
        </button>
        {categories.length > 0 && (
          <button
            className={`btn btn-sm ${selectMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            title="Select several categories to add a sub-category to all of them"
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
        )}
      </div>

      {selectMode && (
        <div className="category-select-bar">
          <span>
            {selectedIds.size} selected
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={selectedIds.size === 0}
            onClick={() => setShowBulkAdd(true)}
          >
            Add sub-category…
          </button>
          {selectedIds.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

      {showNewCategory && (
        <div className="category-new-form">
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <input
              ref={newCatInputRef}
              className="input"
              value={newCatName}
              onChange={e => {
                setNewCatName(e.target.value);
                setNewCatError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateCategory();
                if (e.key === 'Escape') closeNewCategory();
              }}
              placeholder={newCatParentId ? `Sub-category of ${newCatParentName}...` : 'Category name...'}
              style={{ flex: 1, padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-sm)' }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreateCategory}>
              Create
            </button>
            <button className="btn btn-ghost btn-sm" onClick={closeNewCategory}>
              Cancel
            </button>
          </div>

          {newCatParentRuleSize > 0 && (
            <label className="rule-checkbox">
              <input
                type="checkbox"
                checked={newCatApplyRule}
                onChange={e => setNewCatApplyRule(e.target.checked)}
              />
              <span>
                Apply {newCatParentName} rule
                <span className="rule-help-count"> ({newCatParentRuleSize} sub-categories)</span>
              </span>
            </label>
          )}

          {newCatError && <div className="rule-error">{newCatError}</div>}
        </div>
      )}

      {status && (
        <div className="category-status" {...clickable(() => setStatus(''))} title="Click to dismiss">
          {status}
        </div>
      )}

      {rootCategories.map(cat => (
        <CategoryNode key={cat.id} {...categoryNodeProps} category={cat} />
      ))}

      {categories.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-text">No categories yet. Create one to start organizing tags.</p>
        </div>
      )}

      {contextMenu && contextCategory && (
        <div ref={contextMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-header">{contextCategory.name}</div>
          <div
            className="context-menu-item"
            {...clickable(() => {
              startCreateSubCategory(contextMenu.categoryId);
              setContextMenu(null);
            })}
          >
            Add sub-category
          </div>
          <div
            className="context-menu-item"
            {...clickable(() => {
              setRuleCategoryId(contextMenu.categoryId);
              setContextMenu(null);
            })}
          >
            {ruleSize(contextMenu.categoryId) > 0 ? 'Edit rule…' : 'Create rule…'}
          </div>
          {ruleSize(contextMenu.categoryId) > 0 && (
            <div
              className="context-menu-item"
              {...clickable(() => {
                handleApplyRuleToExisting(contextMenu.categoryId);
                setContextMenu(null);
              })}
            >
              Apply rule to existing sub-categories
            </div>
          )}
          <div className="context-menu-separator" />
          <div
            className="context-menu-item"
            {...clickable(() => {
              startRenameCategory(contextMenu.categoryId, contextCategory.name);
              setContextMenu(null);
            })}
          >
            Rename
          </div>
          <div
            className="context-menu-item danger"
            {...clickable(() => {
              handleDeleteCategory(contextMenu.categoryId, contextCategory.name);
              setContextMenu(null);
            })}
          >
            Delete
          </div>
        </div>
      )}

      {ruleCategoryId && (
        <CategoryRuleModal categoryId={ruleCategoryId} onClose={() => setRuleCategoryId(null)} />
      )}

      {showBulkAdd && (
        <BulkAddSubcategoryModal
          categoryIds={[...selectedIds]}
          onClose={() => setShowBulkAdd(false)}
          onAdded={summary => {
            setStatus(summary);
            exitSelectMode();
          }}
        />
      )}

      <Modal
        title="New Tag"
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreate}>
              Create
            </button>
          </>
        }
      >
        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-2)' }}>
            {error}
          </div>
        )}
        <div className="input-group">
          <label className="input-label">Name</label>
          <input
            className="input"
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="Tag name..."
            autoFocus
          />
        </div>
        <div className="input-group">
          <label className="input-label">Category</label>
          <select
            className="input"
            value={newCategoryId}
            onChange={e => { setNewCategoryId(e.target.value); setError(''); }}
            style={{ appearance: 'auto' }}
          >
            {flatCategories.map(({ category: cat, depth }) => (
              <option key={cat.id} value={cat.id}>
                {optionIndent(depth)}{cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Color</label>
          <ColorPicker selectedColor={newColor} onSelect={setNewColor} />
        </div>
      </Modal>
    </div>
  );
}
