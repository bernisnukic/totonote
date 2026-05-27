import type { Editor } from '@tiptap/core';

const editors = new Map<string, Editor>();

export function registerEditor(sectionId: string, editor: Editor) {
  editors.set(sectionId, editor);
}

export function unregisterEditor(sectionId: string) {
  editors.delete(sectionId);
}

export function getEditor(sectionId: string): Editor | null {
  return editors.get(sectionId) || null;
}

export function getActiveEditor(activeSectionId: string | null): Editor | null {
  if (!activeSectionId) return null;
  return editors.get(activeSectionId) || null;
}
