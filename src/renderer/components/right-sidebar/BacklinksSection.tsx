import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { invoke } from '../../lib/ipc-client';
import type { Backlink } from '../../../shared/domain-types';

/**
 * "Linked from" — the other half of a `[[link]]`.
 *
 * Writing a link is one-directional, but the connection isn't: standing on GURA, the useful
 * question is usually which parts of the world mention her. Without this, links can only be
 * followed the way they were written.
 */
export function BacklinksSection() {
  const activeDocumentId = useStore(s => s.activeDocumentId);
  const documents = useStore(s => s.documents);
  const openDocument = useStore(s => s.openDocument);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  // `documents` is in the dependencies so that adding, renaming or deleting a document
  // re-asks — the answer depends on content that other documents own.
  useEffect(() => {
    if (!activeDocumentId) {
      setBacklinks([]);
      return;
    }
    let current = true;
    invoke('document:backlinks', { id: activeDocumentId })
      .then(rows => {
        if (current) setBacklinks(rows);
      })
      .catch(() => {
        if (current) setBacklinks([]);
      });
    return () => {
      current = false;
    };
  }, [activeDocumentId, documents]);

  if (backlinks.length === 0) return null;

  return (
    <div className="info-section">
      <div className="info-section-title">Linked from</div>
      {backlinks.map(link => (
        <button
          key={link.documentId}
          className="backlink-row"
          onClick={() => void openDocument(link.documentId)}
          title={`Open “${link.documentTitle}” — mentioned in ${link.sections
            .map(s => s.sectionTitle)
            .join(', ')}`}
        >
          <span className="backlink-row__title">{link.documentTitle}</span>
          <span className="backlink-row__count">{link.count}</span>
        </button>
      ))}
    </div>
  );
}
