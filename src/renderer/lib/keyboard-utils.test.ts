import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatKeybinding, getModKey } from './keyboard-utils';

describe('keyboard-utils', () => {
  describe('formatKeybinding', () => {
    it('formats Mod key for current platform', () => {
      const result = formatKeybinding('Mod+S');
      // On any platform, Mod should be replaced
      expect(result).not.toContain('Mod');
    });

    it('formats basic key combos', () => {
      const result = formatKeybinding('Shift+A');
      expect(result).not.toBe('');
    });
  });

  describe('getModKey', () => {
    it('returns a string', () => {
      const key = getModKey();
      expect(typeof key).toBe('string');
      expect(['Meta', 'Control']).toContain(key);
    });
  });
});
