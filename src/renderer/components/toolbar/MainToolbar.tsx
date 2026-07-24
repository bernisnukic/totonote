import React, { useState } from 'react';
import { useStore } from '../../stores';
import { getActiveEditor } from '../../lib/editor-registry';
import { SettingsModal } from '../common/SettingsModal';
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons';

export function MainToolbar() {
  const [showSettings, setShowSettings] = useState(false);
  const closeDocument = useStore(s => s.closeDocument);
  const activeDocument = useStore(s => s.activeDocument);
  const activeSectionId = useStore(s => s.activeSectionId);
  const toggleLeftSidebar = useStore(s => s.toggleLeftSidebar);
  const toggleRightSidebar = useStore(s => s.toggleRightSidebar);
  const setGraphOpen = useStore(s => s.setGraphOpen);

  const editor = getActiveEditor(activeSectionId);

  // Each formatting button shows a familiar icon; `tip` is the hover label and the
  // accessible name (the icon itself is aria-hidden).
  const btn = (icon: ToolbarIconName, tip: string, action: () => void, isActive?: boolean) => (
    <button
      className={`toolbar-btn toolbar-btn-icon${isActive ? ' active' : ''}`}
      onClick={action}
      data-tip={tip}
      aria-label={tip}
    >
      {ToolbarIcon[icon]}
    </button>
  );

  return (
    <div className="main-toolbar">
      <button className="toolbar-back-btn" onClick={closeDocument} data-tip="Back to documents" aria-label="Back to documents">
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
            {btn('bold', 'Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {btn('italic', 'Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {btn('underline', 'Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            {btn('strike', 'Strikethrough', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
          </div>

          <div className="toolbar-group">
            {btn('h1', 'Heading 1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
            {btn('h2', 'Heading 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
            {btn('h3', 'Heading 3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
          </div>

          <div className="toolbar-group">
            {btn('bullet', 'Bullet list', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
            {btn('ordered', 'Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          </div>
        </>
      )}

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={toggleLeftSidebar} data-tip="Toggle left sidebar" aria-label="Toggle left sidebar">
          &#9776;
        </button>
        <button className="toolbar-btn" onClick={() => setGraphOpen(true)} data-tip="Graph view" aria-label="Graph view">
          &#9672;
        </button>
        <button className="toolbar-btn" onClick={toggleRightSidebar} data-tip="Toggle right sidebar" aria-label="Toggle right sidebar">
          &#9776;
        </button>
        <button className="toolbar-btn" onClick={() => setShowSettings(true)} data-tip="Settings" aria-label="Settings">
          &#9881;
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
