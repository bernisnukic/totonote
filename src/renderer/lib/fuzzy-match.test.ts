import { describe, it, expect } from 'vitest';
import { fuzzyMatch, levenshtein } from './fuzzy-match';

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('gura', 'gura')).toBe(0);
  });

  it('counts a substitution, insertion and deletion as one each', () => {
    expect(levenshtein('irys', 'iris')).toBe(1);
    expect(levenshtein('cat', 'cart')).toBe(1);
    expect(levenshtein('cart', 'cat')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'));
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('fuzzyMatch', () => {
  it('matches everything when the query is empty', () => {
    // The sidebar shows the whole tree with an empty search box.
    expect(fuzzyMatch('', 'anything at all')).toBe(true);
  });

  it('matches a plain substring', () => {
    expect(fuzzyMatch('drag', 'the dragon sleeps')).toBe(true);
  });

  it('tolerates a typo — the case the search box exists for', () => {
    expect(fuzzyMatch('iris', 'irys')).toBe(true);
  });

  it('matches a typo against one word inside a longer name', () => {
    expect(fuzzyMatch('dragn', 'ancient dragon lair')).toBe(true);
  });

  it('rejects an unrelated query', () => {
    expect(fuzzyMatch('zzzzzz', 'ancient dragon lair')).toBe(false);
  });

  it('gets more forgiving as the query lengthens', () => {
    // threshold = floor(len/3): 6 chars allows 2 edits, so two typos still match.
    expect(fuzzyMatch('dragoon', 'dragon')).toBe(true);
    // A 3-char query only allows 1 edit, so two edits miss.
    expect(fuzzyMatch('xyz', 'abc')).toBe(false);
  });

  it('a single character matches almost anything (documented sharp edge)', () => {
    // Threshold is at least 1, so one character is within an edit of most short words.
    expect(fuzzyMatch('a', 'b')).toBe(true);
  });
});
