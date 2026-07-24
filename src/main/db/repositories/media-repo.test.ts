import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { createMedia, getMediaBytes, getMediaMeta, mediaUsage, deleteUnusedMedia } from './media-repo';

const bytes = (...values: number[]) => new Uint8Array(values);

beforeEach(() => {
  const { db } = createTestDb();
  testDb = db;
});

describe('media-repo', () => {
  it('stores an image and returns its metadata without the bytes', () => {
    const meta = createMedia({ mimeType: 'image/webp', width: 800, height: 600, data: bytes(1, 2, 3, 4) });
    expect(meta.id).toMatch(/[0-9a-f-]{36}/);
    expect(meta.mimeType).toBe('image/webp');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
    expect(meta.byteSize).toBe(4);
    expect(meta).not.toHaveProperty('data');
  });

  it('reads the exact bytes back for the protocol handler', () => {
    const meta = createMedia({ mimeType: 'image/png', width: 2, height: 2, data: bytes(137, 80, 78, 71) });
    const found = getMediaBytes(meta.id);
    expect(found?.mimeType).toBe('image/png');
    expect([...(found?.data ?? [])]).toEqual([137, 80, 78, 71]);
  });

  it('returns null for an id that is not there, so the protocol can 404', () => {
    expect(getMediaBytes('missing')).toBeNull();
    expect(getMediaMeta('missing')).toBeNull();
  });

  it('gives each image its own id', () => {
    const a = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1) });
    const b = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1) });
    expect(a.id).not.toBe(b.id);
  });

  it('reads metadata without loading the bytes', () => {
    const meta = createMedia({ mimeType: 'image/webp', width: 320, height: 240, data: bytes(9, 9, 9) });
    expect(getMediaMeta(meta.id)).toEqual({
      id: meta.id,
      mimeType: 'image/webp',
      width: 320,
      height: 240,
      byteSize: 3,
    });
  });

  describe('usage', () => {
    it('is zero on an empty database', () => {
      expect(mediaUsage()).toEqual({ count: 0, totalBytes: 0 });
    });

    it('totals count and bytes', () => {
      createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1, 2, 3) });
      createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(4, 5) });
      expect(mediaUsage()).toEqual({ count: 2, totalBytes: 5 });
    });
  });

  describe('deleteUnusedMedia', () => {
    it('keeps images that are still referenced and removes the rest', () => {
      const kept = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1) });
      const orphan = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(2) });

      const removed = deleteUnusedMedia(new Set([kept.id]));

      expect(removed).toBe(1);
      expect(getMediaMeta(kept.id)).not.toBeNull();
      expect(getMediaMeta(orphan.id)).toBeNull();
    });

    it('removes nothing when everything is referenced', () => {
      const a = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1) });
      const b = createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(2) });
      expect(deleteUnusedMedia(new Set([a.id, b.id]))).toBe(0);
      expect(mediaUsage().count).toBe(2);
    });

    it('clears everything when nothing is referenced', () => {
      createMedia({ mimeType: 'image/png', width: 1, height: 1, data: bytes(1) });
      expect(deleteUnusedMedia(new Set())).toBe(1);
      expect(mediaUsage()).toEqual({ count: 0, totalBytes: 0 });
    });
  });
});
