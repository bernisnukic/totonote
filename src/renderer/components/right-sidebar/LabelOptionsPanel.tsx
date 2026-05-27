import React, { useState, useMemo } from 'react';
import type { Tag, Category } from '../../../shared/domain-types';
import { ColorPicker } from '../common/ColorPicker';
import { useStore } from '../../stores';

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

interface LabelOptionsPanelProps {
  tag: Tag;
  onClose: () => void;
  hideHeader?: boolean;
}

export function LabelOptionsPanel({ tag, onClose, hideHeader }: LabelOptionsPanelProps) {
  const updateTag = useStore(s => s.updateTag);
  const deleteTag = useStore(s => s.deleteTag);
  const categories = useStore(s => s.categories);
  const [name, setName] = useState(tag.name);
  const [description, setDescription] = useState(tag.description);
  const [color, setColor] = useState(tag.color);
  const [categoryId, setCategoryId] = useState(tag.categoryId);

  const [saved, setSaved] = useState(false);
  const flatCategories = useMemo(() => flattenTree(buildCategoryTree(categories)), [categories]);

  const handleSave = async () => {
    await updateTag(tag.id, { name, description, color, categoryId });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = async () => {
    await deleteTag(tag.id);
    onClose();
  };

  return (
    <div className="label-options-panel">
      {!hideHeader && (
        <div className="label-options-header">
          <span className="label-options-title">{tag.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            &times;
          </button>
        </div>
      )}
      <div className="input-group">
        <label className="input-label">Name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="input-group">
        <label className="input-label">Description</label>
        <textarea
          className="textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="input-group">
        <label className="input-label">Category</label>
        <select
          className="input"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
        >
          {flatCategories.map(({ category: cat, depth }) => (
            <option key={cat.id} value={cat.id}>{'\u00A0\u00A0'.repeat(depth)}{cat.name}</option>
          ))}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Color</label>
        <ColorPicker selectedColor={color} onSelect={setColor} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? 'Saved' : 'Save'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
