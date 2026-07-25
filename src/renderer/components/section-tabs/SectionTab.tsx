import React from 'react';
import { clickable } from '../../lib/clickable';

interface SectionTabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export function SectionTab({ label, isActive, onClick, onClose }: SectionTabProps) {
  return (
    <div
      className={`section-tab${isActive ? ' active' : ''}`}
      {...clickable(onClick)}
      aria-current={isActive ? 'true' : undefined}
    >
      <span className="tab-label">{label}</span>
      <button
        className="tab-close"
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}
      >
        &times;
      </button>
    </div>
  );
}
