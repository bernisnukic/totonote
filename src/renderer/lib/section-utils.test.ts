import { describe, it, expect } from 'vitest';
import { generateAbbreviation, estimateTabWidth, getNextSortOrder } from './section-utils';

describe('generateAbbreviation', () => {
  it('takes first N characters for single word', () => {
    expect(generateAbbreviation('Ancient')).toBe('ANC');
    expect(generateAbbreviation('Hi')).toBe('HI');
  });

  it('takes first letter of each word for multi-word', () => {
    expect(generateAbbreviation('Ancient Age')).toBe('AA');
    expect(generateAbbreviation('The Dark Era')).toBe('TDE');
  });

  it('respects maxLength', () => {
    expect(generateAbbreviation('A Very Long Section Name', 2)).toBe('AV');
    expect(generateAbbreviation('Hello', 2)).toBe('HE');
  });

  it('handles empty and whitespace-only input', () => {
    expect(generateAbbreviation('   ')).toBe('');
  });

  it('uppercases the result', () => {
    expect(generateAbbreviation('ancient age')).toBe('AA');
    expect(generateAbbreviation('hello')).toBe('HEL');
  });
});

describe('estimateTabWidth', () => {
  it('returns a positive number', () => {
    expect(estimateTabWidth('Hello')).toBeGreaterThan(0);
  });

  it('longer text produces wider tab', () => {
    expect(estimateTabWidth('A Long Section Name')).toBeGreaterThan(
      estimateTabWidth('ABC')
    );
  });

  it('includes padding', () => {
    // Even empty string should have padding
    expect(estimateTabWidth('')).toBeGreaterThan(0);
  });
});

describe('getNextSortOrder', () => {
  it('returns 0 for empty array', () => {
    expect(getNextSortOrder([])).toBe(0);
  });

  it('returns max + 1', () => {
    expect(getNextSortOrder([{ sortOrder: 0 }, { sortOrder: 2 }, { sortOrder: 1 }])).toBe(3);
  });

  it('handles single element', () => {
    expect(getNextSortOrder([{ sortOrder: 5 }])).toBe(6);
  });
});
