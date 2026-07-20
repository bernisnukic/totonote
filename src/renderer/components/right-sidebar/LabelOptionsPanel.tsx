import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Tag } from '../../../shared/domain-types';
import { ColorPicker } from '../common/ColorPicker';
import { useStore } from '../../stores';
import { flattenCategoryTree, optionIndent } from '../../lib/category-tree';

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
  const flatCategories = useMemo(() => flattenCategoryTree(categories), [categories]);

  // Edits save themselves, like everything else in the app — there is no Save button
  // to forget before switching tabs. Debounced while typing, flushed on unmount so the
  // last keystrokes are never lost.
  const mountedRef = useRef(false);
  const pendingRef = useRef<{ name: string; description: string; color: string; categoryId: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    // Never persist an empty name mid-edit; the pending payload keeps the last valid one.
    if (!name.trim()) return;
    pendingRef.current = { name: name.trim(), description, color, categoryId };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (!payload) return;
      await updateTag(tag.id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [name, description, color, categoryId]); // deliberately not tag.id — the key remounts us

  // Flush anything still pending when the panel unmounts (tab switch, Escape, …).
  useEffect(() => {
    return () => {
      const payload = pendingRef.current;
      if (payload) updateTag(tag.id, payload);
    };
  }, []); // mount-scoped by design

  const handleDelete = async () => {
    // Deleting cascades to every annotation using this tag, in every document, with no
    // undo. The sidebar's own delete confirms; these two paths should not differ.
    if (!window.confirm(`Delete the tag "${tag.name}" and all of its highlights?`)) return;
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
            <option key={cat.id} value={cat.id}>{optionIndent(depth)}{cat.name}</option>
          ))}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Color</label>
        <ColorPicker selectedColor={color} onSelect={setColor} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <span className="label-options-autosave">{saved ? 'Saved \u2713' : 'Changes save automatically'}</span>
        <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
