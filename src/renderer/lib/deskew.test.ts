import { describe, it, expect } from 'vitest';
import { estimateSkew, profileScore, needsCorrection, toGray, type Gray } from './deskew';

/**
 * Synthetic "text": dark horizontal bars on a light field, optionally tilted. Enough to
 * exercise the angle search, which only cares about how rows of ink line up.
 */
function bars(width: number, height: number, degrees: number): Gray {
  const data = new Uint8Array(width * height).fill(255);
  const radians = (degrees * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;

  // Six lines of "text", each 4px tall with gaps between.
  for (let line = 0; line < 6; line++) {
    const baseY = 12 + line * 14;
    for (let t = 0; t < 4; t++) {
      for (let x = 10; x < width - 10; x++) {
        const dx = x - cx;
        const dy = baseY + t - cy;
        const y2 = Math.round(cy + dx * Math.sin(radians) + dy * Math.cos(radians));
        const x2 = Math.round(cx + dx * Math.cos(radians) - dy * Math.sin(radians));
        if (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height) data[y2 * width + x2] = 20;
      }
    }
  }
  return { data, width, height };
}

describe('profileScore', () => {
  it('peaks at the angle the text actually sits at', () => {
    const tilted = bars(200, 100, 8);
    expect(profileScore(tilted, 8)).toBeGreaterThan(profileScore(tilted, 0));
  });

  it('is zero for an empty image rather than dividing by nothing', () => {
    expect(profileScore({ data: new Uint8Array(0), width: 0, height: 0 }, 0)).toBe(0);
  });
});

describe('estimateSkew', () => {
  it('finds level text to be level', () => {
    expect(Math.abs(estimateSkew(bars(200, 100, 0)))).toBeLessThanOrEqual(1);
  });

  it.each([-10, -6, -3, 3, 6, 10, 12])('recovers a %i° tilt', angle => {
    // Within a degree is plenty: the point is to get text near enough to horizontal that
    // recognition works, not to measure the angle precisely.
    expect(estimateSkew(bars(240, 120, angle))).toBeCloseTo(angle, 0);
  });

  it('stays inside the range it was given', () => {
    const result = estimateSkew(bars(200, 100, 30), 15);
    expect(Math.abs(result)).toBeLessThanOrEqual(15);
  });

  it('does not throw on a blank image', () => {
    const blank: Gray = { data: new Uint8Array(100 * 50).fill(255), width: 100, height: 50 };
    expect(() => estimateSkew(blank)).not.toThrow();
  });
});

describe('needsCorrection', () => {
  it('ignores a tilt too small to matter', () => {
    // Rotating for half a degree only resamples the image for no gain.
    expect(needsCorrection(0)).toBe(false);
    expect(needsCorrection(0.5)).toBe(false);
  });

  it('corrects a tilt big enough to hurt recognition', () => {
    expect(needsCorrection(3)).toBe(true);
    expect(needsCorrection(-12)).toBe(true);
  });
});

describe('toGray', () => {
  it('converts RGBA to one byte per pixel', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const gray = toGray(rgba, 2, 1);
    expect(gray.width).toBe(2);
    expect(gray.data[0]).toBe(255);
    expect(gray.data[1]).toBe(0);
  });

  it('weights green most, as perceived brightness does', () => {
    const green = toGray(new Uint8ClampedArray([0, 255, 0, 255]), 1, 1).data[0];
    const blue = toGray(new Uint8ClampedArray([0, 0, 255, 255]), 1, 1).data[0];
    expect(green).toBeGreaterThan(blue);
  });
});
