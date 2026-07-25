import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;
let sqlite: ReturnType<typeof createTestDb>['sqlite'];

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { createDrawing, getDrawing, saveDrawing, deleteDrawing, deleteUnusedDrawings } from './drawing-repo';
import { createMedia } from './media-repo';

beforeEach(() => {
  const handles = createTestDb();
  testDb = handles.db;
  sqlite = handles.sqlite;
});

describe('drawing-repo', () => {
  it('creates a blank drawing', () => {
    const record = createDrawing({});
    expect(record.id).toMatch(/[0-9a-f-]{36}/);
    expect(record.strokes).toBe('');
    expect(record.backgroundMediaId).toBeNull();
    expect(record.aspectRatio).toBe(1.5);
  });

  it('creates a drawing over an image, at that image’s shape', () => {
    const image = createMedia({ mimeType: 'image/png', width: 1600, height: 900, data: new Uint8Array([1]) });
    const record = createDrawing({ backgroundMediaId: image.id, aspectRatio: 16 / 9 });
    expect(record.backgroundMediaId).toBe(image.id);
    expect(record.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('returns null for an unknown id', () => {
    expect(getDrawing('missing')).toBeNull();
  });

  it('saves strokes and reads them back unchanged', () => {
    const record = createDrawing({});
    const strokes = JSON.stringify({ version: 1, strokes: [{ id: 's1', points: [{ x: 0, y: 0, p: 1 }] }] });
    saveDrawing({ id: record.id, strokes });
    expect(getDrawing(record.id)?.strokes).toBe(strokes);
  });

  it('overwrites on each save rather than accumulating rows', () => {
    // The id in the document stays put while the strokes underneath are replaced — the
    // opposite of media, which is written once and never changes.
    const record = createDrawing({});
    saveDrawing({ id: record.id, strokes: 'first' });
    saveDrawing({ id: record.id, strokes: 'second' });
    expect(getDrawing(record.id)?.strokes).toBe('second');
  });

  it('saving a drawing that has since been deleted is a no-op, not a crash', () => {
    const record = createDrawing({});
    deleteDrawing(record.id);
    expect(saveDrawing({ id: record.id, strokes: 'x' })).toBeNull();
  });

  it('deleting the background image unfiles it rather than destroying the strokes', () => {
    // ON DELETE SET NULL: losing the map you annotated must not lose the annotations.
    const image = createMedia({ mimeType: 'image/png', width: 10, height: 10, data: new Uint8Array([1]) });
    const record = createDrawing({ backgroundMediaId: image.id });
    saveDrawing({ id: record.id, strokes: 'kept' });

    sqlite.exec(`DELETE FROM media WHERE id = '${image.id}'`);

    const after = getDrawing(record.id);
    expect(after).not.toBeNull();
    expect(after?.strokes).toBe('kept');
    expect(after?.backgroundMediaId).toBeNull();
  });

  describe('deleteUnusedDrawings', () => {
    it('keeps referenced drawings and removes the rest', () => {
      const kept = createDrawing({});
      const orphan = createDrawing({});
      expect(deleteUnusedDrawings(new Set([kept.id]))).toBe(1);
      expect(getDrawing(kept.id)).not.toBeNull();
      expect(getDrawing(orphan.id)).toBeNull();
    });

    it('removes nothing when everything is referenced', () => {
      const a = createDrawing({});
      const b = createDrawing({});
      expect(deleteUnusedDrawings(new Set([a.id, b.id]))).toBe(0);
    });
  });
});
