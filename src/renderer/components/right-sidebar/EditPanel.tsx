import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../stores';
import { Modal } from '../common/Modal';
import { ColorPicker } from '../common/ColorPicker';
import type { Category } from '../../../shared/domain-types';

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
  depth: number;
}

function buildCategoryTree(categories: Category[], parentId: string | null = null, depth = 0): CategoryNode[] {
  return categories
    .filter(c => c.parentId === parentId)
    .map(c => ({
      category: c,
      depth,
      children: buildCategoryTree(categories, c.id, depth + 1),
    }));
}

function flattenTree(nodes: CategoryNode[]): { category: Category; depth: number }[] {
  const result: { category: Category; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ category: node.category, depth: node.depth });
    result.push(...flattenTree(node.children));
  }
  return result;
}

export function EditPanel() {
  const categories = useStore(s => s.categories);
  const tags = useStore(s => s.tags);
  const createTag = useStore(s => s.createTag);
  const loadTags = useStore(s => s.loadTags);
  const loadCategories = useStore(s => s.loadCategories);
  const createCategory = useStore(s => s.createCategory);
  const updateCategory = useStore(s => s.updateCategory);
  const deleteCategory = useStore(s => s.deleteCategory);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newColor, setNewColor] = useState('#48dbfb');
  const [error, setError] = useState('');

  // Category inline creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState<string | undefined>(undefined);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  // Category inline rename
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameCatName, setRenameCatName] = useState('');
  const renameCatInputRef = useRef<HTMLInputElement>(null);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const flatCategories = useMemo(() => flattenTree(categoryTree), [categoryTree]);

  useEffect(() => {
    if (categories.length === 0) loadCategories();
  }, [categories.length, loadCategories]);

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

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await createCategory(newCatName.trim(), newCatParentId);
      setNewCatName('');
      setNewCatParentId(undefined);
      setShowNewCategory(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  const startCreateSubCategory = (parentId: string) => {
    setNewCatParentId(parentId);
    setNewCatName('');
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
      console.error('Failed to rename category:', err);
    }
    setRenamingCategoryId(null);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const catTags = tags.filter(t => t.categoryId === id);
    const childCats = categories.filter(c => c.parentId === id);
    const parts: string[] = [];
    if (catTags.length > 0) parts.push(`${catTags.length} tag(s)`);
    if (childCats.length > 0) parts.push(`${childCats.length} sub-category(ies)`);
    const msg = parts.length > 0
      ? `Delete category "${name}" and its ${parts.join(' and ')}?`
      : `Delete category "${name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteCategory(id);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const renderCategoryNode = (cat: Category, depth: number) => {
    const catTags = tags.filter(t => t.categoryId === cat.id);
    const children = categories.filter(c => c.parentId === cat.id);
    return (
      <div key={cat.id} className="info-section" style={{ marginLeft: depth * 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {renamingCategoryId === cat.id ? (
            <input
              ref={renameCatInputRef}
              className="input"
              value={renameCatName}
              onChange={e => setRenameCatName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameCategory();
                if (e.key === 'Escape') setRenamingCategoryId(null);
              }}
              onBlur={handleRenameCategory}
              style={{ flex: 1, padding: '0 var(--space-1)', fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wider)' }}
            />
          ) : (
            <div
              className="info-section-title"
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => startRenameCategory(cat.id, cat.name)}
              title="Click to rename"
            >
              {cat.name}
            </div>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => startCreateSubCategory(cat.id)}
            style={{ padding: '0 var(--space-1)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 1 }}
            title="Add sub-category"
          >
            +
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleDeleteCategory(cat.id, cat.name)}
            style={{ padding: '0 var(--space-1)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 1 }}
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
        {catTags.length === 0 && children.length === 0 && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: '0 var(--space-2)' }}>
            No tags
          </div>
        )}
        {children.map(child => renderCategoryNode(child, depth + 1))}
      </div>
    );
  };

  const rootCategories = categories.filter(c => !c.parentId);

  return (
    <div style={{ padding: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
          + New Tag
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setNewCatParentId(undefined); setShowNewCategory(true); }}>
          + New Category
        </button>
      </div>

      {showNewCategory && (
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
          <input
            ref={newCatInputRef}
            className="input"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateCategory();
              if (e.key === 'Escape') { setShowNewCategory(false); setNewCatName(''); setNewCatParentId(undefined); }
            }}
            placeholder={newCatParentId ? 'Sub-category name...' : 'Category name...'}
            style={{ flex: 1, padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-sm)' }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreateCategory}>Create</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewCategory(false); setNewCatName(''); setNewCatParentId(undefined); }}>Cancel</button>
        </div>
      )}

      {rootCategories.map(cat => renderCategoryNode(cat, 0))}

      {categories.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-text">No categories yet. Create one to start organizing tags.</p>
        </div>
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
                {'\u00A0\u00A0'.repeat(depth)}{cat.name}
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
