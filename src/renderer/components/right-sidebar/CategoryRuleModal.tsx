import React, { useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { Modal } from '../common/Modal';
import { parseRuleTemplate, countRuleNodes, type RuleNode } from '../../../shared/category-rule';

interface CategoryRuleModalProps {
  categoryId: string;
  onClose: () => void;
}

function RulePreview({ nodes, depth = 0 }: { nodes: RuleNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((node, i) => (
        <React.Fragment key={`${depth}-${i}-${node.name}`}>
          <div className="rule-preview-row" style={{ paddingLeft: `${depth * 14}px` }}>
            <span className="rule-preview-marker">&gt;</span>
            <span>{node.name}</span>
          </div>
          <RulePreview nodes={node.children} depth={depth + 1} />
        </React.Fragment>
      ))}
    </>
  );
}

export function CategoryRuleModal({ categoryId, onClose }: CategoryRuleModalProps) {
  const categories = useStore(s => s.categories);
  const storedTemplate = useStore(s => s.categoryRules[categoryId] ?? '');
  const setCategoryRule = useStore(s => s.setCategoryRule);
  const applyRuleToExisting = useStore(s => s.applyRuleToExisting);

  const [template, setTemplate] = useState(storedTemplate);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const category = categories.find(c => c.id === categoryId);
  const childCount = categories.filter(c => c.parentId === categoryId).length;

  const preview = useMemo(() => parseRuleTemplate(template), [template]);
  const nodeCount = countRuleNodes(preview);

  const save = async () => {
    setBusy(true);
    try {
      await setCategoryRule(categoryId, template);
      onClose();
    } catch (err) {
      setFeedback(`Failed to save rule: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  // Applying reads the stored rule, so the pending edits have to be saved first.
  const saveAndApplyToExisting = async () => {
    setBusy(true);
    setFeedback('');
    try {
      await setCategoryRule(categoryId, template);
      const { created, childrenAffected } = await applyRuleToExisting(categoryId);
      setFeedback(
        created.length === 0
          ? 'Every existing sub-category already matches this rule.'
          : `Added ${created.length} sub-categor${created.length === 1 ? 'y' : 'ies'} across ${childrenAffected} existing sub-categor${childrenAffected === 1 ? 'y' : 'ies'}.`,
      );
    } catch (err) {
      setFeedback(`Failed to apply: ${err instanceof Error ? err.message : String(err)}`);
    }
    setBusy(false);
  };

  const removeRule = async () => {
    setBusy(true);
    try {
      await setCategoryRule(categoryId, '');
      onClose();
    } catch (err) {
      setFeedback(`Failed to remove rule: ${err instanceof Error ? err.message : String(err)}`);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Rule for ${category?.name ?? 'category'}`}
      isOpen
      onClose={onClose}
      footer={
        <>
          {storedTemplate && (
            <button className="btn btn-ghost" onClick={removeRule} disabled={busy}>
              Remove rule
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <p className="rule-help">
        New sub-categories of <strong>{category?.name}</strong> get this skeleton created inside them.
        One name per line — indent with spaces to nest deeper.
      </p>

      <div className="input-group">
        <label className="input-label">Sub-categories</label>
        <textarea
          className="textarea rule-textarea"
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder={'HISTORY\nABILITIES\n  COMBAT\n  MAGIC\nCOLOUR PALETTE'}
          rows={8}
          spellCheck={false}
          autoFocus
        />
      </div>

      <div className="input-group">
        <label className="input-label">
          Preview {nodeCount > 0 && <span className="rule-help-count">({nodeCount})</span>}
        </label>
        <div className="rule-preview">
          {preview.length === 0 ? (
            <div className="rule-preview-empty">No sub-categories — saving clears the rule.</div>
          ) : (
            <>
              <div className="rule-preview-row rule-preview-root">
                <span className="rule-preview-marker">&gt;</span>
                <span>new sub-category</span>
              </div>
              <div style={{ paddingLeft: 14 }}>
                <RulePreview nodes={preview} />
              </div>
            </>
          )}
        </div>
      </div>

      {childCount > 0 && (
        <div className="input-group">
          <button
            className="btn btn-secondary btn-sm"
            onClick={saveAndApplyToExisting}
            disabled={busy || preview.length === 0}
            title="Create any missing sub-categories inside the ones that already exist"
          >
            Save &amp; apply to {childCount} existing sub-categor{childCount === 1 ? 'y' : 'ies'}
          </button>
        </div>
      )}

      {feedback && <div className="rule-feedback">{feedback}</div>}
    </Modal>
  );
}
