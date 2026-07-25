import { describe, it, expect } from 'vitest';
import { pageToMarkdown, excerptToMarkdown, pageFilename } from './page-markdown';
import type { AnnotationPlacement, Category } from './domain-types';

const placement = (over: Partial<AnnotationPlacement> = {}): AnnotationPlacement => ({
  id: 'a1',
  tagId: 't1',
  tagName: 'Gura',
  tagColor: '#48dbfb',
  categoryId: 'c1',
  placementOrder: 0,
  fromPos: 0,
  toPos: 10,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  sectionId: 's1',
  sectionTitle: 'Ancient Age',
  sectionSortOrder: 0,
  documentId: 'd1',
  documentTitle: 'Hololore',
  excerpt: 'Gura arrived from the deep.',
  imageIds: [],
  drawingIds: [],
  ...over,
});

const category = (name: string): Category => ({
  id: name.toLowerCase(),
  workspaceId: 'ws-1',
  name,
  parentId: null,
  sortOrder: 0,
});

describe('excerptToMarkdown', () => {
  it('quotes the excerpt and credits where it came from', () => {
    const md = excerptToMarkdown(placement());
    expect(md).toContain('> Gura arrived from the deep.');
    expect(md).toContain('— Gura · Hololore › Ancient Age');
  });

  it('quotes every line of a multi-line excerpt', () => {
    const md = excerptToMarkdown(placement({ excerpt: 'first line\nsecond line' }));
    expect(md).toContain('> first line');
    expect(md).toContain('> second line');
  });

  it('includes a note when there is one', () => {
    expect(excerptToMarkdown(placement({ note: 'first mention' }))).toContain('**Note:** first mention');
  });

  it('says what a picture was, since it cannot travel in a text file', () => {
    const md = excerptToMarkdown(placement({ excerpt: '', imageIds: ['m1'], drawingIds: ['d1'] }));
    expect(md).toContain('1 image(s)');
    expect(md).toContain('1 drawing(s)');
    expect(md).not.toContain('> *[empty]*');
  });

  it('marks a genuinely empty excerpt rather than emitting a bare quote', () => {
    expect(excerptToMarkdown(placement({ excerpt: '' }))).toContain('*[empty]*');
  });
});

describe('pageToMarkdown', () => {
  it('titles the page and lists its excerpts', () => {
    const md = pageToMarkdown({ title: 'GURA', placements: [placement()] });
    expect(md.startsWith('# GURA')).toBe(true);
    expect(md).toContain('Gura arrived from the deep.');
  });

  it('shows the trail of parent pages', () => {
    const md = pageToMarkdown({ title: 'HISTORY', breadcrumb: ['CHARACTERS', 'GURA'], placements: [] });
    expect(md).toContain('*CHARACTERS › GURA › HISTORY*');
  });

  it('gives each child page its own heading', () => {
    const md = pageToMarkdown({
      title: 'GURA',
      placements: [],
      children: [{ category: category('HISTORY'), placements: [placement()] }],
    });
    expect(md).toContain('## HISTORY');
  });

  it('leaves out child pages that have nothing filed', () => {
    const md = pageToMarkdown({
      title: 'GURA',
      placements: [placement()],
      children: [{ category: category('EMPTY'), placements: [] }],
    });
    expect(md).not.toContain('## EMPTY');
  });

  it('says so when the whole page is empty', () => {
    expect(pageToMarkdown({ title: 'NEW', placements: [] })).toContain('*Nothing filed here yet.*');
  });

  it('ends with exactly one newline', () => {
    const md = pageToMarkdown({ title: 'GURA', placements: [placement()] });
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});

describe('pageFilename', () => {
  it('uses the page name', () => {
    expect(pageFilename('GURA')).toBe('GURA.md');
  });

  it('replaces characters that are illegal in a filename', () => {
    expect(pageFilename('Gura / Shark: "the deep"')).toBe('Gura-Shark-the-deep.md');
  });

  it('collapses spaces to single dashes', () => {
    expect(pageFilename('Ancient   Age')).toBe('Ancient-Age.md');
  });

  it('falls back rather than producing a nameless file', () => {
    expect(pageFilename('///')).toBe('page.md');
    expect(pageFilename('')).toBe('page.md');
  });

  it('keeps the name to a sensible length', () => {
    expect(pageFilename('x'.repeat(200)).length).toBeLessThanOrEqual(63);
  });
});
