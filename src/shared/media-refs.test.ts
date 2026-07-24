import { describe, it, expect } from 'vitest';
import { mediaUrl, mediaIdFromUrl, mediaIdsInContent, MEDIA_URL_PREFIX } from './media-refs';

describe('media urls', () => {
  it('round-trips an id', () => {
    const id = '4f1c9c4e-7b0a-4a11-9d3e-0f1b2c3d4e5f';
    expect(mediaIdFromUrl(mediaUrl(id))).toBe(id);
  });

  it('builds the documented prefix', () => {
    expect(mediaUrl('abc')).toBe(`${MEDIA_URL_PREFIX}abc`);
    expect(MEDIA_URL_PREFIX).toBe('totonote://media/');
  });

  it('rejects urls that are not media references', () => {
    expect(mediaIdFromUrl('https://example.com/cat.png')).toBeNull();
    expect(mediaIdFromUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(mediaIdFromUrl('totonote://other/abc')).toBeNull();
    expect(mediaIdFromUrl(MEDIA_URL_PREFIX)).toBeNull();
  });

  it('stops the id at a query, fragment or extra path', () => {
    expect(mediaIdFromUrl(`${MEDIA_URL_PREFIX}abc?v=2`)).toBe('abc');
    expect(mediaIdFromUrl(`${MEDIA_URL_PREFIX}abc#top`)).toBe('abc');
    expect(mediaIdFromUrl(`${MEDIA_URL_PREFIX}abc/extra`)).toBe('abc');
  });
});

describe('mediaIdsInContent', () => {
  const doc = (...srcs: string[]) =>
    JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Gura arrived from the deep.' }] },
        ...srcs.map(src => ({ type: 'image', attrs: { src } })),
      ],
    });

  it('finds nothing in content with no images', () => {
    expect(mediaIdsInContent(doc())).toEqual([]);
    expect(mediaIdsInContent('')).toEqual([]);
  });

  it('finds a single referenced image', () => {
    expect(mediaIdsInContent(doc(mediaUrl('one')))).toEqual(['one']);
  });

  it('finds several, deduplicating a repeated image', () => {
    const ids = mediaIdsInContent(doc(mediaUrl('one'), mediaUrl('two'), mediaUrl('one')));
    expect(ids.sort()).toEqual(['one', 'two']);
  });

  it('ignores images that are not stored in the database', () => {
    expect(mediaIdsInContent(doc('https://example.com/remote.png'))).toEqual([]);
  });

  it('matches uuid-shaped ids', () => {
    const id = '4f1c9c4e-7b0a-4a11-9d3e-0f1b2c3d4e5f';
    expect(mediaIdsInContent(doc(mediaUrl(id)))).toEqual([id]);
  });

  it('finds a reference wherever it sits, not just on an image node', () => {
    // Deliberately not a tree walk: a future node type could carry a media url under a
    // different attribute, and purging must never miss one that is still in use.
    const nested = JSON.stringify({
      type: 'doc',
      content: [{ type: 'customBlock', attrs: { background: mediaUrl('deep') } }],
    });
    expect(mediaIdsInContent(nested)).toEqual(['deep']);
  });
});
