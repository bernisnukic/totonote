import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;
vi.mock('../connection', () => ({ getDb: () => testDb }));

import { listTimeline } from './annotation-repo';

let sqlite: ReturnType<typeof createTestDb>['sqlite'];

const doc = (text: string) =>
  JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

function seed(opts: { workspaceId?: string } = {}) {
  const ws = opts.workspaceId ?? 'ws-default';
  if (ws !== 'ws-default') sqlite.prepare(`INSERT INTO workspaces (id, name, sort_order) VALUES (?, ?, 2)`).run(ws, ws);
  sqlite.prepare(`INSERT INTO categories (id, workspace_id, name, sort_order) VALUES (?, ?, 'Events', 1)`)
    .run(`cat-${ws}`, ws);
  sqlite.prepare(`INSERT INTO tags (id, category_id, name, color) VALUES (?, ?, 'Event', '#48dbfb')`)
    .run(`tag-${ws}`, `cat-${ws}`);
  sqlite.prepare(`INSERT INTO documents (id, workspace_id, title) VALUES (?, ?, 'Chronicle')`)
    .run(`doc-${ws}`, ws);
  sqlite
    .prepare(`INSERT INTO sections (id, document_id, title, abbreviation, sort_order, content) VALUES (?,?,?,?,?,?)`)
    .run(`sec-${ws}`, `doc-${ws}`, 'Main', 'M', 0, doc('THE FLOOD CAME AND THE CITY FELL'));
  return { ws, tagId: `tag-${ws}`, sectionId: `sec-${ws}` };
}

function annotate(id: string, sectionId: string, tagId: string, from: number, to: number, when: string) {
  sqlite
    .prepare(
      `INSERT INTO annotations (id, section_id, tag_id, from_pos, to_pos, note, placement_order, when_text, created_at)
       VALUES (?,?,?,?,?,'',0,?,'2026-01-01T00:00:00.000Z')`,
    )
    .run(id, sectionId, tagId, from, to, when);
}

beforeEach(() => {
  const handles = createTestDb();
  testDb = handles.db;
  sqlite = handles.sqlite;
});

describe('the dated excerpts', () => {
  it('returns one that has been given a when, with its text', () => {
    const { sectionId, tagId } = seed();
    annotate('a1', sectionId, tagId, 1, 15, 'Year 300');

    const events = listTimeline();
    expect(events).toHaveLength(1);
    expect(events[0].whenText).toBe('Year 300');
    expect(events[0].excerpt).toBe('THE FLOOD CAME');
    expect(events[0].documentTitle).toBe('Chronicle');
    expect(events[0].sectionTitle).toBe('Main');
    expect(events[0].tagName).toBe('Event');
  });

  it('leaves out highlights with no when — the timeline is opt-in', () => {
    const { sectionId, tagId } = seed();
    annotate('dated', sectionId, tagId, 1, 15, 'Year 300');
    annotate('undated', sectionId, tagId, 16, 20, '');

    expect(listTimeline().map(e => e.id)).toEqual(['dated']);
  });

  it('keeps a when that has no number in it, rather than dropping the event', () => {
    // The renderer files these under "Undated"; losing them here would lose the excerpt.
    const { sectionId, tagId } = seed();
    annotate('a1', sectionId, tagId, 1, 15, 'long before the founding');
    expect(listTimeline().map(e => e.whenText)).toEqual(['long before the founding']);
  });

  it('stays inside one workspace when asked', () => {
    const here = seed();
    const elsewhere = seed({ workspaceId: 'ws-other' });
    annotate('mine', here.sectionId, here.tagId, 1, 15, 'Year 1');
    annotate('theirs', elsewhere.sectionId, elsewhere.tagId, 1, 15, 'Year 1');

    expect(listTimeline('ws-default').map(e => e.id)).toEqual(['mine']);
    expect(listTimeline().map(e => e.id).sort()).toEqual(['mine', 'theirs']);
  });

  it('is empty when nothing has been dated', () => {
    seed();
    expect(listTimeline()).toEqual([]);
  });
});
