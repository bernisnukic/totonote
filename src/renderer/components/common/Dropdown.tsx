import React, { useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { clickable } from '../../lib/clickable';

interface DropdownItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
}

export function Dropdown({ trigger, items }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setIsOpen(false));

  return (
    <div className="dropdown" ref={ref}>
      <div {...clickable(() => setIsOpen(!isOpen))} aria-expanded={isOpen} aria-haspopup="menu">
        {trigger}
      </div>
      {isOpen && (
        <div className="dropdown-menu" role="menu">
          {items.map((item, i) => (
            <div
              key={i}
              className={`dropdown-item${item.danger ? ' danger' : ''}`}
              {...clickable(() => {
                item.onClick();
                setIsOpen(false);
              })}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
