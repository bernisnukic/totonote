import { describe, it, expect } from 'vitest';
import { resolveTheme, followsSystem, SYSTEM_DARK, SYSTEM_LIGHT } from './theme';

describe('resolveTheme', () => {
  it('passes an explicit choice straight through', () => {
    for (const theme of ['light', 'wood', 'dark', 'black'] as const) {
      expect(resolveTheme(theme, true), theme).toBe(theme);
      expect(resolveTheme(theme, false), theme).toBe(theme);
    }
  });

  it('follows the OS when set to system', () => {
    expect(resolveTheme('system', true)).toBe(SYSTEM_DARK);
    expect(resolveTheme('system', false)).toBe(SYSTEM_LIGHT);
  });

  it('falls back to a real theme for a value it does not recognise', () => {
    // A database written by a newer or older build must not leave the app unstyled.
    expect(resolveTheme('midnight-neon', true)).toBe(SYSTEM_DARK);
    expect(resolveTheme('', false)).toBe(SYSTEM_DARK);
  });
});

describe('followsSystem', () => {
  it('is true only for the system choice', () => {
    expect(followsSystem('system')).toBe(true);
    expect(followsSystem('dark')).toBe(false);
    expect(followsSystem('')).toBe(false);
  });
});
