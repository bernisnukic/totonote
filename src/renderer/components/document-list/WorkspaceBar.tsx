import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../stores';
import { useClickOutside } from '../../hooks/useClickOutside';

/**
 * Workspace switcher, shown above the document grid.
 *
 * A workspace is a world: its documents and its whole category/tag taxonomy are its
 * own. This is the only place to move between them, so it also handles creating,
 * renaming and deleting.
 */
export function WorkspaceBar() {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const setActiveWorkspace = useStore(s => s.setActiveWorkspace);
  const createWorkspace = useStore(s => s.createWorkspace);
  const renameWorkspace = useStore(s => s.renameWorkspace);
  const deleteWorkspace = useStore(s => s.deleteWorkspace);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const active = workspaces.find(w => w.id === activeWorkspaceId);

  useEffect(() => {
    if ((creating || renaming) && inputRef.current) inputRef.current.focus();
  }, [creating, renaming]);

  const startCreate = () => {
    setName('');
    setError('');
    setRenaming(false);
    setCreating(true);
    setOpen(false);
  };

  const startRename = () => {
    setName(active?.name ?? '');
    setError('');
    setCreating(false);
    setRenaming(true);
    setOpen(false);
  };

  const cancel = () => {
    setCreating(false);
    setRenaming(false);
    setError('');
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      if (creating) await createWorkspace(name.trim());
      else if (renaming && activeWorkspaceId) await renameWorkspace(activeWorkspaceId, name.trim());
      cancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!active) return;
    setOpen(false);
    const confirmed = window.confirm(
      `Delete the workspace "${active.name}"?\n\nEvery document, category and tag inside it goes too. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteWorkspace(active.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  };

  if (creating || renaming) {
    return (
      <div className="workspace-bar">
        <span className="workspace-bar__label">{creating ? 'New workspace' : 'Rename workspace'}</span>
        <input
          ref={inputRef}
          className="input workspace-bar__input"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError('');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="e.g. Game 1"
        />
        <button className="btn btn-primary btn-sm" onClick={submit}>
          {creating ? 'Create' : 'Save'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={cancel}>
          Cancel
        </button>
        {error && <span className="workspace-bar__error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="workspace-bar">
      <span className="workspace-bar__label">Workspace</span>
      <div className="workspace-bar__switcher" ref={menuRef}>
        <button
          className="workspace-bar__current"
          onClick={() => setOpen(o => !o)}
          aria-label="Switch workspace"
          data-tip="Switch, rename or add a workspace"
        >
          {active?.name ?? '—'} <span className="workspace-bar__caret">▾</span>
        </button>
        {open && (
          <div className="workspace-bar__menu">
            {workspaces.map(w => (
              <div
                key={w.id}
                className={`workspace-bar__item${w.id === activeWorkspaceId ? ' active' : ''}`}
                onClick={() => {
                  setActiveWorkspace(w.id);
                  setOpen(false);
                }}
              >
                {w.name}
              </div>
            ))}
            <div className="workspace-bar__separator" />
            <div className="workspace-bar__item" onClick={startCreate}>
              + New workspace
            </div>
            <div className="workspace-bar__item" onClick={startRename}>
              Rename &ldquo;{active?.name}&rdquo;
            </div>
            {workspaces.length > 1 && (
              <div className="workspace-bar__item danger" onClick={handleDelete}>
                Delete &ldquo;{active?.name}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>
      <span className="workspace-bar__hint">
        Categories and tags are shared across every document in this workspace
      </span>
    </div>
  );
}
