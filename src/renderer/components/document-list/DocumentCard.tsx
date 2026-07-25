import React from 'react';
import type { Document } from '../../../shared/domain-types';
import { clickable } from '../../lib/clickable';

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
    <div className="document-card" {...clickable(onClick, { label: `Open ${document.title}` })}>
      <div className="document-card-title">{document.title}</div>
      {document.description && (
        <div className="document-card-description">{document.description}</div>
      )}
      <div className="document-card-meta">
        <span>{formatDate(document.updatedAt)}</span>
        <span
          style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-muted)' }}
          {...clickable(e => {
            // Otherwise deleting also opens the document on its way out.
            e.stopPropagation();
            onDelete();
          }, { label: `Delete ${document.title}` })}
        >
          Delete
        </span>
      </div>
    </div>
  );
}
