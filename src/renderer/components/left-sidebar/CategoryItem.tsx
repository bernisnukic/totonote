import React, { useState } from 'react';
import type { BrowseCategory } from '../../../shared/domain-types';

interface CategoryItemProps {
  category: BrowseCategory;
  children?: BrowseCategory[];
  onSelect: (id: string) => void;
  isActive: boolean;
}

export function CategoryItem({ category, children, onSelect, isActive }: CategoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = children && children.length > 0;

  return (
    <div className="category-item">
      <div
        className={`category-header${isActive ? ' active' : ''}`}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(category.id);
        }}
      >
        {hasChildren && (
          <span className={`category-expand-icon${expanded ? ' expanded' : ''}`}>&#9654;</span>
        )}
        {!hasChildren && <span className="category-expand-icon" />}
        <span className="category-name">{category.name}</span>
      </div>
      {expanded && hasChildren && (
        <div className="category-children">
          {children!.map(child => (
            <CategoryItem
              key={child.id}
              category={child}
              onSelect={onSelect}
              isActive={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
