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

/** Offered checkpoint intervals. The pause after a keystroke is ~100-300ms when typing. */
const HISTORY_INTERVALS = [
  { ms: 50, label: 'Every pause (50ms)' },
  { ms: 250, label: 'Quarter second' },
  { ms: 500, label: 'Half a second' },
  { ms: 1000, label: '1 second (default)' },
  { ms: 3000, label: '3 seconds' },
  { ms: 10000, label: '10 seconds' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const autoSaveEnabled = useStore(s => s.autoSaveEnabled);
  const setAutoSaveEnabled = useStore(s => s.setAutoSaveEnabled);
  const historyIntervalMs = useStore(s => s.historyIntervalMs);
  const setHistoryIntervalMs = useStore(s => s.setHistoryIntervalMs);
  const isMac = /Mac/i.test(navigator.platform);

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
        <h3 className="settings-section-title">Editing</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={e => setAutoSaveEnabled(e.target.checked)}
          />
          <span className="settings-toggle-body">
            <span className="settings-toggle-label">Auto-save</span>
            <span className="settings-toggle-hint">
              {autoSaveEnabled
                ? 'Your writing saves itself a moment after you stop typing.'
                : 'Save manually with ' + (isMac ? '⌘S' : 'Ctrl+S') + '. You’ll be warned about unsaved work before quitting.'}
            </span>
          </span>
        </label>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">History</h3>
        <label className="settings-field">
          <span className="settings-toggle-label">Checkpoint every</span>
          <select
            className="input"
            value={historyIntervalMs}
            onChange={e => setHistoryIntervalMs(Number(e.target.value))}
          >
            {HISTORY_INTERVALS.map(({ ms, label }) => (
              <option key={ms} value={ms}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="settings-toggle-hint">
          How long after you stop typing the History tab takes a checkpoint. Shorter fills the
          timeline as you write; longer keeps it reaching further back.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">Keyboard Shortcuts</h3>
        <ShortcutSettingsContent />
      </div>
    </Modal>
  );
}
