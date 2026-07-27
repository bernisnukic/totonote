import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  noteDocumentSteps,
  recordAnnotationEdit,
  undoOne,
  redoOne,
  nextUndo,
  nextRedo,
  clearEditHistory,
  resetAllEditHistory,
  setReplaying,
} from './edit-history';

const S = 'section-1';

beforeEach(() => {
  resetAllEditHistory();
  setReplaying(false);
});

describe('one order for writing and tagging', () => {
  it('undoes the tag before the text it sits on', async () => {
    // The reported bug: typing then tagging then undo threw away both at once, because
    // undoing the typing took the words the highlight was on with it.
    noteDocumentSteps(S, 1); // typed
    const undo = vi.fn();
    recordAnnotationEdit(S, { label: 'tag', undo, redo: vi.fn() });

    expect(nextUndo(S)).toBe('annotation');
    expect(await undoOne(S)).toBe('annotation');
    expect(undo).toHaveBeenCalledOnce();

    // Only then does the text go.
    expect(nextUndo(S)).toBe('doc');
    expect(await undoOne(S)).toBe('doc');
    expect(nextUndo(S)).toBe('none');
  });

  it('redoes them back in the order they happened', async () => {
    noteDocumentSteps(S, 1);
    const redo = vi.fn();
    recordAnnotationEdit(S, { label: 'tag', undo: vi.fn(), redo });
    await undoOne(S);
    await undoOne(S);

    // Text first, then the tag that was applied to it.
    expect(await redoOne(S)).toBe('doc');
    expect(redo).not.toHaveBeenCalled();
    expect(await redoOne(S)).toBe('annotation');
    expect(redo).toHaveBeenCalledOnce();
  });

  it('groups a run of typing the way the editor does', async () => {
    // ProseMirror collapses continuous typing into one undoable step; the count comes
    // from its own depth, so we agree with it rather than counting keystrokes.
    noteDocumentSteps(S, 1);
    expect(await undoOne(S)).toBe('doc');
    expect(await undoOne(S)).toBe('none');
  });

  it('handles several tags in a row', async () => {
    const first = vi.fn();
    const second = vi.fn();
    recordAnnotationEdit(S, { label: 'tag-1', undo: first, redo: vi.fn() });
    recordAnnotationEdit(S, { label: 'tag-2', undo: second, redo: vi.fn() });

    await undoOne(S);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    await undoOne(S);
    expect(first).toHaveBeenCalledOnce();
  });

  it('drops the redo branch once you carry on writing', async () => {
    noteDocumentSteps(S, 1);
    recordAnnotationEdit(S, { label: 'tag', undo: vi.fn(), redo: vi.fn() });
    await undoOne(S);
    expect(nextRedo(S)).toBe('annotation');

    noteDocumentSteps(S, 1); // typed again
    expect(nextRedo(S)).toBe('none');
  });

  it('says there is nothing to undo when nothing has happened', async () => {
    expect(nextUndo(S)).toBe('none');
    expect(await undoOne(S)).toBe('none');
    expect(await redoOne(S)).toBe('none');
  });

  it('keeps sections apart', async () => {
    recordAnnotationEdit('a', { label: 'tag', undo: vi.fn(), redo: vi.fn() });
    expect(nextUndo('a')).toBe('annotation');
    expect(nextUndo('b')).toBe('none');
  });

  it('forgets a section when it is closed', async () => {
    recordAnnotationEdit(S, { label: 'tag', undo: vi.fn(), redo: vi.fn() });
    clearEditHistory(S);
    expect(nextUndo(S)).toBe('none');
  });

  it('takes a doc marker back off when the editor undid by another route', () => {
    noteDocumentSteps(S, 2);
    noteDocumentSteps(S, -1);
    expect(nextUndo(S)).toBe('doc');
    noteDocumentSteps(S, -1);
    expect(nextUndo(S)).toBe('none');
  });

  it('ignores the editor`s reply while we drive its own undo', async () => {
    // Our redo asks the editor to redo; that raises its undo depth exactly as typing
    // does, and recording it would clear the redo branch and lose the tagging step
    // still waiting in it — which is what happened.
    noteDocumentSteps(S, 1);
    const redo = vi.fn();
    recordAnnotationEdit(S, { label: 'tag', undo: vi.fn(), redo });
    await undoOne(S);
    await undoOne(S);

    expect(await redoOne(S)).toBe('doc');
    setReplaying(true);
    noteDocumentSteps(S, 1); // the editor replying to our redo
    setReplaying(false);

    expect(await redoOne(S)).toBe('annotation');
    expect(redo).toHaveBeenCalledOnce();
  });

  it('never lets a stray depth change eat a tagging step', () => {
    // A tagging entry on top means the depth moved for some other reason; dropping it
    // would silently lose the ability to undo the tag.
    recordAnnotationEdit(S, { label: 'tag', undo: vi.fn(), redo: vi.fn() });
    noteDocumentSteps(S, -1);
    expect(nextUndo(S)).toBe('annotation');
  });
});
