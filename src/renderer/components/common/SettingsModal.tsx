import React from 'react';
import { useStore } from '../../stores';
import { Modal } from './Modal';
import { ShortcutSettingsContent } from './ShortcutSettings';

const THEMES = [
  {
    id: 'light',
    label: 'Light',
    colors: { bg: '#ffffff', surface: '#f5f5f5', accent: '#0984e3', text: '#1a1a1a' },
  },
  {
    id: 'wood',
    label: 'Wood',
    colors: { bg: '#f4ece1', surface: '#ebe3d6', accent: '#8b6914', text: '#2c1810' },
  },
  {
    id: 'dark',
    label: 'Dark',
    colors: { bg: '#0a0a0a', surface: '#141414', accent: '#48dbfb', text: '#e0e0e0' },
  },
  {
    id: 'black',
    label: 'Black',
    colors: { bg: '#000000', surface: '#0a0a0a', accent: '#48dbfb', text: '#f0f0f0' },
  },
] as const;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);

  return (
    <Modal
      title="Settings"
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
      <div className="settings-section">
        <h3 className="settings-section-title">Appearance</h3>
        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-card${theme === t.id ? ' active' : ''}`}
              onClick={() => setTheme(t.id)}
            >
              <div className="theme-swatch" style={{ background: t.colors.bg }}>
                <div className="theme-swatch-surface" style={{ background: t.colors.surface }} />
                <div className="theme-swatch-accent" style={{ background: t.colors.accent }} />
                <div className="theme-swatch-text" style={{ background: t.colors.text }} />
              </div>
              <span className="theme-card-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Keyboard Shortcuts</h3>
        <ShortcutSettingsContent />
      </div>
    </Modal>
  );
}
