import React from 'react';
import { useStore } from '../../stores';
import type { RightTab } from '../../stores/ui-slice';
import { InfoPanel } from './InfoPanel';
import { ArrangePanel } from './ArrangePanel';
import { EditPanel } from './EditPanel';

const tabs: { key: RightTab; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'arrange', label: 'Arrange' },
  { key: 'edit', label: 'Edit' },
];

export function RightSidebar() {
  const activeRightTab = useStore(s => s.activeRightTab);
  const setActiveRightTab = useStore(s => s.setActiveRightTab);

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Details</span>
      </div>
      <div className="sidebar-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`sidebar-tab${activeRightTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveRightTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sidebar-content">
        {activeRightTab === 'info' && <InfoPanel />}
        {activeRightTab === 'arrange' && <ArrangePanel />}
        {activeRightTab === 'edit' && <EditPanel />}
      </div>
    </>
  );
}
