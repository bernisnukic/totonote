import { Extension } from '@tiptap/core';

export interface ShortcutConfig {
  [action: string]: string;
}

export const KeyboardShortcuts = Extension.create<{ shortcuts: ShortcutConfig }>({
  name: 'customKeyboardShortcuts',

  addOptions() {
    return {
      shortcuts: {},
    };
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {};

    // Default shortcuts that can be overridden
    const defaultShortcuts: Record<string, () => boolean> = {
      'Mod-s': () => {
        // Save is handled by the editor component
        return true;
      },
      'Escape': () => {
        // ESC hides highlights
        return true;
      },
    };

    return { ...defaultShortcuts, ...shortcuts };
  },
});
