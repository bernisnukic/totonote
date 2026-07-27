import React from 'react';
import { clickable } from '../../lib/clickable';

interface SectionTabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
  /** Reordering, the way browser tabs do it. Omitted when there is only one tab. */
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent) => void;
}

export function SectionTab({
  label,
  isActive,
  onClick,
  onClose,
  draggable,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: SectionTabProps) {
  return (
    <div
      className={`section-tab${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}${
        isDropTarget ? ' drop-target' : ''
      }`}
      {...clickable(onClick)}
      aria-current={isActive ? 'true' : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
