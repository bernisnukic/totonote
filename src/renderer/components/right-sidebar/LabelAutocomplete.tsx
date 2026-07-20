import React, { useState, useRef, useEffect } from 'react';
import type { Tag } from '../../../shared/domain-types';

interface LabelAutocompleteProps {
  tags: Tag[];
  onSelect: (tagId: string) => void;
  placeholder?: string;
  onCreateNew?: (name: string) => void;
}

export function LabelAutocomplete({ tags, onSelect, placeholder, onCreateNew }: LabelAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? tags.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : tags;

  const trimmedQuery = query.trim();
  const hasExactMatch = filtered.some(t => t.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCreateOption = !!onCreateNew && trimmedQuery.length > 0 && !hasExactMatch;
  const totalItems = filtered.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightIndex < filtered.length) {
        if (filtered[highlightIndex]) {
          onSelect(filtered[highlightIndex].id);
          setQuery('');
        }
      } else if (showCreateOption) {
        onCreateNew!(trimmedQuery);
      }
    }
  };

  const showDropdown = filtered.length > 0 || showCreateOption;

  return (
    <div className="autocomplete">
      <input
        ref={inputRef}
        className="input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Search...'}
        autoFocus
      />
      {showDropdown && (
        <div className="autocomplete-dropdown">
          {filtered.map((tag, i) => (
            <div
              key={tag.id}
              className={`autocomplete-item${i === highlightIndex ? ' highlighted' : ''}`}
              onClick={() => {
                onSelect(tag.id);
                setQuery('');
              }}
            >
              <span
                className="label-color-dot"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </div>
          ))}
          {showCreateOption && (
            <div
              className={`autocomplete-item autocomplete-item-create${highlightIndex === filtered.length ? ' highlighted' : ''}`}
              onClick={() => onCreateNew!(trimmedQuery)}
            >
              + Create &ldquo;{trimmedQuery}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
