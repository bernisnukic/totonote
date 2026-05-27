import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../stores';
import { Modal } from './Modal';
import { formatKeybinding, getModKey } from '../../lib/keyboard-utils';

const DEFAULT_SHORTCUTS: { action: string; label: string; default: string }[] = [
  { action: 'save', label: 'Save', default: 'Mod+S' },
  { action: 'bold', label: 'Bold', default: 'Mod+B' },
  { action: 'italic', label: 'Italic', default: 'Mod+I' },
  { action: 'underline', label: 'Underline', default: 'Mod+U' },
  { action: 'strikethrough', label: 'Strikethrough', default: 'Mod+Shift+X' },
  { action: 'heading1', label: 'Heading 1', default: 'Mod+Alt+1' },
  { action: 'heading2', label: 'Heading 2', default: 'Mod+Alt+2' },
  { action: 'heading3', label: 'Heading 3', default: 'Mod+Alt+3' },
  { action: 'bulletList', label: 'Bullet List', default: 'Mod+Shift+8' },
  { action: 'orderedList', label: 'Ordered List', default: 'Mod+Shift+7' },
  { action: 'undo', label: 'Undo', default: 'Mod+Z' },
  { action: 'redo', label: 'Redo', default: 'Mod+Shift+Z' },
];

export function ShortcutSettingsContent() {
  const shortcuts = useStore(s => s.shortcuts);
  const updateShortcut = useStore(s => s.updateShortcut);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingAction) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier-only presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Mod');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);

      const binding = parts.join('+');
      updateShortcut(editingAction, binding);
      setEditingAction(null);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [editingAction, updateShortcut]);

  const handleReset = (action: string) => {
    const def = DEFAULT_SHORTCUTS.find(s => s.action === action);
    if (def) updateShortcut(action, def.default);
  };

  const handleResetAll = () => {
    DEFAULT_SHORTCUTS.forEach(s => updateShortcut(s.action, s.default));
  };

  return (
    <div>
      <div className="shortcut-list">
        {DEFAULT_SHORTCUTS.map(entry => {
          const current = shortcuts[entry.action] || entry.default;
          const isEditing = editingAction === entry.action;

          return (
            <div key={entry.action} className="shortcut-row">
              <span className="shortcut-label">{entry.label}</span>
              <div className="shortcut-binding-area">
                {isEditing ? (
                  <div className="shortcut-capture" ref={captureRef}>
                    Press keys...
                  </div>
                ) : (
                  <button
                    className="shortcut-binding"
                    onClick={() => setEditingAction(entry.action)}
                    title="Click to rebind"
                  >
                    {formatKeybinding(current)}
                  </button>
                )}
                <button
                  className="shortcut-reset-btn"
                  onClick={() => handleReset(entry.action)}
                  title="Reset to default"
                >
                  &#x21BA;
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 'var(--space-3)', textAlign: 'right' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleResetAll}>
          Reset All Shortcuts
        </button>
      </div>
    </div>
  );
}

interface ShortcutSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutSettings({ isOpen, onClose }: ShortcutSettingsProps) {
  const loadPreferences = useStore(s => s.loadPreferences);

  useEffect(() => {
    if (isOpen) loadPreferences();
  }, [isOpen, loadPreferences]);

  return (
    <Modal
      title="Keyboard Shortcuts"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <ShortcutSettingsContent />
    </Modal>
  );
}
