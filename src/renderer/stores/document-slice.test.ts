// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './index';
import { registerFlusher, unregisterFlusher } from '../lib/save-registry';
import type { Section } from '../../shared/domain-types';

/**
 * Store-level tests for document teardown.
 *
 * These cover the paths that unmount the section editors — going Back, switching document,
 * deleting — where anything not persisted first is gone for good. That is exactly where a
 * data-loss bug lived: leaving a document in manual-save mode used to drop unsaved edits.
 */

type InvokeFn = (channel: string, args?: unknown) => Promise<unknown>;

/** Records every channel called, and answers with sensible stubs. */
function mockApi(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ channel: string; args?: unknown }> = [];
  const invoke: InvokeFn = (channel, args) => {
    calls.push({ channel, args });
    if (channel in overrides) return Promise.resolve(overrides[channel]);
    switch (channel) {
      case 'section:update':
        return Promise.resolve({ id: (args as { id: string }).id });
      case 'document:delete':
      case 'section:delete':
        return Promise.resolve({ kind: 'section', label: 'X', rows: {} });
      default:
        return Promise.resolve(undefined);
    }
  };
  (window as unknown as { api: { invoke: InvokeFn } }).api = { invoke };
  return calls;
}

const section = (id: string, sortOrder = 0): Section => ({
  id,
  documentId: 'doc-1',
  title: `Section ${id}`,
  abbreviation: id.toUpperCase(),
  sortOrder,
  content: JSON.stringify({ type: 'doc', content: [] }),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** Put the store into "a document with two sections is open" state. */
function openTwoSectionDocument() {
  useStore.setState({
    activeDocumentId: 'doc-1',
    activeDocument: {
      workspaceId: 'ws-1',
      id: 'doc-1',
      title: 'Doc One',
      description: '',
      sectionLabel: 'Section',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    sections: [section('s1', 0), section('s2', 1)],
    activeSectionId: 's1',
    dirtySectionIds: [],
    documentAnnotations: [],
    sectionTags: [],
    historyBySection: {},
    currentSnapshotId: {},
  });
}

beforeEach(() => {
  mockApi();
  openTwoSectionDocument();
  unregisterFlusher('s1');
  unregisterFlusher('s2');
});

describe('dirty tracking', () => {
  it('marks a section dirty once, not repeatedly', () => {
    useStore.getState().markSectionDirty('s1');
    useStore.getState().markSectionDirty('s1');
    expect(useStore.getState().dirtySectionIds).toEqual(['s1']);
  });

  it('saveAllDirty runs each registered flusher and clears the list', async () => {
    const flushed: string[] = [];
    registerFlusher('s1', () => {
      flushed.push('s1');
    });
    registerFlusher('s2', () => {
      flushed.push('s2');
    });
    useStore.getState().markSectionDirty('s1');
    useStore.getState().markSectionDirty('s2');

    await useStore.getState().saveAllDirty();

    expect(flushed.sort()).toEqual(['s1', 's2']);
    expect(useStore.getState().dirtySectionIds).toEqual([]);
  });

  it('saveAllDirty waits for an async flusher to finish', async () => {
    let settled = false;
    registerFlusher('s1', async () => {
      await new Promise(r => setTimeout(r, 10));
      settled = true;
    });
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().saveAllDirty();

    expect(settled).toBe(true);
  });
});

describe('leaving a document', () => {
  it('flushes unsaved sections BEFORE clearing state (regression: work was lost)', async () => {
    // The flusher only works while the editor is mounted, so it must be called before
    // closeDocument tears the sections down.
    let sectionsAtFlushTime = -1;
    registerFlusher('s1', () => {
      sectionsAtFlushTime = useStore.getState().sections.length;
    });
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().closeDocument();

    expect(sectionsAtFlushTime).toBe(2); // editors still there when we flushed
    expect(useStore.getState().dirtySectionIds).toEqual([]);
    expect(useStore.getState().activeDocumentId).toBeNull();
    expect(useStore.getState().sections).toEqual([]);
  });

  it('drops the session history for the document it closes', async () => {
    useStore.getState().pushSnapshot('s1', JSON.stringify({ type: 'doc', content: [] }));
    useStore.getState().pushSnapshot('s2', JSON.stringify({ type: 'doc', content: [] }));
    expect(Object.keys(useStore.getState().historyBySection)).toHaveLength(2);

    await useStore.getState().closeDocument();

    // Otherwise every section visited keeps its snapshots for the whole session.
    expect(useStore.getState().historyBySection).toEqual({});
    expect(useStore.getState().currentSnapshotId).toEqual({});
  });

  it('switching to another document flushes the one being left', async () => {
    mockApi({
      'document:get': { id: 'doc-2', title: 'Doc Two', sectionLabel: 'Section' },
      'section:list': [],
    });
    let flushed = false;
    registerFlusher('s1', () => {
      flushed = true;
    });
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().openDocument('doc-2');

    expect(flushed).toBe(true);
    expect(useStore.getState().activeDocumentId).toBe('doc-2');
    expect(useStore.getState().dirtySectionIds).toEqual([]);
  });

  it('reopening the SAME document does not flush or reset anything', async () => {
    mockApi({ 'document:get': { id: 'doc-1' }, 'section:list': [section('s1')] });
    const flush = vi.fn();
    registerFlusher('s1', flush);
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().openDocument('doc-1');

    expect(flush).not.toHaveBeenCalled();
  });
});

describe('switching workspace', () => {
  it('flushes the open document before tearing it down', async () => {
    // Changing world unmounts the editors just as surely as pressing Back does.
    mockApi({ 'workspace:list': [], 'document:list': [], 'category:list': [], 'tag:list': [], 'category:rule-list': [] });
    useStore.setState({ activeWorkspaceId: 'ws-1' });
    let flushed = false;
    registerFlusher('s1', () => {
      flushed = true;
    });
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().setActiveWorkspace('ws-2');

    expect(flushed).toBe(true);
    expect(useStore.getState().dirtySectionIds).toEqual([]);
    expect(useStore.getState().activeDocumentId).toBeNull();
  });

  it('does nothing when the workspace is already active', async () => {
    useStore.setState({ activeWorkspaceId: 'ws-1' });
    const flush = vi.fn();
    registerFlusher('s1', flush);
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().setActiveWorkspace('ws-1');

    expect(flush).not.toHaveBeenCalled();
    expect(useStore.getState().activeDocumentId).toBe('doc-1');
  });
});

describe('deleting', () => {
  it('deleteSection forgets its annotations, section tags, dirty flag and history', async () => {
    useStore.setState({
      documentAnnotations: [
        { id: 'a1', sectionId: 's1', tagId: 't1', fromPos: 0, toPos: 5, note: '', categoryId: null, placementOrder: 0, whenText: '', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'a2', sectionId: 's2', tagId: 't1', fromPos: 0, toPos: 5, note: '', categoryId: null, placementOrder: 0, whenText: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      sectionTags: [
        { sectionId: 's1', tagId: 't9', createdAt: '2026-01-01T00:00:00.000Z' },
        { sectionId: 's2', tagId: 't9', createdAt: '2026-01-01T00:00:00.000Z' },
      ] as never,
    });
    useStore.getState().markSectionDirty('s1');
    useStore.getState().pushSnapshot('s1', JSON.stringify({ type: 'doc', content: [] }));

    await useStore.getState().deleteSection('s1');

    // Stale annotations here are what made tag usage counts keep counting a deleted section.
    expect(useStore.getState().documentAnnotations.map(a => a.id)).toEqual(['a2']);
    expect(useStore.getState().sectionTags.map(st => st.sectionId)).toEqual(['s2']);
    expect(useStore.getState().dirtySectionIds).toEqual([]);
    expect(useStore.getState().historyBySection['s1']).toBeUndefined();
    expect(useStore.getState().sections.map(s => s.id)).toEqual(['s2']);
  });

  it('deleteSection moves the active section to one that still exists', async () => {
    await useStore.getState().deleteSection('s1');
    expect(useStore.getState().activeSectionId).toBe('s2');
  });

  it('deleting the open document clears its dirty flags and history', async () => {
    useStore.setState({ documents: [{ id: 'doc-1' }] as never });
    useStore.getState().markSectionDirty('s1');
    useStore.getState().pushSnapshot('s1', JSON.stringify({ type: 'doc', content: [] }));

    await useStore.getState().deleteDocument('doc-1');

    // A deleted document must not leave the app believing it has unsaved work.
    expect(useStore.getState().dirtySectionIds).toEqual([]);
    expect(useStore.getState().historyBySection).toEqual({});
    expect(useStore.getState().activeDocumentId).toBeNull();
    expect(useStore.getState().sections).toEqual([]);
  });

  it('deleting a different document leaves the open one alone', async () => {
    useStore.setState({ documents: [{ id: 'doc-1' }, { id: 'doc-2' }] as never });
    useStore.getState().markSectionDirty('s1');

    await useStore.getState().deleteDocument('doc-2');

    expect(useStore.getState().activeDocumentId).toBe('doc-1');
    expect(useStore.getState().sections).toHaveLength(2);
    expect(useStore.getState().dirtySectionIds).toEqual(['s1']);
  });
});
