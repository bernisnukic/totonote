import React from 'react';

interface LabelItemProps {
  name: string;
  color: string;
  onClick: () => void;
  /** Double-click opens the tag's full page — its excerpts, not just its settings. */
  onDoubleClick?: () => void;
  isActive?: boolean;
}

export function LabelItem({ name, color, onClick, onDoubleClick, isActive }: LabelItemProps) {
  return (
    <button
      className="label-item"
      style={{
        backgroundColor: `${color}20`,
        border: isActive ? `1px solid ${color}` : '1px solid transparent',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Click for settings, double-click to open its page' : undefined}
    >
      <span className="label-color-dot" style={{ backgroundColor: color }} />
      {name}
    </button>
  );
}
