import React, { useState } from 'react';
import { useStore } from '../../stores';
import { getActiveEditor } from '../../lib/editor-registry';
import { SettingsModal } from '../common/SettingsModal';

export function MainToolbar() {
  const [showSettings, setShowSettings] = useState(false);
  const closeDocument = useStore(s => s.closeDocument);
  const activeDocument = useStore(s => s.activeDocument);
  const activeSectionId = useStore(s => s.activeSectionId);
  const toggleLeftSidebar = useStore(s => s.toggleLeftSidebar);
  const toggleRightSidebar = useStore(s => s.toggleRightSidebar);

  const editor = getActiveEditor(activeSectionId);

  const btn = (label: string, action: () => void, isActive?: boolean) => (
    <button
      className={`toolbar-btn${isActive ? ' active' : ''}`}
      onClick={action}
      title={label}
    >
      {label}
    </button>
  );

  return (
    <div className="main-toolbar">
      <button className="toolbar-back-btn" onClick={closeDocument} title="Back to documents">
        &larr; Back
      </button>

      {activeDocument && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            marginLeft: 'var(--space-2)',
          }}
        >
          {activeDocument.title}
        </span>
      )}

      <div className="toolbar-drag-spacer" />

      {editor && (
        <>
          <div className="toolbar-group">
            {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {btn('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            {btn('S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
          </div>

          <div className="toolbar-group">
            {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
            {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
            {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
          </div>

          <div className="toolbar-group">
            {btn('UL', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
            {btn('OL', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          </div>
        </>
      )}

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={toggleLeftSidebar} title="Toggle left sidebar">
          &#9776;
        </button>
        <button className="toolbar-btn" onClick={toggleRightSidebar} title="Toggle right sidebar">
          &#9776;
        </button>
        <button className="toolbar-btn" onClick={() => setShowSettings(true)} title="Settings">
          &#9881;
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
