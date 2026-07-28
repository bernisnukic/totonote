import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { confirmDialog, alertDialog } from '../common/ConfirmDialog';
import { clickable } from '../../lib/clickable';
import { sortTags } from '../../lib/tag-sort';

/**
 * Naming a combination of tags you keep applying together.
 *
 * A set is a shortcut, not a tag: applying one puts its member tags on the text. That is
 * what makes combinations compose — a passage tagged with a four-tag set still turns up
 * under every pair inside it, without anyone having to create a tag for each pair.
 */
export function TagSetsSection() {
  const tags = useStore(s => s.tags);
  const tagSets = useStore(s => s.tagSets);
  const loadTagSets = useStore(s => s.loadTagSets);
  const createTagSet = useStore(s => s.createTagSet);
  const updateTagSet = useStore(s => s.updateTagSet);
  const deleteTagSet = useStore(s => s.deleteTagSet);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    loadTagSets();
  }, [loadTagSets]);

  const sorted = sortTags(tags, 'name');
  const editing = creating || editingId !== null;

  const startCreate = () => {
    setEditingId(null);
    setName('');
    setChosen([]);
    setCreating(true);
  };

  const startEdit = (id: string) => {
    const set = tagSets.find(s => s.id === id);
    if (!set) return;
    setCreating(false);
    setEditingId(id);
    setName(set.name);
    setChosen(set.tagIds);
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    setName('');
    setChosen([]);
  };

  const toggle = (tagId: string) =>
    setChosen(prev => (prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]));

  const save = async () => {
    try {
      if (editingId) await updateTagSet(editingId, name, chosen);
      else await createTagSet(name, chosen);
      cancel();
    } catch (err) {
      await alertDialog(
        'That set could not be saved.',
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const remove = async (id: string, setName: string) => {
    const ok = await confirmDialog({
      title: 'Delete this tag set?',
      message: `“${setName}” will no longer be offered when tagging.`,
      // Worth saying plainly: people reasonably fear this takes the tags with it.
      detail: 'The tags themselves, and everything already tagged with them, are untouched.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await deleteTagSet(id);
  };

  return (
    <div className="tag-sets-section">
      <div className="info-section-title">Tag sets</div>
      <p className="input-hint" style={{ margin: '0 0 var(--space-2)' }}>
        A named group of tags you apply together. Tagging with a set puts all of its tags on
        the text, so it still counts towards every smaller combination.
      </p>

      {tagSets.length === 0 && !editing && (
        <p className="input-hint" style={{ margin: '0 0 var(--space-2)' }}>
          None yet.
        </p>
      )}

      {tagSets.map(set => (
        <div key={set.id} className="tag-set-row-item">
          <span
            className="tag-set-row-item__name"
            {...clickable(() => startEdit(set.id), { label: `Edit ${set.name}` })}
            title="Click to change its name or its tags"
          >
            {set.name}
          </span>
          <span className="tag-set-row-item__tags">
            {set.tagIds
              .map(id => tags.find(t => t.id === id)?.name ?? '—')
              .join(' + ')}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void remove(set.id, set.name)}
            aria-label={`Delete ${set.name}`}
          >
            &times;
          </button>
        </div>
      ))}

      {editing ? (
        <div className="tag-set-editor">
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name for this combination"
            autoFocus
          />
          <div className="tag-set-picker">
            {sorted.map(tag => (
              <label key={tag.id} className="tag-set-picker__item">
                <input
                  type="checkbox"
                  checked={chosen.includes(tag.id)}
                  onChange={() => toggle(tag.id)}
                />
                <span className="label-color-dot" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void save()}
              disabled={!name.trim() || chosen.length < 2}
              title={chosen.length < 2 ? 'Pick at least two tags' : undefined}
            >
              {editingId ? 'Save' : 'Create'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary btn-sm" onClick={startCreate} disabled={tags.length < 2}>
          + Create tag set
        </button>
      )}
    </div>
  );
}
