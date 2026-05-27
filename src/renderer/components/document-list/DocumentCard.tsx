import React from 'react';
import type { Document } from '../../../shared/domain-types';

interface DocumentCardProps {
  document: Document;
  onClick: () => void;
  onDelete: () => void;
}

export function DocumentCard({ document, onClick, onDelete }: DocumentCardProps) {
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="document-card" onClick={onClick}>
      <div className="document-card-title">{document.title}</div>
      {document.description && (
        <div className="document-card-description">{document.description}</div>
      )}
      <div className="document-card-meta">
        <span>{formatDate(document.updatedAt)}</span>
        <span
          style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-muted)' }}
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </span>
      </div>
    </div>
  );
}
