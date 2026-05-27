const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');

export function formatKeybinding(binding: string): string {
  return binding
    .replace('Mod', isMac ? '\u2318' : 'Ctrl')
    .replace('Shift', isMac ? '\u21E7' : 'Shift')
    .replace('Alt', isMac ? '\u2325' : 'Alt')
    .replace('Ctrl', isMac ? '\u2303' : 'Ctrl')
    .replace(/\+/g, isMac ? '' : '+');
}

export function getModKey(): string {
  return isMac ? 'Meta' : 'Control';
}

export function isModKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}
