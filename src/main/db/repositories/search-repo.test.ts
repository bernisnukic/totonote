import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import {
  ensureSearchIndex,
  isSearchIndexEmpty,
  indexSection,
  removeSectionFromIndex,
  rebuildSearchIndex,
  reindexSectionsUsingMedia,
  searchWriting,
  toMatchQuery,
} from './search-repo';

/** A TipTap document with one paragraph per line of text. */
const doc = (...lines: string[]) =>
  JSON.stringify({
    type: 'doc',
    content: lines.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  });

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

function seed(sections: Array<{ id: string; title: string; content: string }>) {
  sqlite.exec(`INSERT INTO documents (id, workspace_id, title) VALUES ('doc-1', 'ws-default', 'Hololore')`);
  for (const [i, s] of sections.entries()) {
    sqlite
      .prepare(
        `INSERT INTO sections (id, document_id, title, abbreviation, sort_order, content)
         VALUES (?, 'doc-1', ?, 'X', ?, ?)`,
      )
      .run(s.id, s.title, i, s.content);
  }
}

beforeEach(() => {
  const handles = createTestDb();
  testDb = handles.db;
  sqlite = handles.sqlite;
  ensureSearchIndex();
});

describe('toMatchQuery', () => {
  it('quotes each word and prefix-matches the last, so results narrow as you type', () => {
    expect(toMatchQuery('dragon lai')).toBe('"dragon" AND "lai"*');
  });

  it('is empty for input with nothing searchable in it', () => {
    expect(toMatchQuery('')).toBe('');
    expect(toMatchQuery('   ')).toBe('');
    expect(toMatchQuery('!!! ???')).toBe('');
  });

  it('neutralises characters that would otherwise be query syntax', () => {
    // A stray quote or asterisk should search, not raise a syntax error.
    expect(toMatchQuery('mc"kraken*')).toBe('"mc" AND "kraken"*');
  });
});

describe('the index', () => {
  it('starts empty and reports so', () => {
    expect(isSearchIndexEmpty()).toBe(true);
  });

  it('finds a word from a section body', () => {
    seed([{ id: 's1', title: 'Ancient Age', content: doc('Gura arrived from the deep.') }]);
    indexSection('s1');

    const hits = searchWriting('deep');
    expect(hits).toHaveLength(1);
    expect(hits[0].sectionId).toBe('s1');
    expect(hits[0].documentTitle).toBe('Hololore');
    expect(hits[0].sectionTitle).toBe('Ancient Age');
    expect(hits[0].snippet).toContain('[deep]');
  });

  it('matches a partial word as you type', () => {
    seed([{ id: 's1', title: 'A', content: doc('The ancient temple stood alone.') }]);
    indexSection('s1');
    expect(searchWriting('temp')).toHaveLength(1);
  });

  it('requires every word, not any of them', () => {
    seed([
      { id: 's1', title: 'A', content: doc('the dragon sleeps') },
      { id: 's2', title: 'B', content: doc('the dragon guards a hoard') },
    ]);
    indexSection('s1');
    indexSection('s2');
    expect(searchWriting('dragon hoard').map(h => h.sectionId)).toEqual(['s2']);
  });

  it('finds nothing for a word that was never written', () => {
    seed([{ id: 's1', title: 'A', content: doc('nothing relevant here') }]);
    indexSection('s1');
    expect(searchWriting('pekora')).toEqual([]);
  });

  it('re-indexing replaces the old text rather than adding to it', () => {
    seed([{ id: 's1', title: 'A', content: doc('original wording') }]);
    indexSection('s1');
    sqlite.prepare(`UPDATE sections SET content = ? WHERE id = 's1'`).run(doc('replacement wording'));
    indexSection('s1');

    expect(searchWriting('original')).toEqual([]);
    expect(searchWriting('replacement')).toHaveLength(1);
  });

  it('drops a deleted section from results', () => {
    seed([{ id: 's1', title: 'A', content: doc('findable text') }]);
    indexSection('s1');
    removeSectionFromIndex('s1');
    expect(searchWriting('findable')).toEqual([]);
  });

  it('rebuilds the whole index from the sections table', () => {
    seed([
      { id: 's1', title: 'A', content: doc('first section') },
      { id: 's2', title: 'B', content: doc('second section') },
    ]);
    rebuildSearchIndex();
    expect(searchWriting('first')).toHaveLength(1);
    expect(searchWriting('second')).toHaveLength(1);
    expect(isSearchIndexEmpty()).toBe(false);
  });

  it('scopes results to a workspace when asked', () => {
    seed([{ id: 's1', title: 'A', content: doc('shared word') }]);
    indexSection('s1');
    expect(searchWriting('shared', 'ws-default')).toHaveLength(1);
    expect(searchWriting('shared', 'ws-other')).toEqual([]);
  });

  it('ignores an unparsable query instead of throwing', () => {
    seed([{ id: 's1', title: 'A', content: doc('text') }]);
    indexSection('s1');
    expect(() => searchWriting('"""')).not.toThrow();
  });
});

describe('text read out of images', () => {
  function seedImage(id: string, ocr: string | null) {
    sqlite
      .prepare(`INSERT INTO media (id, mime_type, width, height, byte_size, ocr_text, data) VALUES (?,?,?,?,?,?,?)`)
      .run(id, 'image/png', 10, 10, 3, ocr, Buffer.from([1, 2, 3]));
  }

  const withImage = (mediaId: string, text: string) =>
    JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text }] },
        { type: 'image', attrs: { src: `totonote://media/${mediaId}` } },
      ],
    });

  it('finds a word that only exists inside a picture', () => {
    // The whole point: a label on a map should be findable from the search box.
    seedImage('m1', 'FROZEN SEA');
    seed([{ id: 's1', title: 'Maps', content: withImage('m1', 'The northern chart.') }]);
    indexSection('s1');

    expect(searchWriting('frozen').map(h => h.sectionId)).toEqual(['s1']);
  });

  it('copes with an image that has not been read yet', () => {
    seedImage('m1', null);
    seed([{ id: 's1', title: 'Maps', content: withImage('m1', 'chart') }]);
    expect(() => indexSection('s1')).not.toThrow();
    expect(searchWriting('chart')).toHaveLength(1);
  });

  it('picks up the image text once it arrives', () => {
    seedImage('m1', null);
    seed([{ id: 's1', title: 'Maps', content: withImage('m1', 'chart') }]);
    indexSection('s1');
    expect(searchWriting('harbour')).toEqual([]);

    sqlite.prepare(`UPDATE media SET ocr_text = 'HARBOUR TOWN' WHERE id = 'm1'`).run();
    reindexSectionsUsingMedia('m1');

    expect(searchWriting('harbour').map(h => h.sectionId)).toEqual(['s1']);
  });
});
