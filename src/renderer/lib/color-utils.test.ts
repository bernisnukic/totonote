import { describe, it, expect } from 'vitest';
import { getTagColor, getTagColors, hexToRgba, rgbaToHex } from './color-utils';

describe('getTagColor', () => {
  it('returns a color string', () => {
    const color = getTagColor(0);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('wraps around for large indices', () => {
    const colors = getTagColors();
    expect(getTagColor(colors.length)).toBe(colors[0]);
    expect(getTagColor(colors.length + 1)).toBe(colors[1]);
  });
});

describe('getTagColors', () => {
  it('returns an array of hex colors', () => {
    const colors = getTagColors();
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('returns a new array each time', () => {
    const a = getTagColors();
    const b = getTagColors();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(hexToRgba('#00ff00', 1)).toBe('rgba(0, 255, 0, 1)');
    expect(hexToRgba('#0000ff', 0)).toBe('rgba(0, 0, 255, 0)');
  });

  it('handles the accent color', () => {
    expect(hexToRgba('#48dbfb', 0.25)).toBe('rgba(72, 219, 251, 0.25)');
  });
});

describe('rgbaToHex', () => {
  it('converts rgba to hex', () => {
    expect(rgbaToHex('rgba(255, 0, 0, 0.5)')).toBe('#ff0000');
    expect(rgbaToHex('rgb(0, 255, 0)')).toBe('#00ff00');
  });

  it('returns default for invalid input', () => {
    expect(rgbaToHex('not a color')).toBe('#48dbfb');
  });
});
