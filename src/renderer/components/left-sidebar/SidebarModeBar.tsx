import React from 'react';
import { useStore } from '../../stores';
import type { LeftSidebarMode } from '../../stores/filter-slice';

const modes: { key: LeftSidebarMode; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'sort', label: 'Sort' },
  { key: 'filter', label: 'Filter' },
  { key: 'highlight', label: 'HL' },
];

export function SidebarModeBar() {
  const leftSidebarMode = useStore(s => s.leftSidebarMode);
  const setLeftSidebarMode = useStore(s => s.setLeftSidebarMode);

  return (
    <div className="sidebar-mode-bar">
      {modes.map(mode => (
        <button
          key={mode.key}
          className={`sidebar-mode-btn${leftSidebarMode === mode.key ? ' active' : ''}`}
          onClick={() => setLeftSidebarMode(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
