import React, { useEffect, useReducer } from 'react';
import { useStore } from '../../stores';
import { getActiveEditor } from '../../lib/editor-registry';
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons';
import { invoke } from '../../lib/ipc-client';
import { mediaIdFromUrl } from '../../../shared/media-refs';
import { importImageFile, isSupportedImage, SUPPORTED_IMAGE_TYPES } from '../../lib/image-import';
import { alertDialog } from '../common/ConfirmDialog';

export function MainToolbar() {
  const closeDocument = useStore(s => s.closeDocument);
  const activeDocument = useStore(s => s.activeDocument);
  const activeSectionId = useStore(s => s.activeSectionId);
  const toggleLeftSidebar = useStore(s => s.toggleLeftSidebar);
  const toggleRightSidebar = useStore(s => s.toggleRightSidebar);
  const setGraphOpen = useStore(s => s.setGraphOpen);
  const setTimelineOpen = useStore(s => s.setTimelineOpen);
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

  /** Pick an image file and drop it in at the caret. */
  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SUPPORTED_IMAGE_TYPES.join(',');
    input.multiple = true;
    input.onchange = async () => {
      const files = [...(input.files ?? [])].filter(isSupportedImage);
      for (const file of files) {
        try {
          const { meta, url } = await importImageFile(file);
          editor?.chain().focus().setImage({ src: url, width: meta.width }).run();
        } catch (err) {
          await alertDialog(
            `Could not add "${file.name}".`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    };
    input.click();
  };

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
            {btn('image', 'Insert a picture', insertImage)}
            {btn('draw', drawOverImage ? 'Draw on this image' : 'Insert a drawing', () => void insertDrawing())}
          </div>
        </>
      )}

      {/* Drawn at the same 16px as the formatting icons — these were text glyphs, which
          rendered noticeably smaller than the buttons beside them. */}
      <div className="toolbar-group">
        {btn('sidebar', 'Toggle left sidebar', toggleLeftSidebar)}
        {btn('graph', 'Graph view', () => setGraphOpen(true))}
        {btn('timeline', 'Timeline', () => setTimelineOpen(true))}
        {btn('sidebar', 'Toggle right sidebar', toggleRightSidebar)}
        {btn('settings', 'Settings', () => setSettingsOpen(true))}
      </div>

    </div>
  );
}
