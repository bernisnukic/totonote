import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;
vi.mock('../connection', () => ({ getDb: () => testDb }));

import { listBacklinks } from './document-repo';
import { DOCUMENT_LINK_NODE } from '../../../shared/doc-links';

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

/** Section content that mentions each of `linkTo` once, with a word between. */
const contentLinking = (...linkTo: string[]) =>
  JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: linkTo.flatMap(id => [
          { type: 'text', text: 'see ' },
          { type: DOCUMENT_LINK_NODE, attrs: { documentId: id, label: 'somewhere' } },
        ]),
      },
    ],
  });

function seedDocument(id: string, title: string, sections: Array<{ id: string; title: string; content: string }>) {
  sqlite.prepare(`INSERT INTO documents (id, workspace_id, title) VALUES (?, 'ws-default', ?)`).run(id, title);
  for (const [i, s] of sections.entries()) {
    sqlite
      .prepare(
        `INSERT INTO sections (id, document_id, title, abbreviation, sort_order, content) VALUES (?,?,?,?,?,?)`,
      )
      .run(s.id, id, s.title, 'X', i, s.content);
  }
}

beforeEach(() => {
  const handles = createTestDb();
  testDb = handles.db;
  sqlite = handles.sqlite;
});

describe('what links here', () => {
  it('finds the document that links to this one', () => {
    seedDocument('gura', 'GURA', [{ id: 'g1', title: 'Main', content: '{}' }]);
    seedDocument('pekora', 'PEKORA', [{ id: 'p1', title: 'History', content: contentLinking('gura') }]);

    const links = listBacklinks('gura');
    expect(links).toHaveLength(1);
    expect(links[0].documentTitle).toBe('PEKORA');
    expect(links[0].count).toBe(1);
    expect(links[0].sections).toEqual([{ sectionId: 'p1', sectionTitle: 'History' }]);
  });

  it('counts every mention, across every section of the linking document', () => {
    seedDocument('gura', 'GURA', []);
    seedDocument('pekora', 'PEKORA', [
      { id: 'p1', title: 'History', content: contentLinking('gura', 'gura') },
      { id: 'p2', title: 'Abilities', content: contentLinking('gura') },
    ]);

    const links = listBacklinks('gura');
    expect(links).toHaveLength(1);
    expect(links[0].count).toBe(3);
    expect(links[0].sections.map(s => s.sectionTitle).sort()).toEqual(['Abilities', 'History']);
  });

  it('lists the document doing the most linking first', () => {
    seedDocument('gura', 'GURA', []);
    seedDocument('a', 'Aqua', [{ id: 'a1', title: 'S', content: contentLinking('gura') }]);
    seedDocument('b', 'Botan', [{ id: 'b1', title: 'S', content: contentLinking('gura', 'gura') }]);

    expect(listBacklinks('gura').map(l => l.documentTitle)).toEqual(['Botan', 'Aqua']);
  });

  it('ignores links to other documents', () => {
    seedDocument('gura', 'GURA', []);
    seedDocument('marine', 'MARINE', []);
    seedDocument('pekora', 'PEKORA', [{ id: 'p1', title: 'S', content: contentLinking('marine') }]);

    expect(listBacklinks('gura')).toEqual([]);
  });

  it('does not count a document linking to itself', () => {
    seedDocument('gura', 'GURA', [{ id: 'g1', title: 'S', content: contentLinking('gura') }]);
    expect(listBacklinks('gura')).toEqual([]);
  });

  it('finds nothing when nothing links here', () => {
    seedDocument('gura', 'GURA', [{ id: 'g1', title: 'S', content: '{}' }]);
    expect(listBacklinks('gura')).toEqual([]);
  });

  it('copes with sections that have no content yet', () => {
    seedDocument('gura', 'GURA', []);
    sqlite
      .prepare(`INSERT INTO documents (id, workspace_id, title) VALUES ('empty','ws-default','Empty')`)
      .run();
    sqlite
      .prepare(`INSERT INTO sections (id, document_id, title, abbreviation, sort_order) VALUES ('e1','empty','S','X',0)`)
      .run();
    expect(() => listBacklinks('gura')).not.toThrow();
  });
});
