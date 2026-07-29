import { describe, it, expect } from 'vitest';
import { describeChange, diffEnds, type ChangePoint } from './history-diff';

/** A document of one paragraph per line given. */
function doc(...paragraphs: string[]): string {
  return JSON.stringify({
    type: 'doc',
    content: paragraphs.map(text => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    })),
  });
}

function point(content: string, extra: Partial<ChangePoint> = {}): ChangePoint {
  return { content, annotations: [], drawings: [], ...extra };
}

describe('diffEnds', () => {
  it('reports only the changed middle, not the whole string', () => {
    expect(diffEnds('the red dragon', 'the blue dragon')).toEqual({
      removed: 'red',
      added: 'blue',
    });
  });

  it('reports an insertion with nothing removed', () => {
    expect(diffEnds('hello', 'hello there')).toEqual({ removed: '', added: ' there' });
  });

  it('reports a deletion with nothing added', () => {
    expect(diffEnds('hello there', 'hello')).toEqual({ removed: ' there', added: '' });
  });

  it('is empty on both sides when nothing changed', () => {
    expect(diffEnds('same', 'same')).toEqual({ removed: '', added: '' });
  });
});

describe('describeChange', () => {
  it('names the first checkpoint rather than diffing against nothing', () => {
    expect(describeChange(null, point(doc('hello')))).toBe('Starting point');
  });

  it('reports typing', () => {
    expect(describeChange(point(doc('')), point(doc('hello')))).toBe('Added “hello”');
  });

  it('reports deleting', () => {
    expect(describeChange(point(doc('hello')), point(doc('')))).toBe('Removed “hello”');
  });

  it('reports putting deleted text back — the effect, not that it was an undo', () => {
    // The tester asked for "undid deleting hello". Nothing records *why* a checkpoint
    // happened, so this says what the checkpoint actually holds.
    expect(describeChange(point(doc('')), point(doc('hello')))).toBe('Added “hello”');
  });

  it('reports a replacement', () => {
    expect(describeChange(point(doc('the red dragon')), point(doc('the blue dragon')))).toBe(
      'Replaced “red” with “blue”',
    );
  });

  it('counts long additions instead of quoting a paragraph', () => {
    const long = 'a'.repeat(200);
    expect(describeChange(point(doc('')), point(doc(long)))).toBe('Added 200 characters');
  });

  it('truncates a quote that is long but still worth showing', () => {
    const text = 'the dragon awoke beneath the mountain';
    // 32 characters kept, then an ellipsis inside the closing quote.
    expect(describeChange(point(doc('')), point(doc(text)))).toBe(
      'Added \u201cthe dragon awoke beneath the mou\u2026\u201d',
    );
  });

  it('reports an empty paragraph being added, which leaves the words identical', () => {
    expect(describeChange(point(doc('one')), point(doc('one', '')))).toBe('Added a paragraph');
  });

  it('reports splitting a paragraph in two', () => {
    expect(describeChange(point(doc('onetwo')), point(doc('one', 'two')))).toBe(
      'Split a paragraph',
    );
  });

  it('reports drawings appearing and disappearing', () => {
    const none = point(doc('x'));
    const one = point(doc('x'), { drawings: [{ id: 'd1', strokes: '[]' }] });
    expect(describeChange(none, one)).toBe('Added a drawing');
    expect(describeChange(one, none)).toBe('Removed a drawing');
  });

  it('reports drawing on an existing drawing', () => {
    const before = point(doc('x'), { drawings: [{ id: 'd1', strokes: '[]' }] });
    const after = point(doc('x'), { drawings: [{ id: 'd1', strokes: '[{"p":[1,2]}]' }] });
    expect(describeChange(before, after)).toBe('Changed a drawing');
  });

  it('reports a picture being added', () => {
    const withImage = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
        { type: 'image', attrs: { src: 'totonote://media/1' } },
      ],
    });
    expect(describeChange(point(doc('x')), point(withImage))).toBe('Added a picture');
  });

  it('quotes the text a new highlight covers', () => {
    const content = doc('the dragon sleeps');
    // Paragraph opens at 0, so its text starts at 1: "dragon" is 5..11.
    const before = point(content);
    const after = point(content, { annotations: [{ id: 'a1', fromPos: 5, toPos: 11 }] });
    expect(describeChange(before, after)).toBe('Highlighted “dragon”');
  });

  it('reports a highlight being removed', () => {
    const content = doc('the dragon sleeps');
    const before = point(content, { annotations: [{ id: 'a1', fromPos: 5, toPos: 11 }] });
    expect(describeChange(before, point(content))).toBe('Removed a highlight');
  });

  it('reports a highlight that moved without the words changing', () => {
    const content = doc('the dragon sleeps');
    const before = point(content, { annotations: [{ id: 'a1', fromPos: 5, toPos: 11 }] });
    const after = point(content, { annotations: [{ id: 'a1', fromPos: 5, toPos: 18 }] });
    expect(describeChange(before, after)).toBe('Moved a highlight');
  });

  it('falls back to formatting when nothing else can be told apart', () => {
    const plain = doc('hello');
    const bold = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'hello' }] },
      ],
    });
    expect(describeChange(point(plain), point(bold))).toBe('Changed formatting');
  });
});
