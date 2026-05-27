import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../stores';
import { LabelAutocomplete } from '../right-sidebar/LabelAutocomplete';
import type { SectionTagWithDetails } from '../../../shared/domain-types';

interface SectionTagBarProps {
  sectionId: string;
  documentId: string;
  sectionTags: SectionTagWithDetails[];
}

export function SectionTagBar({ sectionId, documentId, sectionTags }: SectionTagBarProps) {
  const tags = useStore(s => s.tags);
  const addSectionTag = useStore(s => s.addSectionTag);
  const removeSectionTag = useStore(s => s.removeSectionTag);
  const [showAdd, setShowAdd] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAdd]);

  const handleAdd = async (tagId: string) => {
    await addSectionTag(sectionId, tagId, documentId);
    setShowAdd(false);
  };

  const handleRemove = async (tagId: string) => {
    await removeSectionTag(sectionId, tagId, documentId);
  };

  // Exclude already-applied tags from autocomplete
  const appliedTagIds = new Set(sectionTags.map(st => st.tagId));
  const availableTags = tags.filter(t => !appliedTagIds.has(t.id));

  return (
    <div className="section-tag-bar">
      {sectionTags.map(st => (
        <span
          key={st.tagId}
          className="section-tag-badge"
          style={{ borderColor: st.tagColor, color: st.tagColor }}
        >
          {st.tagName}
          <button
            className="section-tag-remove"
            onClick={() => handleRemove(st.tagId)}
            title="Remove tag"
          >
            &times;
          </button>
        </span>
      ))}
      <div className="section-tag-add-wrapper">
        <button
          className="section-tag-add-btn"
          onClick={() => setShowAdd(true)}
          title="Add section tag"
        >
          +
        </button>
        {showAdd && (
          <div className="section-tag-add-popover" ref={popoverRef}>
            <LabelAutocomplete
              tags={availableTags}
              onSelect={handleAdd}
              placeholder="Add tag..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
