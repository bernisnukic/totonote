import React from 'react';

interface SectionTabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export function SectionTab({ label, isActive, onClick, onClose }: SectionTabProps) {
  return (
    <div className={`section-tab${isActive ? ' active' : ''}`} onClick={onClick}>
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
