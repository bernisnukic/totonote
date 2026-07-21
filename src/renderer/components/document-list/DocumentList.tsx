import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { WorkspaceBar } from './WorkspaceBar';
import { DocumentCard } from './DocumentCard';
import { Modal } from '../common/Modal';

export function DocumentList() {
  const documents = useStore(s => s.documents);
  const loadDocuments = useStore(s => s.loadDocuments);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const createDocument = useStore(s => s.createDocument);
  const deleteDocument = useStore(s => s.deleteDocument);
  const openDocument = useStore(s => s.openDocument);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    // Re-runs on workspace switch; skipped until one is known, so we never fetch
    // every document across every world.
    if (activeWorkspaceId) loadDocuments();
  }, [loadDocuments, activeWorkspaceId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const doc = await createDocument(newTitle.trim(), newDescription.trim());
    setShowCreate(false);
    setNewTitle('');
    setNewDescription('');
    openDocument(doc.id);
  };

  const handleDelete = async (id: string) => {
    // Documents are the biggest unit — deleting one takes every section, highlight and
    // filing inside it. Smaller deletions rely on the undo toast instead of a prompt.
    const doc = documents.find(d => d.id === id);
    const confirmed = window.confirm(
      `Delete "${doc?.title ?? 'this document'}" and everything in it?\n\nAll of its sections and highlights go too.`,
    );
    if (!confirmed) return;
    await deleteDocument(id);
  };

  return (
    <div className="home-view">
      <div className="home-header">
        <WorkspaceBar />
        <h1 className="home-title">Documents</h1>
      </div>
      <div className="document-grid">
        <button className="document-card-new" onClick={() => setShowCreate(true)}>
          <span className="document-card-new-icon">+</span>
          <span className="document-card-new-label">New Document</span>
        </button>
        {documents.map(doc => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onClick={() => openDocument(doc.id)}
            onDelete={() => handleDelete(doc.id)}
          />
        ))}
      </div>

      <Modal
        title="New Document"
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
        <div className="input-group">
          <label className="input-label">Title</label>
          <input
            className="input"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Enter document title..."
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Description</label>
          <textarea
            className="textarea"
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </div>
      </Modal>
    </div>
  );
}
