import { describe, it, expect } from 'vitest';
import { documentLinkIdsInContent, DOCUMENT_LINK_NODE } from './doc-links';
import { extractTextBetween, nodeSize } from './prosemirror-text';

const link = (documentId: string, label = 'Somewhere') => ({
  type: DOCUMENT_LINK_NODE,
  attrs: { documentId, label },
});

const doc = (...content: unknown[]) => JSON.stringify({ type: 'doc', content });
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (t: string) => ({ type: 'text', text: t });

describe('finding the links in a document', () => {
  it('finds a link', () => {
    expect(documentLinkIdsInContent(doc(para(text('See '), link('doc-9'))))).toEqual(['doc-9']);
  });

  it('finds links nested inside lists and quotes', () => {
    const nested = doc({
      type: 'blockquote',
      content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [para(link('deep-1'))] }] }],
    });
    expect(documentLinkIdsInContent(nested)).toEqual(['deep-1']);
  });

  it('keeps repeats, so a count of mentions is possible', () => {
    expect(documentLinkIdsInContent(doc(para(link('a'), text(' and '), link('a'))))).toEqual(['a', 'a']);
  });

  it('finds nothing in content with no links', () => {
    expect(documentLinkIdsInContent(doc(para(text('just words'))))).toEqual([]);
  });

  it('ignores a link with no target rather than reporting an empty id', () => {
    expect(documentLinkIdsInContent(doc(para(link(''))))).toEqual([]);
  });

  it('survives content that is empty, null or not JSON at all', () => {
    expect(documentLinkIdsInContent(null)).toEqual([]);
    expect(documentLinkIdsInContent('')).toEqual([]);
    expect(documentLinkIdsInContent('not json {{{')).toEqual([]);
  });
});

describe('a link in the position arithmetic', () => {
  // The reason this matters: highlight positions are stored as numbers into the same
  // document. A node the arithmetic does not know about shifts every one after it.
  it('occupies exactly one position', () => {
    expect(nodeSize(link('doc-9') as never)).toBe(1);
  });

  it('leaves the text after it readable at the right positions', () => {
    const content = { type: 'doc', content: [para(text('AB'), link('doc-9'), text('CD'))] };
    // doc opens at 0; paragraph enters at 1; 'AB' is 1..2; the link is 3; 'CD' is 4..5.
    expect(extractTextBetween(content as never, 4, 6)).toBe('CD');
  });

  it('contributes no characters of its own', () => {
    const content = { type: 'doc', content: [para(text('AB'), link('doc-9'), text('CD'))] };
    expect(extractTextBetween(content as never, 1, 6)).toBe('ABCD');
  });
});
