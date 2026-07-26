import { describe, it, expect } from 'vitest';
import { clampLineSpacing, parseLineSpacing, DEFAULT_LINE_SPACING } from './preference-slice';

describe('line spacing', () => {
  it('keeps a sensible value as given', () => {
    expect(clampLineSpacing(2)).toBe(2);
  });

  it('refuses to squash lines into each other or fling them apart', () => {
    expect(clampLineSpacing(0.2)).toBe(1.2);
    expect(clampLineSpacing(9)).toBe(2.4);
  });

  it('falls back to the default for nonsense', () => {
    expect(clampLineSpacing(Number.NaN)).toBe(DEFAULT_LINE_SPACING);
    expect(parseLineSpacing('not a number')).toBe(DEFAULT_LINE_SPACING);
    expect(parseLineSpacing(null)).toBe(DEFAULT_LINE_SPACING);
    expect(parseLineSpacing('')).toBe(DEFAULT_LINE_SPACING);
  });

  it('reads a stored value back', () => {
    expect(parseLineSpacing('2')).toBe(2);
    expect(parseLineSpacing('1.2')).toBe(1.2);
  });

  it('defaults to what the editor already looked like, so nobody`s writing reflows', () => {
    expect(DEFAULT_LINE_SPACING).toBe(1.7);
  });
});
