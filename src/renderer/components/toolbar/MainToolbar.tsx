import React, { useEffect, useReducer } from 'react';
import { useStore } from '../../stores';
import { getActiveEditor } from '../../lib/editor-registry';
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons';
import { invoke } from '../../lib/ipc-client';
import { mediaIdFromUrl } from '../../../shared/media-refs';

export function MainToolbar() {
  const closeDocument = useStore(s => s.closeDocument);
  const activeDocument = useStore(s => s.activeDocument);
  const activeSectionId = useStore(s => s.activeSectionId);
  const toggleLeftSidebar = useStore(s => s.toggleLeftSidebar);
  const toggleRightSidebar = useStore(s => s.toggleRightSidebar);
  const setGraphOpen = useStore(s => s.setGraphOpen);
  const setSettingsOpen = useStore(s => s.setSettingsOpen);

  const editor = getActiveEditor(activeSectionId);

  // Everything below asks the editor what's active right now — whether Bold applies, and
  // whether an image is selected. React has no idea when a ProseMirror selection moves, so
  // without this the toolbar only refreshes when some *other* state happens to change, and
  // the button states are stale until then.
  const [, bumpToolbar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const onTransaction = () => bumpToolbar();
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  // With an image selected, a drawing goes on top of it — the marking-up-a-map case.
  // Otherwise it's a blank sketch surface.
  const selectedImage = editor?.isActive('image')
    ? (editor.getAttributes('image') as { src?: string; width?: number })
    : null;
  const drawOverImage = Boolean(selectedImage?.src && mediaIdFromUrl(selectedImage.src));

  const insertDrawing = async () => {
    if (!editor) return;
    const backgroundMediaId = selectedImage?.src ? mediaIdFromUrl(selectedImage.src) : null;
    let aspectRatio = 1.5;
    if (backgroundMediaId) {
      const meta = await invoke('media:get-meta', { id: backgroundMediaId });
      if (meta && meta.height > 0) aspectRatio = meta.width / meta.height;
    }
    const record = await invoke('drawing:create', { backgroundMediaId, aspectRatio });
    editor
      .chain()
      .focus()
      .insertDrawing({ drawingId: record.id, backgroundMediaId, aspectRatio })
      .run();
  };

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

          <div className="toolbar-group">
            <button
              className="toolbar-btn"
              onClick={insertDrawing}
              data-tip={drawOverImage ? 'Draw on this image' : 'Insert a drawing'}
              aria-label={drawOverImage ? 'Draw on this image' : 'Insert a drawing'}
            >
              &#9998;
            </button>
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
        <button className="toolbar-btn" onClick={() => setSettingsOpen(true)} data-tip="Settings" aria-label="Settings">
          &#9881;
        </button>
      </div>

    </div>
  );
}
