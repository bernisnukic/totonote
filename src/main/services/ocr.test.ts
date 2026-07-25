import { describe, it, expect, vi } from 'vitest';

// The recognition engine itself is exercised end-to-end by e2e/ocr.spec.ts; what's worth
// pinning here is the tidying, which decides what actually reaches the search index.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getAppPath: () => '/tmp' } }));
vi.mock('tesseract.js', () => ({ createWorker: async () => ({ recognize: async () => ({ data: { text: '' } }), terminate: async () => undefined }) }));

import { normalise, confidentText, MIN_WORD_CONFIDENCE } from './ocr';

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

describe('confidentText', () => {
  const line = (...words: Array<[string, number]>) => ({
    words: words.map(([text, confidence]) => ({ text, confidence })),
  });

  it('keeps words it read confidently', () => {
    expect(confidentText([line(['Frozen', 95], ['Harbour', 96])])).toBe('Frozen Harbour');
  });

  it('throws away the guessing', () => {
    // Measured: a badly skewed image produced "grozel"/"Haroou!" at 19 and 8. Indexing
    // that is worse than indexing nothing — it can never match a real query.
    expect(confidentText([line(['grozel', 19], ['Haroou!', 8])])).toBe('');
  });

  it('keeps the good words on a line that also has bad ones', () => {
    // A map whose big labels read cleanly should still contribute them.
    expect(confidentText([line(['HARBOUR', 92], ['xvii', 11])])).toBe('HARBOUR');
  });

  it('keeps lines separate', () => {
    expect(confidentText([line(['FROZEN', 90]), line(['SEA', 88])])).toBe('FROZEN\nSEA');
  });

  it('drops a line left empty after filtering', () => {
    expect(confidentText([line(['good', 90]), line(['??', 4])])).toBe('good');
  });

  it('ignores whitespace-only words whatever their score', () => {
    expect(confidentText([line(['  ', 99], ['real', 80])])).toBe('real');
  });

  it('uses a threshold that separates what was actually measured', () => {
    // Correct words scored 42 and above across every style tested; garbage scored 19 and
    // below. The threshold has to sit between the two with room on both sides.
    expect(MIN_WORD_CONFIDENCE).toBeGreaterThan(19);
    expect(MIN_WORD_CONFIDENCE).toBeLessThan(42);
  });

  it('copes with a line carrying no words at all', () => {
    expect(confidentText([{}])).toBe('');
  });
});
