import React from 'react';

interface LabelItemProps {
  name: string;
  color: string;
  onClick: () => void;
  isActive?: boolean;
}

export function LabelItem({ name, color, onClick, isActive }: LabelItemProps) {
  return (
    <button
      className="label-item"
      style={{
        backgroundColor: `${color}20`,
        border: isActive ? `1px solid ${color}` : '1px solid transparent',
      }}
      onClick={onClick}
    >
      <span className="label-color-dot" style={{ backgroundColor: color }} />
      {name}
    </button>
  );
}
