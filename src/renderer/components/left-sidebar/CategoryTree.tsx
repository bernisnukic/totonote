import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { invoke } from '../../lib/ipc-client';
import { CategoryItem } from './CategoryItem';
import type { BrowseCategory } from '../../../shared/domain-types';

export function CategoryTree() {
  const [browseCategories, setBrowseCategories] = useState<BrowseCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    invoke('browse-category:list').then(setBrowseCategories);
  }, []);

  const rootCategories = browseCategories.filter(c => !c.parentId);
  const getChildren = (parentId: string) => browseCategories.filter(c => c.parentId === parentId);

  return (
    <div className="category-tree">
      {rootCategories.map(cat => (
        <CategoryItem
          key={cat.id}
          category={cat}
          children={getChildren(cat.id)}
          onSelect={id => setActiveCategory(id)}
          isActive={activeCategory === cat.id}
        />
      ))}
    </div>
  );
}
