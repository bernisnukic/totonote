import React, { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { useClickOutside } from '../../hooks/useClickOutside';
import { getActiveEditor } from '../../lib/editor-registry';

export function TagPopover() {
  const activeAnnotationId = useStore(s => s.activeAnnotationId);
  const activeSectionId = useStore(s => s.activeSectionId);
  const annotations = useStore(s => s.annotations);
  const tags = useStore(s => s.tags);
  const categories = useStore(s => s.categories);
  const setActiveAnnotation = useStore(s => s.setActiveAnnotation);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setActiveAnnotation(null));

  const annotation = annotations.find(a => a.id === activeAnnotationId);
  const tag = annotation ? tags.find(t => t.id === annotation.tagId) : null;
  const category = tag ? categories.find(c => c.id === tag.categoryId) : null;

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
        <span className="tag-popover-name">{tag.name}</span>
        {category && <span className="tag-popover-category">{category.name}</span>}
      </div>
      {(annotation.note || tag.description) && (
        <div className="tag-popover-note">{annotation.note || tag.description}</div>
      )}
    </div>
  );
}
