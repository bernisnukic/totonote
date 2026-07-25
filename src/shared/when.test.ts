import { describe, it, expect } from 'vitest';
import { parseWhen, sortByWhen, groupByWhen, type Dated } from './when';

const when = (s: string) => parseWhen(s).sortKey;

describe('reading a date out of what was typed', () => {
  it('keeps the label exactly as written', () => {
    expect(parseWhen('  Year 300 of the Third Age  ').label).toBe('Year 300 of the Third Age');
  });

  it('reads a plain year', () => {
    expect(when('Year 300')).toBe(300);
    expect(when('300')).toBe(300);
  });

  it('reads a year before the world began, written as a negative', () => {
    expect(when('-450')).toBe(-450);
    expect(when('-450 BE')).toBe(-450);
  });

  it('orders a made-up calendar the way its numbers run', () => {
    expect(when('Year 12')!).toBeLessThan(when('Year 300')!);
    expect(when('-450 BE')!).toBeLessThan(when('Year 1')!);
  });

  it('reads a real date, and orders two of them correctly', () => {
    expect(when('1885-03-12')!).toBeLessThan(when('1885-11-02')!);
    expect(when('1885-11-02')!).toBeLessThan(when('1886-01-01')!);
  });

  it('reads a date written out in words', () => {
    expect(when('12 March 1885')).toBe(18850312);
  });

  it('does not read a range as a negative number', () => {
    expect(when('Year 300-400')).toBe(300);
  });

  it('has no opinion about text with no number in it', () => {
    expect(when('long ago')).toBeNull();
    expect(when('')).toBeNull();
    expect(parseWhen(null).sortKey).toBeNull();
    expect(parseWhen(undefined).label).toBe('');
  });

  it('does not mistake a lone four-digit-free string for a date', () => {
    // "March" alone parses as a date in some engines; without a year it means nothing here.
    expect(when('March')).toBeNull();
  });
});

describe('putting events in order', () => {
  const entry = (label: string, item: string): Dated<string> => ({ when: parseWhen(label), item });

  it('runs earliest first', () => {
    const sorted = sortByWhen([entry('Year 300', 'c'), entry('Year 12', 'a'), entry('Year 90', 'b')]);
    expect(sorted.map(e => e.item)).toEqual(['a', 'b', 'c']);
  });

  it('puts undated events at the end, not at year zero', () => {
    const sorted = sortByWhen([entry('long ago', 'undated'), entry('Year 5', 'dated')]);
    expect(sorted.map(e => e.item)).toEqual(['dated', 'undated']);
  });

  it('breaks a tie the way it is asked to, rather than at random', () => {
    const sorted = sortByWhen(
      [entry('Year 5', 'zebra'), entry('Year 5', 'apple')],
      (a, b) => a.localeCompare(b),
    );
    expect(sorted.map(e => e.item)).toEqual(['apple', 'zebra']);
  });

  it('leaves the caller’s array alone', () => {
    const input = [entry('Year 9', 'b'), entry('Year 1', 'a')];
    sortByWhen(input);
    expect(input.map(e => e.item)).toEqual(['b', 'a']);
  });
});

describe('grouping a timeline into moments', () => {
  const entry = (label: string, item: string): Dated<string> => ({ when: parseWhen(label), item });

  it('collects everything that happened at the same time', () => {
    const groups = groupByWhen(sortByWhen([
      entry('Year 5', 'a'),
      entry('Year 9', 'c'),
      entry('Year 5', 'b'),
    ]));
    expect(groups).toEqual([
      { label: 'Year 5', items: ['a', 'b'] },
      { label: 'Year 9', items: ['c'] },
    ]);
  });

  it('gathers the undated ones under one heading', () => {
    const groups = groupByWhen(sortByWhen([
      entry('sometime', 'x'),
      entry('Year 1', 'a'),
      entry('who knows', 'y'),
    ]));
    expect(groups).toEqual([
      { label: 'Year 1', items: ['a'] },
      { label: 'Undated', items: ['x', 'y'] },
    ]);
  });

  it('is empty for nothing', () => {
    expect(groupByWhen([])).toEqual([]);
  });
});
