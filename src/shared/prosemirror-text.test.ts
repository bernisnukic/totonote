import { describe, it, expect } from 'vitest';
import { extractTextBetween, nodeSize, excerptFromContent, type PMJsonNode, imagesInRange, drawingsInRange } from './prosemirror-text';

const text = (t: string): PMJsonNode => ({ type: 'text', text: t });
const p = (...content: PMJsonNode[]): PMJsonNode => ({ type: 'paragraph', content });
const doc = (...content: PMJsonNode[]): PMJsonNode => ({ type: 'doc', content });

describe('nodeSize', () => {
  it('counts characters for text nodes', () => {
    expect(nodeSize(text('Gura'))).toBe(4);
  });

  it('adds open and close tokens for containers', () => {
    expect(nodeSize(p(text('Gura')))).toBe(6);
  });

  it('gives an empty paragraph size 2, not 1', () => {
    expect(nodeSize({ type: 'paragraph' })).toBe(2);
  });

  it('gives leaves size 1', () => {
    expect(nodeSize({ type: 'hardBreak' })).toBe(1);
    expect(nodeSize({ type: 'horizontalRule' })).toBe(1);
  });
});

describe('extractTextBetween', () => {
  const oneParagraph = doc(p(text('Gura was born in Atlantis.')));

  it('extracts a full single-paragraph range (text sits at 1..27)', () => {
    expect(extractTextBetween(oneParagraph, 1, 27)).toBe('Gura was born in Atlantis.');
  });

  it('extracts a sub-range', () => {
    expect(extractTextBetween(oneParagraph, 1, 5)).toBe('Gura');
    expect(extractTextBetween(oneParagraph, 6, 9)).toBe('was');
  });

  it('tolerates a range that includes the paragraph boundaries (select-all)', () => {
    expect(extractTextBetween(oneParagraph, 0, 28)).toBe('Gura was born in Atlantis.');
  });

  it('spans two paragraphs with a single separator', () => {
    const d = doc(p(text('Hello')), p(text('World')));
    // p1 occupies 0..7 (text 1..6), p2 occupies 7..14 (text 8..13)
    expect(extractTextBetween(d, 1, 13)).toBe('Hello World');
  });

  it('starts mid-paragraph and ends mid-next-paragraph', () => {
    const d = doc(p(text('Hello')), p(text('World')));
    expect(extractTextBetween(d, 4, 11)).toBe('lo Wor');
  });

  it('splits marks into adjacent text nodes without losing characters', () => {
    // Bold text is a separate text node in the JSON; positions run straight through.
    const d = doc(p(text('Gura '), text('was'), text(' born.')));
    expect(extractTextBetween(d, 1, 15)).toBe('Gura was born.');
    expect(extractTextBetween(d, 6, 9)).toBe('was');
  });

  it('walks nested list structure with the right offsets', () => {
    // bulletList(+1) > listItem(+1) > paragraph(+1) puts the text at position 3.
    const d = doc({
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('Item'))] },
        { type: 'listItem', content: [p(text('Next'))] },
      ],
    });
    expect(extractTextBetween(d, 3, 7)).toBe('Item');
    expect(extractTextBetween(d, 3, 15)).toBe('Item Next');
  });

  it('gives hard breaks a position but no text', () => {
    const d = doc(p(text('one'), { type: 'hardBreak' }, text('two')));
    // text 1..4, break at 4..5, text 5..8
    expect(extractTextBetween(d, 1, 8)).toBe('onetwo');
    expect(extractTextBetween(d, 5, 8)).toBe('two');
  });

  it('returns empty for a range beyond the content', () => {
    expect(extractTextBetween(oneParagraph, 100, 120)).toBe('');
  });
});

describe('excerptFromContent', () => {
  it('parses stored JSON and trims the result', () => {
    const stored = JSON.stringify(doc(p(text('  spaced out  '))));
    expect(excerptFromContent(stored, 1, 15)).toBe('spaced out');
  });

  it('returns empty for unparseable or empty content', () => {
    expect(excerptFromContent('not json', 0, 5)).toBe('');
    expect(excerptFromContent('', 0, 5)).toBe('');
  });
});

describe('imagesInRange', () => {
  const img = (id: string) => ({ type: 'image', attrs: { src: `totonote://media/${id}` } });
  const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  it('finds an image inside the range', () => {
    // doc: [para "abc"](0..5) [image](5..6)
    const doc = { type: 'doc', content: [para('abc'), img('one')] };
    expect(imagesInRange(doc, 5, 6)).toEqual(['one']);
  });

  it('ignores an image outside the range', () => {
    const doc = { type: 'doc', content: [para('abc'), img('one')] };
    expect(imagesInRange(doc, 0, 5)).toEqual([]);
  });

  it('finds several images across a wider range', () => {
    const doc = { type: 'doc', content: [img('a'), img('b'), img('c')] };
    expect(imagesInRange(doc, 0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates the same image used twice', () => {
    const doc = { type: 'doc', content: [img('same'), img('same')] };
    expect(imagesInRange(doc, 0, 2)).toEqual(['same']);
  });

  it('ignores images that are not stored in the database', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://x/y.png' } }] };
    expect(imagesInRange(doc, 0, 1)).toEqual([]);
  });

  it('agrees with the text extractor about where things are', () => {
    // An image contributes no text, so text and images partition the same range.
    const doc = { type: 'doc', content: [para('hi'), img('pic'), para('bye')] };
    const whole = { from: 0, to: nodeSize(doc) };
    expect(extractTextBetween(doc, whole.from, whole.to)).toBe('hi bye');
    expect(imagesInRange(doc, whole.from, whole.to)).toEqual(['pic']);
  });

  it('finds an image nested inside a list item', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'bulletList', content: [{ type: 'listItem', content: [img('nested')] }] },
      ],
    };
    expect(imagesInRange(doc, 0, nodeSize(doc))).toEqual(['nested']);
  });
});

describe('drawingsInRange', () => {
  const draw = (id: string) => ({ type: 'drawing', attrs: { drawingId: id } });
  const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

  it('finds a drawing inside the range', () => {
    const doc = { type: 'doc', content: [para('abc'), draw('d1')] };
    expect(drawingsInRange(doc, 5, 6)).toEqual(['d1']);
  });

  it('ignores one outside the range', () => {
    const doc = { type: 'doc', content: [para('abc'), draw('d1')] };
    expect(drawingsInRange(doc, 0, 5)).toEqual([]);
  });

  it('keeps images and drawings apart', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'totonote://media/img' } }, draw('d1')],
    };
    expect(imagesInRange(doc, 0, 2)).toEqual(['img']);
    expect(drawingsInRange(doc, 0, 2)).toEqual(['d1']);
  });

  it('counts a drawing as one position, like an image', () => {
    // Both are atoms; if either measured differently every annotation after it in the
    // section would be off by that difference.
    const withImage = { type: 'doc', content: [{ type: 'image', attrs: {} }] };
    const withDrawing = { type: 'doc', content: [draw('d1')] };
    expect(nodeSize(withDrawing)).toBe(nodeSize(withImage));
  });
});
