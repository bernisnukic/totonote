import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test-helpers';

let testDb: TestDb;

vi.mock('../connection', () => ({
  getDb: () => testDb,
}));

import { listDocuments, getDocument, createDocument, updateDocument, deleteDocument } from './document-repo';

function initTestDb() {
  ({ db: testDb } = createTestDb());
}

describe('document-repo', () => {
  beforeEach(() => {
    initTestDb();
  });

  describe('createDocument', () => {
    it('creates a document and returns it', () => {
      const doc = createDocument({ title: 'Test Doc' });
      expect(doc.title).toBe('Test Doc');
      expect(doc.id).toBeTruthy();
      expect(doc.description).toBe('');
      expect(doc.sectionLabel).toBe('Section');
    });

    it('creates with description and sectionLabel', () => {
      const doc = createDocument({
        title: 'Lore',
        description: 'My lore notes',
        sectionLabel: 'Time Period',
      });
      expect(doc.description).toBe('My lore notes');
      expect(doc.sectionLabel).toBe('Time Period');
    });
  });

  describe('getDocument', () => {
    it('returns null for nonexistent id', () => {
      expect(getDocument('fake-id')).toBeNull();
    });

    it('returns the document by id', () => {
      const created = createDocument({ title: 'Find Me' });
      const found = getDocument(created.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe('Find Me');
    });
  });

  describe('listDocuments', () => {
    it('returns empty array when no documents', () => {
      expect(listDocuments()).toEqual([]);
    });

    it('returns all documents', () => {
      createDocument({ title: 'Doc A' });
      createDocument({ title: 'Doc B' });
      const docs = listDocuments();
      expect(docs.length).toBe(2);
    });
  });

  describe('updateDocument', () => {
    it('updates title', () => {
      const doc = createDocument({ title: 'Old Title' });
      const updated = updateDocument({ id: doc.id, title: 'New Title' });
      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('');
    });

    it('updates only provided fields', () => {
      const doc = createDocument({ title: 'Title', description: 'Desc' });
      const updated = updateDocument({ id: doc.id, description: 'New Desc' });
      expect(updated.title).toBe('Title');
      expect(updated.description).toBe('New Desc');
    });

    it('throws for nonexistent document', () => {
      expect(() => updateDocument({ id: 'fake', title: 'X' })).toThrow('Document not found');
    });
  });

  describe('deleteDocument', () => {
    it('deletes a document', () => {
      const doc = createDocument({ title: 'Delete Me' });
      deleteDocument(doc.id);
      expect(getDocument(doc.id)).toBeNull();
    });

    it('does not throw for nonexistent id', () => {
      expect(() => deleteDocument('fake')).not.toThrow();
    });
  });
});
