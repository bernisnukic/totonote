import React, { useState } from 'react';
import { useStore } from '../../stores';
import { Modal } from '../common/Modal';

interface BulkAddSubcategoryModalProps {
  categoryIds: string[];
  onClose: () => void;
  /** Called after a successful add so the panel can clear its selection. */
  onAdded: (summary: string) => void;
}

export function BulkAddSubcategoryModal({ categoryIds, onClose, onAdded }: BulkAddSubcategoryModalProps) {
  const categories = useStore(s => s.categories);
  const categoryRules = useStore(s => s.categoryRules);
  const bulkAddSubcategory = useStore(s => s.bulkAddSubcategory);

  const [name, setName] = useState('');
  const [applyRule, setApplyRule] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const targets = categoryIds
    .map(id => categories.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const withRules = targets.filter(c => categoryRules[c.id]).length;

  const submit = async () => {
    if (!name.trim()) {
      setError('Sub-category name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { created, skipped } = await bulkAddSubcategory(categoryIds, name.trim(), applyRule);
      const added = created.filter(c => categoryIds.includes(c.parentId ?? '')).length;
      const parts = [`Added "${name.trim()}" to ${added} categor${added === 1 ? 'y' : 'ies'}`];
      if (skipped.length > 0) {
        parts.push(`${skipped.length} already had it (${skipped.map(s => s.parentName).join(', ')})`);
      }
      onAdded(`${parts.join(' — ')}.`);
      onClose();
    } catch (err) {
      setError(`Failed to add: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Add sub-category to ${targets.length} categor${targets.length === 1 ? 'y' : 'ies'}`}
      isOpen
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            Add
          </button>
        </>
      }
    >
      {error && <div className="rule-error">{error}</div>}

      <div className="input-group">
        <label className="input-label">Sub-category name</label>
        <input
          className="input"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError('');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="e.g. NOTES"
          autoFocus
        />
      </div>

      {withRules > 0 && (
        <label className="rule-checkbox">
          <input type="checkbox" checked={applyRule} onChange={e => setApplyRule(e.target.checked)} />
          <span>
            Apply each category&rsquo;s own rule to the new sub-category
            <span className="rule-help-count"> ({withRules} of {targets.length} have one)</span>
          </span>
        </label>
      )}

      <div className="input-group">
        <label className="input-label">Adding to</label>
        <div className="rule-preview">
          {targets.map(c => (
            <div key={c.id} className="rule-preview-row">
              <span className="rule-preview-marker">&gt;</span>
              <span>{c.name}</span>
              {categoryRules[c.id] && <span className="rule-chip rule-chip-inline">rule</span>}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
