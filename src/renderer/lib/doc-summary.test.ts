import { describe, it, expect } from 'vitest';
import { summarizeDoc } from './doc-summary';

const doc = (...paras: string[]) =>
  JSON.stringify({
    type: 'doc',
    content: paras.map(t => ({
      type: 'paragraph',
      content: t ? [{ type: 'text', text: t }] : [],
    })),
  });

describe('summarizeDoc', () => {
  it('counts text characters across paragraphs', () => {
    const { chars } = summarizeDoc(doc('Hello', 'World'));
    // "Hello World" with a block-boundary space = 11.
    expect(chars).toBe(11);
  });

  it('previews the first characters and ellipsizes long text', () => {
    const long = 'a'.repeat(100);
    const { preview } = summarizeDoc(doc(long));
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBe(61); // 60 chars + ellipsis
  });

  it('does not ellipsize short text', () => {
    expect(summarizeDoc(doc('Short line')).preview).toBe('Short line');
  });

  it('collapses whitespace in the preview', () => {
    expect(summarizeDoc(doc('one', 'two')).preview).toBe('one two');
  });

  it('returns empty for an empty document', () => {
    expect(summarizeDoc(doc(''))).toEqual({ chars: 0, preview: '' });
  });

  it('returns empty on malformed JSON rather than throwing', () => {
    expect(summarizeDoc('not json')).toEqual({ chars: 0, preview: '' });
  });
});
