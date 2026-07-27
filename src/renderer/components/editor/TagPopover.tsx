import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { useClickOutside } from '../../hooks/useClickOutside';
import { getActiveEditor } from '../../lib/editor-registry';
import { clickable } from '../../lib/clickable';

export function TagPopover() {
  const activeAnnotationId = useStore(s => s.activeAnnotationId);
  const activeSectionId = useStore(s => s.activeSectionId);
  const annotations = useStore(s => s.annotations);
  const tags = useStore(s => s.tags);
  const categories = useStore(s => s.categories);
  const setActiveAnnotation = useStore(s => s.setActiveAnnotation);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setActiveAnnotation(null));

  const annotation = annotations.find(a => a.id === activeAnnotationId);
  const tag = annotation ? tags.find(t => t.id === annotation.tagId) : null;
  const category = tag ? categories.find(c => c.id === tag.categoryId) : null;

  // Escape closes it wherever the focus happens to be — the editor's own handler only
  // fires while the editor has focus, and clicking a highlight often takes it elsewhere.
  useEffect(() => {
    if (!annotation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveAnnotation(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [annotation, setActiveAnnotation]);

  useEffect(() => {
    if (!annotation) {
      setPosition(null);
      return;
    }

    const editor = getActiveEditor(activeSectionId);
    if (!editor) {
      setPosition(null);
      return;
    }

    try {
      const coords = editor.view.coordsAtPos(annotation.fromPos);
      setPosition({ x: coords.left, y: coords.bottom + 8 });
    } catch {
      setPosition(null);
    }
  }, [annotation, activeSectionId]);

  if (!annotation || !tag || !position) return null;

  return (
    <div
      ref={ref}
      className="tag-popover"
      style={{
        left: position.x,
        top: position.y,
        position: 'fixed',
      }}
    >
      <div className="tag-popover-header">
        <div className="tag-popover-color" style={{ backgroundColor: tag.color }} />
        {/* The name is the way into the tag's page. Clicking a highlight told you which
            tag it carried, then left you to go and find that tag in the sidebar. */}
        <span
          className="tag-popover-name tag-popover-name--link"
          {...clickable(() => {
            setFocusedTag(tag.id);
            setActiveAnnotation(null);
          })}
          title={`Open the ${tag.name} page`}
        >
          {tag.name}
        </span>
        {category && (
          <span
            className="tag-popover-category tag-popover-name--link"
            {...clickable(() => {
              setFocusedCategory(category.id);
              setActiveAnnotation(null);
            })}
            title={`Open the ${category.name} page`}
          >
            {category.name}
          </span>
        )}
      </div>
      {(annotation.note || tag.description) && (
        <div className="tag-popover-note">{annotation.note || tag.description}</div>
      )}
    </div>
  );
}
