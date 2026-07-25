import { describe, it, expect, vi } from 'vitest';

// The recognition engine itself is exercised end-to-end by e2e/ocr.spec.ts; what's worth
// pinning here is the tidying, which decides what actually reaches the search index.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getAppPath: () => '/tmp' } }));
vi.mock('tesseract.js', () => ({ createWorker: async () => ({ recognize: async () => ({ data: { text: '' } }), terminate: async () => undefined }) }));

import { normalise } from './ocr';

describe('normalise', () => {
  it('keeps the words it read', () => {
    expect(normalise('FROZEN SEA\nHarbour Town')).toBe('FROZEN SEA\nHarbour Town');
  });

  it('collapses the ragged whitespace recognition emits', () => {
    expect(normalise('FROZEN    SEA')).toBe('FROZEN SEA');
    expect(normalise('  padded line  ')).toBe('padded line');
  });

  it('drops single stray characters mistaken for letters', () => {
    // Noise in a photo often reads as a lone "|" or "l"; indexing those is worse than
    // useless because they match everything.
    expect(normalise('FROZEN SEA\n|\nl\nHarbour')).toBe('FROZEN SEA\nHarbour');
  });

  it('drops blank lines', () => {
    expect(normalise('one\n\n\ntwo')).toBe('one\ntwo');
  });

  it('returns empty for a picture with nothing readable', () => {
    expect(normalise('')).toBe('');
    expect(normalise('   \n \n  ')).toBe('');
  });
});
