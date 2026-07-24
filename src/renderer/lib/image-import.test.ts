import { describe, it, expect } from 'vitest';
import {
  fitWithin,
  shouldRecompress,
  isSupportedImage,
  MAX_IMAGE_DIMENSION,
  RECOMPRESS_OVER_BYTES,
} from './image-import';

describe('fitWithin', () => {
  it('leaves an image that already fits alone', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600, scaled: false });
  });

  it('leaves an image exactly at the limit alone', () => {
    const r = fitWithin(MAX_IMAGE_DIMENSION, 100);
    expect(r.scaled).toBe(false);
    expect(r.width).toBe(MAX_IMAGE_DIMENSION);
  });

  it('scales a wide image by its longest edge', () => {
    const r = fitWithin(4000, 2000);
    expect(r).toEqual({ width: 2000, height: 1000, scaled: true });
  });

  it('scales a tall image by its longest edge', () => {
    const r = fitWithin(2000, 6000);
    expect(r).toEqual({ width: 667, height: 2000, scaled: true });
  });

  it('keeps the aspect ratio', () => {
    const r = fitWithin(5000, 2500);
    expect(r.width / r.height).toBeCloseTo(2, 2);
  });

  it('never collapses an edge to zero on an extreme panorama', () => {
    // A 10000x3 strip would round its height to 0 without the guard, and a zero-height
    // canvas throws on export.
    const r = fitWithin(10000, 3);
    expect(r.height).toBeGreaterThanOrEqual(1);
    expect(r.width).toBe(MAX_IMAGE_DIMENSION);
  });

  it('handles a zero-sized image without dividing by zero', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0, scaled: false });
  });

  it('honours a custom maximum', () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50, scaled: true });
  });
});

describe('shouldRecompress', () => {
  it('always re-encodes something that was scaled', () => {
    expect(shouldRecompress(1, true)).toBe(true);
  });

  it('leaves a small unscaled image as it is', () => {
    // Re-encoding a small PNG can make it bigger and loses nothing worth losing.
    expect(shouldRecompress(1024, false)).toBe(false);
  });

  it('re-encodes a large unscaled image', () => {
    expect(shouldRecompress(RECOMPRESS_OVER_BYTES + 1, false)).toBe(true);
  });
});

describe('isSupportedImage', () => {
  it('accepts the common image types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']) {
      expect(isSupportedImage({ type }), type).toBe(true);
    }
  });

  it('rejects anything else, so pasting text still pastes text', () => {
    for (const type of ['text/plain', 'application/pdf', 'image/svg+xml', '']) {
      expect(isSupportedImage({ type }), type).toBe(false);
    }
  });
});
